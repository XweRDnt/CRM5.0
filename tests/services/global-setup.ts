import { assertPostgresAvailable } from "@/tests/utils/postgres";

export default async function globalSetup(): Promise<void> {
  await assertPostgresAvailable(
    "Integration tests require PostgreSQL. Start dependencies with: docker compose up -d postgres redis",
  );
}
