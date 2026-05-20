// Client Gmail API minimal pour Edge Functions Deno.
// Doc API : https://developers.google.com/gmail/api/reference/rest

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailError extends Error {}

// ---------------------------------------------------------------------------
// OAuth — exchange code for tokens, refresh access tokens
// ---------------------------------------------------------------------------

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new GmailError("Google OAuth credentials manquants");

  const body = new URLSearchParams({
    code, client_id: clientId, client_secret: clientSecret,
    redirect_uri: redirectUri, grant_type: "authorization_code",
  });
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new GmailError(`Token exchange failed: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new GmailError("Google OAuth credentials manquants");

  const body = new URLSearchParams({
    client_id: clientId, client_secret: clientSecret,
    refresh_token: refreshToken, grant_type: "refresh_token",
  });
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new GmailError(`Refresh token failed: ${r.status} ${await r.text()}`);
  return r.json();
}

// ---------------------------------------------------------------------------
// Gmail API client
// ---------------------------------------------------------------------------

export interface GmailMessageMeta {
  id: string;
  threadId: string;
}

export interface GmailMessageFull {
  id: string;
  threadId: string;
  internalDate: string; // ms epoch
  payload: GmailMessagePayload;
  snippet?: string;
  labelIds?: string[];
}

export interface GmailMessagePayload {
  headers: Array<{ name: string; value: string }>;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePayload[];
  mimeType?: string;
}

export class GmailClient {
  constructor(private accessToken: string) {}

  static async getUserInfo(accessToken: string): Promise<{ email: string; sub: string }> {
    const r = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) throw new GmailError(`userinfo failed: ${r.status}`);
    return r.json();
  }

  private async get(path: string, params?: Record<string, string>): Promise<any> {
    const url = new URL(`${GMAIL_API}${path}`);
    if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!r.ok) throw new GmailError(`GET ${path} failed: ${r.status} ${await r.text().then(t => t.slice(0, 200))}`);
    return r.json();
  }

  /**
   * Liste les messages matchant la query Gmail (https://support.google.com/mail/answer/7190).
   * `maxResults` par page ≤ 500. Pagination via pageToken.
   */
  async *listMessages(query: string, maxTotal = 500): AsyncGenerator<GmailMessageMeta> {
    let pageToken: string | undefined;
    let count = 0;
    while (count < maxTotal) {
      const params: Record<string, string> = {
        q: query,
        maxResults: String(Math.min(100, maxTotal - count)),
      };
      if (pageToken) params.pageToken = pageToken;
      const data = await this.get("/messages", params);
      for (const msg of (data.messages ?? []) as GmailMessageMeta[]) {
        yield msg;
        count++;
        if (count >= maxTotal) return;
      }
      pageToken = data.nextPageToken;
      if (!pageToken) return;
    }
  }

  async getMessageFull(id: string): Promise<GmailMessageFull> {
    return this.get(`/messages/${id}`, { format: "full" });
  }

  async getMessageMetadata(id: string): Promise<GmailMessageFull> {
    return this.get(`/messages/${id}`, {
      format: "metadata",
      "metadataHeaders": "From,To,Subject,Date,Message-ID",
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers : extraction header + body texte d'un message Gmail
// ---------------------------------------------------------------------------

export function getHeader(msg: GmailMessageFull, name: string): string | undefined {
  const h = msg.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value;
}

/**
 * Décode le body d'un message Gmail. Privilégie text/plain, fallback text/html (stripé).
 */
export function extractBodyText(msg: GmailMessageFull): string {
  const text = walkParts(msg.payload, "text/plain");
  if (text) return decodeBase64Url(text);
  const html = walkParts(msg.payload, "text/html");
  if (html) return stripHtml(decodeBase64Url(html));
  return msg.snippet ?? "";
}

function walkParts(part: GmailMessagePayload, mime: string): string | null {
  if (part.mimeType === mime && part.body?.data) return part.body.data;
  if (part.parts) {
    for (const p of part.parts) {
      const found = walkParts(p, mime);
      if (found) return found;
    }
  }
  return null;
}

function decodeBase64Url(b64: string): string {
  const std = b64.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return new TextDecoder("utf-8").decode(Uint8Array.from(atob(std), (c) => c.charCodeAt(0)));
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse "Sophie Martin <sophie@x.fr>" → { name: "Sophie Martin", email: "sophie@x.fr" }
 */
export function parseFromHeader(raw: string | undefined): { name?: string; email?: string } {
  if (!raw) return {};
  const m = raw.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, "").trim() || undefined, email: m[2].trim() };
  if (raw.includes("@")) return { email: raw.trim() };
  return { name: raw.trim() };
}
