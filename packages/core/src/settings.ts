/** Configurações de geração ajustáveis pelo usuário. */
export interface ModelSettings {
  /** 0 = determinístico, valores altos = mais criativo. */
  temperature: number;
  /** Nucleus sampling: considera só os tokens que somam esta probabilidade. */
  topP: number;
  /** Limite de tokens gerados por resposta. */
  maxTokens: number;
  /**
   * Janela de contexto (tokens) usada ao carregar o modelo.
   * null = padrão do modelo. Alterar exige recarregar; janelas maiores usam mais VRAM.
   */
  contextWindow: number | null;
  /** Modo "thinking" (só em modelos que suportam, ex.: Qwen 3). */
  thinking: boolean;
  /** Vazio = usa o system prompt padrão do app. */
  systemPrompt: string;
}

export const DEFAULT_SETTINGS: ModelSettings = {
  temperature: 0.7,
  topP: 0.95,
  maxTokens: 1024,
  contextWindow: null,
  thinking: false,
  systemPrompt: "",
};

/** Janela usada para calcular o orçamento do histórico quando o padrão do modelo é usado. */
export const DEFAULT_CONTEXT_WINDOW = 4096;

export const CONTEXT_WINDOW_OPTIONS = [2048, 4096, 8192, 16384, 32768] as const;

/** Mescla valores salvos (possivelmente antigos/incompletos) com os padrões, validando tipos e faixas. */
export function normalizeSettings(raw: unknown): ModelSettings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ModelSettings, unknown>>;
  const num = (v: unknown, def: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
  return {
    temperature: num(s.temperature, DEFAULT_SETTINGS.temperature, 0, 2),
    topP: num(s.topP, DEFAULT_SETTINGS.topP, 0.05, 1),
    maxTokens: Math.round(num(s.maxTokens, DEFAULT_SETTINGS.maxTokens, 64, 8192)),
    contextWindow:
      typeof s.contextWindow === "number" && s.contextWindow >= 512 ? Math.round(s.contextWindow) : null,
    thinking: typeof s.thinking === "boolean" ? s.thinking : DEFAULT_SETTINGS.thinking,
    systemPrompt: typeof s.systemPrompt === "string" ? s.systemPrompt : DEFAULT_SETTINGS.systemPrompt,
  };
}

/** Quantos tokens do histórico cabem no prompt, reservando espaço para a resposta. */
export function historyBudget(s: Pick<ModelSettings, "contextWindow" | "maxTokens">): number {
  const ctx = s.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  const reply = Math.min(s.maxTokens, Math.floor(ctx / 2));
  return Math.max(256, ctx - reply - 64);
}
