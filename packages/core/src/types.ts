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
  maxTokens?: number;
  /** Modelos Qwen3 têm modo "thinking"; desligado por padrão pra respostas mais rápidas. */
  thinking?: boolean;
  signal?: AbortSignal;
  onToken?: (delta: string, full: string) => void;
}

/**
 * Interface única que a UI usa, não importa onde o modelo roda
 * (worker local do site ou engine hospedado pela extensão).
 */
export interface ChatEngine {
  readonly kind: "local" | "extension";
  readonly currentModel: string | null;
  load(modelId: string, onProgress?: (p: LoadProgress) => void): Promise<void>;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
  unload(): Promise<void>;
  dispose(): void;
}
