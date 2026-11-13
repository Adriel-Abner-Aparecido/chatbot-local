export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface LoadProgress {
  /** 0..1 */
  progress: number;
  text: string;
}

export interface ChatOptions {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  /** Modelos Qwen3 têm modo "thinking"; desligado por padrão pra respostas mais rápidas. */
  thinking?: boolean;
  signal?: AbortSignal;
  onToken?: (delta: string, full: string) => void;
}

export interface LoadOptions {
  /** Janela de contexto em tokens; omitido = padrão do modelo. */
  contextWindow?: number | null;
}

/**
 * Interface única que a UI usa, não importa onde o modelo roda
 * (worker local do site ou engine hospedado pela extensão).
 */
export interface ChatEngine {
  readonly kind: "local" | "extension";
  readonly currentModel: string | null;
  /** Janela de contexto pedida no último load (null = padrão do modelo). */
  readonly currentContextWindow: number | null;
  load(modelId: string, onProgress?: (p: LoadProgress) => void, opts?: LoadOptions): Promise<void>;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
  unload(): Promise<void>;
  dispose(): void;
}
