import "server-only";
import { db } from "@/db/client";
import { conversations, conversationMessages, platformCustomers } from "@/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  const numConvos = Number.parseInt(process.argv[2] || "200", 10);
  const msgsPerConvo = Number.parseInt(process.argv[3] || "20", 10);
  const now = Date.now();

  for (let i = 0; i < numConvos; i++) {
    const email = `seed_${now}_${i}@example.com`;

    // Create conversation (open, not merged)
    const [conv] = await db
      .insert(conversations)
      .values({
        emailFrom: email,
        subject: `Seeded conversation #${i}`,
        status: "open",
        lastUserEmailCreatedAt: new Date(now - i * 1000 * 60),
        createdAt: new Date(now - i * 1000 * 60 * 2),
      })
      .returning();

    // Ensure platform customer exists
    await db.execute(sql`
      INSERT INTO "mailboxes_platformcustomer" (email, value, created_at, updated_at, mailbox_id)
      VALUES (${email}, ${(i % 100) * 100}, NOW(), NOW(), 0)
      ON CONFLICT (email) DO NOTHING;
    `);

    // Create messages alternating user/staff, increasing created_at
    for (let m = 0; m < msgsPerConvo; m++) {
      const isUser = m % 2 === 0;
      const createdAt = new Date(now - (i * 1000 * 60) - (msgsPerConvo - m) * 1000);
      await db.insert(conversationMessages).values({
        conversationId: conv.id,
        role: isUser ? "user" : "staff",
        body: `Seeded message ${m} for conversation ${conv.id}`,
        cleanedUpText: `Seeded message ${m}`,
        isPerfect: false,
        isFlaggedAsBad: false,
        createdAt,
      });
    }
  }
  console.log(`Seeded ${numConvos} conversations with ${msgsPerConvo} messages each`);
}

main().catch((e) => { console.error(e); process.exit(1); });
