import "server-only";
import { and, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { explainAnalyze } from "@/db/lib/debug";
import { conversationMessages, conversations, platformCustomers } from "@/db/schema";

async function main() {
  const limit = Number.parseInt(process.argv[2] || "50", 10);

  const statusOpen: SQL = eq(conversations.status, "open");
  const notMerged: SQL = isNull(conversations.mergedIntoId);
  const orderByField = sql`COALESCE(${conversations.lastUserEmailCreatedAt}, ${conversations.createdAt})`;

  const query = db
    .select({ id: conversations.id })
    .from(conversations)
    .leftJoin(platformCustomers, eq(conversations.emailFrom, platformCustomers.email))
    .leftJoin(
      sql`LATERAL (
        SELECT ${conversationMessages.createdAt} as created_at
        FROM ${conversationMessages}
        WHERE ${and(
          eq(conversationMessages.conversationId, conversations.id),
          inArray(conversationMessages.role, ["user", "staff"]),
          isNull(conversationMessages.deletedAt)
        )}
        ORDER BY ${desc(conversationMessages.createdAt)}
        LIMIT 1
      ) as recent_message`,
      sql`true`,
    )
    .where(and(statusOpen, notMerged))
    .orderBy(sql`${platformCustomers.value} DESC NULLS LAST`, desc(orderByField))
    .limit(limit)
    .offset(0);

  await explainAnalyze(query);
}

main().catch((e) => { console.error(e); process.exit(1); });
