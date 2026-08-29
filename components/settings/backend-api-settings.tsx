"use client";

import { useState } from "react";
import { FLOAT_API_BASE_KEY } from "../mobile-api-bridge";
import { LINK_RESOLVER_TOKEN_KEY, LINK_RESOLVER_URL_KEY } from "@/lib/link-analysis/link-resolver";

export function BackendApiSettings() {
  const [value, setValue] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem(FLOAT_API_BASE_KEY) || "");
  const [status, setStatus] = useState("");
  const [resolverUrl, setResolverUrl] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem(LINK_RESOLVER_URL_KEY) || "");
  const [resolverToken, setResolverToken] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem(LINK_RESOLVER_TOKEN_KEY) || "");
  const save = () => {
    const next = value.trim().replace(/\/+$/, "");
    if (next && !/^https?:\/\//i.test(next)) { setStatus("地址必须以 http:// 或 https:// 开头"); return; }
    if (next) window.localStorage.setItem(FLOAT_API_BASE_KEY, next); else window.localStorage.removeItem(FLOAT_API_BASE_KEY);
    setValue(next); setStatus("已保存，重新打开页面后生效");
  };
  const saveResolver = () => {
    const nextUrl = resolverUrl.trim().replace(/\/+$/, "");
    if (nextUrl && !/^https:\/\//i.test(nextUrl)) { setStatus("链接解析 Worker 必须使用 https:// 地址"); return; }
    if (nextUrl) window.localStorage.setItem(LINK_RESOLVER_URL_KEY, nextUrl); else window.localStorage.removeItem(LINK_RESOLVER_URL_KEY);
    if (resolverToken.trim()) window.localStorage.setItem(LINK_RESOLVER_TOKEN_KEY, resolverToken.trim()); else window.localStorage.removeItem(LINK_RESOLVER_TOKEN_KEY);
    setResolverUrl(nextUrl);
    setStatus("链接解析备用服务已保存");
  };
  return <section style={{ margin: "0 0 18px", padding: 14, borderRadius: 14, background: "rgba(127,127,127,.1)" }}>
    <div style={{ fontWeight: 600, marginBottom: 6 }}>Float 后端 API 地址</div>
    <div style={{ fontSize: 12, opacity: .7, marginBottom: 8 }}>用于云端数据、图片、语音等服务；留空则使用当前应用。</div>
    <input value={value} onChange={e => setValue(e.target.value)} placeholder="https://你的 Float API 地址" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(127,127,127,.3)", background: "transparent" }} />
    <button onClick={save} style={{ marginTop: 8, padding: "8px 14px", borderRadius: 9 }}>保存地址</button>
    {status && <div style={{ marginTop: 6, fontSize: 12 }}>{status}</div>}
    <div style={{ fontWeight: 600, margin: "18px 0 6px" }}>公开链接解析 Worker（可选）</div>
    <div style={{ fontSize: 12, opacity: .7, marginBottom: 8 }}>仅在设备无法直接读取公开网页时使用；不会上传聊天或附件。</div>
    <input value={resolverUrl} onChange={e => setResolverUrl(e.target.value)} placeholder="https://你的-worker.workers.dev" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(127,127,127,.3)", background: "transparent" }} />
    <input type="password" value={resolverToken} onChange={e => setResolverToken(e.target.value)} placeholder="Worker 连接密钥" style={{ width: "100%", marginTop: 8, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(127,127,127,.3)", background: "transparent" }} />
    <button onClick={saveResolver} style={{ marginTop: 8, padding: "8px 14px", borderRadius: 9 }}>保存链接解析配置</button>
  </section>;
}
