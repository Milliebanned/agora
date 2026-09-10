-- Record who actually paid into escrow.
--
-- Nimiq Pay sends from the account the user currently has active, which need
-- not be the account the app read at login. Requiring the two to match made
-- funding unverifiable for anyone whose wallet holds more than one account.

ALTER TABLE "EscrowTransaction"
  ADD COLUMN IF NOT EXISTS "fromAddress" TEXT;
