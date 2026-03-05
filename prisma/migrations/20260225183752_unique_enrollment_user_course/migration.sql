/*
  Warnings:

  - A unique constraint covering the columns `[id_user,id_course]` on the table `enrollment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "enrollment_id_user_id_course_key" ON "enrollment"("id_user", "id_course");
