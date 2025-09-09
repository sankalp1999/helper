## Keyset vs OFFSET pagination performance (Conversations list)

### Test setup
- Single Postgres database seeded once with ~200k conversations and ~400k messages; very sparse occurrences of the keyword "sankalp" in message bodies and `search_index`.
- Compared two branches against the same DB and environment: `main` (OFFSET/LIMIT) vs `sankalp/optimise-search` (keyset/cursor).
- Measured SQL-only performance and plans for page 20, limit 50 using `scripts/bench/bench-sql.ts` with EXPLAIN (ANALYZE, BUFFERS, VERBOSE).
- Query includes a lateral subquery to fetch the most recent message per conversation.

### Results (page 20, limit 50)

| Mode | Execution Time | Shared Buffers (hit/read) | Temp Buffers (read/written) | Notable operators |
|---|---:|---|---|---|
| OFFSET (main) | ~713.8 ms | 3555 / 5686 | 1306 / 3395 | Parallel Seq Scan on conversations → external Sort → Gather Merge; lateral message probe executed ~1000 times before the final LIMIT 50 |
| Keyset (branch) | ~54.4 ms | 2183 / 3225 | 1157 / 2289 | Cursor predicate prunes early within Parallel Seq Scan; external Sort persists; lateral message probe executed only 50 times |

### Plan excerpts

```text
-- OFFSET (main)
Sort Method: external merge  Disk: 8832kB
Parallel Seq Scan on conversations_conversation
Execution Time: 713.761 ms
```

```text
-- Keyset (branch)
Filter: (COALESCE(c.last_message_at, c.created_at) < '…') OR ((…) AND (c.id < …))
Sort Method: external merge  Disk: 7000kB
Execution Time: 54.424 ms
```

### Takeaways
- Deep pages: keyset is ~13× faster at page 20 (50 rows) on this dataset.
- Keyset’s cursor predicate prunes rows early, reducing scanned rows and shared/temp buffer I/O.
- Lateral recent-message probe drops from ~1000 evaluations (OFFSET) to 50 (keyset), matching the requested page size.
- Plans corroborate that OFFSET repeatedly scans and sorts larger sets as page depth grows, while keyset keeps per-page work roughly flat.

### Reproduce locally
```bash
# OFFSET (main)
git switch main
pnpm with-dev-env tsx scripts/bench/bench-sql.ts --mode=offset --pages=20 --limit=50 --explain=1 | tee bench-offset-20.json

# Keyset (branch)
git switch sankalp/optimise-search
pnpm with-dev-env tsx scripts/bench/bench-sql.ts --mode=keyset --pages=20 --limit=50 --explain=1 | tee bench-keyset-20.json
```


