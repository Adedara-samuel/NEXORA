import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Base for every intentional, client-facing error in the API. Carries a
 * stable machine-readable `code` (used by frontends for i18n/branching) in
 * addition to the human message. Never wraps raw internal errors — those
 * are caught and sanitised by the global exception filter instead.
 */
export class ApiException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message, status);
  }
}

export class UnauthorizedApiException extends ApiException {
  constructor(message = "Authentication required", code = "UNAUTHORIZED") {
    super(code, message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenApiException extends ApiException {
  constructor(message = "You do not have permission to perform this action", code = "FORBIDDEN") {
    super(code, message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundApiException extends ApiException {
  constructor(message = "Resource not found", code = "NOT_FOUND") {
    super(code, message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictApiException extends ApiException {
  constructor(message: string, code = "CONFLICT") {
    super(code, message, HttpStatus.CONFLICT);
  }
}

export class ValidationApiException extends ApiException {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, HttpStatus.BAD_REQUEST, details);
  }
}
