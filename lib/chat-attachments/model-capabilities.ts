import type { AnalysisPart } from "./types.ts";

export interface ModelCapabilities {
  text: true;
  image: boolean;
  audioInput: boolean;
  documentNative: boolean;
}

export interface CapabilityConfig {
  provider?: string;
  baseUrl?: string;
  defaultModel?: string;
  enableImageRecognition?: boolean;
  capabilities?: {
    image?: boolean;
    audioInput?: boolean;
    documentNative?: boolean;
  };
}

const VISION_MODELS = [
  /(?:^|[/_-])gpt-4o(?:$|[/_.-])/i,
  /(?:^|[/_-])gpt-4\.1(?:$|[/_.-])/i,
  /(?:^|[/_-])o[134](?:$|[/_.-])/i,
  /claude-3/i,
  /claude-(?:sonnet|opus|haiku)-4/i,
  /gemini-(?:1\.5|2|2\.5|3)/i,
  /qwen(?:2\.5|3)?-vl/i,
  /(?:^|[/_-])vision(?:$|[/_.-])/i,
];

const AUDIO_INPUT_MODELS = [
  /gpt-4o-(?:audio|realtime)/i,
  /gemini-(?:2(?:\.\d+)?|2\.5|3).*(?:live|audio)/i,
];

function matchesAny(model: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(model));
}

export function resolveModelCapabilities(config: CapabilityConfig): ModelCapabilities {
  const model = String(config.defaultModel || "").trim();
  const inferredImage = config.enableImageRecognition !== false && matchesAny(model, VISION_MODELS);
  const inferredAudio = matchesAny(model, AUDIO_INPUT_MODELS);
  return {
    text: true,
    image: config.capabilities?.image ?? inferredImage,
    audioInput: config.capabilities?.audioInput ?? inferredAudio,
    documentNative: config.capabilities?.documentNative ?? false,
  };
}

export function assertPartsSupported(
  parts: AnalysisPart[],
  capabilities: ModelCapabilities,
): void {
  if (parts.some((part) => part.type === "image") && !capabilities.image) {
    throw new Error("当前模型不支持图片输入。请更换视觉模型，或在 API 配置中明确开启模型能力。");
  }
  if (parts.some((part) => part.type === "audio") && !capabilities.audioInput) {
    throw new Error("当前模型不支持音频输入。请更换支持音频的模型，或在 API 配置中明确开启模型能力。");
  }
}
