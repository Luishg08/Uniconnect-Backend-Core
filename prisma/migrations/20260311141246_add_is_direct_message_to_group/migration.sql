-- AddColumn is_direct_message to group table
ALTER TABLE "public"."group" ADD COLUMN "is_direct_message" BOOLEAN NOT NULL DEFAULT false;
