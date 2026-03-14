-- AlterTable
ALTER TABLE "events" ADD COLUMN "id_program" INTEGER;

-- CreateIndex
CREATE INDEX "events_id_program_idx" ON "events"("id_program");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_id_program_fkey" FOREIGN KEY ("id_program") REFERENCES "program"("id_program") ON DELETE SET NULL ON UPDATE CASCADE;
