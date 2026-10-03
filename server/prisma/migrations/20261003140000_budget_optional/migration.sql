-- Taste quiz: "No budget" is a real answer.
--
-- The quiz's budget step offers four cards (No budget / Under AED 100 /
-- AED 100-200 / AED 200+), so the column needs a way to say "no band". NULL is
-- that way, which means the NOT NULL and the @default(MID) both have to go:
-- MID was a band every user carried without ever having chosen it, and while
-- budget was a Stage-1 filter that quietly constrained every decision they made.
--
-- Additive and reversible: no column is dropped, no row is rewritten. Existing
-- rows keep whatever band they hold; they are simply no longer forced to hold
-- one. Applied with `prisma migrate deploy` (no shadow database) — the
-- decision_engine_v2 / venue_type / taste_quiz pattern.
ALTER TABLE "User" ALTER COLUMN "budgetRange" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "budgetRange" DROP DEFAULT;
