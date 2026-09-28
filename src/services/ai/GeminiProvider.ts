import type {
  AIRequest,
  AIResponse,
  AIStreamChunk,
} from "../../types/ai";
import type { Message } from "../../types/chat";
import type { AIProvider } from "./AIProvider";

const getCustomApiKey = (): string | null => {
  if (typeof window !== "undefined") {
    const localKey = localStorage.getItem("GEMINI_API_KEY");
    if (localKey && localKey.trim()) {
      return localKey.trim();
    }
  }

  return null;
};

const getMessages = (request: AIRequest): Message[] => {
  return request.messages;
};

export class GeminiProvider implements AIProvider {
  readonly id = "gemini" as const;

  async generate(request: AIRequest): Promise<AIResponse> {
    const history = getMessages(request);
    const customApiKey = getCustomApiKey();

    let response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        history,
        customApiKey,
      }),
      cache: "no-store",
    });

    if (!response.ok && response.status === 404) {
      response = await fetch("/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          history,
          customApiKey,
        }),
        cache: "no-store",
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: response.statusText,
      }));

      throw new Error(
        errorData?.error ||
        `Gemini server returned HTTP ${response.status}`
      );
    }

    const data = await response.json();

    return {
      text: data.text || "",
      provider: this.id,
      model: data.model,
      usage: data.usage,
      metadata: data.metadata,
    };
  }

  async *stream(
    request: AIRequest
  ): AsyncIterable<AIStreamChunk> {
    const history = getMessages(request);
    const customApiKey = getCustomApiKey();

    let response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        history,
        customApiKey,
      }),
      cache: "no-store",
    });

    if (!response.ok && response.status === 404) {
      response = await fetch("/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          history,
          customApiKey,
        }),
        cache: "no-store",
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: response.statusText,
      }));

      yield {
        text: "",
        provider: this.id,
        error:
          errorData?.error ||
          `Gemini stream returned HTTP ${response.status}`,
        done: true,
      };

      return;
    }

    if (!response.body) {
      yield {
        text: "",
        provider: this.id,
        error: "Le flux de réponse est vide.",
        done: true,
      };

      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed || !trimmed.startsWith("data: ")) {
            continue;
          }

          const dataStr = trimmed.replace(/^data:\s*/, "");

          try {
            const parsed = JSON.parse(dataStr);

            if (parsed.error) {
              yield {
                text: "",
                provider: this.id,
                error: parsed.error,
                done: true,
              };

              return;
            }

            if (parsed.text) {
              yield {
                text: parsed.text,
                provider: this.id,
                done: false,
              };
            }

            if (parsed.done) {
              yield {
                text: "",
                provider: this.id,
                done: true,
              };

              return;
            }
          } catch {
            // Ignore malformed SSE payloads,
            // exactly as the legacy service does.
          }
        }
      }

      yield {
        text: "",
        provider: this.id,
        done: true,
      };
    } finally {
      reader.releaseLock();
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch("/api/health", {
        method: "GET",
        cache: "no-store",
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}
