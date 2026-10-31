-- Price honesty: a row Google has no price signal for stores NULL instead of
-- the invented AED 45-100 fallback. Purely additive: no column dropped, no row
-- rewritten here (the 75 guessed rows are corrected by `npm run sync:prices`,
-- which re-asks Google and nulls what it still has nothing for).
ALTER TABLE "Restaurant" ALTER COLUMN "priceMin" DROP NOT NULL;
ALTER TABLE "Restaurant" ALTER COLUMN "priceMax" DROP NOT NULL;
