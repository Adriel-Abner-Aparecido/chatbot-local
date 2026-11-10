import type { ChatEngine } from "../types";
import { PROTOCOL_VERSION, type ClientRequest, type HostEvent } from "./protocol";

export type Reply = (ev: HostEvent) => void;

/**
 * Lado "servidor" do protocolo: recebe pedidos de um cliente e executa no engine.
 * Usado pelo offscreen document da extensão (um engine compartilhado por todos os clientes).
 */
export function createEngineHost(engine: ChatEngine) {
  const running = new Map<string, AbortController>();

  async function handle(req: ClientRequest, reply: Reply) {
    switch (req.type) {
      case "hello":
        reply({ type: "hello", version: PROTOCOL_VERSION, currentModel: engine.currentModel });
        return;

      case "load":
        try {
          await engine.load(req.modelId, (p) =>
            reply({ type: "progress", id: req.id, progress: p.progress, text: p.text }),
          );
          reply({ type: "loaded", id: req.id, modelId: req.modelId });
        } catch (e) {
          reply({ type: "error", id: req.id, message: errMsg(e) });
        }
        return;

      case "chat": {
        const ac = new AbortController();
        running.set(req.id, ac);
        try {
          const text = await engine.chat(req.messages, {
            temperature: req.temperature,
            maxTokens: req.maxTokens,
            thinking: req.thinking,
            signal: ac.signal,
            onToken: (delta) => reply({ type: "token", id: req.id, delta }),
          });
          reply({ type: "done", id: req.id, text });
        } catch (e) {
          reply({ type: "error", id: req.id, message: errMsg(e) });
        } finally {
          running.delete(req.id);
        }
        return;
      }

      case "abort":
        running.get(req.id)?.abort();
        return;

      case "unload":
        try {
          await engine.unload();
          reply({ type: "unloaded", id: req.id });
        } catch (e) {
          reply({ type: "error", id: req.id, message: errMsg(e) });
        }
        return;
    }
  }

  /** Cancela as gerações de um cliente que desconectou. */
  function abortAll() {
    for (const ac of running.values()) ac.abort();
  }

  return { handle, abortAll };
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
