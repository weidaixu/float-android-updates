"use client";

import { useRef } from "react";
import { Film, Paperclip } from "lucide-react";
import { canUseNativeVideoAnalysis } from "@/lib/chat-attachments/native-video-extractor";

const ACCEPTED = "image/*,video/mp4,video/webm,video/quicktime,.pdf,.docx,.txt,.epub";

export function ChatAttachmentPicker({
  disabled,
  onPick,
  onPickNativeVideo,
}: {
  disabled?: boolean;
  onPick(files: File[]): void;
  onPickNativeVideo?(): void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept={ACCEPTED}
        onChange={(event) => {
          onPick(Array.from(event.target.files || []));
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className="ui-bare-btn text-[var(--c-text)]"
        disabled={disabled}
        aria-label="添加文件"
        title="添加图片、视频或文档"
        onClick={() => inputRef.current?.click()}
        style={disabled ? { opacity: 0.35 } : undefined}
      >
        <Paperclip size={23} strokeWidth={1.6} />
      </button>
      {canUseNativeVideoAnalysis() && onPickNativeVideo && (
        <button
          type="button"
          className="ui-bare-btn text-[var(--c-text)]"
          disabled={disabled}
          aria-label="原生视频分析"
          title="选择视频并在本机提取画面和音轨"
          onClick={onPickNativeVideo}
          style={disabled ? { opacity: 0.35 } : undefined}
        >
          <Film size={23} strokeWidth={1.6} />
        </button>
      )}
    </>
  );
}
