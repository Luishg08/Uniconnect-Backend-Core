-- Drop the old event table and its foreign key constraint
ALTER TABLE "event" DROP CONSTRAINT IF EXISTS "event_id_program_fkey";
DROP TABLE IF EXISTS "event";

-- Create EventType enum
CREATE TYPE "EventType" AS ENUM ('CONFERENCIA', 'TALLER', 'SEMINARIO', 'COMPETENCIA', 'CULTURAL', 'DEPORTIVO');

-- Create new events table with the updated schema
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- Create indexes for optimized queries
CREATE INDEX "events_date_idx" ON "events"("date");
CREATE INDEX "events_type_idx" ON "events"("type");
CREATE INDEX "events_date_type_idx" ON "events"("date", "type");
