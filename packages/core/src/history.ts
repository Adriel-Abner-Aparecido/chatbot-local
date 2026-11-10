import type { ChatMessage } from "./types";

export interface Conversation {
  id: string;
  title: string;
  modelId: string | null;
  messages: ChatMessage[];
  updatedAt: number;
}

const DB_NAME = "localchat";
const STORE = "conversations";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("updatedAt", "updatedAt");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

/** Histórico de conversas no IndexedDB (fica só no dispositivo do usuário). */
export const history = {
  async list(): Promise<Conversation[]> {
    const all = await tx<Conversation[]>("readonly", (s) => s.getAll());
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get: (id: string) => tx<Conversation | undefined>("readonly", (s) => s.get(id)),
  async save(conv: Conversation) {
    await tx("readwrite", (s) => s.put({ ...conv, updatedAt: Date.now() }));
  },
  async remove(id: string) {
    await tx("readwrite", (s) => s.delete(id));
  },
  newId: () => crypto.randomUUID(),
};

export function titleFrom(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.content.trim() ?? "Nova conversa";
  return first.length > 48 ? first.slice(0, 47) + "…" : first;
}

/**
 * Corta o histórico para caber na janela de contexto do modelo.
 * Estimativa grosseira (~4 caracteres por token); mantém o system prompt e as mensagens mais recentes.
 */
export function fitContext(messages: ChatMessage[], maxTokens = 3000): ChatMessage[] {
  const est = (m: ChatMessage) => Math.ceil(m.content.length / 4) + 4;
  const system = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  let budget = maxTokens - system.reduce((n, m) => n + est(m), 0);
  const kept: ChatMessage[] = [];
  for (let i = rest.length - 1; i >= 0; i--) {
    const m = rest[i]!;
    budget -= est(m);
    if (budget < 0 && kept.length > 0) break;
    kept.unshift(m);
  }
  return [...system, ...kept];
}
