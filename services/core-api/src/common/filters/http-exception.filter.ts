import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";
import { ApiException } from "../exceptions/api.exception";

/**
 * Converts every thrown error into the standard { success: false, error }
 * envelope (see @nexora/types ApiError) and guarantees internal details
 * (stack traces, driver errors, secrets) never reach the client — section 69.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof ApiException) {
      response.status(exception.getStatus()).json({
        success: false,
        error: { code: exception.code, message: exception.message, details: exception.details },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === "string" ? body : ((body as { message?: string | string[] })?.message ?? exception.message);
      response.status(status).json({
        success: false,
        error: {
          code: HttpStatus[status] ?? "HTTP_ERROR",
          message: Array.isArray(message) ? message.join(", ") : message,
        },
      });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" },
    });
  }
}
