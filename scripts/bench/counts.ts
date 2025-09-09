/* eslint-disable no-console */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

async function main() {
  const convs = await db.execute(sql`SELECT COUNT(*)::bigint AS count FROM conversations_conversation`);
  const msgs = await db.execute(sql`SELECT COUNT(*)::bigint AS count FROM messages`);
  console.log(
    JSON.stringify({ conversations: Number(convs.rows?.[0]?.count ?? 0n), messages: Number(msgs.rows?.[0]?.count ?? 0n) }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


