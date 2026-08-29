import type { AnalysisPart } from "../chat-attachments/types.ts";
import { normalizeExtractedText } from "../chat-attachments/text-normalizer.ts";
import { classifyPublicUrl } from "./url-detection.ts";

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export interface LinkResolverOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function htmlToText(html: string): { title: string; text: string } {
  if (typeof DOMParser !== "undefined") {
    const document = new DOMParser().parseFromString(html, "text/html");
    document.querySelectorAll("script,style,noscript,svg,canvas").forEach((node) => node.remove());
    return { title: document.title.trim(), text: document.body?.textContent || "" };
  }
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, " ").trim() || "";
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
  return { title, text };
}

export async function resolvePublicLink(input: string, options: LinkResolverOptions = {}): Promise<AnalysisPart> {
  const fetchImpl = options.fetchImpl || fetch;
  let current = input;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const classification = classifyPublicUrl(current);
      if (!classification.allowed || !classification.url) throw new Error(classification.reason || "链接不安全");
      const response = await fetchImpl(classification.url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("链接重定向缺少目标地址");
        if (redirects === MAX_REDIRECTS) throw new Error("链接重定向次数过多");
        current = new URL(location, classification.url).toString();
        continue;
      }
      if (!response.ok) throw new Error(`网页读取失败（HTTP ${response.status}）`);
      const declaredSize = Number(response.headers.get("content-length") || 0);
      if (declaredSize > MAX_RESPONSE_BYTES) throw new Error("网页内容超过 5 MB 限制");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new Error("网页内容超过 5 MB 限制");
      const contentType = response.headers.get("content-type") || "";
      const decoded = new TextDecoder("utf-8").decode(bytes);
      const extracted = contentType.includes("html") || /<html[\s>]/i.test(decoded)
        ? htmlToText(decoded) : { title: "", text: decoded };
      const body = normalizeExtractedText(extracted.text);
      if (!body) throw new Error("网页没有可读取的公开正文");
      const title = extracted.title ? `标题：${extracted.title}\n` : "";
      return {
        type: "text",
        sourceName: classification.url,
        text: `[公开链接：${classification.platform}]\n${title}地址：${classification.url}\n\n${body}`,
      };
    }
    throw new Error("链接重定向次数过多");
  } finally {
    clearTimeout(timer);
  }
}
