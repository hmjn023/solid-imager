/**
 * Common types for API clients
 */

/**
 * Standard API success response
 */
export type ApiSuccessResponse<T = unknown> = {
  success: true;
  data?: T;
  message?: string;
};

/**
 * Standard API error response
 */
export type ApiErrorResponse = {
  success: false;
  error: string;
  message?: string;
};

/**
 * Combined API response type
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
