import { createContext, useCallback, useContext, useRef } from "react";
import { useConversationListContext } from "@/app/(dashboard)/mailboxes/[mailbox_slug]/[category]/list/conversationListContext";
import { toast } from "@/components/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { assertDefined } from "@/components/utils/assert";
import { captureExceptionAndThrowIfDevelopment } from "@/lib/shared/sentry";
import { RouterInputs, RouterOutputs } from "@/trpc";
import { api } from "@/trpc/react";

type ConversationContextType = {
  conversationSlug: string;
  mailboxSlug: string;
  data: RouterOutputs["mailbox"]["conversations"]["get"] | null;
  isPending: boolean;
  error: { message: string } | null;
  refetch: () => void;
  updateStatus: (status: "closed" | "spam" | "open") => Promise<void>;
  updateConversation: (inputs: Partial<RouterInputs["mailbox"]["conversations"]["update"]>) => Promise<void>;
  isUpdating: boolean;
};

const ConversationContext = createContext<ConversationContextType | null>(null);

export function useConversationQuery(mailboxSlug: string, conversationSlug: string | null) {
  const result = api.mailbox.conversations.get.useQuery(
    {
      mailboxSlug,
      conversationSlug: conversationSlug ?? "",
    },
    {
      enabled: !!conversationSlug,
    },
  );

  return conversationSlug ? result : null;
}

export const ConversationContextProvider = ({ children }: { children: React.ReactNode }) => {
  const {
    mailboxSlug,
    currentConversationSlug,
    removeConversation,
    removeConversationKeepActive,
    navigateToConversation,
  } = useConversationListContext();
  const conversationSlug = assertDefined(
    currentConversationSlug,
    "ConversationContext can only be used when currentConversationSlug is defined",
  );
  const {
    data = null,
    isPending,
    error,
    refetch,
  } = assertDefined(useConversationQuery(mailboxSlug, currentConversationSlug));

  const previousStatusRef = useRef<"closed" | "spam" | "open" | undefined>(data?.status);

  // Helper to get contextual verb for status changes
  const getStatusVerb = (status?: "closed" | "spam" | "open") => {
    switch (status) {
      case "open":
        return "reopening";
      case "closed":
        return "closing";
      case "spam":
        return "marking as spam";
      case undefined:
      default:
        return "updating";
    }
  };

  const utils = api.useUtils();
  const { mutateAsync: updateConversation, isPending: isUpdating } = api.mailbox.conversations.update.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing queries to prevent race conditions
      await utils.mailbox.conversations.get.cancel({
        mailboxSlug,
        conversationSlug: variables.conversationSlug,
      });
      // Snapshot current data for rollback on error
      const previousData = utils.mailbox.conversations.get.getData({
        mailboxSlug,
        conversationSlug: variables.conversationSlug,
      });
      // Capture previous status here instead of using ref to avoid race conditions
      const previousStatus = previousData?.status;
      if (previousStatus) {
        previousStatusRef.current = previousStatus;
      }
      // Optimistically update cache - only merge status if explicitly provided and not undefined
      // Guard prevents wiping status to undefined when caller does update({subject: "foo"})
      const hasStatus = Object.prototype.hasOwnProperty.call(variables, "status") && variables.status !== undefined;
      utils.mailbox.conversations.get.setData(
        {
          mailboxSlug,
          conversationSlug: variables.conversationSlug,
        },
        (old) => (old ? { ...old, ...(hasStatus ? { status: variables.status } : {}) } : old),
      );
      return { previousData, previousStatus };
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousData) {
        utils.mailbox.conversations.get.setData(
          {
            mailboxSlug,
            conversationSlug: variables.conversationSlug,
          },
          context.previousData,
        );
      }

      // Show error toast with contextual action description
      toast({
        variant: "destructive",
        title: `Error ${getStatusVerb(variables.status)} conversation`,
        description: error.message,
      });
    },
    onSettled: (_, __, variables) => {
      // Refetch to ensure consistency regardless of success/error
      utils.mailbox.conversations.get.invalidate({
        mailboxSlug,
        conversationSlug: variables.conversationSlug,
      });
    },
  });

  const update = async (inputs: Partial<RouterInputs["mailbox"]["conversations"]["update"]>) => {
    await updateConversation({ mailboxSlug, conversationSlug, ...inputs });
  };

  const updateStatus = useCallback(
    async (status: "closed" | "spam" | "open") => {
      const previousStatus = previousStatusRef.current;

      await update({ status });

      if (status === "open") {
        removeConversationKeepActive();
        toast({
          title: "Conversation reopened",
          variant: "success",
        });
      } else {
        removeConversation();
        if (status === "closed") {
          toast({
            title: "Conversation closed",
            variant: "success",
          });
        }
      }

      if (status === "spam") {
        // Capture previous status now to avoid race conditions
        const undoStatus = previousStatus ?? "open";
        toast({
          title: "Marked as spam",
          action: (
            <ToastAction
              altText="Undo"
              onClick={async () => {
                try {
                  await update({ status: undoStatus });
                  navigateToConversation(conversationSlug);
                  toast({
                    title: "No longer marked as spam",
                  });
                } catch (e) {
                  captureExceptionAndThrowIfDevelopment(e);
                  toast({
                    variant: "destructive",
                    title: "Failed to undo",
                  });
                }
              }}
            >
              Undo
            </ToastAction>
          ),
        });
      }
    },
    [update, removeConversation, removeConversationKeepActive, navigateToConversation, conversationSlug],
  );

  return (
    <ConversationContext.Provider
      value={{
        conversationSlug,
        mailboxSlug,
        data,
        isPending,
        error,
        refetch,
        updateStatus,
        updateConversation: update,
        isUpdating,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversationContext = () =>
  assertDefined(
    useContext(ConversationContext),
    "useConversationContext must be used within a ConversationContextProvider",
  );
