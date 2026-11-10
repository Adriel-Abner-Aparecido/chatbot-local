import { useCallback, useEffect, useRef, useState } from "react";
import {
  detectGpu,
  fitContext,
  history,
  listModels,
  recommendModel,
  requestPersistentStorage,
  stripThinking,
  titleFrom,
  type ChatEngine,
  type ChatMessage,
  type Conversation,
  type GpuInfo,
  type ModelOption,
} from "@localchat/core";

export type Status = "init" | "idle" | "loading" | "ready" | "generating" | "error";

export interface UseChatOptions {
  getEngine: () => Promise<ChatEngine>;
  systemPrompt?: string;
  /** Contexto extra injetado antes da pergunta (ex.: texto da página na extensão). */
  getContext?: () => Promise<string | null>;
}

const SELECTED_KEY = "localchat:model";

export function useChat({ getEngine, systemPrompt, getContext }: UseChatOptions) {
  const [engine, setEngine] = useState<ChatEngine | null>(null);
  const [gpu, setGpu] = useState<GpuInfo | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [status, setStatus] = useState<Status>("init");
  const [progress, setProgress] = useState<{ value: number; text: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string>(() => history.newId());
  const abortRef = useRef<AbortController | null>(null);

  // Inicialização: GPU, catálogo, engine e histórico.
  useEffect(() => {
    let disposed = false;
    let eng: ChatEngine | null = null;
    (async () => {
      const info = await detectGpu();
      if (disposed) return;
      setGpu(info);
      const list = listModels(info);
      setModels(list);
      const saved = safeGet(SELECTED_KEY);
      setSelected(list.find((m) => m.id === saved)?.id ?? recommendModel(list)?.id ?? "");
      if (!info.supported) {
        setError(info.reason ?? "WebGPU indisponível.");
        setStatus("error");
        return;
      }
      eng = await getEngine();
      if (disposed) return eng.dispose();
      setEngine(eng);
      if (eng.currentModel) setSelected(eng.currentModel);
      setStatus(eng.currentModel ? "ready" : "idle");
      setConversations(await history.list().catch(() => []));
    })().catch((e) => {
      setError(String(e?.message ?? e));
      setStatus("error");
    });
    return () => {
      disposed = true;
      abortRef.current?.abort();
      eng?.dispose();
    };
    // getEngine deve ser estável (definido fora do componente).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadModel = useCallback(
    async (modelId = selected) => {
      if (!engine || !modelId) return;
      setError(null);
      setStatus("loading");
      setProgress({ value: 0, text: "Preparando…" });
      try {
        await requestPersistentStorage();
        await engine.load(modelId, (p) => setProgress({ value: p.progress, text: p.text }));
        safeSet(SELECTED_KEY, modelId);
        setStatus("ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      } finally {
        setProgress(null);
      }
    },
    [engine, selected],
  );

  const persist = useCallback(
    async (msgs: ChatMessage[]) => {
      const conv: Conversation = {
        id: conversationId,
        title: titleFrom(msgs),
        modelId: engine?.currentModel ?? null,
        messages: msgs,
        updatedAt: Date.now(),
      };
      await history.save(conv).catch(() => undefined);
      setConversations(await history.list().catch(() => []));
    },
    [conversationId, engine],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!engine || !content || status === "generating") return;
      if (!engine.currentModel) await loadModel();
      if (!engine.currentModel) return;

      const userMsg: ChatMessage = { role: "user", content };
      const next = [...messages, userMsg];
      setMessages(next);
      setStreaming("");
      setError(null);
      setStatus("generating");

      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const extra = getContext ? await getContext().catch(() => null) : null;
        const sys: ChatMessage[] = [];
        if (systemPrompt) sys.push({ role: "system", content: systemPrompt });
        if (extra) sys.push({ role: "system", content: `Contexto fornecido pelo usuário:\n${extra}` });

        const reply = await engine.chat(fitContext([...sys, ...next]), {
          signal: ac.signal,
          onToken: (_d, full) => setStreaming(stripThinking(full)),
        });
        const final = [...next, { role: "assistant" as const, content: reply || "…" }];
        setMessages(final);
        void persist(final);
      } catch (e) {
        if (!ac.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        setStreaming("");
        abortRef.current = null;
        setStatus("ready");
      }
    },
    [engine, status, messages, loadModel, getContext, systemPrompt, persist],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const newConversation = useCallback(() => {
    stop();
    setMessages([]);
    setConversationId(history.newId());
  }, [stop]);

  const openConversation = useCallback(
    async (id: string) => {
      stop();
      const conv = await history.get(id);
      if (!conv) return;
      setConversationId(conv.id);
      setMessages(conv.messages);
    },
    [stop],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      await history.remove(id);
      setConversations(await history.list());
      if (id === conversationId) newConversation();
    },
    [conversationId, newConversation],
  );

  return {
    engine,
    gpu,
    models,
    selected,
    setSelected,
    status,
    progress,
    messages,
    streaming,
    error,
    conversations,
    conversationId,
    loadModel,
    send,
    stop,
    newConversation,
    openConversation,
    deleteConversation,
  };
}

function safeGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* armazenamento indisponível */
  }
}
