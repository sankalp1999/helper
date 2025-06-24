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
  setSearchQuery: (query: string) => void;
  setSearchActive: (active: boolean) => void;
  setMatches: (matches: { messageId: string; messageIndex: number; matchIndex: number }[]) => void;
  setCurrentMatchIndex: (index: number) => void;
  nextMatch: () => void;
  previousMatch: () => void;
  resetSearch: () => void;
}>()(
  devtools(
    (set, get) => ({
      searchState: {
        query: "",
        isActive: false,
        matches: [],
        currentMatchIndex: -1,
      },
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
      },
      previousMatch: () => {
        const { searchState } = get();
        if (searchState.matches.length === 0) return;
        const prevIndex =
          searchState.currentMatchIndex === 0 ? searchState.matches.length - 1 : searchState.currentMatchIndex - 1;
        set((state) => ({
          searchState: { ...state.searchState, currentMatchIndex: prevIndex },
        }));
      },
      resetSearch: () =>
        set({
          searchState: {
            query: "",
            isActive: false,
            matches: [],
            currentMatchIndex: -1,
          },
        }),
    }),
    {
      name: "conversation-search-store",
    },
  ),
); 