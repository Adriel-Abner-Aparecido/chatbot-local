import { CONTEXT_WINDOW_OPTIONS, DEFAULT_SETTINGS, type ModelSettings } from "@localchat/core";

export interface SettingsPanelProps {
  settings: ModelSettings;
  onChange: (patch: Partial<ModelSettings>) => void;
  onReset: () => void;
  onClose: () => void;
  /** O modelo selecionado suporta modo thinking. */
  supportsThinking: boolean;
  /** System prompt padrão do app (mostrado como placeholder). */
  defaultSystemPrompt?: string;
}

export function SettingsPanel({
  settings: s,
  onChange,
  onReset,
  onClose,
  supportsThinking,
  defaultSystemPrompt,
}: SettingsPanelProps) {
  return (
    <section className="lc-settings" aria-label="Configurações do modelo">
      <div className="lc-settings-head">
        <strong>Configurações do modelo</strong>
        <div className="lc-settings-actions">
          <button className="lc-btn" onClick={onReset}>
            Restaurar padrões
          </button>
          <button className="lc-btn" onClick={onClose} aria-label="Fechar configurações">
            ×
          </button>
        </div>
      </div>

      <div className="lc-settings-grid">
        <Slider
          label="Temperatura"
          hint="Mais baixa = respostas mais previsíveis; mais alta = mais criativas."
          value={s.temperature}
          min={0}
          max={2}
          step={0.05}
          def={DEFAULT_SETTINGS.temperature}
          onChange={(temperature) => onChange({ temperature })}
        />
        <Slider
          label="Top P"
          hint="Limita a escolha às palavras mais prováveis que somam esta probabilidade."
          value={s.topP}
          min={0.05}
          max={1}
          step={0.05}
          def={DEFAULT_SETTINGS.topP}
          onChange={(topP) => onChange({ topP })}
        />

        <label className="lc-field">
          <span className="lc-field-label">
            Máx. tokens por resposta <output>{s.maxTokens}</output>
          </span>
          <input
            type="number"
            min={64}
            max={8192}
            step={64}
            value={s.maxTokens}
            onChange={(e) => {
              const v = e.target.valueAsNumber;
              if (Number.isFinite(v)) onChange({ maxTokens: v });
            }}
          />
          <small>Tamanho máximo de cada resposta (padrão {DEFAULT_SETTINGS.maxTokens}).</small>
        </label>

        <label className="lc-field">
          <span className="lc-field-label">Janela de contexto</span>
          <select
            value={s.contextWindow ?? ""}
            onChange={(e) => onChange({ contextWindow: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Padrão do modelo</option>
            {CONTEXT_WINDOW_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString("pt-BR")} tokens
              </option>
            ))}
          </select>
          <small>Quanto do histórico o modelo enxerga. Alterar recarrega o modelo; janelas maiores usam mais VRAM.</small>
        </label>

        {supportsThinking && (
          <label className="lc-field lc-field-check">
            <input type="checkbox" checked={s.thinking} onChange={(e) => onChange({ thinking: e.target.checked })} />
            <span>
              <span className="lc-field-label">Modo thinking</span>
              <small>O modelo raciocina antes de responder. Melhora respostas difíceis, mas é bem mais lento.</small>
            </span>
          </label>
        )}

        <label className="lc-field lc-field-wide">
          <span className="lc-field-label">System prompt</span>
          <textarea
            rows={3}
            value={s.systemPrompt}
            placeholder={defaultSystemPrompt || "Instruções gerais para o assistente"}
            onChange={(e) => onChange({ systemPrompt: e.target.value })}
          />
          <small>Deixe vazio para usar o padrão.</small>
        </label>
      </div>
    </section>
  );
}

function Slider(props: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  def: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="lc-field">
      <span className="lc-field-label">
        {props.label} <output>{props.value.toFixed(2)}</output>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(e.target.valueAsNumber)}
      />
      <small>
        {props.hint} (padrão {props.def})
      </small>
    </label>
  );
}
