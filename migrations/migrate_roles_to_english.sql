-- Migración: Estandarización de Roles a Inglés
-- Fecha: 2026-03-13
-- Descripción: Actualiza roles legacy ("user", "estudiante") al nuevo sistema de 3 roles en inglés

-- PASO 1: Crear los 3 roles oficiales si no existen
INSERT INTO role (name) 
VALUES ('student'), ('admin'), ('superadmin')
ON CONFLICT (name) DO NOTHING;

-- PASO 2: Actualizar usuarios con rol "user" a "student"
UPDATE "user" 
SET id_role = (SELECT id_role FROM role WHERE name = 'student')
WHERE id_role IN (SELECT id_role FROM role WHERE name = 'user');

-- PASO 3: Actualizar usuarios con rol "estudiante" a "student" (si existe)
UPDATE "user" 
SET id_role = (SELECT id_role FROM role WHERE name = 'student')
WHERE id_role IN (SELECT id_role FROM role WHERE name = 'estudiante');

-- PASO 4: Eliminar roles legacy (solo si no hay usuarios asociados)
DELETE FROM role WHERE name IN ('user', 'estudiante') 
AND id_role NOT IN (SELECT DISTINCT id_role FROM "user");

-- PASO 5: Validación - Verificar que todos los usuarios tienen un rol válido
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM "user" u
    LEFT JOIN role r ON u.id_role = r.id_role
    WHERE r.name NOT IN ('student', 'admin', 'superadmin');
    
    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Existen % usuarios con roles inválidos', invalid_count;
    END IF;
    
    RAISE NOTICE 'Migración completada exitosamente. Todos los usuarios tienen roles válidos.';
END $$;
