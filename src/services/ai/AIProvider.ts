import type {
  AIRequest,
  AIResponse,
  AIStreamChunk,
  AIProviderId,
} from "../../types/ai";

export interface AIProvider {
  readonly id: AIProviderId;

  generate(request: AIRequest): Promise<AIResponse>;

  stream(request: AIRequest): AsyncIterable<AIStreamChunk>;

  isAvailable(): Promise<boolean>;
}
