// Wrapper léger pour appeler les Edge Functions Supabase depuis le client.
// Pour les requêtes CRUD simples, utiliser directement getBrowserClient().from('table')...

import { getBrowserClient } from "./supabase/client";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type FunctionBody = Record<string, unknown> | string | undefined;

export async function callFunction<T>(
  name: string,
  body?: FunctionBody,
  options: { method?: "POST" | "GET" } = {},
): Promise<T> {
  const sb = getBrowserClient();
  const { data, error } = await sb.functions.invoke<T>(name, {
    method: options.method ?? "POST",
    body,
  });
  if (error) throw new ApiError((error as { context?: { status?: number } }).context?.status ?? 500, error.message);
  return data as T;
}

export const api = {
  // Helpers de compat avec les pages qui appelaient api.get/post (Edge Functions Supabase).
  get: callFunction,
  post: callFunction,
};
