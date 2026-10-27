-- Optional fields preserve existing profiles. Files remain in private storage;
-- the API validates ownership, purpose, MIME type and READY status before linking.
ALTER TABLE "client_profiles" ADD COLUMN "image_file_id" BIGINT;
ALTER TABLE "creator_profiles"
  ADD COLUMN "image_file_id" BIGINT,
  ADD COLUMN "career" TEXT,
  ADD COLUMN "website_url" TEXT,
  ADD COLUMN "social_url" TEXT;

ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_image_file_id_fkey"
  FOREIGN KEY ("image_file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_image_file_id_fkey"
  FOREIGN KEY ("image_file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
