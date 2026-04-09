-- Migration: Fix events table schema to match application code
-- Issue: Database has 'id' (TEXT) but code expects 'id_event' (INTEGER)
-- Also missing: created_by column

-- Step 1: Add new columns
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "id_event" SERIAL;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;

-- Step 2: Create unique index on id_event (will be primary key)
CREATE UNIQUE INDEX IF NOT EXISTS "events_id_event_unique" ON "events"("id_event");

-- Step 3: Create index on created_by for performance
CREATE INDEX IF NOT EXISTS "events_created_by_idx" ON "events"("created_by");

-- Step 4: Add foreign key constraint for created_by
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" 
  FOREIGN KEY ("created_by") REFERENCES "user"("id_user") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Drop old primary key constraint on 'id' column
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_pkey";

-- Step 6: Set id_event as new primary key
ALTER TABLE "events" ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id_event");

-- Step 7: Make id_event NOT NULL (after data migration if needed)
-- Note: If there's existing data, you'll need to populate id_event first
-- ALTER TABLE "events" ALTER COLUMN "id_event" SET NOT NULL;

-- Step 8: Make created_by NOT NULL (after data migration if needed)
-- ALTER TABLE "events" ALTER COLUMN "created_by" SET NOT NULL;

-- Optional: Drop old 'id' column after confirming everything works
-- ALTER TABLE "events" DROP COLUMN IF EXISTS "id";
