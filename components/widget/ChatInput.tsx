import { Camera, Mic } from "lucide-react";
import * as motion from "motion/react-client";
import { useCallback, useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useSpeechRecognition } from "@/components/hooks/useSpeechRecognition";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ShadowHoverButton from "@/components/widget/ShadowHoverButton";
import { useScreenshotStore } from "@/components/widget/widgetState";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { cn } from "@/lib/utils";
import { closeWidget, sendScreenshot } from "@/lib/widget/messages";

type Props = {
  input: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (screenshotData?: string) => void;
  isLoading: boolean;
  isGumroadTheme: boolean;
  placeholder?: string;
};

const SCREENSHOT_KEYWORDS = [
  "error",
  "I can't",
  "wrong",
  "trouble",
  "problem",
  "issue",
  "glitch",
  "bug",
  "broken",
  "doesn't work",
  "doesn't load",
  "not loading",
  "crash",
  "stuck",
  "fails",
  "failure",
  "failed",
  "missing",
  "can't find",
  "can't see",
  "doesn't show",
  "not showing",
  "not working",
  "incorrect",
  "unexpected",
  "strange",
  "weird",
  "help me",
  "confused",
  "404",
  "500",
  "not responding",
  "slow",
  "hangs",
  "screenshot",
];

export default function ChatInput({
  input,
  inputRef,
  handleInputChange,
  handleSubmit,
  isLoading,
  isGumroadTheme,
  placeholder,
}: Props) {
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [includeScreenshot, setIncludeScreenshot] = useState(false);
  const { screenshot, setScreenshot, screenshotState, setScreenshotState } = useScreenshotStore();

  // Handle keyboard shortcut for screenshot checkbox (Cmd+Shift+S on Mac)
  useHotkeys(
    "cmd+shift+s",
    (e) => {
      e.preventDefault();
      if (showScreenshot) {
        setIncludeScreenshot(!includeScreenshot);
      }
    },
    {
      enabled: showScreenshot && typeof window !== "undefined" && navigator.platform.includes("Mac"),
      enableOnFormTags: true,
    },
    [showScreenshot, includeScreenshot],
  );

  const handleSegment = useCallback(
    (segment: string) => {
      const currentInput = inputRef.current?.value || "";

      const event = {
        target: { value: currentInput + segment },
      } as React.ChangeEvent<HTMLTextAreaElement>;

      handleInputChange(event);

      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      });
    },
    [handleInputChange, inputRef],
  );

  const handleError = useCallback((error: string) => {
    captureExceptionAndLog(new Error(`Speech recognition error: ${error}`));
  }, []);

  const { isSupported, isRecording, startRecording, stopRecording } = useSpeechRecognition({
    onSegment: handleSegment,
    onError: handleError,
  });

  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  useEffect(() => {
    if (!input) {
      setShowScreenshot(false);
      setIncludeScreenshot(false);
      setScreenshotState({ state: "initial" });
    } else if (SCREENSHOT_KEYWORDS.some((keyword) => input.toLowerCase().includes(keyword))) {
      setShowScreenshot(true);
    }
  }, [input, setScreenshotState]);

  useEffect(() => {
    if (screenshot) {
      if (screenshot.response) {
        // Screenshot captured successfully
        setScreenshotState({ state: "captured", response: screenshot.response });
        handleSubmit(screenshot.response);
        setScreenshot(null);
        setIncludeScreenshot(false);
      } else {
        // Screenshot failed (response is null)
        setScreenshotState({
          state: "error",
          error: "Failed to capture screenshot. Sending message without screenshot.",
        });
        handleSubmit();
        setScreenshot(null);
      }
    }
  }, [screenshot, handleSubmit, setScreenshot, setScreenshotState]);

  const submit = () => {
    const normalizedInput = input.trim().toLowerCase();
    if (
      ["exit", "cancel", "close", "stop", "quit", "end", "bye"].some((cmd) => normalizedInput === cmd) ||
      normalizedInput.includes("exit chat") ||
      normalizedInput.includes("exit this chat") ||
      normalizedInput.includes("close this chat") ||
      normalizedInput.includes("close chat")
    ) {
      closeWidget();
      return;
    }

    if (includeScreenshot) {
      try {
        setScreenshotState({ state: "capturing" });
        sendScreenshot();
      } catch (error) {
        captureExceptionAndLog(error);
        setScreenshotState({
          state: "error",
          error: "Failed to capture screenshot. Sending message without screenshot.",
        });
        handleSubmit();
      }
    } else {
      handleSubmit();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="border-t border-black p-4 bg-white">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          stopRecording();
          submit();
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex-1 flex items-start">
          <Textarea
            aria-label="Ask a question"
            ref={inputRef}
            value={input}
            onChange={(e) => {
              handleInputChange(e);
              adjustTextareaHeight();
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            className="self-stretch max-w-md placeholder:text-muted-foreground text-foreground flex-1 resize-none border-none bg-white p-0 pr-3 outline-none focus:border-none focus:outline-none focus:ring-0 min-h-[24px] max-h-[200px]"
            disabled={isLoading}
          />
          <div className="flex items-center gap-2">
            {isSupported && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={cn("text-primary hover:text-muted-foreground p-2 rounded-full hover:bg-muted", {
                        "bg-muted": isRecording,
                      })}
                      disabled={isLoading}
                      aria-label={isRecording ? "Stop" : "Dictate"}
                    >
                      <Mic
                        className={cn("w-4 h-4", {
                          "text-red-500": isRecording,
                          "text-primary": !isRecording,
                        })}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{isRecording ? "Stop" : "Dictate"}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <ShadowHoverButton
              isLoading={isLoading || screenshotState.state === "capturing"}
              isGumroadTheme={isGumroadTheme}
            />
          </div>
        </div>
        {showScreenshot && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{
              type: "spring",
              stiffness: 600,
              damping: 30,
            }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <Checkbox
                id="screenshot"
                checked={includeScreenshot}
                onCheckedChange={(e) => {
                  setIncludeScreenshot(e === true);
                  if (!e) setScreenshotState({ state: "initial" });
                }}
                className="border-muted-foreground data-[state=checked]:bg-black data-[state=checked]:text-white"
                disabled={screenshotState.state === "capturing"}
              />
              <label
                htmlFor="screenshot"
                className="cursor-pointer flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Camera className="w-4 h-4" />
                {screenshotState.state === "capturing"
                  ? "Capturing screenshot..."
                  : "Include a screenshot for better support?"}
                {typeof window !== "undefined" && navigator.platform.includes("Mac") && (
                  <span className="text-xs opacity-60 ml-1">(⌘⇧S)</span>
                )}
              </label>
            </div>
            {screenshotState.state === "error" && (
              <div className="text-xs text-red-600 ml-6">{screenshotState.error}</div>
            )}
          </motion.div>
        )}
      </form>
    </div>
  );
}
