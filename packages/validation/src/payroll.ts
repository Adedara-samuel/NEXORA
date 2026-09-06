import { z } from "zod";

export const runPayrollSchema = z.object({
  periodYear: z.coerce.number().int().min(2000).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
});
export type RunPayrollInput = z.infer<typeof runPayrollSchema>;

const taxBandSchema = z.object({
  upToMajor: z.number().int().positive().nullable(),
  ratePercent: z.number().int().min(0).max(100),
});

export const updateTaxSettingsSchema = z
  .object({
    customBands: z
      .array(taxBandSchema)
      .min(1)
      .refine((bands) => bands[bands.length - 1]?.upToMajor === null, {
        message: "The last band must have upToMajor: null (open-ended top band)",
      })
      .refine(
        (bands) =>
          bands.slice(0, -1).every((band, index) => band.upToMajor !== null && (index === 0 || (bands[index - 1]!.upToMajor ?? 0) < band.upToMajor)),
        { message: "Band thresholds must be strictly ascending" },
      )
      .nullable()
      .optional(),
    pensionRatePercent: z.number().int().min(0).max(100).nullable().optional(),
  })
  .refine((value) => value.customBands !== undefined || value.pensionRatePercent !== undefined, {
    message: "At least one of customBands or pensionRatePercent must be provided",
  });
export type UpdateTaxSettingsInput = z.infer<typeof updateTaxSettingsSchema>;

export const linkPayrollBankAccountSchema = z.object({
  accountNumber: z.string().trim().regex(/^\d{10}$/, "accountNumber must be exactly 10 digits"),
});
export type LinkPayrollBankAccountInput = z.infer<typeof linkPayrollBankAccountSchema>;

export const depositToPayrollWalletSchema = z.object({
  bankAccountId: z.string().uuid(),
  amountMinor: z.coerce.number().int().positive(),
});
export type DepositToPayrollWalletInput = z.infer<typeof depositToPayrollWalletSchema>;
