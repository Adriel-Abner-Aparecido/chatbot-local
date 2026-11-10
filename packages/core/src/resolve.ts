import { ExtensionChatEngine } from "./engines/extension";
import type { ChatEngine } from "./types";

export interface ResolveEngineOptions {
  /** ID da extensão publicada. Se instalada, o site usa o modelo dela (baixado uma vez só). */
  extensionId?: string;
  /** Fábrica do Web Worker local (fallback quando a extensão não está presente). */
  createWorker: () => Worker;
  /** Força o modo local, ignorando a extensão. */
  preferLocal?: boolean;
}

export async function resolveEngine(opts: ResolveEngineOptions): Promise<ChatEngine> {
  if (opts.extensionId && !opts.preferLocal) {
    const ext = await ExtensionChatEngine.connect(opts.extensionId);
    if (ext) return ext;
  }
  // Import dinâmico: o WebLLM (~6 MB) só é baixado quando o site roda o modelo por conta própria.
  const { createLocalEngine } = await import("./engines/local");
  return createLocalEngine(opts.createWorker);
}
