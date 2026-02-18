import { ZodError } from "zod";
import { AppError } from "@/lib/utils/errors";

export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

function inferStatus(error: Error): APIError {
  const message = error.message || "Internal server error";
  const normalized = message.toLowerCase();

  if (normalized.includes("not found")) {
    return new APIError(404, message, "NOT_FOUND");
  }
  if (normalized.includes("unauthorized") || normalized.includes("invalid token")) {
    return new APIError(401, message, "UNAUTHORIZED");
  }
  if (normalized.includes("forbidden")) {
    return new APIError(403, message, "FORBIDDEN");
  }
  if (
    normalized.includes("required") ||
    normalized.includes("invalid") ||
    normalized.includes("must be") ||
    normalized.includes("cannot be in the past")
  ) {
    return new APIError(400, message, "BAD_REQUEST");
  }
  if (normalized.includes("already exists")) {
    return new APIError(409, message, "CONFLICT");
  }

  return new APIError(500, message, "INTERNAL_ERROR");
}

export function handleAPIError(error: unknown): Response {
  console.error("[API Error]", error);

  if (error instanceof APIError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      { error: "Validation failed", issues: error.issues },
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    const mapped = inferStatus(error);
    return Response.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.statusCode },
    );
  }

  if (error instanceof Error) {
    const mapped = inferStatus(error);
    return Response.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.statusCode },
    );
  }

  return Response.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
