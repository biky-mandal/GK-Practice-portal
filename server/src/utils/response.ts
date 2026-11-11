export const successResponse = <T>(message: string, data?: T, meta?: Record<string, unknown>) => ({
  success: true,
  message,
  data,
  meta
});

export const errorResponse = (message: string, details?: Record<string, unknown>) => ({
  success: false,
  message,
  details
});
