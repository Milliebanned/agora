-- Escrow payouts: the columns and constraints the claim flow relies on.
--
-- Run after 2026_09_09_opportunity_marketplace.sql. Additive, and safe to
-- re-run. The unique constraint is the part that matters — it is what makes a
-- double payout impossible rather than merely unlikely.

ALTER TABLE "EscrowTransaction"
  ADD COLUMN IF NOT EXISTS "amountNIM" DECIMAL(65,30);

-- Collapse any duplicate rows before the unique index goes on, keeping the
-- oldest of each (agreementId, type) pair. On a fresh database this is a no-op.
DELETE FROM "EscrowTransaction" a
  USING "EscrowTransaction" b
  WHERE a."agreementId" = b."agreementId"
    AND a."type" = b."type"
    AND a."createdAt" > b."createdAt";

-- One fund row, one claim row, one refund row per deal. A concurrent second
-- claim loses this insert and never reaches the signing code.
CREATE UNIQUE INDEX IF NOT EXISTS "EscrowTransaction_agreementId_type_key"
  ON "EscrowTransaction" ("agreementId", "type");

CREATE INDEX IF NOT EXISTS "EscrowTransaction_type_status_createdAt_idx"
  ON "EscrowTransaction" ("type", "status", "createdAt");
