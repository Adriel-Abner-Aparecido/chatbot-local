import { CLIENT_PORT, PROTOCOL_VERSION, type ClientRequest, type HostEvent } from "../bridge/protocol";
import type { ChatEngine, ChatMessage, ChatOptions, LoadProgress } from "../types";

type Port = chrome.runtime.Port;

interface Pending {
  onEvent: (ev: HostEvent) => void;
  reject: (err: Error) => void;
}

/**
 * Cliente do engine hospedado pela extensão.
 * - No site: passe o ID da extensão (exige externally_connectable no manifest).
 * - Dentro da própria extensão (side panel/popup): não passe ID.
 */
export class ExtensionChatEngine implements ChatEngine {
  readonly kind = "extension" as const;
  private model: string | null;
  private pending = new Map<string, Pending>();
  private seq = 0;

  private constructor(private readonly port: Port, currentModel: string | null) {
    this.model = currentModel;
    port.onMessage.addListener((ev: HostEvent) => {
      if (ev.type === "hello") return;
      this.pending.get(ev.id)?.onEvent(ev);
    });
    port.onDisconnect.addListener(() => {
      const err = new Error("Conexão com a extensão foi encerrada.");
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
    });
  }

  /** Tenta conectar; resolve null se a extensão não estiver instalada/permitida. */
  static async connect(extensionId?: string, timeoutMs = 1500): Promise<ExtensionChatEngine | null> {
    const runtime = globalThis.chrome?.runtime;
    if (!runtime?.connect) return null;
    let port: Port;
    try {
      port = extensionId
        ? runtime.connect(extensionId, { name: CLIENT_PORT })
        : runtime.connect({ name: CLIENT_PORT });
    } catch {
      return null;
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => finish(null), timeoutMs);
      function finish(v: ExtensionChatEngine | null) {
        clearTimeout(timer);
        port.onMessage.removeListener(onHello);
        port.onDisconnect.removeListener(onGone);
        if (!v) port.disconnect();
        resolve(v);
      }
      function onHello(ev: HostEvent) {
        if (ev.type !== "hello") return;
        if (ev.version !== PROTOCOL_VERSION) return finish(null);
        finish(new ExtensionChatEngine(port, ev.currentModel));
      }
      function onGone() {
        void runtime.lastError; // evita "Unchecked runtime.lastError" no console
        finish(null);
      }
      port.onMessage.addListener(onHello);
      port.onDisconnect.addListener(onGone);
      port.postMessage({ type: "hello" } satisfies ClientRequest);
    });
  }

  get currentModel() {
    return this.model;
  }

  private request<T>(
    build: (id: string) => ClientRequest,
    onEvent: (ev: HostEvent, resolve: (v: T) => void, reject: (e: Error) => void) => void,
  ): Promise<T> {
    const id = `${Date.now().toString(36)}-${++this.seq}`;
    return new Promise<T>((resolve, reject) => {
      const done = () => this.pending.delete(id);
      this.pending.set(id, {
        reject: (e) => (done(), reject(e)),
        onEvent: (ev) => {
          if (ev.type === "error") return done(), reject(new Error(ev.message));
          onEvent(ev, (v) => (done(), resolve(v)), (e) => (done(), reject(e)));
        },
      });
      this.port.postMessage(build(id));
    });
  }

  async load(modelId: string, onProgress?: (p: LoadProgress) => void) {
    if (this.model === modelId) return;
    await this.request<void>(
      (id) => ({ type: "load", id, modelId }),
      (ev, resolve) => {
        if (ev.type === "progress") onProgress?.({ progress: ev.progress, text: ev.text });
        if (ev.type === "loaded") resolve();
      },
    );
    this.model = modelId;
  }

  chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    let full = "";
    let reqId = "";
    const onAbort = () => this.port.postMessage({ type: "abort", id: reqId } satisfies ClientRequest);
    opts.signal?.addEventListener("abort", onAbort, { once: true });

    return this.request<string>(
      (id) => {
        reqId = id;
        return {
          type: "chat",
          id,
          messages,
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
          thinking: opts.thinking,
        };
      },
      (ev, resolve) => {
        if (ev.type === "token") {
          full += ev.delta;
          opts.onToken?.(ev.delta, full);
        }
        if (ev.type === "done") resolve(ev.text);
      },
    ).finally(() => opts.signal?.removeEventListener("abort", onAbort));
  }

  async unload() {
    await this.request<void>(
      (id) => ({ type: "unload", id }),
      (ev, resolve) => ev.type === "unloaded" && resolve(),
    );
    this.model = null;
  }

  dispose() {
    this.port.disconnect();
  }
}
