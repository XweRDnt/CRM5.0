import { z } from "zod";

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const authSignupRequestSchema = z.object({
  tenantName: z.string().min(2),
  ownerName: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
});

export const authLoginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const createProjectRequestSchema = z.object({
  clientAccountId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  dueDate: z.string().optional(),
});

export const createClientRequestSchema = z.object({
  companyName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.email(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});
