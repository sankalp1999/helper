-- Speeds the LATERAL subquery that selects the most recent user/staff message per conversation
-- Used by lib/data/conversation/search.ts when building the conversation list

CREATE INDEX CONCURRENTLY IF NOT EXISTS "messages_conversation_created_at_desc_idx"
  ON "messages" ("conversation_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL AND "role" IN ('user','staff');


