# Design: Implementación del Sistema RBAC Estandarizado

## Arquitectura de Roles

### Diagrama de Jerarquía
```
superadmin (bypass total)
    ↓
  admin (puede crear grupos + gestionar sus grupos)
    ↓
 student (rol por defecto, permisos básicos)
```

## 1. Capa de Datos (Prisma)

### Schema: `role.prisma`
```prisma
model role {
  id_role  Int      @id @default(autoincrement())
  name     String   @unique @db.VarChar  // DEBE ser único
  accesses access[]
  users    user[]
}
```

**Cambios requeridos**:
- Agregar constraint `@unique` al campo `name` para prevenir duplicados
- Validar que solo existan 3 registros: `"student"`, `"admin"`, `"superadmin"`

### Seeder: `prisma/seed.ts`
**Estrategia de implementación**:
```typescript
async function seedRoles() {
  const roles = ['student', 'admin', 'superadmin'];
  
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName }
    });
  }
}
```

**Lógica**:
- Usar `upsert` para idempotencia (puede ejecutarse múltiples veces sin duplicar)
- Eliminar lógica que crea el rol `"user"`
- Asegurar que los 3 roles existan antes de cualquier operación

## 2. Capa de Servicio (Backend)

### Asignación de Rol por Defecto

#### Ubicación: `src/users/users.service.ts` o `src/auth/auth.service.ts`

**Método de creación de usuario**:
```typescript
async createUser(userData: CreateUserDto) {
  // Buscar el rol "student" por nombre
  const studentRole = await this.prisma.role.findUnique({
    where: { name: 'student' }
  });
  
  if (!studentRole) {
    throw new Error('Rol "student" no encontrado en la base de datos');
  }
  
  // Crear usuario con rol student por defecto
  return this.prisma.user.create({
    data: {
      ...userData,
      id_role: studentRole.id_role  // Asignación explícita
    }
  });
}
```

**Puntos críticos**:
- Buscar el rol `"student"` por nombre (no hardcodear IDs)
- Validar que el rol existe antes de crear el usuario
- Aplicar en todos los flujos de registro (Google OAuth, Auth0, etc.)

### Lógica de Grupos

#### Ubicación: `src/groups/groups.service.ts`

**Creación de grupo**:
```typescript
async createGroup(userId: number, groupData: CreateGroupDto) {
  const user = await this.prisma.user.findUnique({
    where: { id_user: userId },
    include: { role: true }
  });
  
  // Validar que el usuario sea admin o superadmin
  if (!['admin', 'superadmin'].includes(user.role.name)) {
    throw new ForbiddenException('Solo usuarios con rol admin o superadmin pueden crear grupos');
  }
  
  // Crear grupo y asignar al creador como owner
  const group = await this.prisma.group.create({
    data: {
      ...groupData,
      id_owner: userId
    }
  });
  
  // Crear membership con is_admin = true
  await this.prisma.membership.create({
    data: {
      id_user: userId,
      id_group: group.id_group,
      is_admin: true,
      joined_at: new Date()
    }
  });
  
  return group;
}
```

#### Ubicación: `src/memberships/memberships.service.ts`

**Asignación de admin dentro de grupo**:
```typescript
async promoteToGroupAdmin(
  requesterId: number,
  groupId: number,
  targetUserId: number
) {
  // Verificar que el requester sea el owner del grupo O sea superadmin
  const requester = await this.prisma.user.findUnique({
    where: { id_user: requesterId },
    include: { role: true }
  });
  
  const group = await this.prisma.group.findUnique({
    where: { id_group: groupId }
  });
  
  const isSuperAdmin = requester.role.name === 'superadmin';
  const isGroupOwner = group.id_owner === requesterId;
  
  if (!isSuperAdmin && !isGroupOwner) {
    throw new ForbiddenException('Solo el creador del grupo o un superadmin pueden asignar administradores');
  }
  
  // Promover al usuario
  await this.prisma.membership.update({
    where: {
      id_user_id_group: {
        id_user: targetUserId,
        id_group: groupId
      }
    },
    data: { is_admin: true }
  });
}
```

## 3. Capa de Seguridad (Guards)

### Guard: `src/auth/guards/admin.guard.ts`

**Estrategia de bypass para superadmin**:
```typescript
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Superadmin tiene bypass total
    if (user?.role?.name === 'superadmin') {
      return true;
    }
    
    // Validar que sea admin
    return user?.role?.name === 'admin';
  }
}
```

### Guard: `src/auth/guards/permissions.guard.ts`

**Lógica de permisos con bypass**:
```typescript
@Injectable()
export class PermissionsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler()
    );
    
    // Superadmin bypasses all permission checks
    if (user?.role?.name === 'superadmin') {
      return true;
    }
    
    // Validar permisos específicos para otros roles
    return this.validatePermissions(user, requiredPermissions);
  }
}
```

### Guard de Grupo: `src/groups/guards/group-admin.guard.ts`

**Validación de administrador de grupo**:
```typescript
@Injectable()
export class GroupAdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const groupId = request.params.groupId;
    
    // Superadmin bypasses
    if (user?.role?.name === 'superadmin') {
      return true;
    }
    
    // Verificar membership con is_admin = true
    const membership = await this.prisma.membership.findUnique({
      where: {
        id_user_id_group: {
          id_user: user.id_user,
          id_group: parseInt(groupId)
        }
      }
    });
    
    return membership?.is_admin === true;
  }
}
```

## 4. Flujo de Autenticación

### Diagrama de Flujo
```
Usuario hace login (Google/Auth0)
    ↓
¿Usuario existe en BD?
    ↓ NO
Crear usuario con rol "student"
    ↓
Generar JWT con claims: { id_user, role: "student" }
    ↓
Retornar token al cliente
```

### Ubicación: `src/auth/auth.service.ts`

**Método de login/registro**:
```typescript
async handleGoogleLogin(googleUser: GoogleUserDto) {
  let user = await this.prisma.user.findUnique({
    where: { google_sub: googleUser.sub },
    include: { role: true }
  });
  
  if (!user) {
    // Usuario nuevo - asignar rol student
    const studentRole = await this.prisma.role.findUnique({
      where: { name: 'student' }
    });
    
    user = await this.prisma.user.create({
      data: {
        google_sub: googleUser.sub,
        email: googleUser.email,
        full_name: googleUser.name,
        picture: googleUser.picture,
        id_role: studentRole.id_role
      },
      include: { role: true }
    });
  }
  
  // Generar JWT con rol incluido
  return this.generateToken(user);
}
```

## 5. Consideraciones de Migración

### Migración de Datos Existentes
```sql
-- Actualizar usuarios con rol "user" a "student"
UPDATE "user" 
SET id_role = (SELECT id_role FROM role WHERE name = 'student')
WHERE id_role = (SELECT id_role FROM role WHERE name = 'user');

-- Eliminar rol legacy
DELETE FROM role WHERE name = 'user';
```

### Validación Post-Migración
- Verificar que no existan usuarios sin rol asignado
- Confirmar que todos los usuarios tienen uno de los 3 roles válidos
- Validar que no existan roles huérfanos en la tabla `role`

## 6. Testing

### Casos de Prueba Críticos
1. Usuario nuevo recibe rol `"student"` automáticamente
2. `admin` puede crear grupos
3. `student` NO puede crear grupos
4. `superadmin` puede acceder a cualquier endpoint sin restricciones
5. `admin` puede promover miembros en sus propios grupos
6. `admin` NO puede promover miembros en grupos de otros
7. Guards rechazan roles legacy (`"user"`, `"estudiante"`)

---

# Design: HU-09 - Sistema de Eventos con Restricción de Dominio por Carrera

## Arquitectura General

### Diagrama de Flujo de Permisos
```
┌─────────────────────────────────────────────────────────┐
│                    CREACIÓN DE EVENTOS                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  student ──────────────────────────► ❌ FORBIDDEN       │
│                                                          │
│  admin ──► Validar programId ──┬──► ✅ ALLOWED         │
│                                 │                        │
│                                 └──► ❌ FORBIDDEN       │
│                                      (si programId       │
│                                       no coincide)       │
│                                                          │
│  superadmin ────────────────────────► ✅ BYPASS         │
│                                                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    CONSULTA DE EVENTOS                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  student ──► Filtrar por programId ──► Solo su carrera │
│                                                          │
│  admin ───► Filtrar por programId ──► Solo su carrera  │
│                                                          │
│  superadmin ──────────────────────────► Todos los       │
│                                          eventos         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 1. Capa de Datos (Backend)

### 1.1 Modificación de Schema Prisma

#### Archivo: `prisma/schema/event.prisma`

**Cambios requeridos**:
```prisma
model event {
  id          String    @id @default(uuid())
  title       String
  description String
  date        DateTime
  time        String
  location    String
  type        EventType
  created_by  Int
  program_id  Int       // ⭐ NUEVO CAMPO
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  creator     user      @relation(fields: [created_by], references: [id_user])
  program     program   @relation(fields: [program_id], references: [id_program]) // ⭐ NUEVA RELACIÓN
  
  @@index([date])
  @@index([type])
  @@index([program_id])  // ⭐ NUEVO ÍNDICE para queries eficientes
  @@index([date, type])
  @@index([created_by])
  @@map("events")
}
```

**Justificación técnica**:
- `program_id Int`: Campo obligatorio para garantizar que todo evento pertenezca a una carrera
- Índice en `program_id`: Optimiza las queries de filtrado por carrera (operación más frecuente)
- Relación con `program`: Permite joins eficientes y validación de integridad referencial

#### Archivo: `prisma/schema/program.prisma`

**Cambios requeridos**:
```prisma
model program {
  id_program Int      @id @default(autoincrement())
  name       String?  @db.VarChar
  courses    course[]
  users      user[]
  events     event[]  // ⭐ NUEVA RELACIÓN INVERSA
}
```

### 1.2 Migración de Prisma

**Comando a ejecutar**:
```bash
npx prisma migrate dev --name add_program_to_events
```

**Contenido esperado de la migración**:
```sql
-- AlterTable
ALTER TABLE "events" ADD COLUMN "program_id" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "events_program_id_idx" ON "events"("program_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_program_id_fkey" 
  FOREIGN KEY ("program_id") REFERENCES "program"("id_program") 
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

**Consideración**: Si ya existen eventos en la BD, la migración fallará porque `program_id` es NOT NULL. Soluciones:
1. Hacer el campo nullable temporalmente y luego actualizarlo
2. Eliminar eventos existentes antes de migrar (si es entorno de desarrollo)
3. Asignar un `program_id` por defecto en la migración

## 2. Capa de Servicio (Backend)

### 2.1 DTOs

#### Archivo: `src/events/dto/create-event.dto.ts`

```typescript
import { IsString, IsNotEmpty, IsEnum, IsDateString } from 'class-validator';
import { EventType } from '@prisma/client';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsDateString()
  date: string;

  @IsString()
  @IsNotEmpty()
  time: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsEnum(EventType)
  type: EventType;

  // ⚠️ NO incluir programId aquí - se extrae del JWT
}
```

**Importante**: El `programId` NO debe venir del cliente para prevenir manipulación. Se extrae del token JWT del usuario autenticado.

### 2.2 Service de Eventos

#### Archivo: `src/events/events.service.ts`

**Método de creación con validación de dominio**:
```typescript
import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, createEventDto: CreateEventDto) {
    // 1. Obtener información completa del usuario
    const user = await this.prisma.user.findUnique({
      where: { id_user: userId },
      include: { role: true }
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // 2. Validar que el usuario tenga una carrera asignada
    if (!user.id_program) {
      throw new BadRequestException(
        'Debes tener una carrera asignada para crear eventos. Completa tu perfil.'
      );
    }

    // 3. Validar permisos de creación según rol
    if (user.role.name === 'student') {
      throw new ForbiddenException(
        'Los estudiantes no pueden crear eventos. Contacta a un administrador.'
      );
    }

    // 4. Para admin: validar que el evento sea para su propia carrera
    // Para superadmin: bypass (puede crear para cualquier carrera)
    const programId = user.id_program; // Admin solo puede crear para su carrera
    
    // Nota: Si en el futuro se permite que superadmin elija la carrera,
    // se puede agregar un campo opcional en el DTO y usar:
    // const programId = user.role.name === 'superadmin' && dto.programId 
    //   ? dto.programId 
    //   : user.id_program;

    // 5. Crear el evento
    return this.prisma.event.create({
      data: {
        ...createEventDto,
        created_by: userId,
        program_id: programId, // ⭐ Asignación automática desde el perfil
        date: new Date(createEventDto.date)
      },
      include: {
        creator: {
          select: {
            id_user: true,
            full_name: true,
            email: true
          }
        },
        program: {
          select: {
            id_program: true,
            name: true
          }
        }
      }
    });
  }

  async findAll(userId: number) {
    // 1. Obtener información del usuario
    const user = await this.prisma.user.findUnique({
      where: { id_user: userId },
      include: { role: true }
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // 2. Construir filtro según rol
    const whereClause = user.role.name === 'superadmin'
      ? {} // Superadmin ve todos los eventos
      : { program_id: user.id_program }; // Otros solo ven de su carrera

    // 3. Si el usuario no tiene carrera y no es superadmin, retornar vacío
    if (!user.id_program && user.role.name !== 'superadmin') {
      return [];
    }

    // 4. Consultar eventos con filtro aplicado
    return this.prisma.event.findMany({
      where: whereClause,
      include: {
        creator: {
          select: {
            id_user: true,
            full_name: true,
            picture: true
          }
        },
        program: {
          select: {
            id_program: true,
            name: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });
  }

  async findOne(eventId: string, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id_user: userId },
      include: { role: true }
    });

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        creator: true,
        program: true
      }
    });

    if (!event) {
      throw new BadRequestException('Evento no encontrado');
    }

    // Validar acceso: solo si es de su carrera o es superadmin
    if (user.role.name !== 'superadmin' && event.program_id !== user.id_program) {
      throw new ForbiddenException('No tienes acceso a este evento');
    }

    return event;
  }
}
```

### 2.3 Controller de Eventos

#### Archivo: `src/events/events.controller.ts`

```typescript
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards,
  Request 
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('events')
@UseGuards(JwtAuthGuard) // ⭐ Todos los endpoints requieren autenticación
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  async create(
    @Request() req,
    @Body() createEventDto: CreateEventDto
  ) {
    // El userId se extrae del JWT (req.user.id_user)
    return this.eventsService.create(req.user.id_user, createEventDto);
  }

  @Get()
  async findAll(@Request() req) {
    // Filtrado automático por carrera en el service
    return this.eventsService.findAll(req.user.id_user);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() req
  ) {
    return this.eventsService.findOne(id, req.user.id_user);
  }
}
```

**Notas de seguridad**:
- `@UseGuards(JwtAuthGuard)`: Garantiza que solo usuarios autenticados accedan
- `req.user`: Poblado por el guard con la información del JWT
- NO se usa `@AdminOnly()` decorator porque la validación es más compleja (depende del `programId`)

## 3. Capa de Presentación (Frontend)

### 3.1 Service de Eventos

#### Archivo: `src/features/events/services/events.service.ts`

```typescript
import axios from 'axios';
import { Event, CreateEventPayload } from '../types/event.types';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export class EventsService {
  async getEvents(): Promise<Event[]> {
    const response = await axios.get(`${API_URL}/events`);
    return response.data;
  }

  async createEvent(payload: CreateEventPayload): Promise<Event> {
    const response = await axios.post(`${API_URL}/events`, payload);
    return response.data;
  }

  async getEventById(id: string): Promise<Event> {
    const response = await axios.get(`${API_URL}/events/${id}`);
    return response.data;
  }
}

export const eventsService = new EventsService();
```

### 3.2 Store de Eventos (MobX)

#### Archivo: `src/features/events/store/EventsStore.ts`

```typescript
import { makeAutoObservable, runInAction } from 'mobx';
import { eventsService } from '../services/events.service';
import { Event, CreateEventPayload } from '../types/event.types';

export class EventsStore {
  events: Event[] = [];
  isLoading = false;
  isCreating = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  async fetchEvents() {
    this.isLoading = true;
    this.error = null;

    try {
      const events = await eventsService.getEvents();
      runInAction(() => {
        this.events = events;
        this.isLoading = false;
      });
    } catch (error: any) {
      runInAction(() => {
        this.error = error.response?.data?.message || 'Error al cargar eventos';
        this.isLoading = false;
      });
    }
  }

  async createEvent(payload: CreateEventPayload) {
    this.isCreating = true;
    this.error = null;

    try {
      const newEvent = await eventsService.createEvent(payload);
      runInAction(() => {
        this.events.push(newEvent);
        this.isCreating = false;
      });
      return newEvent;
    } catch (error: any) {
      runInAction(() => {
        this.error = error.response?.data?.message || 'Error al crear evento';
        this.isCreating = false;
      });
      throw error;
    }
  }

  // Computed para filtrar eventos por tipo (opcional)
  get upcomingEvents() {
    const now = new Date();
    return this.events.filter(e => new Date(e.date) >= now);
  }
}

export const eventsStore = new EventsStore();
```

### 3.3 Componente de Creación de Eventos

#### Archivo: `src/features/events/components/CreateEventModal.tsx`

```typescript
import React, { useState } from 'react';
import { View, TextInput, Button, Alert, Modal, StyleSheet } from 'react-native';
import { observer } from 'mobx-react-lite';
import { eventsStore } from '../store/EventsStore';
import { EventType } from '../types/event.types';

interface CreateEventModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CreateEventModal = observer(({ visible, onClose }: CreateEventModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<EventType>('CONFERENCIA');

  const handleSubmit = async () => {
    if (!title || !description || !date || !time || !location) {
      Alert.alert('Error', 'Todos los campos son obligatorios');
      return;
    }

    try {
      await eventsStore.createEvent({
        title,
        description,
        date,
        time,
        location,
        type
      });
      
      Alert.alert('Éxito', 'Evento creado correctamente');
      onClose();
      
      // Limpiar formulario
      setTitle('');
      setDescription('');
      setDate('');
      setTime('');
      setLocation('');
    } catch (error) {
      Alert.alert('Error', eventsStore.error || 'No se pudo crear el evento');
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <TextInput
          placeholder="Título"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />
        <TextInput
          placeholder="Descripción"
          value={description}
          onChangeText={setDescription}
          multiline
          style={styles.input}
        />
        <TextInput
          placeholder="Fecha (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
          style={styles.input}
        />
        <TextInput
          placeholder="Hora (HH:MM)"
          value={time}
          onChangeText={setTime}
          style={styles.input}
        />
        <TextInput
          placeholder="Ubicación"
          value={location}
          onChangeText={setLocation}
          style={styles.input}
        />
        
        <Button 
          title={eventsStore.isCreating ? 'Creando...' : 'Crear Evento'} 
          onPress={handleSubmit}
          disabled={eventsStore.isCreating}
        />
        <Button title="Cancelar" onPress={onClose} color="red" />
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center'
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5
  }
});
```

### 3.4 Vista Principal de Eventos (Desacoplada)

#### Archivo: `app/(tabs)/events.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { View, FlatList, Button, Text } from 'react-native';
import { observer } from 'mobx-react-lite';
import { eventsStore } from '@/features/events/store/EventsStore';
import { authStore } from '@/features/auth/store/AuthStore';
import { CreateEventModal } from '@/features/events/components/CreateEventModal';

export default observer(function EventsScreen() {
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    eventsStore.fetchEvents();
  }, []);

  // ⭐ Computed: Solo admin y superadmin pueden crear eventos
  const canCreateEvents = ['admin', 'superadmin'].includes(authStore.user?.role?.name || '');

  return (
    <View style={{ flex: 1, padding: 20 }}>
      {/* Botón de creación condicionado por rol */}
      {canCreateEvents && (
        <Button 
          title="+ Nuevo Evento" 
          onPress={() => setModalVisible(true)} 
        />
      )}

      {eventsStore.isLoading ? (
        <Text>Cargando eventos...</Text>
      ) : (
        <FlatList
          data={eventsStore.events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ padding: 10, borderBottomWidth: 1 }}>
              <Text style={{ fontWeight: 'bold' }}>{item.title}</Text>
              <Text>{item.description}</Text>
              <Text>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
          )}
        />
      )}

      <CreateEventModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
      />
    </View>
  );
});
```

**Principios aplicados**:
- **Desacoplamiento**: La lógica de permisos está en el computed `canCreateEvents`
- **Reactividad**: MobX actualiza automáticamente la UI cuando cambia el store
- **Seguridad en capas**: Aunque el botón se oculta, el backend valida de nuevo

## 4. Formato de Respuestas (FEN - Frontend-Expected Notation)

### Respuesta de Creación Exitosa (201)
```json
{
  "id": "uuid-v4",
  "title": "Conferencia de IA",
  "description": "Introducción a Machine Learning",
  "date": "2026-04-15T00:00:00.000Z",
  "time": "14:00",
  "location": "Auditorio Principal",
  "type": "CONFERENCIA",
  "created_by": 5,
  "program_id": 2,
  "createdAt": "2026-03-13T10:00:00.000Z",
  "updatedAt": "2026-03-13T10:00:00.000Z",
  "creator": {
    "id_user": 5,
    "full_name": "Juan Pérez",
    "email": "juan@example.com"
  },
  "program": {
    "id_program": 2,
    "name": "Ingeniería en Sistemas"
  }
}
```

### Respuesta de Error 403 (Admin intentando crear para otra carrera)
```json
{
  "statusCode": 403,
  "message": "Solo puedes crear eventos para tu propia carrera",
  "error": "Forbidden"
}
```

### Respuesta de Error 403 (Student intentando crear)
```json
{
  "statusCode": 403,
  "message": "Los estudiantes no pueden crear eventos. Contacta a un administrador.",
  "error": "Forbidden"
}
```

### Respuesta de GET /events (Filtrada)
```json
[
  {
    "id": "uuid-1",
    "title": "Taller de React",
    "program_id": 2,
    "program": {
      "name": "Ingeniería en Sistemas"
    }
  },
  {
    "id": "uuid-2",
    "title": "Hackathon 2026",
    "program_id": 2,
    "program": {
      "name": "Ingeniería en Sistemas"
    }
  }
]
```

## 5. Consideraciones de Performance

### Índices de Base de Datos
- `@@index([program_id])`: Acelera filtrado por carrera (query más frecuente)
- `@@index([date, type])`: Permite filtrado combinado eficiente

### Caching (Futuro)
- Cachear lista de eventos por `programId` con TTL de 5 minutos
- Invalidar cache al crear/actualizar/eliminar eventos

### Paginación (Futuro)
```typescript
async findAll(userId: number, page = 1, limit = 20) {
  // ... lógica de filtrado ...
  
  return this.prisma.event.findMany({
    where: whereClause,
    skip: (page - 1) * limit,
    take: limit,
    // ... resto de la query
  });
}
```
