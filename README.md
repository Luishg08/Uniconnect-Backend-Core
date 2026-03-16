# Uniconnect Core

Backend API para la plataforma Uniconnect - Red social universitaria

## Integrantes

- Luis Miguel Henao
- Jaime Andrés Cardona
- Daner Alejandro Salazar
- Mariana López

## Tecnologías

- NestJS
- Prisma ORM
- PostgreSQL
- Docker

## Instalación y Ejecución

### Con Docker

```bash
docker-compose build
docker-compose up
```

### Desarrollo Local

```bash
pnpm install
pnpm run start:dev
```

## Variables de Entorno

Crear un archivo `.env` basado en las configuraciones necesarias para la conexión a la base de datos y autenticación.

## Scripts de Mantenimiento

### Limpieza de Invitaciones y Solicitudes

El script `clean-invitations.ts` permite limpiar registros antiguos en las tablas de invitaciones y solicitudes de grupo.

#### Ejecución

```bash
# Desde la raíz del proyecto backend
cd Uniconnect-Backend-Core

# Ejecutar script de limpieza
npx ts-node scripts/clean-invitations.ts

# O alternativamente desde la carpeta scripts
cd scripts
npx ts-node clean-invitations.ts
```

#### Funcionalidades

- **Invitaciones antiguas**: Elimina invitaciones rechazadas/aceptadas con más de 30 días de antigüedad
- **Solicitudes antiguas**: Elimina solicitudes rechazadas/aceptadas con más de 30 días de antigüedad  
- **Registros pendientes antiguos**: Limpia invitaciones/solicitudes pendientes con más de 90 días de antigüedad

#### Cuándo ejecutar

- **Manual**: Cuando se detecten problemas de P2002 en producción
- **Mantenimiento**: Como parte de tareas de limpieza periódicas (mensual)
- **Migración**: Después de cambios importantes en la estructura de grupos

#### Precauciones

- El script elimina datos permanentemente
- Ejecutar en horarios de bajo tráfico
- Hacer backup de la base de datos antes de ejecutar en producción