-- Onboarding taste quiz.
--
-- Purely ADDITIVE (one new enum, three new User columns, one new
-- UserTasteProfile column — all defaulted or nullable), hand-written and
-- applied with `prisma migrate deploy`. That deliberately avoids `migrate dev`
-- and its shadow database: see the shadow-DB warning in CLAUDE.md — pointing a
-- shadow at a real URL resets it and drops every table.

-- How far from a user's favourites the engine may roam. BALANCED is the
-- default AND the engine's historical ε constant (0.15), so every existing
-- user behaves exactly as before until they take the quiz.
CREATE TYPE "Adventurousness" AS ENUM ('SAFE', 'BALANCED', 'ADVENTUROUS');

ALTER TABLE "User" ADD COLUMN "dislikedCuisines" TEXT[];
ALTER TABLE "User" ADD COLUMN "adventurousness" "Adventurousness" NOT NULL DEFAULT 'BALANCED';
ALTER TABLE "User" ADD COLUMN "tasteQuizCompletedAt" TIMESTAMP(3);

-- The quiz's OWN taste contribution, separate from the swipe/select-learned
-- `weights`. Recomputed from the stored answers on every save, which is what
-- keeps re-taking the quiz idempotent instead of stacking +2s forever.
ALTER TABLE "UserTasteProfile" ADD COLUMN "quizWeights" JSONB NOT NULL DEFAULT '{}';
