import cx from "classnames";
import { useMemo, useState, type JSX } from "react";
import type { AttachedFile, Conversation, Message as MessageType, Note as NoteType } from "@/app/types/global";
import HumanizedTime from "@/components/humanizedTime";
import { FlagAsBadAction } from "./flagAsBadAction";
import "@/components/linkCta.css";
import { truncate } from "lodash-es";
import {
  Bot,
  Download,
  Edit,
  Frown,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/hooks/use-toast";
import { useUsers } from "@/components/hooks/use-users";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { api } from "@/trpc/react";
import { renderMessageBody } from "./renderMessageBody";

function getPreviewUrl(file: AttachedFile): string {
  return file.previewUrl
    ? file.previewUrl
    : file.mimetype.startsWith("video/")
      ? "/images/attachment-preview-video.svg"
      : "/images/attachment-preview-default.svg";
}

const hasReasoningMetadata = (metadata: any): metadata is { reasoning: string } => {
  return metadata && typeof metadata.reasoning === "string";
};

const MessageItem = ({
  mailboxSlug,
  conversation,
  message,
  onViewDraftedReply,

  onPreviewAttachment,
}: {
  mailboxSlug: string;
  conversation: Conversation;
  message: (MessageType | NoteType) & { isNew?: boolean };
  onPreviewAttachment?: (index: number) => void;
  onViewDraftedReply?: () => void;
}) => {
  const userMessage = message.role === "user";
  const rightAlignedMessage = !userMessage || message.type === "note";
  const isAIMessage = message.type === "message" && message.role === "ai_assistant";
  const hasReasoning = isAIMessage && hasReasoningMetadata(message.metadata);
  const router = useRouter();
  const { usersById } = useUsers();

  const messageLabels: JSX.Element[] = [];
  
  const getDisplayName = () => {
    if (message.from) return message.from;
    
    if (message.role === "staff" && "userId" in message && message.userId) {
      const user = usersById[message.userId];
      return user?.displayName || "Unknown User";
    }
    
    if (message.type === "note" && "userId" in message && message.userId) {
      const user = usersById[message.userId];
      return user?.displayName || "Unknown User";
    }
    
    return message.role === "user" ? "Anonymous" : "Helper agent";
  };
  
  messageLabels.push(
    <span key={`${message.id}-from`} className="flex items-center gap-1">
      {userMessage ? (
        conversation.source === "email" ? (
          <Mail className="h-3 w-3" />
        ) : (
          <MessageSquare className="h-3 w-3" />
        )
      ) : message.type === "note" ? (
        <Edit className="h-3 w-3" />
      ) : message.from ? (
        <User className="h-3 w-3" />
      ) : (
        <Bot className="h-3 w-3" />
      )}
      {getDisplayName()}
    </span>,
  );
  if (message.type === "message" && message.emailTo)
    messageLabels.push(
      <span key={`${message.id}-to`} className="flex items-center gap-1">
        to: <span>{message.emailTo}</span>
      </span>,
    );
  if (message.type === "message" && message.cc.length > 0)
    messageLabels.push(
      <span key={`${message.id}-cc`} className="flex items-center gap-1">
        cc:{" "}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{truncate(message.cc.join(", "), { length: 150 })}</span>
            </TooltipTrigger>
            {message.cc.join(", ").length > 150 ? (
              <TooltipContent>
                {message.cc.map((email, i) => (
                  <div key={i}>{email}</div>
                ))}
              </TooltipContent>
            ) : null}
          </Tooltip>
        </TooltipProvider>
      </span>,
    );
  if (message.type === "message" && message.bcc.length > 0)
    messageLabels.push(
      <span key={`${message.id}-bcc`} className="flex items-center gap-1">
        bcc:{" "}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{truncate(message.bcc.join(", "), { length: 150 })}</span>
            </TooltipTrigger>
            {message.bcc.join(", ").length > 150 ? (
              <TooltipContent>
                {message.bcc.map((email, i) => (
                  <div key={i}>{email}</div>
                ))}
              </TooltipContent>
            ) : null}
          </Tooltip>
        </TooltipProvider>
      </span>,
    );

  const addSeparator = (array: JSX.Element[], separator: string): JSX.Element[] =>
    array.reduce<JSX.Element[]>(
      (acc, curr, index) =>
        index === 0 ? [curr] : [...acc, <span key={`${message.id}-separator-${index}`}>{separator}</span>, curr],
      [],
    );

  const [showQuotedContext, setShowQuotedContext] = useState(false);

  const isChatMessage =
    message.type === "message" && message.role === "user" && conversation.source !== "email" && !message.emailTo;
  const { mainContent, quotedContext } = useMemo(
    () =>
      renderMessageBody({
        body: message.body,
        isMarkdown: isChatMessage || message.type === "note" || isAIMessage,
        className: "lg:prose-base prose-sm **:text-foreground! **:bg-transparent!",
      }),
    [message.body, message.type, isAIMessage],
  );

  const splitMergedMutation = api.mailbox.conversations.splitMerged.useMutation({
    onSuccess: (conversation) => {
      router.push(`/mailboxes/${mailboxSlug}/conversations?id=${conversation.slug}`);
    },
    onError: (e) => {
      captureExceptionAndLog(e);
      toast({
        title: "Failed to split conversation",
        variant: "destructive",
      });
    },
  });

  return (
    <div data-message-item data-type={message.type} data-id={message.id} className="responsive-break-words grid">
      <div className={`flex ${rightAlignedMessage ? "justify-end" : ""}`}>
        <div className={`flex flex-col gap-2 ${rightAlignedMessage ? "items-end" : ""}`}>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {addSeparator(messageLabels, "·")}
          </div>
          <div className="flex items-start gap-2">
            <div
              className={cx(
                "inline-block rounded-lg p-4",
                message.type === "note"
                  ? "border border-bright/50"
                  : rightAlignedMessage
                    ? "border md:bg-muted md:border-none"
                    : "bg-muted",
              )}
            >
              {mainContent}
              {quotedContext ? (
                <>
                  <button
                    onClick={() => setShowQuotedContext(!showQuotedContext)}
                    className={cx(
                      "my-2 flex h-3 w-8 items-center justify-center rounded-full outline-hidden transition-colors duration-200",
                      showQuotedContext
                        ? "bg-muted-foreground text-muted-foreground"
                        : "bg-border text-muted-foreground hover:text-muted-foreground",
                    )}
                  >
                    <MoreHorizontal className="h-8 w-8" />
                  </button>
                  {showQuotedContext ? quotedContext : null}
                </>
              ) : null}
            </div>
          </div>
          <div className="flex w-full items-center gap-3 text-sm text-muted-foreground">
            {message.type === "message" && message.isMerged && (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        if (confirm("Are you sure you want to separate this conversation?")) {
                          splitMergedMutation.mutate({ messageId: message.id, mailboxSlug });
                        }
                      }}
                    >
                      <Download className="h-4 w-4" />
                      <span className="text-xs">Merged</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Automatically merged based on similarity. Click to split.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {message.isNew && <div className="h-[0.5rem] w-[0.5rem] rounded-full bg-blue-500" />}
            {hasReasoning && !userMessage && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs">View AI reasoning</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[min(calc(100vw-2rem),400px)]"
                  align="start"
                  side="top"
                  avoidCollisions
                  collisionPadding={16}
                >
                  <div className="space-y-2">
                    <h4 className="font-medium">AI Reasoning</h4>
                    <div className="max-h-[300px] overflow-y-auto">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {isAIMessage && hasReasoningMetadata(message.metadata) && message.metadata.reasoning}
                      </p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {message.type === "message" && message.reactionType && (
              <span className="inline-flex items-center gap-1 text-xs">
                {message.reactionType === "thumbs-up" ? (
                  <ThumbsUp size={14} className="text-green-500" />
                ) : (
                  <ThumbsDown size={14} className="text-red-500" />
                )}
                {message.reactionFeedback}
              </span>
            )}
            {message.type === "message" && message.isFlaggedAsBad && (
              <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                <Frown size={14} className="text-red-500" /> {message.reason ?? "Flagged as bad"}
              </span>
            )}
            <div className="flex flex-1 items-center gap-2">
              <div
                className={cx("flex flex-1 items-center gap-2", {
                  "justify-end": rightAlignedMessage,
                })}
              >
                <HumanizedTime time={message.createdAt} />
                {message.type === "message" && message.slackUrl && (
                  <span>
                    <a target="_blank" href={message.slackUrl}>
                      &nbsp;{message.role === "user" ? "alerted on Slack" : "via Slack"}
                    </a>
                  </span>
                )}
                {onViewDraftedReply && (
                  <span>
                    &nbsp;·{" "}
                    <button className="cursor-pointer underline" onClick={onViewDraftedReply}>
                      View drafted reply
                    </button>
                  </span>
                )}
              </div>
              {message.type === "message" && message.status === "failed" && (
                <div className="align-center flex items-center justify-center gap-0.5 text-sm text-destructive">
                  <XCircle className="h-4 w-4" />
                  <span>Message failed to send</span>
                </div>
              )}
              {message.type === "message" && message.role === "ai_assistant" && (
                <FlagAsBadAction message={message} conversationSlug={conversation.slug} mailboxSlug={mailboxSlug} />
              )}
            </div>
          </div>
          {message.files.length ? (
            <div
              className={`flex flex-wrap gap-2 overflow-x-auto pb-2 ${rightAlignedMessage ? "flex-row-reverse" : ""}`}
            >
              {message.files.map((file, idx) => (
                <a
                  key={idx}
                  href={file.presignedUrl ?? undefined}
                  title={file.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-40 flex-col overflow-hidden rounded-md border border-border hover:border-border"
                  onClick={(e) => {
                    if (onPreviewAttachment) {
                      e.preventDefault();
                      onPreviewAttachment(idx);
                    }
                  }}
                >
                  <div
                    className="h-24 w-full overflow-hidden rounded-t bg-cover bg-center"
                    style={{ backgroundImage: `url(${getPreviewUrl(file)})` }}
                  >
                    {}
                  </div>

                  <div className="inline-flex items-center gap-1 rounded-b border-t border-t-border p-2 text-xs">
                    <Paperclip className="h-4 w-4 shrink-0" />
                    <span className="max-w-[10rem] truncate" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
