import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useChat, type UseChatOptions } from "./useChat";

export interface ChatProps extends UseChatOptions {
  /** Layout estreito (side panel da extensão): esconde a lista de conversas. */
  compact?: boolean;
  title?: string;
}

export function Chat({ compact = false, title = "LocalChat", ...opts }: ChatProps) {
  const c = useChat(opts);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [c.messages, c.streaming]);

  const current = c.models.find((m) => m.id === c.selected);
  const loadedHere = c.engine?.currentModel === c.selected;
  const busy = c.status === "loading" || c.status === "generating";

  function submit() {
    if (!input.trim() || busy) return;
    void c.send(input);
    setInput("");
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className={`lc-root${compact ? " lc-compact" : ""}`}>
      {!compact && (
        <aside className="lc-sidebar">
          <button className="lc-btn lc-btn-primary lc-new" onClick={c.newConversation}>
            + Nova conversa
          </button>
          <nav className="lc-convs">
            {c.conversations.map((conv) => (
              <div key={conv.id} className={`lc-conv${conv.id === c.conversationId ? " is-active" : ""}`}>
                <button className="lc-conv-title" onClick={() => void c.openConversation(conv.id)}>
                  {conv.title}
                </button>
                <button
                  className="lc-conv-del"
                  aria-label="Apagar conversa"
                  onClick={() => void c.deleteConversation(conv.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </nav>
          <p className="lc-privacy">Tudo roda e fica salvo só neste dispositivo.</p>
        </aside>
      )}

      <main className="lc-main">
        <header className="lc-header">
          <div className="lc-brand">
            <strong>{title}</strong>
            {c.engine && (
              <span className={`lc-badge lc-badge-${c.engine.kind}`}>
                {c.engine.kind === "extension" ? "via extensão" : "local"}
              </span>
            )}
          </div>

          <div className="lc-model">
            <select
              value={c.selected}
              disabled={busy || !c.models.length}
              onChange={(e) => c.setSelected(e.target.value)}
              aria-label="Modelo"
            >
              {c.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {(m.vramMB / 1024).toFixed(1)} GB{m.fits ? "" : " ⚠"}
                </option>
              ))}
            </select>
            <button
              className="lc-btn"
              disabled={busy || !c.engine || loadedHere}
              onClick={() => void c.loadModel()}
            >
              {loadedHere ? "Carregado" : "Carregar"}
            </button>
            {compact && (
              <button className="lc-btn" onClick={c.newConversation} title="Nova conversa">
                +
              </button>
            )}
          </div>
        </header>

        {current && (
          <div className="lc-meta">
            {current.params} · {current.quantization} · licença {current.license}
            {!current.permissive && " (verifique os termos)"}
            {c.gpu?.supported && ` · GPU ${c.gpu.vendor || "?"}${c.gpu.f16 ? " · f16" : ""}`}
          </div>
        )}

        {c.progress && (
          <div className="lc-progress" role="progressbar" aria-valuenow={Math.round(c.progress.value * 100)}>
            <div className="lc-progress-bar" style={{ width: `${c.progress.value * 100}%` }} />
            <span>{c.progress.text}</span>
          </div>
        )}

        {c.error && <div className="lc-error">{c.error}</div>}

        <div className="lc-messages" ref={listRef}>
          {c.messages.length === 0 && !c.streaming && (
            <div className="lc-empty">
              <h2>IA rodando no seu navegador</h2>
              <p>
                Nada sai do seu computador. Na primeira vez o modelo é baixado e fica em cache; depois funciona
                até offline.
              </p>
            </div>
          )}
          {c.messages.map((m, i) => (
            <div key={i} className={`lc-msg lc-msg-${m.role}`}>
              {m.content}
            </div>
          ))}
          {c.status === "generating" && (
            <div className="lc-msg lc-msg-assistant">{c.streaming || <span className="lc-typing">…</span>}</div>
          )}
        </div>

        <footer className="lc-composer">
          <textarea
            value={input}
            rows={compact ? 2 : 3}
            placeholder={c.engine ? "Escreva sua mensagem (Enter envia, Shift+Enter quebra linha)" : "Iniciando…"}
            disabled={!c.engine}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
          />
          {c.status === "generating" ? (
            <button className="lc-btn lc-btn-danger" onClick={c.stop}>
              Parar
            </button>
          ) : (
            <button className="lc-btn lc-btn-primary" disabled={!input.trim() || busy || !c.engine} onClick={submit}>
              Enviar
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}
