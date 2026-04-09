-- ============================================================================
-- MIGRACIÓN: Recrear tabla events correctamente (SIN UUID, SOLO INTEGERS)
-- Problema: Alguien creó la tabla con id UUID en lugar de id_event INTEGER
-- Solución: DROP y CREATE con el esquema correcto
-- ============================================================================

-- PASO 1: Backup de datos existentes (si hay)
CREATE TABLE IF NOT EXISTS events_backup AS SELECT * FROM events;

-- PASO 2: Eliminar tabla actual (con todas sus constraints)
DROP TABLE IF EXISTS events CASCADE;

-- PASO 3: Recrear tabla con esquema CORRECTO
CREATE TABLE events (
    id_event SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    date TIMESTAMP(3) NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    type "EventType" NOT NULL,
    created_by INTEGER NOT NULL,
    id_program INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PASO 4: Crear índices para performance
CREATE INDEX events_date_idx ON events(date);
CREATE INDEX events_type_idx ON events(type);
CREATE INDEX events_id_program_idx ON events(id_program);
CREATE INDEX events_date_type_idx ON events(date, type);
CREATE INDEX events_created_by_idx ON events(created_by);

-- PASO 5: Agregar foreign keys
ALTER TABLE events 
    ADD CONSTRAINT events_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES "user"(id_user) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;

ALTER TABLE events 
    ADD CONSTRAINT events_id_program_fkey 
    FOREIGN KEY (id_program) 
    REFERENCES program(id_program) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE;

-- PASO 6: Si había datos en backup, intentar migrarlos (opcional)
-- NOTA: Solo funciona si events_backup tiene las columnas correctas
-- INSERT INTO events (title, description, date, time, location, type, created_by, id_program, "createdAt", "updatedAt")
-- SELECT title, description, date, time, location, type, created_by, id_program, "createdAt", "updatedAt"
-- FROM events_backup
-- WHERE created_by IS NOT NULL;

-- PASO 7: Limpiar backup (descomentar después de verificar)
-- DROP TABLE IF EXISTS events_backup;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- Ejecuta esto después de aplicar la migración:
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'events' ORDER BY ordinal_position;
