import type { MLCEngineInterface } from "@mlc-ai/web-llm";
import type { ChatEngine, ChatMessage, ChatOptions, LoadProgress } from "../types";
import { familyOf } from "../models";
import { stripThinking } from "../thinking";

/**
 * Adapta qualquer engine do WebLLM (worker, offscreen, main thread)
 * para a interface ChatEngine.
 */
export class WebLLMChatEngine implements ChatEngine {
  readonly kind: "local" | "extension";
  private model: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly engine: MLCEngineInterface,
    kind: "local" | "extension" = "local",
    private readonly onDispose?: () => void,
  ) {
    this.kind = kind;
  }

  get currentModel() {
    return this.model;
  }

  async load(modelId: string, onProgress?: (p: LoadProgress) => void) {
    if (this.model === modelId) return;
    this.engine.setInitProgressCallback((r) => onProgress?.({ progress: r.progress, text: r.text }));
    await this.engine.reload(modelId);
    this.model = modelId;
  }

  chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    // Um engine só gera uma resposta por vez: serializa as chamadas.
    const run = this.queue.then(() => this.runChat(messages, opts));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async runChat(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
    if (!this.model) throw new Error("Nenhum modelo carregado.");
    const fam = familyOf(this.model);
    const onAbort = () => this.engine.interruptGenerate();
    opts.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const stream = await this.engine.chat.completions.create({
        messages,
        stream: true,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1024,
        ...(fam?.supportsThinking ? { extra_body: { enable_thinking: opts.thinking ?? false } } : {}),
      });
      let full = "";
      for await (const chunk of stream) {
        if (opts.signal?.aborted) break;
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (!delta) continue;
        full += delta;
        opts.onToken?.(delta, full);
      }
      return stripThinking(full);
    } finally {
      opts.signal?.removeEventListener("abort", onAbort);
    }
  }

  async unload() {
    await this.engine.unload();
    this.model = null;
  }

  dispose() {
    void this.engine.unload();
    this.onDispose?.();
  }
}
