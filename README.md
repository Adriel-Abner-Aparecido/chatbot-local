# LocalChat

Chatbot open source com IA rodando **100% no navegador** via WebGPU. Nada é enviado para servidores: o modelo é baixado uma vez, fica em cache no dispositivo e funciona até offline.

- **App web** (React + Vite) — roda o modelo num Web Worker do próprio site.
- **Extensão** para Chrome e Edge (MV3, WXT) — chat no painel lateral **e** "servidor de modelo" para o site: com a extensão instalada, o site usa o modelo que ela já baixou, em vez de baixar de novo.

## Estrutura

```
packages/
  core/        engine (WebLLM), detecção de GPU, catálogo de modelos, histórico (IndexedDB), protocolo extensão⇄site
  ui/          hook useChat + componente <Chat/> compartilhados
apps/
  web/         app web
  extension/   extensão (background roteia, offscreen hospeda o engine, side panel é a UI)
```

```
 side panel ──┐
 site web ────┼──► background (service worker, só roteia) ──► offscreen document ──► Web Worker (WebLLM + WebGPU)
 outras abas ─┘          └ checa origem do site                  └ um engine compartilhado por todos
```

O site decide sozinho onde rodar (`resolveEngine`): se a extensão estiver instalada e responder, usa ela; senão, carrega o WebLLM (import dinâmico, ~6 MB) e roda local. O bundle inicial do site fica em ~75 KB gzip.

## Começando

Requisitos: Node 20+, pnpm 10, Chrome ou Edge recente com WebGPU.

```bash
pnpm install
pnpm dev:web        # http://localhost:5173
pnpm dev:ext        # abre um Chrome com a extensão carregada
pnpm dev:ext:edge   # idem no Edge
```

Para o site usar o modelo da extensão:

1. Rode a extensão e copie o ID dela em `chrome://extensions` (ou `edge://extensions`).
2. Crie `apps/web/.env.local` com `VITE_EXTENSION_ID=<id>`.
3. Confira se a origem do site está em `apps/extension/allowed-origins.ts`.

Abra o site com `?local` para forçar o modo local mesmo com a extensão instalada.

> O ID de uma extensão carregada sem empacotar muda conforme a pasta. Para fixá-lo em dev, gere uma chave e coloque em `manifest.key` no `wxt.config.ts`.

## Build e publicação

```bash
pnpm build       # site em apps/web/dist, extensão em apps/extension/.output/{chrome-mv3,edge-mv3}
pnpm zip:ext     # zips prontos para Chrome Web Store e Edge Add-ons
pnpm typecheck
```

Antes de publicar, troque `https://localchat.example.com` em `allowed-origins.ts` pelo domínio real.

## Modelos

O catálogo fica em `packages/core/src/models.ts`. Para cada família, a variante `q4f16_1` é usada quando a GPU suporta `shader-f16`, e `q4f32_1` caso contrário. O padrão sugerido é o maior modelo de **licença permissiva** que cabe na máquina.

| Modelo | Licença | VRAM (f16) |
|---|---|---|
| Qwen 3.5 0.8B | Apache-2.0 | ~1.6 GB |
| Qwen 3 1.7B | Apache-2.0 | ~2.0 GB |
| Qwen 3.5 2B | Apache-2.0 | ~2.2 GB |
| Qwen 3 4B | Apache-2.0 | ~3.4 GB |
| Phi 3.5 mini | MIT | ~3.7 GB |
| Llama 3.2 1B / 3B | Llama 3.2 Community | ~0.9 / 2.3 GB |
| Gemma 2 2B | Gemma Terms | ~1.9 GB |

Os pesos são baixados do Hugging Face pelo navegador do usuário; o projeto não redistribui nenhum modelo. Llama e Gemma têm termos próprios — a UI avisa.

Ao atualizar o `@mlc-ai/web-llm`, rode `pnpm --filter @localchat/core check:models` para conferir se os IDs e números de VRAM continuam batendo.

## Segurança

- O site só conecta à extensão se a origem estiver em `externally_connectable`, e o background confere a origem de novo.
- Qualquer site da lista pode usar o modelo local do usuário; mantenha a lista curta.
- O histórico fica no IndexedDB de cada origem (site e extensão têm históricos separados).

## Próximos passos sugeridos

- Contexto da página aberta no side panel (`activeTab` + `scripting`).
- Renderização de Markdown nas respostas.
- Fallback em CPU/WASM (ex.: wllama) para máquinas sem WebGPU.
- Testes do protocolo (`packages/core/src/bridge`) com portas falsas.

## Licença

MIT
