import { z } from "zod";

export const createPlanSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  priceMinor: z.coerce.number().int().min(0),
  currency: z.string().trim().toUpperCase().length(3).default("NGN"),
  billingCycle: z.enum(["MONTHLY", "ANNUALLY"]),
  moduleKeys: z.array(z.string()).default([]),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = z.object({
  description: z.string().trim().min(1).optional(),
  priceMinor: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  moduleKeys: z.array(z.string()).optional(),
});
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const createSubscriptionSchema = z.object({
  planId: z.string().uuid(),
  status: z.enum(["TRIALING", "ACTIVE"]).default("TRIALING"),
});
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const changeSubscriptionPlanSchema = z.object({
  planId: z.string().uuid(),
});
export type ChangeSubscriptionPlanInput = z.infer<typeof changeSubscriptionPlanSchema>;

export const renewSubscriptionSchema = z.object({
  /** Mock gateway only: force the simulated payment to fail, to exercise the failure path. */
  simulateFailure: z.boolean().default(false),
});
export type RenewSubscriptionInput = z.infer<typeof renewSubscriptionSchema>;
