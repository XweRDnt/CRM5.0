-- Remove non-Kinescope values from VideoProvider enum
ALTER TYPE "public"."VideoProvider" RENAME TO "VideoProvider_old";

CREATE TYPE "public"."VideoProvider" AS ENUM ('KINESCOPE');

ALTER TABLE "public"."AssetVersion" ALTER COLUMN "videoProvider" DROP DEFAULT;
ALTER TABLE "public"."AssetVersion"
  ALTER COLUMN "videoProvider" TYPE "public"."VideoProvider"
  USING ("videoProvider"::text::"public"."VideoProvider");
ALTER TABLE "public"."AssetVersion" ALTER COLUMN "videoProvider" SET DEFAULT 'KINESCOPE';

DROP TYPE "public"."VideoProvider_old";
