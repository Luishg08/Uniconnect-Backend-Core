-- AlterTable
ALTER TABLE "notification" ADD COLUMN     "notification_type" TEXT,
ADD COLUMN     "push_sent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "push_token" (
    "id_token" SERIAL NOT NULL,
    "id_user" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "device_type" TEXT NOT NULL,
    "device_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_token_pkey" PRIMARY KEY ("id_token")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_token_token_key" ON "push_token"("token");

-- AddForeignKey
ALTER TABLE "push_token" ADD CONSTRAINT "push_token_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "user"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;
