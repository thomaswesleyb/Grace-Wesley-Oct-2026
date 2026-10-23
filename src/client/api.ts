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

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/** A FormData body is sent as a multipart upload; anything else as JSON. */
function requestInit(method: Method, body: unknown): RequestInit {
  if (body === undefined) return { method };
  if (body instanceof FormData) return { method, body };
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

async function send(path: string, method: Method, body: unknown): Promise<Response> {
  try {
    const init = requestInit(method, body);
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
  init: { method?: Method; body?: unknown } = {},
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
