import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

async function main() {
  await db.execute(sql`DROP INDEX IF EXISTS "messages_conversation_created_at_desc_idx";`);
  await db.execute(sql`DROP INDEX IF EXISTS "platformcustomer_value_idx";`);
  console.log("Dropped indexes if existed");
}

main().catch((e) => { console.error(e); process.exit(1); });
