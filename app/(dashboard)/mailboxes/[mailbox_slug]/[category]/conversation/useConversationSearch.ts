import { useCallback, useEffect, useRef } from "react";
import { useDebouncedCallback } from "@/components/useDebouncedCallback";
import type { ConversationWithNewMessages } from "./conversation";
import { useConversationSearchStore } from "./searchStore";

export const useConversationSearch = (conversationInfo: ConversationWithNewMessages | null) => {
  const { searchState, setSearchQuery, setSearchActive, setMatches, nextMatch, previousMatch, resetSearch } =
    useConversationSearchStore();

  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchInMessages = useCallback(
    (query: string) => {
      if (!conversationInfo || !query.trim()) {
        setMatches([]);
        return;
      }

      const matches: { messageId: string; messageIndex: number; matchIndex: number }[] = [];
      const searchTerm = query.toLowerCase();
      const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");

      conversationInfo.messages.forEach((message, messageIndex) => {
        if (message.type === "message" || message.type === "note") {
          const bodyText = message.body || "";
          const fromText = message.from || "";

          const bodyMatches = Array.from(bodyText.matchAll(regex));
          bodyMatches.forEach(() => {
            matches.push({
              messageId: message.id.toString(),
              messageIndex,
              matchIndex: matches.length,
            });
          });

          const fromMatches = Array.from(fromText.matchAll(regex));
          fromMatches.forEach(() => {
            matches.push({
              messageId: message.id.toString(),
              messageIndex,
              matchIndex: matches.length,
            });
          });
        }
      });

      setMatches(matches);
    },
    [conversationInfo, setMatches],
  );

  const debouncedSearchInMessages = useDebouncedCallback(searchInMessages, 300);

  const handleSearchToggle = useCallback(() => {
    if (searchState.isActive) {
      resetSearch();
    } else {
      setSearchActive(true);
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [searchState.isActive, resetSearch, setSearchActive]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);

      if (!value.trim()) {
        setMatches([]);
        return;
      }

      debouncedSearchInMessages(value);
    },
    [setSearchQuery, setMatches, debouncedSearchInMessages],
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          previousMatch();
        } else {
          nextMatch();
        }
      } else if (e.key === "Escape") {
        resetSearch();
      }
    },
    [nextMatch, previousMatch, resetSearch],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        const activeElement = document.activeElement;
        const isEditing =
          activeElement?.tagName === "INPUT" ||
          activeElement?.tagName === "TEXTAREA" ||
          activeElement?.getAttribute("contenteditable") === "true";

        if (!isEditing) {
          e.preventDefault();
          handleSearchToggle();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSearchToggle]);

  return {
    searchState,
    searchInputRef,
    handleSearchToggle,
    handleSearchChange,
    handleSearchKeyDown,
    resetSearch,
    nextMatch,
    previousMatch,
  };
};
