-- One-time challenges for wallet-signed actions.
--
-- The app asked the wallet to sign a string on login and then threw the
-- signature away unverified, and the string itself was only a timestamp that
-- was never recorded. That is not authentication, it is a formality: anybody
-- could post any wallet address and be handed a session as that person.
--
-- A signature only means something when the server chose the thing being
-- signed, can tell what it authorises, and refuses to accept it twice. That is
-- what this table is for.
CREATE TABLE IF NOT EXISTS "SignatureChallenge" (
  "id"        TEXT NOT NULL,
  "nonce"     TEXT NOT NULL,
  "address"   TEXT NOT NULL,
  "action"    TEXT NOT NULL,
  "subjectId" TEXT,
  "message"   TEXT NOT NULL,
  "issuedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),

  CONSTRAINT "SignatureChallenge_pkey" PRIMARY KEY ("id")
);

-- The nonce is what makes a signature single-use: spending one sets usedAt, and
-- the uniqueness here is what stops two of them ever existing.
CREATE UNIQUE INDEX IF NOT EXISTS "SignatureChallenge_nonce_key"
  ON "SignatureChallenge" ("nonce");

CREATE INDEX IF NOT EXISTS "SignatureChallenge_address_action_idx"
  ON "SignatureChallenge" ("address", "action");

-- Expired rows are swept on issue, and this is what makes that cheap.
CREATE INDEX IF NOT EXISTS "SignatureChallenge_expiresAt_idx"
  ON "SignatureChallenge" ("expiresAt");
