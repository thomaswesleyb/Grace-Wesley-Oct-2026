import type { z } from "zod";
import { apiError } from "@shared/schemas.ts";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function send(path: string, method: "GET" | "POST", body: unknown): Promise<Response> {
  try {
    const init: RequestInit =
      body === undefined
        ? { method }
        : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    return await fetch(path, init);
  } catch {
    throw new ApiRequestError(
      "We couldn't reach the server. Check your connection and try again.",
      0,
    );
  }
}

/** Sends JSON to the worker and validates the reply against `schema`. */
export async function apiFetch<T extends z.ZodType>(
  path: string,
  schema: T,
  init: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<z.infer<T>> {
  const response = await send(path, init.method ?? "GET", init.body);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = apiError.safeParse(payload);
    const message = error.success ? error.data.error : `Request failed (${response.status}).`;
    throw new ApiRequestError(message, response.status);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiRequestError(
      "The server sent an unexpected reply. Please try again.",
      response.status,
    );
  }
  return parsed.data;
}
