import { Capacitor, registerPlugin } from "@capacitor/core";
import { resolveDownloadSaveMode } from "./download-save-mode";

export type DownloadFileOptions = {
    disableNativeShare?: boolean;
    nativeShareOnly?: boolean;
    automaticAndroidSave?: boolean;
};

type NativeFileSaverPlugin = {
    startSave(options: { filename: string; mimeType: string }): Promise<{ sessionId: string }>;
    startAutomaticSave(options: { filename: string; mimeType: string }): Promise<{ sessionId: string }>;
    writeChunk(options: { sessionId: string; data: string }): Promise<void>;
    finishSave(options: { sessionId: string }): Promise<{ uri: string }>;
    abortSave(options: { sessionId: string }): Promise<void>;
    queueDownload(options: { url: string; filename: string; mimeType?: string }): Promise<{ downloadId: string }>;
};

const NativeFileSaver = registerPlugin<NativeFileSaverPlugin>("NativeFileSaver");
const NATIVE_SAVE_CHUNK_BYTES = 256 * 1024;

function blobChunkToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error("读取文件分块失败"));
        reader.onload = () => {
            const value = typeof reader.result === "string" ? reader.result : "";
            const comma = value.indexOf(",");
            if (comma < 0) reject(new Error("文件分块编码失败"));
            else resolve(value.slice(comma + 1));
        };
        reader.readAsDataURL(blob);
    });
}

async function saveWithAndroid(blob: Blob, filename: string, automatic: boolean): Promise<void> {
    let session: { sessionId: string };
    try {
        session = await (automatic ? NativeFileSaver.startAutomaticSave : NativeFileSaver.startSave)({
            filename,
            mimeType: blob.type || "application/octet-stream",
        });
    } catch (error) {
        if (!automatic) throw error;
        session = await NativeFileSaver.startSave({
            filename,
            mimeType: blob.type || "application/octet-stream",
        });
    }
    const { sessionId } = session;
    try {
        for (let offset = 0; offset < blob.size; offset += NATIVE_SAVE_CHUNK_BYTES) {
            const data = await blobChunkToBase64(blob.slice(offset, offset + NATIVE_SAVE_CHUNK_BYTES));
            await NativeFileSaver.writeChunk({ sessionId, data });
        }
        await NativeFileSaver.finishSave({ sessionId });
    } catch (error) {
        await NativeFileSaver.abortSave({ sessionId }).catch(() => undefined);
        throw error;
    }
}

export function isAndroidBrowser(): boolean {
    return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

export function isIOSBrowser(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    return /iPad|iPhone|iPod/i.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export async function downloadFile(blob: Blob, filename: string, options: DownloadFileOptions = {}): Promise<void> {
    const saveMode = resolveDownloadSaveMode({
        androidNative: Capacitor.getPlatform() === "android" && Capacitor.isNativePlatform(),
        automaticAndroidSave: options.automaticAndroidSave,
    });
    if (saveMode !== "browser") {
        await saveWithAndroid(blob, filename, saveMode === "android-downloads");
        return;
    }
    const url = URL.createObjectURL(blob);
    const anchorDownload = () => {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const shouldUseNativeShare = options.nativeShareOnly || (!options.disableNativeShare && isIOSBrowser());
    if (shouldUseNativeShare) {
        const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
        const canNativeShare = typeof navigator !== "undefined"
            && typeof navigator.share === "function"
            && typeof navigator.canShare === "function"
            && navigator.canShare({ files: [file] });
        if (canNativeShare) {
            try {
                await navigator.share({ files: [file] });
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                return;
            } catch (err) {
                // User explicitly dismissed the share sheet → respect it, don't force a download.
                if (err instanceof DOMException && err.name === "AbortError") {
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    return;
                }
                // Any other failure (webview without real file-share support, lost user
                // activation, etc.) is surfaced to the caller on iOS instead of opening
                // the blob URL, which can navigate away from the app.
            }
        }
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        throw new Error("当前浏览器没有成功打开系统分享，请在 Safari 中重试，或导出轻量备份后再试。");
    }

    anchorDownload();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadRemoteFile(url: string, filename: string): Promise<void> {
    const saveMode = resolveDownloadSaveMode({
        androidNative: Capacitor.getPlatform() === "android" && Capacitor.isNativePlatform(),
        directRemoteDownload: true,
    });
    if (saveMode === "android-download-manager") {
        await NativeFileSaver.queueDownload({ url, filename });
        return;
    }
    await downloadUrl(url, filename);
}

export async function downloadUrl(url: string, filename: string): Promise<void> {
    let blob: Blob | null = null;

    try {
        const res = await fetch(url);
        if (res.ok) blob = await res.blob();
    } catch { /* CORS or network error — try proxy */ }

    if (!blob && /^https?:\/\//.test(url)) {
        try {
            const res = await fetch("/api/tool-proxy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, method: "GET" }),
            });
            if (res.ok) blob = await res.blob();
        } catch { /* proxy also failed */ }
    }

    if (blob) {
        await downloadFile(blob, filename);
    } else {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
}
