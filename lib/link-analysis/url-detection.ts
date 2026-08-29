export type PublicLinkPlatform = "douyin" | "xiaohongshu" | "web";

export interface PublicUrlClassification {
  allowed: boolean;
  platform: PublicLinkPlatform;
  url?: string;
  reason?: string;
}

const URL_PATTERN = /https?:\/\/[^\s<>"'，。！？；：、【】《》]+/giu;
const TRAILING_PUNCTUATION = /[.,!?;:，。！？；：、)\]}>]+$/u;

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127);
}

function isPrivateIpv6(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "::" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb");
}

export function classifyPublicUrl(input: string): PublicUrlClassification {
  let url: URL;
  try { url = new URL(input); } catch { return { allowed: false, platform: "web", reason: "链接格式无效" }; }
  const hostname = url.hostname.toLowerCase();
  const platform: PublicLinkPlatform = hostname === "douyin.com" || hostname.endsWith(".douyin.com")
    ? "douyin"
    : hostname === "xiaohongshu.com" || hostname.endsWith(".xiaohongshu.com") || hostname === "xhslink.com" || hostname.endsWith(".xhslink.com")
      ? "xiaohongshu" : "web";
  if (url.protocol !== "http:" && url.protocol !== "https:") return { allowed: false, platform, reason: "只允许 HTTP(S) 链接" };
  if (url.username || url.password) return { allowed: false, platform, reason: "不允许包含账号信息的链接" };
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    return { allowed: false, platform, reason: "不允许访问本机或内网地址" };
  }
  url.hash = "";
  return { allowed: true, platform, url: url.toString() };
}

export function extractPublicUrls(text: string): string[] {
  const found = new Set<string>();
  for (const match of String(text || "").matchAll(URL_PATTERN)) {
    let candidate = match[0].replace(TRAILING_PUNCTUATION, "");
    if (candidate.startsWith("(") && candidate.endsWith(")")) candidate = candidate.slice(1, -1);
    const classification = classifyPublicUrl(candidate);
    if (classification.allowed && classification.url) found.add(classification.url.replace(/\/$/, candidate.endsWith("/") ? "/" : ""));
  }
  return [...found];
}
