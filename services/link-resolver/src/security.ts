function ipv4Parts(value: string): number[] | null {
  const parts = value.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

export function isPrivateOrReservedAddress(value: string): boolean {
  const v4 = ipv4Parts(value);
  if (v4) {
    const [a, b, c] = v4;
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0 && (c === 0 || c === 2))
      || (a === 198 && (b === 18 || b === 19 || b === 51))
      || (a === 203 && b === 0 && c === 113);
  }
  const host = value.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "::" || host === "::1" || host.startsWith("fc") || host.startsWith("fd")
    || /^fe[89ab]/.test(host) || host.startsWith("2001:db8:");
}

export function assertSafeHostname(url: URL): void {
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("unsupported_protocol");
  if (url.username || url.password) throw new Error("credentials_not_allowed");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || isPrivateOrReservedAddress(host)) {
    throw new Error("private_target");
  }
}

export function assertSafeResolvedAddresses(addresses: string[]): void {
  if (!addresses.length) throw new Error("dns_no_answer");
  if (addresses.some(isPrivateOrReservedAddress)) throw new Error("dns_private_answer");
}

export function sanitizeHtmlText(html: string): { title: string; text: string } {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, " ").trim() || "";
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  return { title, text };
}
