export type Json = Record<string, unknown>;

export function allowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
}

export function corsHeaders(req: Request): Headers {
  const headers = new Headers();
  const origin = req.headers.get("origin") ?? "";
  const allowed = allowedOrigins();
  const match = allowed.includes("*") ? origin : allowed.find((item) => item === origin);
  if (match) {
    headers.set("Access-Control-Allow-Origin", match);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Headers", "authorization, content-type");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

export function json(req: Request, body: unknown, status = 200): Response {
  const headers = corsHeaders(req);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

export function text(req: Request, body: string, status = 200): Response {
  const headers = corsHeaders(req);
  headers.set("Content-Type", "text/plain; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(body, { status, headers });
}

export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export function isAllowedRedirect(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      return false;
    }
    const allowed = allowedOrigins();
    return allowed.includes("*") || allowed.includes(url.origin);
  } catch {
    return false;
  }
}
