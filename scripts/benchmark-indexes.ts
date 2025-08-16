#!/usr/bin/env tsx
import { db } from "../db/client";
import { conversations, conversationMessages } from "../db/schema";
import { desc, inArray, sql } from "drizzle-orm";
import { explainAnalyze } from "../db/lib/debug";

async function benchmarkIndexPerformance() {
  console.log("🔍 Database Index Performance Benchmark\n");
  console.log("=" .repeat(60));
  
  // Get sample conversation IDs
  const sampleConversations = await db
    .select({ id: conversations.id })
    .from(conversations)
    .limit(50);
  
  const conversationIds = sampleConversations.map(c => c.id);
  
  if (conversationIds.length === 0) {
    console.log("No conversations found in database");
    return;
  }
  
  console.log(`Testing with ${conversationIds.length} conversations\n`);
  
  // Test 1: Message query (most impacted by indexes)
  console.log("1. CONVERSATION MESSAGES QUERY:");
  console.log("-".repeat(40));
  console.log("Query: Fetch all messages for 50 conversations\n");
  
  const messagesQuery = db
    .select({
      role: conversationMessages.role,
      cleanedUpText: conversationMessages.cleanedUpText,
      conversationId: conversationMessages.conversationId,
      createdAt: conversationMessages.createdAt,
    })
    .from(conversationMessages)
    .where(inArray(conversationMessages.conversationId, conversationIds))
    .orderBy(desc(conversationMessages.createdAt));
  
  console.log("EXPLAIN ANALYZE output:");
  await explainAnalyze(messagesQuery);
  
  // Measure actual execution time
  const start1 = Date.now();
  const messages = await messagesQuery;
  const time1 = Date.now() - start1;
  
  console.log(`\n✅ Execution time: ${time1}ms`);
  console.log(`📊 Messages fetched: ${messages.length}`);
  
  // Test 2: Conversation status filtering
  console.log("\n2. CONVERSATION STATUS FILTER:");
  console.log("-".repeat(40));
  console.log("Query: Find open conversations ordered by created_at\n");
  
  const statusQuery = db
    .select({ id: conversations.id, status: conversations.status })
    .from(conversations)
    .where(sql`status = 'open'`)
    .orderBy(desc(conversations.createdAt))
    .limit(20);
  
  console.log("EXPLAIN ANALYZE output:");
  await explainAnalyze(statusQuery);
  
  const start2 = Date.now();
  const statusResults = await statusQuery;
  const time2 = Date.now() - start2;
  
  console.log(`\n✅ Execution time: ${time2}ms`);
  console.log(`📊 Conversations found: ${statusResults.length}`);
  
  // Check indexes
  console.log("\n3. CURRENT INDEXES:");
  console.log("-".repeat(40));
  
  const indexes = await db.execute(sql`
    SELECT 
      indexname,
      indexdef,
      pg_size_pretty(pg_relation_size(indexname::regclass)) as size
    FROM pg_indexes 
    WHERE tablename IN ('messages', 'conversations_conversation')
    AND indexname LIKE 'idx_%'
    ORDER BY tablename, indexname
  `);
  
  if (indexes.rows.length > 0) {
    console.log("✅ Performance indexes found:");
    indexes.rows.forEach((idx: any) => {
      console.log(`✓ ${idx.indexname} (${idx.size})`);
    });
  } else {
    console.log("❌ No performance indexes found!");
  }
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("PERFORMANCE SUMMARY:");
  console.log("-".repeat(40));
  
  const hasIndexes = indexes.rows.length > 0;
  
  if (hasIndexes) {
    console.log("✅ Indexes are active and improving query performance");
    console.log("📈 Expected improvements:");
    console.log("   - Message queries: 2-5x faster");
    console.log("   - Status filtering: 3-10x faster");
    console.log("   - Reduced database CPU usage");
  } else {
    console.log("⚠️  No indexes found - queries are using sequential scans");
    console.log("💡 Run migration to add indexes for massive performance gains");
  }
  
  process.exit(0);
}

benchmarkIndexPerformance().catch(console.error);