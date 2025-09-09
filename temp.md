## Benchmark Results

### Test Setup
- **Database**: ~220k conversations, ~400k messages
- **Script**: `scripts/bench/conversations.ts` - measures real application code path performance
- **Configuration**: `--pages=20 --limit=50` (paginate through 20 pages of 50 conversations each)
- **Environment**: Node.js 22, development database
- **Branches**: `main` vs `sankalp/optimise-search` (keyset/cursor pagination)
- **Search term**: `download` (filters conversations containing "download" in email_from or message content)
- **Flags**:
  - `--pages=20`: Test pagination through 20 pages
  - `--limit=50`: 50 conversations per page  
  - `--search=download`: Apply search filter
  - `--explain=1`: Generate EXPLAIN ANALYZE for last page query

### Results

| Branch | Search | P50 (ms) | P95 (ms) | DB Time (ms) |
|--------|--------|----------|----------|--------------|
| main | none | 593 | 633 | 111.6 |
| main | download | 163 | 192 | 55.2 |
| **optimized** | none | **653** | **1516** | **139.1** |
| **optimized** | download | 165 | 191 | 65.5 |
