-- DecisionEngine v2: taste profiles, opening hours, decision log.
--
-- Purely ADDITIVE (one nullable column + two new tables), hand-written and
-- applied with `prisma migrate deploy`. That deliberately avoids `migrate dev`
-- and its shadow database: see the shadow-DB warning in CLAUDE.md — pointing a
-- shadow at a real URL resets it and drops every table.

-- Restaurant.openingHours — Google regularOpeningHours.periods, verbatim.
ALTER TABLE "Restaurant" ADD COLUMN "openingHours" JSONB;

-- Learned cuisine affinity, one row per user.
CREATE TABLE "UserTasteProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weights" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTasteProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserTasteProfile_userId_key" ON "UserTasteProfile"("userId");

ALTER TABLE "UserTasteProfile"
    ADD CONSTRAINT "UserTasteProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One row per engine invocation: audit trail for tuning the weights.
CREATE TABLE "DecisionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "inputSummary" JSONB NOT NULL,
    "breakdown" JSONB NOT NULL,
    "chosenIds" TEXT[],
    "radiusTier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DecisionLog_userId_createdAt_idx" ON "DecisionLog"("userId", "createdAt");
