/* eslint-disable no-console */
import "dotenv/config";
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
    const { list } = await searchConversations(mailbox, { status: ["open"], search: SEARCH, limit: LIMIT });
    await list;
  }

  const times: number[] = [];
  let cursor: string | null = null;

  for (let i = 0; i < PAGES; i++) {
    const t0 = performance.now();
    const { list } = await searchConversations(mailbox, { status: ["open"], search: SEARCH, limit: LIMIT, cursor });
    const { results, nextCursor } = await list;
    const t1 = performance.now();
    times.push(t1 - t0);
    cursor = nextCursor;
    if (!cursor) break;
    await sleep(50);
  }

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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


