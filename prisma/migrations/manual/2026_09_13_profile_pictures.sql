-- Profile pictures.
--
-- A wallet address and a first initial are not an identity. Somebody picking
-- between four proposals is picking between four people, and until now every
-- one of them was a green circle with a letter in it.

-- Whether this user has a picture, and when it last changed. Null means
-- initials, which is what everyone starts as. The timestamp doubles as the
-- cache key in the image URL, so a new picture is visible immediately while an
-- unchanged one can be cached for a year.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "avatarUpdatedAt" TIMESTAMP(3);

-- The image itself, kept off the user row: a user is read on nearly every
-- request, and a list of proposals reads several at once. Nothing but the
-- route that serves the picture ever touches this table.
CREATE TABLE IF NOT EXISTS "Avatar" (
  "userId"    TEXT NOT NULL,
  "mimeType"  TEXT NOT NULL,
  "data"      TEXT NOT NULL,
  "bytes"     INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Avatar_pkey" PRIMARY KEY ("userId")
);

-- Cascade: deleting a user takes their picture with it. Unlike a deal, a
-- profile picture has no life of its own once the person is gone.
DO $$
BEGIN
  ALTER TABLE "Avatar"
    ADD CONSTRAINT "Avatar_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
