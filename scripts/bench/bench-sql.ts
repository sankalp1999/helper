/* eslint-disable no-console */
import "dotenv/config";
import { Client } from "pg";
import { env } from "@/lib/env";

// Usage:
// pnpm with-dev-env tsx scripts/bench/bench-sql.ts --mode=offset --pages=5 --limit=50
// pnpm with-dev-env tsx scripts/bench/bench-sql.ts --mode=keyset --pages=5 --limit=50

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")));
const mode = (args["--mode"] ?? "offset") as "offset" | "keyset";
const pages = parseInt(args["--pages"] ?? "5", 10);
const limit = parseInt(args["--limit"] ?? "50", 10);
const explain = args["--explain"] === "1" || args["--explain"] === "true";

const ORDER_EXPR = `COALESCE(c.last_message_at, c.created_at)`;

function makePageSql(pageIdx: number, cursor?: { ts: string | null; id: number }) {
  const base = `
    SELECT
      c.id, c.slug, c.subject, c.email_from, c.created_at, c.last_message_at,
      rm.cleaned_up_text AS recent_message_text,
      rm.created_at AS recent_message_at
    FROM conversations_conversation c
    LEFT JOIN LATERAL (
      SELECT m.cleaned_up_text, m.created_at
      FROM messages m
      WHERE m.conversation_id = c.id
        AND m.role IN ('user','staff')
        AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT 1
    ) rm ON true
    WHERE c.merged_into_id IS NULL
      AND (c.status = 'open' OR c.status IS NULL)
  `;

  if (mode === "offset") {
    const offset = pageIdx * limit;
    const sql = `${base}
      ORDER BY ${ORDER_EXPR} DESC, c.id DESC
      LIMIT ${limit} OFFSET ${offset}`;
    return { sql, params: [] as any[] };
  } else {
    let predicate = "";
    const params: any[] = [];
    if (cursor) {
      predicate = ` AND ( ${ORDER_EXPR} < $1 OR (${ORDER_EXPR} = $1 AND c.id < $2) )`;
      params.push(cursor.ts ?? new Date(0).toISOString());
      params.push(cursor.id);
    }
    const sql = `${base}
      ${predicate}
      ORDER BY ${ORDER_EXPR} DESC, c.id DESC
      LIMIT ${limit}`;
    return { sql, params };
  }
}

function stats(ns: number[]) {
  const s = [...ns].sort((a, b) => a - b);
  const p50 = s[Math.floor(0.5 * (s.length - 1))] ?? 0;
  const p95 = s[Math.floor(0.95 * (s.length - 1))] ?? 0;
  return { p50, p95 };
}

async function main() {
  const url = env.POSTGRES_URL || env.DATABASE_URL;
  if (!url) throw new Error("POSTGRES_URL not set (via env loader)");
  const client = new Client({ connectionString: url });
  await client.connect();

  const times: number[] = [];
  let cursor: { ts: string | null; id: number } | undefined;

  if (!explain) {
    for (let p = 0; p < pages; p++) {
      const { sql, params } = makePageSql(p, cursor);
      const t0 = performance.now();
      const res = await client.query(sql, params);
      const t1 = performance.now();
      times.push(t1 - t0);
      if (mode === "keyset") {
        const last = res.rows[res.rows.length - 1];
        if (!last) break;
        cursor = { ts: last.recent_message_at ?? last.last_message_at ?? last.created_at, id: last.id };
      }
    }
  } else {
    // For EXPLAIN, target the last requested page
    if (mode === "keyset") {
      // Walk pages to compute cursor of the last page without EXPLAIN
      for (let p = 0; p < pages - 1; p++) {
        const { sql, params } = makePageSql(p, cursor);
        const res = await client.query(sql, params);
        const last = res.rows[res.rows.length - 1];
        if (!last) break;
        cursor = { ts: last.recent_message_at ?? last.last_message_at ?? last.created_at, id: last.id };
      }
    }
    const { sql, params } = makePageSql(pages - 1, cursor);
    const plan = await client.query(`EXPLAIN (ANALYZE, BUFFERS, VERBOSE) ${sql}`, params);
    console.log(plan.rows.map((r: any) => r["QUERY PLAN"]).join("\n"));
    await client.end();
    return;
  }

  const { p50, p95 } = stats(times);
  console.log(
    JSON.stringify(
      {
        mode,
        pages,
        limit,
        times_ms: times.map((t) => Math.round(t)),
        p50_ms: Math.round(p50),
        p95_ms: Math.round(p95),
      },
      null,
      2,
    ),
  );

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


