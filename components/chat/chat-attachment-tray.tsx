"use client";

import { FileText, Film, Image as ImageIcon, Loader2, RotateCcw, X } from "lucide-react";
import type { PendingAttachment } from "@/lib/chat-attachments/types";

function AttachmentIcon({ kind }: { kind: PendingAttachment["kind"] }) {
  if (kind === "image") return <ImageIcon size={16} />;
  if (kind === "video") return <Film size={16} />;
  return <FileText size={16} />;
}

export function ChatAttachmentTray({
  attachments,
  onRemove,
  onRetry,
}: {
  attachments: PendingAttachment[];
  onRemove(id: string): void;
  onRetry(id: string): void;
}) {
  if (!attachments.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto px-3 py-2" aria-label="待发送附件">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex min-w-[150px] max-w-[230px] items-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] px-2 py-2"
        >
          {attachment.status === "processing" ? <Loader2 className="animate-spin" size={16} /> : <AttachmentIcon kind={attachment.kind} />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-[var(--c-text)]">{attachment.name}</div>
            <div className={`truncate text-[10px] ${attachment.status === "error" ? "text-red-500" : "text-[var(--c-icon)]"}`}>
              {attachment.status === "processing" ? "正在本地解析" : attachment.status === "error" ? attachment.error : "已就绪"}
            </div>
          </div>
          {attachment.status === "error" && (
            <button type="button" className="ui-bare-btn" title="重试" onClick={() => onRetry(attachment.id)}><RotateCcw size={14} /></button>
          )}
          <button type="button" className="ui-bare-btn" title="移除" onClick={() => onRemove(attachment.id)}><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
