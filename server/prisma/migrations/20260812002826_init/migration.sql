-- CreateEnum
CREATE TYPE "LocationArea" AS ENUM ('JLT', 'DIFC', 'DOWNTOWN', 'BUSINESS_BAY', 'MARINA', 'OTHER');

-- CreateEnum
CREATE TYPE "BudgetRange" AS ENUM ('LOW', 'MID', 'HIGH');

-- CreateEnum
CREATE TYPE "AccountTier" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "DecisionAction" AS ENUM ('DIRECTIONS', 'CALL', 'ORDER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "googleId" TEXT,
    "locationArea" "LocationArea" NOT NULL DEFAULT 'OTHER',
    "cuisinePreferences" TEXT[],
    "budgetRange" "BudgetRange" NOT NULL DEFAULT 'MID',
    "dietary" TEXT[],
    "accountTier" "AccountTier" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cuisineType" TEXT NOT NULL,
    "area" "LocationArea" NOT NULL,
    "priceMin" INTEGER NOT NULL,
    "priceMax" INTEGER NOT NULL,
    "phone" TEXT,
    "googleMapsUrl" TEXT,
    "talabatUrl" TEXT,
    "noonUrl" TEXT,
    "deliverooUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "ratingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageCalories" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "promptText" TEXT NOT NULL,
    "moodChipsUsed" TEXT[],
    "resultIds" TEXT[],
    "selectedResultId" TEXT,
    "actionTaken" "DecisionAction",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPick" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "themeLabel" TEXT NOT NULL,
    "result1Id" TEXT NOT NULL,
    "result2Id" TEXT NOT NULL,
    "result3Id" TEXT NOT NULL,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPick_date_key" ON "DailyPick"("date");

-- AddForeignKey
ALTER TABLE "DecisionSession" ADD CONSTRAINT "DecisionSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPick" ADD CONSTRAINT "DailyPick_result1Id_fkey" FOREIGN KEY ("result1Id") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPick" ADD CONSTRAINT "DailyPick_result2Id_fkey" FOREIGN KEY ("result2Id") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPick" ADD CONSTRAINT "DailyPick_result3Id_fkey" FOREIGN KEY ("result3Id") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
