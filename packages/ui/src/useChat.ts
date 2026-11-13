import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_SETTINGS,
  detectGpu,
  familyOf,
  fitContext,
  history,
  historyBudget,
  isThinking,
  listModels,
  normalizeSettings,
  recommendModel,
  requestPersistentStorage,
  stripThinking,
  titleFrom,
  type ChatEngine,
  type ChatMessage,
  type Conversation,
  type GpuInfo,
  type ModelOption,
  type ModelSettings,
} from "@localchat/core";

export type Status = "init" | "idle" | "loading" | "ready" | "generating" | "error";

export interface UseChatOptions {
  getEngine: () => Promise<ChatEngine>;
  systemPrompt?: string;
  /** Contexto extra injetado antes da pergunta (ex.: texto da página na extensão). */
  getContext?: () => Promise<string | null>;
}

const SELECTED_KEY = "localchat:model";
const SETTINGS_KEY = "localchat:settings";

function loadSettings(): ModelSettings {
  try {
    return normalizeSettings(JSON.parse(safeGet(SETTINGS_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function useChat({ getEngine, systemPrompt, getContext }: UseChatOptions) {
  const [engine, setEngine] = useState<ChatEngine | null>(null);
  const [gpu, setGpu] = useState<GpuInfo | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [status, setStatus] = useState<Status>("init");
  const [progress, setProgress] = useState<{ value: number; text: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string>(() => history.newId());
  const [settings, setSettings] = useState<ModelSettings>(loadSettings);
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

  const updateSettings = useCallback((patch: Partial<ModelSettings>) => {
    setSettings((prev) => {
      const next = normalizeSettings({ ...prev, ...patch });
      safeSet(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    safeSet(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  /** O modelo selecionado está carregado, mas com outra janela de contexto. */
  const needsReload =
    !!engine?.currentModel &&
    engine.currentModel === selected &&
    (engine.currentContextWindow ?? null) !== settings.contextWindow;

  const loadModel = useCallback(
    async (modelId = selected) => {
      if (!engine || !modelId) return;
      setError(null);
      setStatus("loading");
      setProgress({ value: 0, text: "Preparando…" });
      try {
        await requestPersistentStorage();
        await engine.load(modelId, (p) => setProgress({ value: p.progress, text: p.text }), {
          contextWindow: settings.contextWindow,
        });
        safeSet(SELECTED_KEY, modelId);
        setStatus("ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      } finally {
        setProgress(null);
      }
    },
    [engine, selected, settings.contextWindow],
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
      if (!engine.currentModel || needsReload) await loadModel();
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
        const prompt = settings.systemPrompt.trim() || systemPrompt;
        if (prompt) sys.push({ role: "system", content: prompt });
        if (extra) sys.push({ role: "system", content: `Contexto fornecido pelo usuário:\n${extra}` });

        const fam = familyOf(engine.currentModel);
        const reply = await engine.chat(fitContext([...sys, ...next], historyBudget(settings)), {
          temperature: settings.temperature,
          topP: settings.topP,
          maxTokens: settings.maxTokens,
          thinking: fam?.supportsThinking ? settings.thinking : undefined,
          signal: ac.signal,
          onToken: (_d, full) => {
            setThinking(isThinking(full));
            setStreaming(stripThinking(full));
          },
        });
        const final = [...next, { role: "assistant" as const, content: reply || "…" }];
        setMessages(final);
        void persist(final);
      } catch (e) {
        if (!ac.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        setStreaming("");
        setThinking(false);
        abortRef.current = null;
        setStatus("ready");
      }
    },
    [engine, status, messages, loadModel, needsReload, getContext, systemPrompt, settings, persist],
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
    thinking,
    error,
    conversations,
    conversationId,
    settings,
    updateSettings,
    resetSettings,
    needsReload,
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
