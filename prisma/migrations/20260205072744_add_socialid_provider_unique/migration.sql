/*
  Warnings:

  - A unique constraint covering the columns `[socialId,provider]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_socialId_key";

-- CreateIndex
CREATE UNIQUE INDEX "User_socialId_provider_key" ON "User"("socialId", "provider");
