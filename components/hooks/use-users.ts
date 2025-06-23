import { api } from "@/trpc/react";
import { useMemo } from "react";

export const useUsers = () => {
  const { data: users, ...rest } = api.user.getAll.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  const usersById = useMemo(
    () => Object.fromEntries(users?.map(user => [user.id, user]) || []),
    [users]
  );

  return { users, usersById, ...rest };
}; 