import {
  CLIENT_PORT,
  HOST_PORT,
  isClientRequest,
  type ClientGone,
  type ClientRequest,
  type Envelope,
  type HostEvent,
} from "@localchat/core/protocol";
import { ALLOWED_ORIGINS } from "../allowed-origins";

type Port = chrome.runtime.Port;

/**
 * Background (service worker): só faz o roteamento.
 * O modelo vive no offscreen document, que tem WebGPU e não morre com o service worker.
 *
 *   side panel ─┐
 *   site web ───┼─► background ─► offscreen (worker WebLLM)
 *   outra aba ──┘
 */
export default defineBackground(() => {
  const clients = new Map<string, Port>();
  let host: Port | null = null;
  let waiters: ((p: Port) => void)[] = [];
  let creating: Promise<void> | null = null;

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);

  async function ensureOffscreen() {
    const url = chrome.runtime.getURL("/offscreen.html");
    const existing = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [url],
    });
    if (existing.length) return;
    creating ??= chrome.offscreen
      .createDocument({
        url,
        reasons: [chrome.offscreen.Reason.WORKERS],
        justification: "Executa o modelo de linguagem local (WebGPU) num Web Worker.",
      })
      .finally(() => (creating = null));
    await creating;
  }

  async function getHost(): Promise<Port> {
    if (host) return host;
    const ready = new Promise<Port>((resolve) => waiters.push(resolve));
    await ensureOffscreen();
    return ready;
  }

  function attachHost(port: Port) {
    host = port;
    waiters.forEach((w) => w(port));
    waiters = [];
    port.onMessage.addListener((env: Envelope<HostEvent> | { type: "keepalive" }) => {
      if ("clientId" in env) clients.get(env.clientId)?.postMessage(env.msg);
    });
    port.onDisconnect.addListener(() => {
      if (host === port) host = null;
    });
  }

  function attachClient(port: Port) {
    const clientId = crypto.randomUUID();
    clients.set(clientId, port);
    port.onMessage.addListener(async (msg: unknown) => {
      if (!isClientRequest(msg)) return;
      const h = await getHost();
      h.postMessage({ clientId, msg } satisfies Envelope<ClientRequest>);
    });
    port.onDisconnect.addListener(() => {
      clients.delete(clientId);
      host?.postMessage({ clientId, msg: { type: "client-gone" } } satisfies Envelope<ClientGone>);
    });
  }

  // Conexões de dentro da extensão (side panel e o próprio offscreen).
  chrome.runtime.onConnect.addListener((port) => {
    if (port.sender?.id !== chrome.runtime.id) return port.disconnect();
    if (port.name === HOST_PORT) attachHost(port);
    else if (port.name === CLIENT_PORT) attachClient(port);
  });

  // Conexões do app web. O manifest já filtra por externally_connectable;
  // conferimos a origem de novo por defesa em profundidade.
  chrome.runtime.onConnectExternal.addListener((port) => {
    const origin = port.sender?.origin ?? "";
    if (port.name !== CLIENT_PORT || !ALLOWED_ORIGINS.includes(origin)) return port.disconnect();
    attachClient(port);
  });
});
