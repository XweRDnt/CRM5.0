import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const signupSchema = z.object({
  tenantName: z.string().min(2),
  ownerName: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
});

export const createClientSchema = z.object({
  companyName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.email(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export const createProjectSchema = z.object({
  clientAccountId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  dueDate: z.string().optional(),
});
