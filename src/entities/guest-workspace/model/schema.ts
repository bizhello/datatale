import { z } from "zod";

export const guestWorkspaceSchema = z
  .object({ id: z.string().uuid(), expiresAt: z.string().datetime() })
  .strict();
export type GuestWorkspace = z.infer<typeof guestWorkspaceSchema>;
