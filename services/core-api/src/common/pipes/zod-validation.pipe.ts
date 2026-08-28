import { PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";
import { ValidationApiException } from "../exceptions/api.exception";

/** Validates a request body/query/param against a shared @nexora/validation Zod schema. */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ValidationApiException("Request validation failed", {
        issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      });
    }
    return result.data;
  }
}
