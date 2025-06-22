"use client";

import { createContext, useContext, type ReactNode } from "react";
import { api } from "@/trpc/react";

type OrganizationMember = {
  id: string;
  displayName: string;
  email: string | null;
};

type OrganizationMembersContextType = {
  members: OrganizationMember[] | undefined;
  isLoading: boolean;
};

const OrganizationMembersContext = createContext<OrganizationMembersContextType | null>(null);

export function OrganizationMembersProvider({ children }: { children: ReactNode }) {
  const { data: members, isLoading } = api.organization.getMembers.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return (
    <OrganizationMembersContext.Provider value={{ members, isLoading }}>{children}</OrganizationMembersContext.Provider>
  );
}

export function useOrganizationMembers() {
  const context = useContext(OrganizationMembersContext);
  if (!context) {
    throw new Error("useOrganizationMembers must be used within an OrganizationMembersProvider");
  }
  return context;
}
