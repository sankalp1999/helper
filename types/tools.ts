import type { Tool } from "@/db/schema/tools";

export type ToolFormatted = Omit<
  Tool,
  "authenticationToken" | "authenticationMethod" | "createdAt" | "updatedAt" | "headers"
> & {
  path: string;
};
