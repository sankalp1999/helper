"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import cx from "classnames";
import { jwtDecode } from "jwt-decode";
import { domAnimation, LazyMotion, m } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { HelperWidgetConfig, MESSAGE_TYPE, RESUME_GUIDE } from "@helperai/sdk";
import Conversation from "@/components/widget/Conversation";
import { eventBus, messageQueue } from "@/components/widget/eventBus";
import Header from "@/components/widget/Header";
import { useReadPageTool } from "@/components/widget/hooks/useReadPageTool";
import PreviousConversations from "@/components/widget/PreviousConversations";
import PromptDetailsModal from "@/components/widget/PromptDetailsModal";
import { useWidgetView } from "@/components/widget/useWidgetView";
import { useScreenshotStore } from "@/components/widget/widgetState";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { sendConversationUpdate, sendReadyMessage } from "@/lib/widget/messages";
import { GuideInstructions } from "@/types/guide";

type DecodedPayload = {
  isWhitelabel?: boolean;
  title?: string;
  exp?: number;
  iat?: number;
};

const queryClient = new QueryClient();

export default function Page() {
  const [token, setToken] = useState<string | null>(null);
  const [config, setConfig] = useState<HelperWidgetConfig | null>(null);
  const [defaultTitle, setDefaultTitle] = useState<string | null>(null);
  const [currentURL, setCurrentURL] = useState<string | null>(null);
  const [selectedConversationSlug, setSelectedConversationSlug] = useState<string | null>(null);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [pageHTML, setPageHTML] = useState<string | null>(null);
  const isGumroadTheme = typeof window !== "undefined" && location.hostname.includes("gumroad.com");
  const { readPageToolCall } = useReadPageTool(token, config, pageHTML, currentURL);
  const [resumeGuide, setResumeGuide] = useState<GuideInstructions | null>(null);

  const {
    currentView,
    isNewConversation,
    setCurrentView,
    setIsNewConversation,
    handleSelectConversation,
    handleNewConversation,
    showingPromptInfo,
    togglePromptInfo,
  } = useWidgetView();

  const { setScreenshot } = useScreenshotStore();

  const onSelectConversation = (slug: string) => {
    setIsNewConversation(false);
    setSelectedConversationSlug(slug);
    handleSelectConversation(slug);
    sendConversationUpdate(slug);
  };

  const onShowPreviousConversations = useCallback(() => {
    setHasLoadedHistory(true);
    setCurrentView("previous");
  }, [setCurrentView]);

  const memoizedHandleNewConversation = useCallback(() => {
    handleNewConversation();
    sendConversationUpdate(null);
  }, [handleNewConversation]);

  useEffect(() => {
    if (isNewConversation) {
      setSelectedConversationSlug(null);
      sendConversationUpdate(null);
    }
  }, [isNewConversation]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || !event.data || event.data.type !== MESSAGE_TYPE) return;

      const { action, content } = event.data.payload;

      if (action === "PROMPT" || action === "START_GUIDE") {
        if (eventBus.all.has("PROMPT")) {
          eventBus.emit("PROMPT", content as string);
        } else {
          messageQueue.push(content as string);
        }
      } else if (action === RESUME_GUIDE) {
        const sessionId = content.sessionId;
        const steps = content.steps;
        const instructions = content.instructions;
        const title = content.title;
        setSelectedConversationSlug(content.conversationSlug);
        setResumeGuide({
          sessionId,
          instructions,
          title,
          steps,
        });
      } else if (action === "CONFIG") {
        setPageHTML(content.pageHTML);
        setCurrentURL(content.currentURL);
        setToken(content.sessionToken);
        setConfig(content.config);

        try {
          const payload = jwtDecode<DecodedPayload>(content.sessionToken);
          setDefaultTitle(payload?.title ?? null);
        } catch (error) {
          captureExceptionAndLog(error);
        }
      } else if (action === "OPEN_CONVERSATION") {
        const { conversationSlug } = content;
        onSelectConversation(conversationSlug);
      } else if (action === "SCREENSHOT") {
        setScreenshot({ response: content });
      }
    };

    window.addEventListener("message", handleMessage);
    sendReadyMessage();

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const isAnonymous = !config?.email;

  if (!config || !token) {
    return (
      <div className="light flex h-screen w-full flex-col responsive-chat max-w-full sm:max-w-[520px] bg-background">
        <div className="flex items-center justify-between border-b border-black p-1.5">
          <div className="ml-2 h-5 w-20 animate-skeleton rounded bg-gray-100" />
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 animate-skeleton rounded bg-gray-100" />
            <div className="h-6 w-6 animate-skeleton rounded bg-gray-100" />
            <div className="h-6 w-6 animate-skeleton rounded bg-gray-100" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%] rounded-lg border border-gray-200 bg-white p-4">
                  <div className="space-y-2">
                    <div className="h-4 w-64 animate-skeleton rounded bg-gray-100" />
                    <div className="h-4 w-48 animate-skeleton rounded bg-gray-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-black p-4 bg-white">
          <div className="h-10 w-full animate-skeleton rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  const headerTitle = currentView === "previous" ? "History" : (config.title ?? defaultTitle ?? "Support");

  return (
    <QueryClientProvider client={queryClient}>
      <div
        className={cx("light flex h-screen w-full flex-col responsive-chat max-w-full sm:max-w-[520px]", {
          "bg-gumroad-bg": isGumroadTheme,
          "bg-background": !isGumroadTheme,
        })}
      >
        <Header
          config={config}
          onShowPreviousConversations={onShowPreviousConversations}
          onNewConversation={memoizedHandleNewConversation}
          title={headerTitle}
        />
        <div className="relative flex-1 overflow-hidden">
          {showingPromptInfo && (
            <PromptDetailsModal
              onClose={() => togglePromptInfo()}
              allMessages={showingPromptInfo.allMessages}
              message={showingPromptInfo.message}
              promptInfo={showingPromptInfo.promptInfo}
            />
          )}
          <LazyMotion features={domAnimation}>
            <m.div
              className="absolute inset-0 flex"
              animate={currentView === "previous" ? "previous" : "chat"}
              variants={{ previous: { x: 0 }, chat: { x: "-100%" } }}
              transition={{ type: "tween", duration: 0.3 }}
            >
              <div className="shrink-0 w-full h-full">
                <div className="h-full overflow-y-auto p-4">
                  {currentView === "previous" && hasLoadedHistory && (
                    <PreviousConversations
                      token={token}
                      onSelectConversation={onSelectConversation}
                      isAnonymous={isAnonymous}
                    />
                  )}
                </div>
              </div>

              <div className="shrink-0 w-full h-full flex flex-col">
                <Conversation
                  token={token}
                  readPageTool={readPageToolCall}
                  isGumroadTheme={isGumroadTheme}
                  isNewConversation={isNewConversation}
                  selectedConversationSlug={selectedConversationSlug}
                  onLoadFailed={memoizedHandleNewConversation}
                  guideEnabled={config.enableGuide ?? false}
                  resumeGuide={resumeGuide}
                />
              </div>
            </m.div>
          </LazyMotion>
        </div>
      </div>
    </QueryClientProvider>
  );
}
