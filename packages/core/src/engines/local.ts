import { WebWorkerMLCEngine } from "@mlc-ai/web-llm";
import type { ChatEngine } from "../types";
import { WebLLMChatEngine } from "./webllm";

/**
 * Engine que roda o modelo num Web Worker do próprio site (a UI nunca trava).
 *
 * O worker precisa ser criado pelo app, para o bundler resolver a URL:
 *   createLocalEngine(() => new Worker(new URL("./llm.worker.ts", import.meta.url), { type: "module" }))
 * onde llm.worker.ts contém apenas: import "@localchat/core/worker";
 *
 * Nenhum modelo é baixado aqui; isso acontece no primeiro load().
 */
export async function createLocalEngine(createWorker: () => Worker): Promise<ChatEngine> {
  const worker = createWorker();
  const engine = new WebWorkerMLCEngine(worker);
  return new WebLLMChatEngine(engine, "local", () => worker.terminate());
}
