-- Reconstructed migration: estandarizar_id_eventos
-- Converts events table from TEXT id to INTEGER id_event, adds created_by column

-- Drop old table and recreate with integer PK and created_by
DROP TABLE IF EXISTS "events";

CREATE TABLE "events" (
    "id_event" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "created_by" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id_event")
);

-- Indexes
CREATE INDEX "events_date_idx" ON "events"("date");
CREATE INDEX "events_type_idx" ON "events"("type");
CREATE INDEX "events_date_type_idx" ON "events"("date", "type");
CREATE INDEX "events_created_by_idx" ON "events"("created_by");

-- Foreign key
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id_user") ON DELETE CASCADE ON UPDATE CASCADE;
