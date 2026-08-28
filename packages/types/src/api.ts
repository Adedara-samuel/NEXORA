/** Standard success envelope returned by every NEXORA Core API endpoint. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

/** Standard error envelope. Never carries stack traces or internal details. */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;
