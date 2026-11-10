import type { ChatMessage } from "../types";

/** Versão do protocolo entre site/side panel e o engine hospedado na extensão. */
export const PROTOCOL_VERSION = 1;

export type ClientRequest =
  | { type: "hello" }
  | { type: "load"; id: string; modelId: string }
  | {
      type: "chat";
      id: string;
      messages: ChatMessage[];
      temperature?: number;
      maxTokens?: number;
      thinking?: boolean;
    }
  | { type: "abort"; id: string }
  | { type: "unload"; id: string };

export type HostEvent =
  | { type: "hello"; version: number; currentModel: string | null }
  | { type: "progress"; id: string; progress: number; text: string }
  | { type: "loaded"; id: string; modelId: string }
  | { type: "token"; id: string; delta: string }
  | { type: "done"; id: string; text: string }
  | { type: "unloaded"; id: string }
  | { type: "error"; id: string; message: string };

/** Nome da porta usada pelo side panel e pelo site para falar com o background. */
export const CLIENT_PORT = "localchat-client";
/** Nome da porta entre o offscreen document (engine) e o background. */
export const HOST_PORT = "localchat-host";

/** Aviso interno do background ao offscreen: o cliente desconectou (cancela as gerações dele). */
export type ClientGone = { type: "client-gone" };

/** Envelope usado entre background ⇄ offscreen para multiplexar vários clientes. */
export interface Envelope<T> {
  clientId: string;
  msg: T;
}

export function isClientRequest(x: unknown): x is ClientRequest {
  return !!x && typeof x === "object" && typeof (x as { type?: unknown }).type === "string";
}
