import type { GpuInfo } from "./gpu.ts";

export type License = "Apache-2.0" | "MIT" | "Llama 3.2 Community" | "Gemma Terms";

export interface ModelFamily {
  /** Prefixo do model_id no WebLLM, sem o sufixo de quantização. */
  base: string;
  label: string;
  params: string;
  license: License;
  /** Licença permissiva (OSI) — padrão recomendado para o projeto. */
  permissive: boolean;
  supportsThinking?: boolean;
  /** VRAM estimada (MB) por quantização, conforme o prebuiltAppConfig do WebLLM. */
  vram: { q4f16_1: number; q4f32_1: number };
  /** Marcado pelo WebLLM como viável em hardware modesto. */
  lowResource: boolean;
}

/**
 * Catálogo curado. Os IDs precisam existir no prebuiltAppConfig do WebLLM
 * (`pnpm --filter @localchat/core check:models` confere).
 * Os números ficam aqui, e não lidos do WebLLM, para a UI não precisar
 * carregar a biblioteca inteira (~6 MB) só para listar modelos.
 */
export const MODEL_FAMILIES: ModelFamily[] = [
  { base: "Qwen3.5-0.8B", label: "Qwen 3.5 0.8B", params: "0.8B", license: "Apache-2.0", permissive: true, supportsThinking: true, vram: { q4f16_1: 1629, q4f32_1: 1894 }, lowResource: true },
  { base: "Qwen3-1.7B", label: "Qwen 3 1.7B", params: "1.7B", license: "Apache-2.0", permissive: true, supportsThinking: true, vram: { q4f16_1: 2037, q4f32_1: 2635 }, lowResource: true },
  { base: "Qwen3.5-2B", label: "Qwen 3.5 2B", params: "2B", license: "Apache-2.0", permissive: true, supportsThinking: true, vram: { q4f16_1: 2245, q4f32_1: 2592 }, lowResource: false },
  { base: "Qwen3-4B", label: "Qwen 3 4B", params: "4B", license: "Apache-2.0", permissive: true, supportsThinking: true, vram: { q4f16_1: 3432, q4f32_1: 4328 }, lowResource: true },
  { base: "Phi-3.5-mini-instruct", label: "Phi 3.5 mini", params: "3.8B", license: "MIT", permissive: true, vram: { q4f16_1: 3672, q4f32_1: 5483 }, lowResource: false },
  { base: "Llama-3.2-1B-Instruct", label: "Llama 3.2 1B", params: "1B", license: "Llama 3.2 Community", permissive: false, vram: { q4f16_1: 879, q4f32_1: 1129 }, lowResource: true },
  { base: "Llama-3.2-3B-Instruct", label: "Llama 3.2 3B", params: "3B", license: "Llama 3.2 Community", permissive: false, vram: { q4f16_1: 2264, q4f32_1: 2952 }, lowResource: true },
  { base: "gemma-2-2b-it", label: "Gemma 2 2B", params: "2B", license: "Gemma Terms", permissive: false, vram: { q4f16_1: 1895, q4f32_1: 2509 }, lowResource: false },
];

export interface ModelOption extends ModelFamily {
  id: string;
  quantization: "q4f16_1" | "q4f32_1";
  vramMB: number;
  /** Cabe com folga na GPU detectada. */
  fits: boolean;
}

/**
 * Para cada família escolhe a variante certa (f16 se a GPU suportar)
 * e marca se cabe no limite de buffer reportado pelo adaptador.
 */
export function listModels(gpu: GpuInfo): ModelOption[] {
  const out: ModelOption[] = [];
  for (const fam of MODEL_FAMILIES) {
    const quantization = gpu.f16 ? "q4f16_1" : "q4f32_1";
    const vramMB = fam.vram[quantization];
    out.push({
      ...fam,
      id: `${fam.base}-${quantization}-MLC`,
      quantization,
      vramMB,
      // maxBufferSize não é VRAM total, mas é um sinal razoável: GPUs com
      // limite baixo (≤ 1–2 GB) costumam ser integradas e fracas.
      fits: gpu.supported && (gpu.maxBufferSizeMB >= 2048 || fam.lowResource),
    });
  }
  return out.sort((a, b) => a.vramMB - b.vramMB);
}

/** Sugestão padrão: o maior modelo permissivo que cabe, até ~2.5 GB de VRAM. */
export function recommendModel(models: ModelOption[]): ModelOption | undefined {
  const candidates = models.filter((m) => m.fits && m.permissive && m.vramMB <= 2600);
  return candidates.at(-1) ?? models.find((m) => m.fits) ?? models[0];
}

export function familyOf(modelId: string): ModelFamily | undefined {
  return MODEL_FAMILIES.find((f) => modelId.startsWith(f.base + "-"));
}
