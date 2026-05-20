// Client minimal Microsoft Graph (OAuth client_credentials).
// Permissions Application requises : Mail.Read, Calendars.Read

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export class GraphError extends Error {}

export class GraphClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private tenantId: string,
    private clientId: string,
    private clientSecret: string,
  ) {}

  static fromEnv(): GraphClient {
    const t = Deno.env.get("MICROSOFT_TENANT_ID");
    const c = Deno.env.get("MICROSOFT_CLIENT_ID");
    const s = Deno.env.get("MICROSOFT_CLIENT_SECRET");
    if (!t || !c || !s) throw new GraphError("Microsoft credentials manquants");
    return new GraphClient(t, c, s);
  }

  private async acquireToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt - 60_000) return this.token;
    const url = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!r.ok) throw new GraphError(`Token Graph: ${r.status} ${await r.text()}`);
    const data = await r.json();
    this.token = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return this.token!;
  }

  async get(path: string, params?: Record<string, string>): Promise<any> {
    const token = await this.acquireToken();
    const url = new URL(`${GRAPH_BASE}${path}`);
    if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!r.ok) throw new GraphError(`GET ${path}: ${r.status} ${await r.text().then((t) => t.slice(0, 200))}`);
    return r.json();
  }

  async *iterMessages(userId: string, sinceIso?: string, top = 100): AsyncGenerator<any> {
    const params: Record<string, string> = {
      "$select": "id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,internetMessageId",
      "$top": String(top),
      "$orderby": "receivedDateTime desc",
    };
    if (sinceIso) params["$filter"] = `receivedDateTime ge ${sinceIso}`;
    let pageUrl: string | null = null;
    let first = true;
    while (true) {
      const data: any = first
        ? await this.get(`/users/${userId}/messages`, params)
        : await this.getRaw(pageUrl!);
      first = false;
      for (const msg of data.value ?? []) yield msg;
      pageUrl = data["@odata.nextLink"] ?? null;
      if (!pageUrl) break;
    }
  }

  private async getRaw(absoluteUrl: string): Promise<any> {
    const token = await this.acquireToken();
    const r = await fetch(absoluteUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new GraphError(`GET ${absoluteUrl}: ${r.status}`);
    return r.json();
  }
}
