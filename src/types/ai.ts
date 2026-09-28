export type AIProviderId =
  | "gemini"
  | "claude"
  | "deepseek"
  | "openai"
  | "local";

export interface AIRequest {
  messages: import("./chat").Message[];
  systemInstruction?: string;
  context?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
}

export interface AIUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AIResponse {
  text: string;
  provider: AIProviderId;
  model?: string;
  usage?: AIUsage;
  metadata?: Record<string, unknown>;
}

export interface AIStreamChunk {
  text: string;
  provider?: AIProviderId;
  model?: string;
  done?: boolean;
  error?: string;
}
