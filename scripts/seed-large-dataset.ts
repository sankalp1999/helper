#!/usr/bin/env tsx
import { faker } from "@faker-js/faker";
import { subDays, subHours } from "date-fns";
import { conversationMessagesFactory } from "@tests/support/factories/conversationMessages";
import { conversationFactory } from "@tests/support/factories/conversations";

const NUM_CONVERSATIONS = 1000;
const MESSAGES_PER_CONVERSATION = 5;

async function seedLargeDataset() {
  console.log(`🌱 Seeding ${NUM_CONVERSATIONS} conversations with ${MESSAGES_PER_CONVERSATION} messages each...`);
  
  for (let i = 0; i < NUM_CONVERSATIONS; i++) {
    if (i % 100 === 0) {
      console.log(`Progress: ${i}/${NUM_CONVERSATIONS} conversations`);
    }
    
    const { conversation } = await conversationFactory.create({
      subject: faker.lorem.sentence(),
      emailFrom: faker.internet.email(),
      emailFromName: faker.person.fullName(),
      status: faker.helpers.arrayElement(["open", "closed", "spam"]),
      conversationProvider: faker.helpers.arrayElement(["gmail", "helpscout", "chat"]),
      lastUserEmailCreatedAt: subHours(new Date(), i),
      createdAt: subDays(new Date(), Math.floor(i / 10)),
    });

    for (let j = 0; j < MESSAGES_PER_CONVERSATION; j++) {
      await conversationMessagesFactory.create(conversation.id, {
        role: faker.helpers.arrayElement(["user", "staff", "ai_assistant"]),
        body: faker.lorem.paragraphs(2),
        cleanedUpText: faker.lorem.paragraphs(2),
        createdAt: subHours(conversation.createdAt, j),
      });
    }
  }
  
  console.log(`✅ Seeded ${NUM_CONVERSATIONS} conversations with ${NUM_CONVERSATIONS * MESSAGES_PER_CONVERSATION} messages`);
}

seedLargeDataset().catch(console.error);