import { TRPCError, TRPCRouterRecord } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { Resend } from "resend";
import { z } from "zod";
import { assertDefined } from "@/components/utils/assert";
import { db } from "@/db/client";
import { authUsers } from "@/db/supabaseSchema/auth";
import { setupMailboxForNewUser } from "@/lib/auth/authService";
import { cacheFor } from "@/lib/cache";
import { getFullName } from "@/lib/auth/authUtils";
import OtpEmail from "@/lib/emails/otp";
import { env } from "@/lib/env";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { createAdminClient } from "@/lib/supabase/server";
import { protectedProcedure, publicProcedure } from "../trpc";

export const userRouter = {
  getAll: protectedProcedure.query(async () => {
    const users = await db.query.authUsers.findMany({
      columns: {
        id: true,
        email: true,
        user_metadata: true,
      },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: getFullName(user),
    }));
  }),
  startSignIn: publicProcedure.input(z.object({ email: z.string() })).mutation(async ({ input }) => {
    const user = await db.query.authUsers.findFirst({
      where: eq(authUsers.email, input.email),
    });
    if (!user) {
      const [_, emailDomain] = input.email.split("@");
      if (emailDomain && env.EMAIL_SIGNUP_DOMAINS.some((domain) => domain === emailDomain)) {
        return { signupPossible: true };
      }

      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const { data, error } = await createAdminClient().auth.admin.generateLink({
      type: "recovery",
      email: user.email ?? "",
    });
    if (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate OTP",
      });
    }

    if (env.RESEND_API_KEY && env.RESEND_FROM_ADDRESS) {
      const resend = new Resend(env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: env.RESEND_FROM_ADDRESS,
        to: assertDefined(user.email),
        subject: "Your OTP for Helper",
        react: OtpEmail({ otp: data.properties.email_otp }),
      });
      if (error) {
        captureExceptionAndLog(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send OTP: ${error.message}`,
        });
      }
      return { email: true };
    }

    await cacheFor<string>(`otp:${user.id}`).set(data.properties.email_otp.toString(), 60 * 5);
    let dashboardUrl: string | null = null;
    const [_, projectId] = /https:\/\/([a-zA-Z0-9_-]+)\.supabase\.co/.exec(env.NEXT_PUBLIC_SUPABASE_URL) ?? [];
    if (projectId) {
      const {
        rows: [cacheTable],
      } = await db.execute(sql`
        SELECT c.oid AS id
        FROM pg_class c
        JOIN pg_namespace nc ON nc.oid = c.relnamespace
        WHERE c.relname = 'cache' AND nc.nspname = 'public'
      `);
      dashboardUrl = `https://supabase.com/dashboard/project/${projectId}/editor/${cacheTable?.id}?filter=key:eq:otp:${user.id}`;
    }
    return { email: false, dashboardUrl, otp: env.NODE_ENV === "development" ? data.properties.email_otp : undefined };
  }),
  createUser: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        displayName: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const supabase = createAdminClient();
      const { error } = await supabase.auth.admin.createUser({
        email: input.email,
        user_metadata: {
          display_name: input.displayName,
        },
      });
      if (error) throw error;
      return { success: true };
    }),
  onboard: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        displayName: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const existingMailbox = await db.query.mailboxes.findFirst({
        columns: { id: true },
      });

      if (existingMailbox) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A mailbox already exists. Please use the login form instead.",
        });
      }

      const supabase = createAdminClient();
      const { data: userData, error: createUserError } = await supabase.auth.admin.createUser({
        email: input.email,
        user_metadata: {
          display_name: input.displayName,
        },
        email_confirm: true,
      });

      if (createUserError) throw createUserError;
      if (!userData.user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user",
        });
      }

      await setupMailboxForNewUser(userData.user);

      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email: userData.user.email ?? "",
      });

      if (linkError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate OTP",
        });
      }

      return {
        otp: linkData.properties.email_otp,
      };
    }),
} satisfies TRPCRouterRecord;
