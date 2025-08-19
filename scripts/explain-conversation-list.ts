import "server-only";
import { and, asc, desc, eq, inArray, isNull, SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { explainAnalyze } from "@/db/lib/debug";
import { conversationMessages, conversations, platformCustomers } from "@/db/schema";

// Minimal reproduction of the hot path query used by lib/data/conversation/search.ts
// We run EXPLAIN ANALYZE to see scan/plan changes when indexes are added.

async function main() {
  // Representative filters for open inbox, default sort (newest) and metadata enabled highest_value order
  const statusOpen: SQL = eq(conversations.status, "open");
  const notMerged: SQL = isNull(conversations.mergedIntoId);

  const orderByField = sql`COALESCE(${conversations.lastUserEmailCreatedAt}, ${conversations.createdAt})`;

  const orderBy = [desc(orderByField)];

  const query = db
    .select({
      conversations_conversation: conversations,
      mailboxes_platformcustomer: platformCustomers,
      recent_message_cleanedUpText: sql<string | null>`recent_message.cleaned_up_text`,
      recent_message_createdAt: sql<string | null>`recent_message.created_at`,
    })
    .from(conversations)
    .leftJoin(platformCustomers, eq(conversations.emailFrom, platformCustomers.email))
    .leftJoin(
      sql`LATERAL (
        SELECT
          ${conversationMessages.cleanedUpText} as cleaned_up_text,
          ${conversationMessages.createdAt} as created_at
        FROM ${conversationMessages}
        WHERE ${and(
          eq(conversationMessages.conversationId, conversations.id),
          inArray(conversationMessages.role, ["user", "staff"]),
        )}
        ORDER BY ${desc(conversationMessages.createdAt)}
        LIMIT 1
      ) as recent_message`,
      sql`true`,
    )
    .where(and(statusOpen, notMerged))
    .orderBy(sql`${platformCustomers.value} DESC NULLS LAST`, ...orderBy)
    .limit(50)
    .offset(0);

  await explainAnalyze(query);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


