/* eslint-disable no-console */
import "dotenv/config";
import { addHours, subDays } from "date-fns";
import { db } from "@/db/client";
import { conversationMessages, conversations } from "@/db/schema";
import { extractHashedWordsFromEmail } from "@/lib/emailSearchService/extractHashedWordsFromEmail";

// Usage:
// pnpm with-dev-env tsx --conditions=react-server scripts/bench/seedLarge.ts 20000 2
// args: [numConversations] [messagesPerConversation]

const numConversations = parseInt(process.argv[2] ?? "20000", 10);
const messagesPerConversation = parseInt(process.argv[3] ?? "2", 10);

type NewConversation = typeof conversations.$inferInsert;
type NewMessage = typeof conversationMessages.$inferInsert;

function randomDateWithinDays(days: number): Date {
  const now = new Date();
  const start = subDays(now, days).getTime();
  const end = now.getTime();
  return new Date(start + Math.floor(Math.random() * (end - start)));
}

async function seedConversations(count: number): Promise<{ id: number; createdAt: Date }[]> {
  const batchSize = 2000;
  const inserted: { id: number; createdAt: Date }[] = [];

  for (let i = 0; i < count; i += batchSize) {
    const batch: NewConversation[] = [];
    const thisBatch = Math.min(batchSize, count - i);
    for (let j = 0; j < thisBatch; j++) {
      const idx = i + j + 1;
      const createdAt = randomDateWithinDays(30);
      const lastMessageAt = addHours(createdAt, Math.floor(Math.random() * 24));
      batch.push({
        emailFrom: `loadtest+${idx}@example.com`,
        subject: `Bench Subject ${idx}`,
        status: "open",
        conversationProvider: "chat",
        createdAt,
        updatedAt: createdAt,
        lastMessageAt,
        source: "chat",
        isPrompt: false,
        isVisitor: false,
        assignedToAI: false,
      } as NewConversation);
    }

    const rows = await db
      .insert(conversations)
      .values(batch)
      .returning({ id: conversations.id, createdAt: conversations.createdAt });
    inserted.push(...rows);
    console.log(`Inserted conversations: ${inserted.length}/${count}`);
  }

  return inserted;
}

async function seedMessages(convs: { id: number; createdAt: Date }[], perConv: number) {
  const batchSize = 5000;
  const allMsgs: NewMessage[] = [];

  for (const c of convs) {
    for (let k = 0; k < perConv; k++) {
      const createdAt = addHours(c.createdAt, k);
      const role = k % 2 === 0 ? ("user" as const) : ("staff" as const);
      const includeKeyword = Math.random() < 0.002; // ~0.2% of messages include the keyword
      const body = includeKeyword && role === "user" ? `hello sankalp ${c.id}` : null;
      const cleaned = includeKeyword && role === "user" ? `hello sankalp ${c.id}` : role === "user" ? "download link issue" : "acknowledged";
      const searchTokens = await extractHashedWordsFromEmail({ body: cleaned });
      allMsgs.push({
        conversationId: c.id,
        role,
        emailFrom: role === "user" ? `loadtest+${c.id}@example.com` : null,
        body,
        cleanedUpText: cleaned,
        searchIndex: searchTokens.join(" "),
        createdAt,
        updatedAt: createdAt,
        isPinned: false,
        isPerfect: false,
        isFlaggedAsBad: false,
      } as NewMessage);
    }
  }

  for (let i = 0; i < allMsgs.length; i += batchSize) {
    const slice = allMsgs.slice(i, i + batchSize);
    await db.insert(conversationMessages).values(slice);
    console.log(`Inserted messages: ${Math.min(i + batchSize, allMsgs.length)}/${allMsgs.length}`);
  }
}

async function main() {
  console.log(`Seeding ${numConversations} conversations with ${messagesPerConversation} messages each...`);
  const convs = await seedConversations(numConversations);
  await seedMessages(convs, messagesPerConversation);
  console.log("Seeding completed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


