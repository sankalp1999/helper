import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type SearchState = {
  query: string;
  isActive: boolean;
  matches: { messageId: string; messageIndex: number; matchIndex: number }[];
  currentMatchIndex: number;
};

export const useConversationSearchStore = create<{
  searchState: SearchState;
  messageRefs: Map<string, HTMLElement>;
  setSearchQuery: (query: string) => void;
  setSearchActive: (active: boolean) => void;
  setMatches: (matches: { messageId: string; messageIndex: number; matchIndex: number }[]) => void;
  setCurrentMatchIndex: (index: number) => void;
  nextMatch: () => void;
  previousMatch: () => void;
  resetSearch: () => void;
  registerMessageRef: (messageId: string, element: HTMLElement | null) => void;
  scrollToCurrentMatch: (matchIndex?: number) => void;
}>()(
  devtools(
    (set, get) => ({
      searchState: {
        query: "",
        isActive: false,
        matches: [],
        currentMatchIndex: -1,
      },
      messageRefs: new Map<string, HTMLElement>(),
      setSearchQuery: (query) =>
        set((state) => ({
          searchState: { ...state.searchState, query },
        })),
      setSearchActive: (active) =>
        set((state) => ({
          searchState: { ...state.searchState, isActive: active },
        })),
      setMatches: (matches) =>
        set((state) => ({
          searchState: {
            ...state.searchState,
            matches,
            currentMatchIndex: matches.length > 0 ? 0 : -1,
          },
        })),
      setCurrentMatchIndex: (index) =>
        set((state) => ({
          searchState: { ...state.searchState, currentMatchIndex: index },
        })),
      nextMatch: () => {
        const { searchState } = get();
        if (searchState.matches.length === 0) return;
        const nextIndex = (searchState.currentMatchIndex + 1) % searchState.matches.length;
        set((state) => ({
          searchState: { ...state.searchState, currentMatchIndex: nextIndex },
        }));
        get().scrollToCurrentMatch(nextIndex);
      },
      previousMatch: () => {
        const { searchState } = get();
        if (searchState.matches.length === 0) return;
        const prevIndex =
          searchState.currentMatchIndex === 0 ? searchState.matches.length - 1 : searchState.currentMatchIndex - 1;
        set((state) => ({
          searchState: { ...state.searchState, currentMatchIndex: prevIndex },
        }));
        get().scrollToCurrentMatch(prevIndex);
      },
      resetSearch: () =>
        set((state) => ({
          searchState: {
            query: "",
            isActive: false,
            matches: [],
            currentMatchIndex: -1,
          },
        })),
      registerMessageRef: (messageId: string, element: HTMLElement | null) => {
        set((state) => {
          const newRefs = new Map(state.messageRefs);
          if (element) {
            newRefs.set(messageId, element);
          } else {
            newRefs.delete(messageId);
          }
          return { messageRefs: newRefs };
        });
      },
      scrollToCurrentMatch: (matchIndex?: number) => {
        const { searchState, messageRefs } = get();
        if (searchState.isActive && searchState.matches.length > 0) {
          const indexToUse = matchIndex !== undefined ? matchIndex : searchState.currentMatchIndex;
          if (indexToUse >= 0) {
            const currentMatch = searchState.matches[indexToUse];
            if (currentMatch) {
              const messageElement = messageRefs.get(currentMatch.messageId);
              if (messageElement) {
                messageElement.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                  inline: "nearest",
                });
              }
            }
          }
        }
      },
    }),
    {
      name: "conversation-search-store",
    },
  ),
);
