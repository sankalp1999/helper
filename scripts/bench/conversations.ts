/* eslint-disable no-console */
import "dotenv/config";
import { and, asc, desc, eq, inArray, isNull, SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { conversationMessages, conversations, platformCustomers } from "@/db/schema";
import { getMailbox } from "@/lib/data/mailbox";
import { searchConversations } from "@/lib/data/conversation/search";

// Usage:
// BRANCH=main pnpm with-dev-env tsx --conditions=react-server scripts/bench/conversations.ts --search=download --pages=5 --limit=50

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.split("=");
    return [k, v];
  }),
);

const SEARCH = args["--search"] ?? null;
const PAGES = parseInt(args["--pages"] ?? "5", 10);
const LIMIT = parseInt(args["--limit"] ?? "50", 10);
const EXPLAIN = args["--explain"] === "1" || args["--explain"] === "true";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stats = (ns: number[]) => {
  const s = [...ns].sort((a, b) => a - b);
  const p50 = s[Math.floor(0.5 * (s.length - 1))] ?? 0;
  const p95 = s[Math.floor(0.95 * (s.length - 1))] ?? 0;
  return { p50, p95 };
};

async function main() {
  const mailbox = await getMailbox();
  if (!mailbox) throw new Error("Mailbox not found");

  // Warm-up
  {
    const { list } = await searchConversations(mailbox, { status: ["open"], sort: "newest", search: SEARCH, limit: LIMIT });
    await list;
  }

  const times: number[] = [];
  let cursor: string | null = null;

  for (let i = 0; i < PAGES; i++) {
    const t0 = performance.now();
    const { list } = await searchConversations(mailbox, { status: ["open"], sort: "newest", search: SEARCH, limit: LIMIT, cursor });
    const { results, nextCursor } = await list;
    const t1 = performance.now();
    times.push(t1 - t0);
    cursor = nextCursor;
    if (!cursor) break;
    await sleep(50);
  }

  if (!EXPLAIN) {
    const { p50, p95 } = stats(times);
    console.log(
      JSON.stringify(
        {
          branch: process.env.BRANCH ?? "local",
          search: SEARCH,
          pages: PAGES,
          limit: LIMIT,
          times_ms: times.map((t) => Math.round(t)),
          p50_ms: Math.round(p50),
          p95_ms: Math.round(p95),
        },
        null,
        2,
      ),
    );
    return;
  }

  // EXPLAIN (ANALYZE) for the actual code path at the last page boundary
  // Walk to compute cursor for the target page
  let explainCursor: string | null = null;
  {
    let c: string | null = null;
    for (let i = 0; i < Math.max(0, PAGES - 1); i++) {
      const { list } = await searchConversations(mailbox, { status: ["open"], sort: "newest", search: SEARCH, limit: LIMIT, cursor: c });
      const { nextCursor } = await list;
      c = nextCursor;
      if (!c) break;
    }
    explainCursor = c;
  }

  // Build WHERE from the real code path to include all filters and matches
  const { where: realWhere, metadataEnabled } = await searchConversations(mailbox, {
    status: ["open"],
    sort: "newest",
    search: SEARCH,
    limit: LIMIT,
    cursor: explainCursor ?? undefined,
  });

  // Sorting mirrors the real code path for open tickets
  const orderByField = sql`COALESCE(${conversations.lastMessageAt}, ${conversations.createdAt})`;
  const primaryOrderDesc = true; // open tickets default to newest first
  const orderClause = primaryOrderDesc
    ? sql`${desc(orderByField)}, ${desc(conversations.id)}`
    : sql`${asc(orderByField)}, ${asc(conversations.id)}`;

  // Decode cursor and build keyset predicate (timestamp + id)
  const decodeCursor = (cur: string): { ts: string | null; id: number } | null => {
    try {
      return JSON.parse(Buffer.from(cur, "base64").toString("utf8"));
    } catch {
      return null;
    }
  };
  const decoded = explainCursor ? decodeCursor(explainCursor) : null;
  const cursorPredicate: SQL | null = decoded
    ? primaryOrderDesc
      ? sql`(${orderByField}) < ${decoded.ts}::timestamptz OR ((${orderByField}) = ${decoded.ts}::timestamptz AND ${conversations.id} < ${decoded.id})`
      : sql`(${orderByField}) > ${decoded.ts}::timestamptz OR ((${orderByField}) = ${decoded.ts}::timestamptz AND ${conversations.id} > ${decoded.id})`
    : null;

  // Construct the same SELECT shape (recent_message LATERAL) and run EXPLAIN
  const plan = await db.execute(sql`
    EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
    SELECT
      ${conversations.id} as id,
      ${conversations.slug} as slug,
      ${conversations.subject} as subject,
      ${conversations.emailFrom} as email_from,
      ${conversations.createdAt} as created_at,
      ${conversations.lastMessageAt} as last_message_at,
      rm.cleaned_up_text as recent_message_text,
      rm.created_at as recent_message_at
    FROM ${conversations}
    LEFT JOIN ${platformCustomers} ON ${eq(conversations.emailFrom, platformCustomers.email)}
    LEFT JOIN LATERAL (
      SELECT ${conversationMessages.cleanedUpText} as cleaned_up_text, ${conversationMessages.createdAt} as created_at
      FROM ${conversationMessages}
      WHERE ${and(
        eq(conversationMessages.conversationId, conversations.id),
        inArray(conversationMessages.role, ["user", "staff"]),
        isNull(conversationMessages.deletedAt),
      )}
      ORDER BY ${desc(conversationMessages.createdAt)}
      LIMIT 1
    ) rm ON true
    WHERE ${and(...Object.values(realWhere), cursorPredicate ?? sql`true`)}
    ORDER BY ${orderClause}
    LIMIT ${LIMIT}
  `);

  // Print the plan output
  console.log(plan.rows.map((r: any) => r["QUERY PLAN"]).join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


