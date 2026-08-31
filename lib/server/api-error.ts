import "server-only";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "request_failed",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: error.code, message: error.message, details: error.details },
      { status: error.status },
    );
  }

  if (error instanceof Response) return error;

  console.error(error);
  return Response.json(
    { error: "internal_error", message: "Ocurrió un error interno." },
    { status: 500 },
  );
}
