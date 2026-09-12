-- A posting hired from an advertisement belongs to one freelancer.
--
-- Hiring from an ad created an ordinary public posting, so every freelancer on
-- the board saw a job that had been addressed to one of them, and any of them
-- could propose on it. The client had picked somebody; the board was telling
-- everybody else about it.
ALTER TABLE "Agreement"
  ADD COLUMN IF NOT EXISTS "invitedSellerId" TEXT;

CREATE INDEX IF NOT EXISTS "Agreement_invitedSellerId_idx"
  ON "Agreement" ("invitedSellerId");
