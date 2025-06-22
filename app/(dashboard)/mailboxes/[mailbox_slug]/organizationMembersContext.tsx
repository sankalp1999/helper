"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { api } from "@/trpc/react";

type OrganizationMember = {
  id: string;
  displayName: string;
  email: string | null;
};

type OrganizationMembersContextType = {
  members: OrganizationMember[] | undefined;
  membersById: Map<string, OrganizationMember>;
  isLoading: boolean;
  error: unknown;
};

const OrganizationMembersContext = createContext<OrganizationMembersContextType | null>(null);

export function OrganizationMembersProvider({ children }: { children: ReactNode }) {
  const {
    data: members,
    isLoading,
    error,
  } = api.organization.getMembers.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const membersById = useMemo(() => {
    const map = new Map<string, OrganizationMember>();
    if (members) {
      members.forEach((member) => {
        map.set(member.id, member);
      });
    }
    return map;
  }, [members]);

  return (
    <OrganizationMembersContext.Provider value={{ members, membersById, isLoading, error }}>
      {children}
    </OrganizationMembersContext.Provider>
  );
}

export function useOrganizationMembers() {
  const context = useContext(OrganizationMembersContext);
  if (!context) {
    throw new Error("useOrganizationMembers must be used within an OrganizationMembersProvider");
  }
  return context;
}
