/*
  Warnings:

  - You are about to drop the column `googleSub` on the `user` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user" DROP COLUMN "googleSub",
ADD COLUMN     "google_sub" VARCHAR;
