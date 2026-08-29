"use client";

import { useEffect } from "react";

export const FLOAT_API_BASE_KEY = "float.apiBaseUrl";

function resolveApiUrl(input: RequestInfo | URL, base: string): RequestInfo | URL {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (!raw.startsWith("/api/")) return input;
  const url = `${base.replace(/\/+$/, "")}${raw}`;
  if (typeof input === "string") return url;
  return new Request(url, input instanceof Request ? input : undefined);
}

export function MobileApiBridge() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const patchedFetch: typeof window.fetch = (input, init) => {
      const base = window.localStorage.getItem(FLOAT_API_BASE_KEY)?.trim();
      return originalFetch(base ? resolveApiUrl(input, base) : input, init);
    };
    window.fetch = patchedFetch;
    return () => { window.fetch = originalFetch; };
  }, []);
  return null;
}
