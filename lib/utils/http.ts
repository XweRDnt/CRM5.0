import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { toApiError } from "@/lib/utils/errors";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function fail(error: unknown, status = 500): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request payload validation failed",
          details: { issues: error.issues },
        },
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ error: toApiError(error) }, { status });
}
