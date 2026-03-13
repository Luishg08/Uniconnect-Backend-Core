-- Agregar columna created_by a la tabla events
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by INTEGER;

-- Crear índice en created_by
CREATE INDEX IF NOT EXISTS events_created_by_idx ON events(created_by);

-- Agregar foreign key constraint
ALTER TABLE events 
ADD CONSTRAINT events_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES "user"(id_user) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Actualizar eventos existentes (si los hay) con un usuario por defecto
-- Puedes ajustar esto según tu lógica de negocio
-- UPDATE events SET created_by = 1 WHERE created_by IS NULL;
