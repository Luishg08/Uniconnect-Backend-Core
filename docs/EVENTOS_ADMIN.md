# Sistema de Gestión de Eventos con Control de Permisos

## Resumen

Este documento explica cómo funciona el sistema de creación, edición y eliminación de eventos académicos con control de permisos basado en roles.

## Arquitectura de Permisos

### 1. Sistema de Roles

La aplicación utiliza un sistema de roles y permisos basado en las siguientes tablas:

- **`role`**: Define los roles del sistema (ej: "Estudiante", "Administrador")
- **`permission`**: Define los permisos disponibles
- **`access`**: Tabla intermedia que relaciona roles con permisos
- **`user`**: Cada usuario tiene un `id_role` que determina sus permisos

### 2. Roles Necesarios

Para gestionar eventos, necesitas tener en tu base de datos:

#### Rol: Estudiante (Usuario Normal)
```sql
INSERT INTO role (name) VALUES ('Estudiante');
```

#### Rol: Administrador
```sql
INSERT INTO role (name) VALUES ('Administrador');
```

### 3. Asignar Rol de Administrador a un Usuario

Para que un usuario pueda crear eventos, debe tener el rol de administrador:

```sql
-- Obtener el ID del rol de administrador
SELECT id_role FROM role WHERE name = 'Administrador';

-- Actualizar el usuario para que sea administrador
UPDATE "user" 
SET id_role = (SELECT id_role FROM role WHERE name = 'Administrador')
WHERE id_user = [ID_DEL_USUARIO];
```

## Endpoints de la API

### Endpoints Públicos (Requieren autenticación JWT)

#### 1. Listar Eventos
```
GET /events
```
- **Autenticación**: JWT requerido
- **Permisos**: Cualquier usuario autenticado
- **Parámetros de query**:
  - `date`: Fecha exacta (ISO 8601)
  - `type`: Tipo de evento (CONFERENCIA, TALLER, SEMINARIO, etc.)
  - `startDate`: Fecha inicial del rango
  - `endDate`: Fecha final del rango
  - `page`: Número de página (default: 1)
  - `pageSize`: Tamaño de página (default: 20)

#### 2. Obtener Evento por ID
```
GET /events/:id
```
- **Autenticación**: JWT requerido
- **Permisos**: Cualquier usuario autenticado

### Endpoints Protegidos (Solo Administradores)

#### 3. Crear Evento
```
POST /events
```
- **Autenticación**: JWT requerido
- **Permisos**: Solo usuarios con rol "Administrador"
- **Body**:
```json
{
  "title": "Conferencia de IA",
  "description": "Conferencia sobre inteligencia artificial",
  "date": "2026-04-15",
  "time": "14:00",
  "location": "Auditorio Principal",
  "type": "CONFERENCIA"
}
```

#### 4. Actualizar Evento
```
PUT /events/:id
```
- **Autenticación**: JWT requerido
- **Permisos**: Solo usuarios con rol "Administrador"
- **Body**: Campos opcionales del evento a actualizar

#### 5. Eliminar Evento
```
DELETE /events/:id
```
- **Autenticación**: JWT requerido
- **Permisos**: Solo usuarios con rol "Administrador"

## Flujo de Autorización

### 1. AdminGuard

El `AdminGuard` se ejecuta en cada petición a endpoints protegidos:

```typescript
@Post()
@AdminOnly()  // <- Marca el endpoint como solo para admins
async create(@Body() dto: CreateEventDto) {
  // ...
}
```

### 2. Verificación de Permisos

El guard realiza los siguientes pasos:

1. Extrae el `userId` del token JWT
2. Consulta el usuario en la base de datos con su rol
3. Verifica si el nombre del rol contiene "admin" (case-insensitive)
4. Si es admin, permite la operación
5. Si no es admin, lanza `ForbiddenException`

### 3. Respuestas de Error

Si un usuario sin permisos intenta crear/editar/eliminar un evento:

```json
{
  "statusCode": 403,
  "message": "No tienes permisos para realizar esta acción. Solo administradores pueden gestionar eventos.",
  "error": "Forbidden"
}
```

## Modelo de Datos

### Tabla `events`

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
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  creator     user      @relation(fields: [created_by], references: [id_user])
}
```

### Tipos de Eventos

```typescript
enum EventType {
  CONFERENCIA
  TALLER
  SEMINARIO
  COMPETENCIA
  CULTURAL
  DEPORTIVO
}
```

## Configuración Inicial

### Paso 1: Ejecutar Migración SQL

Ejecuta el script SQL para agregar la columna `created_by`:

```bash
psql -h [HOST] -U [USER] -d [DATABASE] -f migrations/add_event_creator.sql
```

### Paso 2: Crear Roles en la Base de Datos

```sql
-- Crear rol de estudiante
INSERT INTO role (name) VALUES ('Estudiante');

-- Crear rol de administrador
INSERT INTO role (name) VALUES ('Administrador');
```

### Paso 3: Asignar Rol de Administrador

```sql
-- Ejemplo: Hacer administrador al usuario con email específico
UPDATE "user" 
SET id_role = (SELECT id_role FROM role WHERE name = 'Administrador')
WHERE email = 'admin@universidad.edu';
```

### Paso 4: Regenerar Cliente de Prisma

```bash
cd Uniconnect-Backend-Core
npx prisma generate
```

## Pruebas

### 1. Probar como Usuario Normal

```bash
# Login como estudiante
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "estudiante@universidad.edu", "password": "..."}'

# Intentar crear evento (debe fallar con 403)
curl -X POST http://localhost:3000/events \
  -H "Authorization: Bearer [TOKEN_ESTUDIANTE]" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", ...}'
```

### 2. Probar como Administrador

```bash
# Login como administrador
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@universidad.edu", "password": "..."}'

# Crear evento (debe funcionar)
curl -X POST http://localhost:3000/events \
  -H "Authorization: Bearer [TOKEN_ADMIN]" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Conferencia de IA",
    "description": "Evento sobre inteligencia artificial",
    "date": "2026-04-15",
    "time": "14:00",
    "location": "Auditorio",
    "type": "CONFERENCIA"
  }'
```

## Consideraciones de Seguridad

1. **Validación de Roles**: El guard verifica que el nombre del rol contenga "admin". Asegúrate de que tus roles sigan esta convención.

2. **Auditoría**: Cada evento guarda el `created_by` para trazabilidad.

3. **JWT**: Todos los endpoints requieren autenticación JWT válida.

4. **Separación de Permisos**: Los usuarios normales pueden ver eventos, pero solo los administradores pueden gestionarlos.

## Extensiones Futuras

### 1. Permisos Granulares

Podrías implementar permisos más específicos usando la tabla `permission`:

```sql
INSERT INTO permission (name, description, claim) 
VALUES ('Crear Eventos', 'Permite crear eventos académicos', 'events:create');

INSERT INTO permission (name, description, claim) 
VALUES ('Editar Eventos', 'Permite editar eventos académicos', 'events:update');

-- Asignar permisos al rol de administrador
INSERT INTO access (id_role, id_permission)
SELECT 
  (SELECT id_role FROM role WHERE name = 'Administrador'),
  id_permission
FROM permission
WHERE claim LIKE 'events:%';
```

### 2. Roles Intermedios

Podrías crear un rol "Coordinador de Eventos" con permisos limitados:

```sql
INSERT INTO role (name) VALUES ('Coordinador de Eventos');
```

## Resumen

✅ **Implementado**:
- Sistema de roles y permisos
- Guard de administrador
- Endpoints CRUD completos
- Validación de permisos
- Auditoría de creación

✅ **Listo para usar**:
- Solo necesitas ejecutar la migración SQL
- Crear los roles en la base de datos
- Asignar rol de administrador a usuarios específicos
