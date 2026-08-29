import { assertSafeHostname, assertSafeResolvedAddresses, sanitizeHtmlText } from "./security";

interface Env { RESOLVER_TOKEN: string; MAX_RESPONSE_BYTES?: string }
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function resolveAddresses(hostname: string): Promise<string[]> {
  const answers: string[] = [];
  for (const type of ["A", "AAAA"]) {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, { headers: { accept: "application/dns-json" } });
    if (!response.ok) continue;
    const data = await response.json() as { Answer?: Array<{ type: number; data: string }> };
    for (const answer of data.Answer || []) if (answer.type === 1 || answer.type === 28) answers.push(answer.data);
  }
  return answers;
}

async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error("response_too_large");
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw new Error("response_too_large"); }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

function platform(hostname: string): string {
  return hostname.endsWith("douyin.com") ? "douyin" : hostname.endsWith("xiaohongshu.com") || hostname.endsWith("xhslink.com") ? "xiaohongshu" : "web";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...JSON_HEADERS, "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "POST,OPTIONS" } });
    if (request.method !== "POST") return json({ ok: false, errorCode: "method_not_allowed" }, 405);
    if (!env.RESOLVER_TOKEN || request.headers.get("authorization") !== `Bearer ${env.RESOLVER_TOKEN}`) return json({ ok: false, errorCode: "unauthorized" }, 401);
    try {
      const payload = await request.json() as { url?: string };
      let current = new URL(String(payload.url || ""));
      const maxBytes = Math.min(5 * 1024 * 1024, Number(env.MAX_RESPONSE_BYTES || 5 * 1024 * 1024));
      for (let redirects = 0; redirects <= 5; redirects++) {
        assertSafeHostname(current);
        assertSafeResolvedAddresses(await resolveAddresses(current.hostname));
        const response = await fetch(current.toString(), { redirect: "manual", headers: { accept: "text/html,text/plain;q=0.9" } });
        if (response.status >= 300 && response.status < 400) {
          if (redirects === 5) throw new Error("too_many_redirects");
          const location = response.headers.get("location");
          if (!location) throw new Error("redirect_without_location");
          current = new URL(location, current);
          continue;
        }
        if (!response.ok) throw new Error(`http_${response.status}`);
        const decoded = new TextDecoder().decode(await readLimited(response, maxBytes));
        const parsed = (response.headers.get("content-type") || "").includes("html") || /<html[\s>]/i.test(decoded)
          ? sanitizeHtmlText(decoded) : { title: "", text: decoded.replace(/\s+/g, " ").trim() };
        return json({ ok: true, url: payload.url, canonicalUrl: current.toString(), platform: platform(current.hostname), title: parsed.title, text: parsed.text.slice(0, 120_000), warnings: [] });
      }
      throw new Error("too_many_redirects");
    } catch (error) {
      return json({ ok: false, errorCode: error instanceof Error ? error.message : "resolver_error" }, 400);
    }
  },
};
