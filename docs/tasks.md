# Tasks: Plan de Implementación RBAC

## Resumen Ejecutivo
Plan de 3 fases para estandarizar el sistema de roles a nivel de plataforma, eliminando ambigüedades y estableciendo una taxonomía estricta de 3 roles en inglés.

---

## 📋 TAREA 1: Auditoría de Prisma (Schemas y Seeders)

### Objetivo
Forzar la existencia de únicamente 3 roles en inglés en la base de datos y eliminar cualquier rol legacy.

### Archivos a Modificar
- `prisma/schema/role.prisma`
- `prisma/seed.ts`

### Subtareas

#### 1.1 Actualizar Schema de Roles
- [ ] Agregar constraint `@unique` al campo `name` en `role.prisma`
- [ ] Documentar que solo deben existir 3 valores: `"student"`, `"admin"`, `"superadmin"`

#### 1.2 Refactorizar Seeder
- [ ] Eliminar lógica que crea el rol `"user"`
- [ ] Implementar creación de los 3 roles oficiales usando `upsert`
- [ ] Asegurar idempotencia (puede ejecutarse múltiples veces)
- [ ] Agregar validación de que los 3 roles existan

#### 1.3 Migración de Datos
- [ ] Crear script de migración para actualizar usuarios con rol `"user"` a `"student"`
- [ ] Eliminar registros de roles legacy de la tabla `role`
- [ ] Validar integridad referencial

### Criterios de Aceptación
- ✅ Seeder crea exactamente 3 roles en inglés
- ✅ No existen roles legacy en la base de datos
- ✅ Constraint `@unique` previene duplicados
- ✅ Todos los usuarios tienen un rol válido asignado

---

## 🔧 TAREA 2: Refactorización Backend (Servicios y Guards)

### Objetivo
Implementar la lógica de asignación automática de roles, permisos de grupos y guards con bypass para superadmin.

### Archivos a Modificar

#### Servicios
- `src/users/users.service.ts`
- `src/auth/auth.service.ts`
- `src/groups/groups.service.ts`
- `src/memberships/memberships.service.ts`

#### Guards
- `src/auth/guards/admin.guard.ts`
- `src/auth/guards/permissions.guard.ts`
- `src/groups/guards/*` (si existen guards específicos de grupos)

### Subtareas

#### 2.1 Asignación Automática de Rol "student"
- [ ] Modificar `users.service.ts` para buscar rol `"student"` por nombre
- [ ] Asignar automáticamente `id_role` de "student" en creación de usuarios
- [ ] Aplicar en todos los flujos de autenticación (Google OAuth, Auth0, etc.)
- [ ] Agregar validación de que el rol existe antes de crear usuario

#### 2.2 Lógica de Creación de Grupos
- [ ] Validar en `groups.service.ts` que solo `admin` y `superadmin` puedan crear grupos
- [ ] Asignar automáticamente `is_admin = true` en membership al creador del grupo
- [ ] Eliminar validaciones que busquen el rol `"user"`

#### 2.3 Lógica de Asignación de Admins en Grupos
- [ ] Implementar en `memberships.service.ts` método para promover usuarios a admin de grupo
- [ ] Validar que solo el owner del grupo o un superadmin puedan asignar admins
- [ ] Actualizar campo `is_admin` en tabla `membership`

#### 2.4 Refactorización de Guards
- [ ] Implementar bypass total para `superadmin` en todos los guards
- [ ] Actualizar `admin.guard.ts` para validar rol `"admin"` (no `"user"`)
- [ ] Actualizar `permissions.guard.ts` con lógica de bypass
- [ ] Crear/actualizar guard de grupo para validar `is_admin` en membership

#### 2.5 Limpieza de Código Legacy
- [ ] Buscar y eliminar todas las referencias a rol `"user"` en servicios
- [ ] Buscar y eliminar todas las referencias a roles en español
- [ ] Actualizar DTOs y tipos TypeScript para reflejar los 3 roles válidos

### Criterios de Aceptación
- ✅ Usuarios nuevos reciben automáticamente rol `"student"`
- ✅ Solo `admin` y `superadmin` pueden crear grupos
- ✅ `superadmin` tiene bypass en todos los guards
- ✅ Admins pueden promover miembros solo en sus propios grupos
- ✅ No existen referencias a roles legacy en el backend

---

## 🎨 TAREA 3: Auditoría y Limpieza Frontend

### Objetivo
Purgar deuda técnica de roles legacy en el frontend y asegurar que reconozca únicamente los 3 roles oficiales en inglés.

### Archivos a Auditar
- `src/features/auth/store/AuthStore.ts` (o equivalente MobX)
- `src/types/*` (definiciones de tipos)
- `src/features/*/` (todas las features)
- `src/components/*/` (todos los componentes)

### Subtareas

#### 3.1 Actualizar Tipos TypeScript
- [ ] Definir tipo estricto: `type UserRole = "student" | "admin" | "superadmin"`
- [ ] Actualizar interfaces de usuario para usar el tipo `UserRole`
- [ ] Eliminar tipos legacy (`"user"`, `"estudiante"`)

#### 3.2 Refactorizar AuthStore (MobX)
- [ ] Actualizar tipado del campo `role` en el store
- [ ] Crear computed values para permisos (ej. `canCreateGroup`)
- [ ] Implementar lógica de validación basada en roles

#### 3.3 Búsqueda y Reemplazo de Validaciones Hardcoded
- [ ] Buscar `role === 'user'` y reemplazar por `role === 'student'`
- [ ] Buscar `role === 'estudiante'` y reemplazar por `role === 'student'`
- [ ] Buscar cualquier otra referencia a roles legacy

#### 3.4 Refactorizar Vistas Protegidas
- [ ] Botón "Crear Grupo": validar `['admin', 'superadmin'].includes(user.role)`
- [ ] Panel de Administración: validar rol `superadmin`
- [ ] Opciones de grupo: validar `is_admin` en membership

#### 3.5 Aplicar Principio de Desacoplamiento
- [ ] Mover lógica de validación de roles del JSX al Store
- [ ] Crear computed booleans (ej. `canCreateGroup`, `isSuperAdmin`)
- [ ] Usar estos booleans en las vistas en lugar de lógica inline

### Criterios de Aceptación
- ✅ Tipos TypeScript reflejan únicamente los 3 roles oficiales
- ✅ No existen referencias a `"user"` o `"estudiante"` en el código
- ✅ Vistas protegidas usan computed values del Store
- ✅ Lógica de permisos está desacoplada de la UI

---

## 📊 Métricas de Éxito

### Cobertura de Cambios
- [ ] 100% de referencias a roles legacy eliminadas
- [ ] 100% de guards implementan bypass para superadmin
- [ ] 100% de flujos de registro asignan rol "student"

### Validación Funcional
- [ ] Tests unitarios pasan para servicios modificados
- [ ] Tests de integración validan flujo completo de roles
- [ ] Tests E2E confirman comportamiento en UI

### Documentación
- [ ] README actualizado con nueva taxonomía de roles
- [ ] Swagger/OpenAPI refleja los 3 roles en schemas
- [ ] Comentarios en código explican lógica de permisos

---

## 🚀 Orden de Ejecución Recomendado

1. **TAREA 1** (Prisma) - Base de datos primero
2. **TAREA 2** (Backend) - Lógica de negocio
3. **TAREA 3** (Frontend) - Interfaz de usuario

**Razón**: Los cambios en la base de datos deben propagarse hacia arriba en la arquitectura para evitar inconsistencias.

---

## ⚠️ Riesgos y Mitigaciones

### Riesgo 1: Usuarios existentes con rol "user"
**Mitigación**: Crear script de migración antes de eliminar el rol legacy

### Riesgo 2: Frontend cacheando roles antiguos
**Mitigación**: Forzar logout de todos los usuarios después del deploy

### Riesgo 3: Guards bloqueando superadmin
**Mitigación**: Implementar bypass como primera validación en todos los guards

### Riesgo 4: Pérdida de permisos de admins de grupo
**Mitigación**: Validar que `is_admin` en membership se preserve durante migración

---

# HU-09: Plan de Implementación - Sistema de Eventos por Carrera

## Resumen Ejecutivo
Plan de 3 tareas para implementar un sistema de eventos académicos con restricciones de dominio basadas en carreras, donde los administradores solo pueden crear eventos para su propia carrera y los usuarios solo ven eventos relevantes a su programa.

---

## 📋 TAREA 1: Modificación de Schema y Migración de Base de Datos

### Objetivo
Agregar la relación entre `event` y `program` en Prisma y ejecutar la migración para crear el campo `program_id` en la tabla de eventos.

### Archivos a Modificar
- `prisma/schema/event.prisma`
- `prisma/schema/program.prisma`

### Subtareas

#### 1.1 Actualizar Schema de Eventos
- [ ] Agregar campo `program_id Int` al modelo `event`
- [ ] Crear relación `program program @relation(fields: [program_id], references: [id_program])`
- [ ] Agregar índice `@@index([program_id])` para optimizar queries de filtrado
- [ ] Documentar que `program_id` es obligatorio (NOT NULL)

**Código esperado**:
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
  program_id  Int       // ⭐ NUEVO
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  creator     user      @relation(fields: [created_by], references: [id_user])
  program     program   @relation(fields: [program_id], references: [id_program]) // ⭐ NUEVO
  
  @@index([date])
  @@index([type])
  @@index([program_id])  // ⭐ NUEVO
  @@index([date, type])
  @@index([created_by])
  @@map("events")
}
```

#### 1.2 Actualizar Schema de Programas
- [ ] Agregar relación inversa `events event[]` al modelo `program`

**Código esperado**:
```prisma
model program {
  id_program Int      @id @default(autoincrement())
  name       String?  @db.VarChar
  courses    course[]
  users      user[]
  events     event[]  // ⭐ NUEVO
}
```

#### 1.3 Generar y Ejecutar Migración
- [ ] Ejecutar `npx prisma migrate dev --name add_program_to_events`
- [ ] Revisar el archivo de migración generado
- [ ] Validar que la migración incluya:
  - Creación del campo `program_id`
  - Creación del índice en `program_id`
  - Creación de la foreign key constraint
- [ ] Ejecutar `npx prisma generate` para actualizar el cliente

#### 1.4 Manejo de Datos Existentes (Si Aplica)
- [ ] Si existen eventos en la BD, decidir estrategia:
  - Opción A: Eliminar eventos existentes (solo desarrollo)
  - Opción B: Hacer `program_id` nullable temporalmente y asignar valores
  - Opción C: Crear script de migración manual

### Criterios de Aceptación
- ✅ Modelo `event` tiene campo `program_id` con relación a `program`
- ✅ Modelo `program` tiene relación inversa `events`
- ✅ Migración ejecutada sin errores
- ✅ Cliente de Prisma regenerado correctamente
- ✅ Índice en `program_id` creado para performance

### Comando de Validación
```bash
npx prisma db pull  # Verificar que el schema coincida con la BD
npx prisma validate # Validar sintaxis del schema
```

---

## 🔧 TAREA 2: Implementación de Lógica Backend (NestJS)

### Objetivo
Crear los endpoints de eventos con validación de roles y restricción de dominio por carrera, asegurando que los admins solo puedan crear eventos para su propia carrera y que los usuarios solo vean eventos relevantes.

### Archivos a Crear/Modificar

#### Nuevos
- `src/events/events.module.ts`
- `src/events/events.controller.ts`
- `src/events/events.service.ts`
- `src/events/dto/create-event.dto.ts`
- `src/events/dto/update-event.dto.ts` (opcional)

#### Modificar
- `src/app.module.ts` (importar EventsModule)

### Subtareas

#### 2.1 Crear Módulo de Eventos
- [ ] Generar módulo: `nest g module events`
- [ ] Generar controller: `nest g controller events`
- [ ] Generar service: `nest g service events`
- [ ] Importar `PrismaModule` en `EventsModule`
- [ ] Registrar `EventsModule` en `AppModule`

#### 2.2 Crear DTOs
- [ ] Crear `CreateEventDto` con validaciones:
  - `title`: string, not empty
  - `description`: string, not empty
  - `date`: DateString
  - `time`: string, not empty
  - `location`: string, not empty
  - `type`: enum EventType
  - ⚠️ NO incluir `programId` (se extrae del JWT)

**Código esperado**:
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
}
```

#### 2.3 Implementar EventsService

**Método `create(userId, dto)`**:
- [ ] Obtener usuario con rol y programId desde BD
- [ ] Validar que el usuario tenga `id_program` asignado
- [ ] Validar rol:
  - Si es `student`: lanzar `ForbiddenException`
  - Si es `admin`: usar su `id_program` para el evento
  - Si es `superadmin`: usar su `id_program` (o permitir override futuro)
- [ ] Crear evento con `program_id` del usuario
- [ ] Retornar evento con relaciones `creator` y `program`

**Método `findAll(userId)`**:
- [ ] Obtener usuario con rol desde BD
- [ ] Construir filtro:
  - Si es `superadmin`: sin filtro (ve todos)
  - Si es `admin` o `student`: filtrar por `program_id === user.id_program`
- [ ] Si usuario no tiene `id_program` y no es superadmin: retornar array vacío
- [ ] Retornar eventos ordenados por fecha ascendente

**Método `findOne(eventId, userId)`**:
- [ ] Obtener evento por ID
- [ ] Validar que el usuario tenga acceso:
  - Si es `superadmin`: permitir
  - Si no: validar que `event.program_id === user.id_program`
- [ ] Si no tiene acceso: lanzar `ForbiddenException`

**Código de referencia**:
```typescript
async create(userId: number, createEventDto: CreateEventDto) {
  const user = await this.prisma.user.findUnique({
    where: { id_user: userId },
    include: { role: true }
  });

  if (!user.id_program) {
    throw new BadRequestException('Debes tener una carrera asignada');
  }

  if (user.role.name === 'student') {
    throw new ForbiddenException('Los estudiantes no pueden crear eventos');
  }

  return this.prisma.event.create({
    data: {
      ...createEventDto,
      created_by: userId,
      program_id: user.id_program,
      date: new Date(createEventDto.date)
    },
    include: {
      creator: { select: { id_user: true, full_name: true, email: true } },
      program: { select: { id_program: true, name: true } }
    }
  });
}
```

#### 2.4 Implementar EventsController
- [ ] Aplicar `@UseGuards(JwtAuthGuard)` a nivel de controller
- [ ] Crear endpoint `POST /events`:
  - Extraer `userId` de `req.user.id_user`
  - Llamar a `eventsService.create(userId, dto)`
  - Retornar 201 con el evento creado
- [ ] Crear endpoint `GET /events`:
  - Extraer `userId` de `req.user`
  - Llamar a `eventsService.findAll(userId)`
  - Retornar 200 con array de eventos
- [ ] Crear endpoint `GET /events/:id`:
  - Extraer `userId` de `req.user`
  - Llamar a `eventsService.findOne(id, userId)`
  - Retornar 200 con el evento

**Código de referencia**:
```typescript
@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@Request() req, @Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(req.user.id_user, createEventDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.eventsService.findAll(req.user.id_user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.eventsService.findOne(id, req.user.id_user);
  }
}
```

#### 2.5 Testing Backend (Opcional pero Recomendado)
- [ ] Test: `student` no puede crear eventos (403)
- [ ] Test: `admin` puede crear eventos (201)
- [ ] Test: `admin` ve solo eventos de su carrera
- [ ] Test: `superadmin` ve todos los eventos
- [ ] Test: Usuario sin `programId` recibe error apropiado

### Criterios de Aceptación
- ✅ Endpoint `POST /events` valida roles correctamente
- ✅ Endpoint `POST /events` asigna `program_id` automáticamente
- ✅ Endpoint `GET /events` filtra por carrera del usuario
- ✅ `superadmin` bypasses filtros de carrera
- ✅ Errores retornan mensajes descriptivos (403, 400)
- ✅ Respuestas incluyen relaciones `creator` y `program`

### Comandos de Validación
```bash
# Iniciar servidor
npm run start:dev

# Probar endpoints con curl o Postman
curl -X POST http://localhost:3000/events \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Test","date":"2026-04-15","time":"14:00","location":"Aula 101","type":"CONFERENCIA"}'
```

---

## 📱 TAREA 3: Implementación de UI Frontend (React Native + MobX)

### Objetivo
Crear la interfaz de usuario para visualizar y crear eventos, asegurando que el botón de creación solo sea visible para `admin` y `superadmin`, y aplicando el principio de desacoplamiento absoluto.

### Archivos a Crear/Modificar

#### Nuevos
- `src/features/events/services/events.service.ts`
- `src/features/events/store/EventsStore.ts`
- `src/features/events/components/CreateEventModal.tsx`
- `src/features/events/components/EventCard.tsx` (opcional)
- `src/features/events/types/event.types.ts`

#### Modificar
- `app/(tabs)/events.tsx` (vista principal)

### Subtareas

#### 3.1 Crear Tipos TypeScript
- [ ] Definir interfaz `Event` con todos los campos
- [ ] Definir interfaz `CreateEventPayload` (sin `programId`)
- [ ] Definir enum `EventType` sincronizado con backend

**Código esperado**:
```typescript
export enum EventType {
  CONFERENCIA = 'CONFERENCIA',
  TALLER = 'TALLER',
  SEMINARIO = 'SEMINARIO',
  COMPETENCIA = 'COMPETENCIA',
  CULTURAL = 'CULTURAL',
  DEPORTIVO = 'DEPORTIVO'
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  type: EventType;
  created_by: number;
  program_id: number;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id_user: number;
    full_name: string;
    picture?: string;
  };
  program?: {
    id_program: number;
    name: string;
  };
}

export interface CreateEventPayload {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  type: EventType;
}
```

#### 3.2 Crear Service de Eventos
- [ ] Implementar método `getEvents()`: GET /events
- [ ] Implementar método `createEvent(payload)`: POST /events
- [ ] Implementar método `getEventById(id)`: GET /events/:id
- [ ] Configurar interceptor de Axios para incluir token JWT

**Código esperado**:
```typescript
import axios from 'axios';

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
}

export const eventsService = new EventsService();
```

#### 3.3 Crear EventsStore (MobX)
- [ ] Definir observables:
  - `events: Event[]`
  - `isLoading: boolean`
  - `isCreating: boolean`
  - `error: string | null`
- [ ] Implementar acción `fetchEvents()`:
  - Llamar a `eventsService.getEvents()`
  - Actualizar `events` con `runInAction`
  - Manejar errores
- [ ] Implementar acción `createEvent(payload)`:
  - Llamar a `eventsService.createEvent(payload)`
  - Agregar nuevo evento a `events`
  - Manejar errores
- [ ] Crear computed `upcomingEvents` (opcional): filtrar eventos futuros

**Código esperado**:
```typescript
import { makeAutoObservable, runInAction } from 'mobx';

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
    try {
      const events = await eventsService.getEvents();
      runInAction(() => {
        this.events = events;
        this.isLoading = false;
      });
    } catch (error: any) {
      runInAction(() => {
        this.error = error.response?.data?.message || 'Error';
        this.isLoading = false;
      });
    }
  }

  async createEvent(payload: CreateEventPayload) {
    this.isCreating = true;
    try {
      const newEvent = await eventsService.createEvent(payload);
      runInAction(() => {
        this.events.push(newEvent);
        this.isCreating = false;
      });
      return newEvent;
    } catch (error: any) {
      runInAction(() => {
        this.error = error.response?.data?.message || 'Error';
        this.isCreating = false;
      });
      throw error;
    }
  }
}

export const eventsStore = new EventsStore();
```

#### 3.4 Crear Componente CreateEventModal
- [ ] Crear formulario con campos:
  - Título (TextInput)
  - Descripción (TextInput multiline)
  - Fecha (TextInput o DatePicker)
  - Hora (TextInput o TimePicker)
  - Ubicación (TextInput)
  - Tipo (Picker con opciones de EventType)
- [ ] Validar que todos los campos estén completos
- [ ] Llamar a `eventsStore.createEvent()` al enviar
- [ ] Mostrar loading mientras `isCreating === true`
- [ ] Cerrar modal y limpiar formulario al éxito
- [ ] Mostrar Alert con error si falla

**Código de referencia**:
```typescript
export const CreateEventModal = observer(({ visible, onClose }) => {
  const [title, setTitle] = useState('');
  // ... otros estados

  const handleSubmit = async () => {
    if (!title || !description || !date || !time || !location) {
      Alert.alert('Error', 'Todos los campos son obligatorios');
      return;
    }

    try {
      await eventsStore.createEvent({ title, description, date, time, location, type });
      Alert.alert('Éxito', 'Evento creado');
      onClose();
    } catch (error) {
      Alert.alert('Error', eventsStore.error || 'No se pudo crear');
    }
  };

  return (
    <Modal visible={visible}>
      {/* Formulario */}
    </Modal>
  );
});
```

#### 3.5 Actualizar Vista Principal de Eventos
- [ ] Importar `authStore` para obtener el rol del usuario
- [ ] Crear computed `canCreateEvents`:
  ```typescript
  const canCreateEvents = ['admin', 'superadmin'].includes(authStore.user?.role?.name || '');
  ```
- [ ] Renderizar botón "Nuevo Evento" solo si `canCreateEvents === true`
- [ ] Cargar eventos con `eventsStore.fetchEvents()` en `useEffect`
- [ ] Mostrar loading mientras `isLoading === true`
- [ ] Renderizar lista de eventos con `FlatList`
- [ ] Abrir modal al hacer clic en "Nuevo Evento"

**Código de referencia**:
```typescript
export default observer(function EventsScreen() {
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    eventsStore.fetchEvents();
  }, []);

  const canCreateEvents = ['admin', 'superadmin'].includes(
    authStore.user?.role?.name || ''
  );

  return (
    <View>
      {canCreateEvents && (
        <Button title="+ Nuevo Evento" onPress={() => setModalVisible(true)} />
      )}
      
      <FlatList
        data={eventsStore.events}
        renderItem={({ item }) => <EventCard event={item} />}
      />

      <CreateEventModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
});
```

#### 3.6 Aplicar Principios de Desacoplamiento
- [ ] Lógica de permisos en computed values (no en JSX)
- [ ] Lógica de negocio en el Store (no en componentes)
- [ ] Componentes solo renderizan y delegan acciones
- [ ] Manejo de errores centralizado en el Store

### Criterios de Aceptación
- ✅ Botón "Crear Evento" visible solo para `admin` y `superadmin`
- ✅ Formulario de creación NO solicita carrera (se toma del backend)
- ✅ Lista de eventos muestra solo eventos de la carrera del usuario
- ✅ Errores 403 se manejan con Alert descriptivo
- ✅ UI reactiva con MobX (actualización automática)
- ✅ Desacoplamiento: lógica en Store, UI en componentes

### Comandos de Validación
```bash
# Iniciar app en desarrollo
npx expo start

# Verificar tipos
npx tsc --noEmit
```

---

## 📊 Métricas de Éxito Global (HU-09)

### Cobertura de Implementación
- [ ] 100% de endpoints de eventos implementados
- [ ] 100% de validaciones de roles aplicadas
- [ ] 100% de filtros de carrera funcionando

### Validación Funcional
- [ ] `student` no puede crear eventos (UI + Backend)
- [ ] `admin` puede crear eventos de su carrera
- [ ] `admin` NO puede crear eventos de otra carrera
- [ ] `superadmin` puede crear eventos de cualquier carrera
- [ ] Usuarios ven solo eventos de su carrera
- [ ] `superadmin` ve todos los eventos

### Seguridad
- [ ] `programId` se extrae del JWT (no del body)
- [ ] Validación en backend (no solo frontend)
- [ ] Errores descriptivos sin exponer información sensible

---

## 🚀 Orden de Ejecución Recomendado (HU-09)

1. **TAREA 1** (Prisma) - Modificar schema y migrar BD
2. **TAREA 2** (Backend) - Implementar endpoints y lógica
3. **TAREA 3** (Frontend) - Crear UI y conectar con backend

**Razón**: La base de datos debe estar lista antes de implementar la lógica de negocio, y el backend debe estar funcional antes de conectar el frontend.

---

## ⚠️ Riesgos y Mitigaciones (HU-09)

### Riesgo 1: Eventos existentes sin `program_id`
**Mitigación**: Decidir estrategia antes de migrar (eliminar, hacer nullable, o asignar valores)

### Riesgo 2: Admin intenta crear evento sin tener carrera asignada
**Mitigación**: Validar `user.id_program !== null` antes de permitir creación

### Riesgo 3: Frontend envía `programId` en el body (manipulación)
**Mitigación**: Backend SIEMPRE extrae `programId` del JWT, ignora el body

### Riesgo 4: Superadmin no puede ver eventos de todas las carreras
**Mitigación**: Implementar bypass explícito en `findAll()` para rol `superadmin`

### Riesgo 5: Performance con muchos eventos
**Mitigación**: Índice en `program_id` + paginación futura
