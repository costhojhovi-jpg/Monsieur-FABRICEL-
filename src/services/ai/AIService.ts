import type {
  AIRequest,
  AIResponse,
  AIStreamChunk,
  AIProviderId,
} from "../../types/ai";
import type { AIProvider } from "./AIProvider";
import { GeminiProvider } from "./GeminiProvider";

class AIService {
  private readonly providers: Map<AIProviderId, AIProvider>;
  private activeProviderId: AIProviderId = "gemini";

  constructor() {
    const geminiProvider = new GeminiProvider();

    this.providers = new Map<AIProviderId, AIProvider>([
      ["gemini", geminiProvider],
    ]);
  }

  getProvider(providerId: AIProviderId = this.activeProviderId): AIProvider {
    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new Error(`Le fournisseur IA "${providerId}" n'est pas disponible.`);
    }

    return provider;
  }

  setActiveProvider(providerId: AIProviderId): void {
    this.getProvider(providerId);
    this.activeProviderId = providerId;
  }

  getActiveProviderId(): AIProviderId {
    return this.activeProviderId;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    return this.getProvider().generate(request);
  }

  stream(request: AIRequest): AsyncIterable<AIStreamChunk> {
    return this.getProvider().stream(request);
  }

  async isAvailable(providerId: AIProviderId = this.activeProviderId): Promise<boolean> {
    return this.getProvider(providerId).isAvailable();
  }
}

export const aiService = new AIService();

export default aiService;
