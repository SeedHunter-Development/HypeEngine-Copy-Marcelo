import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@workspace/db/schema";

declare global {
  var _apiPool: Pool | undefined;
}

function getPool(): Pool {
  if (!global._apiPool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    global._apiPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return global._apiPool;
}

export const db = drizzle(getPool(), { schema });
export * from "@workspace/db/schema";
