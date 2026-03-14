# Requirements: Estandarización del Sistema RBAC

## Objetivo
Establecer una taxonomía estricta de roles a nivel de plataforma, eliminando ambigüedades y roles legacy que causan inconsistencias en el sistema.

## Taxonomía de Roles (Estricta)

El sistema debe soportar **ÚNICAMENTE** 3 roles a nivel de plataforma, con valores en base de datos **ESTRICTAMENTE EN INGLÉS**:

### 1. `student` (Estudiante)
- **Descripción**: Rol por defecto asignado automáticamente a cualquier usuario nuevo en su primer login
- **Permisos base**: 
  - Acceso a funcionalidades básicas de la plataforma
  - Puede unirse a grupos existentes
  - Puede ver eventos y contenido público
  - NO puede crear grupos de estudio
- **Asignación**: Automática al momento de creación del usuario

### 2. `admin` (Administrador de Grupos)
- **Descripción**: Rol asignado inicialmente por base de datos a usuarios específicos
- **Permisos globales**:
  - Todos los permisos de `student`
  - **Puede crear grupos de estudio**
  - Puede gestionar sus propios grupos
- **Permisos dentro de grupos creados**:
  - Puede asignar el rol de administrador (`is_admin = true` en `membership`) a otros miembros dentro de sus propios grupos
  - Puede gestionar membresías de sus grupos
  - Puede moderar contenido de sus grupos
- **Asignación**: Manual por base de datos o por otro admin/superadmin

### 3. `superadmin` (Administrador de Plataforma)
- **Descripción**: Administrador web general con acceso absoluto
- **Permisos**:
  - **Bypass completo** de cualquier restricción de la plataforma
  - Acceso total a todos los grupos, eventos y recursos
  - Puede asignar roles `admin` y `superadmin` a otros usuarios
  - Gestión completa de la plataforma
- **Asignación**: Manual por base de datos únicamente

## Roles Legacy a Eliminar

Los siguientes roles deben ser **COMPLETAMENTE ELIMINADOS** del sistema:

- ❌ `"user"` (en inglés) - Reemplazar por `"student"`
- ❌ `"estudiante"` (en español) - Reemplazar por `"student"`
- ❌ Cualquier otro rol no especificado en la taxonomía oficial

## Modelo de Dos Niveles

Es importante distinguir entre:

1. **Rol de Usuario en el Sistema** (`user.role`):
   - Valores permitidos: `"student"`, `"admin"`, `"superadmin"`
   - Define permisos globales en la plataforma

2. **Rol de Usuario dentro de un Grupo** (`membership.is_admin`):
   - Valores: `true` (administrador del grupo) o `false` (miembro regular)
   - Define permisos específicos dentro de un grupo particular
   - Un `student` puede ser `is_admin = true` en un grupo si un `admin` lo promueve

## Reglas de Negocio Críticas

1. **Creación de Usuario**: Todo usuario nuevo debe recibir automáticamente el rol `"student"`
2. **Inmutabilidad de Roles**: Los roles en base de datos deben estar en inglés sin excepciones
3. **Jerarquía de Permisos**: `superadmin` > `admin` > `student`
4. **Alcance de Admin**: Un `admin` solo puede gestionar administradores dentro de grupos que él mismo creó
5. **Bypass de Superadmin**: Los guards deben permitir paso libre a `superadmin` sin validaciones adicionales

## Criterios de Aceptación

- [ ] Base de datos contiene únicamente los 3 roles en inglés
- [ ] Seeder crea los 3 roles correctamente
- [ ] Usuarios nuevos reciben automáticamente el rol `"student"`
- [ ] Guards diferencian correctamente entre `admin` y `superadmin`
- [ ] No existen referencias a roles legacy en el código
- [ ] Frontend reconoce y valida únicamente los 3 roles oficiales
- [ ] Documentación actualizada refleja la nueva taxonomía

---

# HU-09: Creación y Gestión de Eventos por Carrera

## Objetivo
Implementar un sistema de eventos académicos con restricciones de dominio basadas en carreras/programas, donde los administradores solo pueden crear y gestionar eventos para su propia carrera, y los usuarios solo pueden ver eventos relevantes a su programa académico.

## Contexto de Negocio
Los eventos académicos (conferencias, talleres, seminarios, competencias, culturales, deportivos) deben estar segmentados por carrera para garantizar relevancia y evitar saturación de información irrelevante para los estudiantes.

## Reglas de Negocio Estrictas

### 1. Permisos de Creación de Eventos

#### Rol `student`
- ❌ **NO puede crear eventos** bajo ninguna circunstancia
- ✅ Puede ver eventos de su propia carrera
- ✅ Puede participar/registrarse en eventos de su carrera

#### Rol `admin`
- ✅ **Puede crear eventos ÚNICAMENTE para su propia carrera**
- ❌ NO puede crear eventos para otras carreras
- ✅ Puede ver y gestionar eventos de su carrera
- ❌ NO puede ver eventos de otras carreras (a menos que sea participante)

#### Rol `superadmin`
- ✅ **Puede crear eventos para CUALQUIER carrera**
- ✅ Tiene visibilidad global de todos los eventos
- ✅ Puede gestionar eventos de todas las carreras
- ✅ Bypass completo de restricciones de dominio

### 2. Restricción de Dominio (Program-Based Access Control)

#### Validación en Creación
```typescript
// Pseudocódigo de validación
if (user.role === 'admin') {
  if (event.programId !== user.programId) {
    throw ForbiddenException('Solo puedes crear eventos para tu propia carrera');
  }
}

if (user.role === 'student') {
  throw ForbiddenException('Los estudiantes no pueden crear eventos');
}

// superadmin bypasses all checks
```

#### Validación en Consulta
```typescript
// Pseudocódigo de filtrado automático
if (user.role !== 'superadmin') {
  events = events.filter(e => e.programId === user.programId);
}
```

### 3. Visibilidad de Eventos

| Rol | Visibilidad |
|-----|-------------|
| `student` | Solo eventos de su carrera (`programId` coincide) |
| `admin` | Solo eventos de su carrera (`programId` coincide) |
| `superadmin` | Todos los eventos (sin filtro) |

### 4. Casos Especiales

#### Usuarios sin Carrera Asignada
- Si `user.programId === null`:
  - ❌ NO puede crear eventos (incluso si es `admin`)
  - ❌ NO puede ver ningún evento
  - ⚠️ Debe completar su perfil antes de acceder a eventos

#### Eventos sin Carrera Asignada (Legacy)
- Si `event.programId === null`:
  - ⚠️ Visible para `superadmin` únicamente
  - ❌ NO visible para `student` ni `admin`
  - 🔧 Debe ser corregido por un `superadmin`

## Modelo de Datos

### Cambios Requeridos en `event.prisma`

```prisma
model event {
  id          String    @id @default(uuid())
  title       String
  description String
  date        DateTime
  time        String
  location    String
  type        EventType
  created_by  Int       // ID del usuario que creó el evento
  program_id  Int       // ⭐ NUEVO: ID de la carrera/programa
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  creator     user      @relation(fields: [created_by], references: [id_user])
  program     program   @relation(fields: [program_id], references: [id_program]) // ⭐ NUEVO
  
  @@index([date])
  @@index([type])
  @@index([program_id]) // ⭐ NUEVO: Índice para filtrado eficiente
  @@index([date, type])
  @@index([created_by])
  @@map("events")
}
```

### Relación con `program.prisma`

```prisma
model program {
  id_program Int      @id @default(autoincrement())
  name       String?  @db.VarChar
  courses    course[]
  users      user[]
  events     event[]  // ⭐ NUEVO: Relación inversa
}
```

## Flujos de Usuario

### Flujo 1: Admin Crea Evento

```
1. Admin hace clic en "Crear Evento" (botón visible solo para admin/superadmin)
2. Completa formulario (título, descripción, fecha, hora, ubicación, tipo)
3. Backend extrae `programId` del JWT del admin
4. Backend valida: event.programId === admin.programId
5. Si válido: Crea evento y retorna 201
6. Si inválido: Retorna 403 Forbidden
```

### Flujo 2: Student Consulta Eventos

```
1. Student abre la vista de eventos
2. Frontend hace GET /events
3. Backend extrae `programId` del JWT del student
4. Backend filtra automáticamente: WHERE program_id = student.programId
5. Retorna solo eventos de la carrera del student
```

### Flujo 3: Superadmin Gestiona Eventos

```
1. Superadmin abre la vista de eventos
2. Frontend hace GET /events
3. Backend detecta rol superadmin
4. Backend NO aplica filtro de programId
5. Retorna TODOS los eventos de todas las carreras
```

## Criterios de Aceptación

### Backend
- [ ] Modelo `event` tiene campo `program_id` con relación a `program`
- [ ] Migración de Prisma ejecutada correctamente
- [ ] Endpoint `POST /events` valida rol y `programId`
- [ ] Endpoint `GET /events` filtra automáticamente por `programId`
- [ ] `superadmin` bypasses todas las validaciones de dominio
- [ ] Usuarios sin `programId` reciben error descriptivo

### Frontend
- [ ] Botón "Crear Evento" visible solo para `admin` y `superadmin`
- [ ] Formulario de creación NO solicita carrera (se toma del perfil)
- [ ] Lista de eventos muestra solo eventos de la carrera del usuario
- [ ] Manejo de errores 403 con mensajes claros
- [ ] `superadmin` puede ver selector de carrera (opcional)

### Testing
- [ ] Test: `student` no puede crear eventos (403)
- [ ] Test: `admin` puede crear eventos de su carrera (201)
- [ ] Test: `admin` NO puede crear eventos de otra carrera (403)
- [ ] Test: `superadmin` puede crear eventos de cualquier carrera (201)
- [ ] Test: `GET /events` filtra correctamente por carrera
- [ ] Test: Usuario sin `programId` recibe error apropiado

## Consideraciones de Seguridad

1. **Nunca confiar en el cliente**: El `programId` DEBE extraerse del JWT en el backend, NO del body de la request
2. **Validación doble**: Validar tanto en el guard como en el service
3. **Logs de auditoría**: Registrar intentos de creación de eventos fuera de dominio
4. **Rate limiting**: Limitar creación de eventos para prevenir spam

## Impacto en Otros Módulos

- **Notificaciones**: Deben respetar el filtro de `programId`
- **Búsqueda**: Debe incluir `programId` en el índice
- **Reportes**: Deben segmentarse por carrera
- **Dashboard**: Métricas deben ser por carrera (excepto superadmin)
