import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

async function main() {
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "messages_conversation_created_at_desc_idx" ON "messages" ("conversation_id", "created_at" DESC) WHERE "deleted_at" IS NULL AND "role" IN ('user','staff');`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "platformcustomer_value_idx" ON "mailboxes_platformcustomer" ("value" DESC NULLS LAST);`);
  console.log("Created indexes if not exist");
}

main().catch((e) => { console.error(e); process.exit(1); });
