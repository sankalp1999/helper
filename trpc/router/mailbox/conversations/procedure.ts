import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { protectedProcedure } from "@/trpc/trpc";
import { getMailboxBySlug } from "@/lib/data/mailbox";

export const conversationProcedure = protectedProcedure
  .input(z.object({ mailboxSlug: z.string(), conversationSlug: z.string() }))
  .use(async ({ ctx, input, next }) => {
    const mailbox = await getMailboxBySlug(input.mailboxSlug);
    if (!mailbox) throw new TRPCError({ code: "NOT_FOUND" });

    const conversation = await db.query.conversations.findFirst({
      where: and(eq(conversations.slug, input.conversationSlug), eq(conversations.mailboxId, mailbox.id)),
    });

    if (!conversation) throw new TRPCError({ code: "NOT_FOUND" });

    return next({ ctx: { ...ctx, mailbox, conversation } });
  });
