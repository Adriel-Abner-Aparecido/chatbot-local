import { requestPersistentStorage } from "@localchat/core";
import { createEngineHost } from "@localchat/core/host";
import { createLocalEngine } from "@localchat/core/local";
import { HOST_PORT, type ClientGone, type ClientRequest, type Envelope, type HostEvent } from "@localchat/core/protocol";

/**
 * Offscreen document: dono do único engine da extensão.
 * Todos os clientes (side panel, site, várias abas) compartilham o mesmo modelo carregado.
 */
const engine = await createLocalEngine(
  () => new Worker(new URL("./llm.worker.ts", import.meta.url), { type: "module" }),
);
void requestPersistentStorage();

const hosts = new Map<string, ReturnType<typeof createEngineHost>>();
let port: chrome.runtime.Port;

function connect() {
  port = chrome.runtime.connect({ name: HOST_PORT });
  port.onMessage.addListener((env: Envelope<ClientRequest | ClientGone>) => {
    const { clientId, msg } = env;
    if (msg.type === "client-gone") {
      hosts.get(clientId)?.abortAll();
      hosts.delete(clientId);
      return;
    }
    let host = hosts.get(clientId);
    if (!host) hosts.set(clientId, (host = createEngineHost(engine)));
    // Usa sempre a porta atual: o service worker pode reiniciar no meio de uma geração.
    void host.handle(msg, (ev) => port.postMessage({ clientId, msg: ev } satisfies Envelope<HostEvent>));
  });
  // O service worker dorme quando ocioso; reconectar o acorda e reanuncia o host.
  port.onDisconnect.addListener(() => setTimeout(connect, 250));
}

connect();

// Mensagens periódicas mantêm o service worker acordado enquanto o engine existe,
// para as portas dos clientes (side panel, site) não caírem por ociosidade.
setInterval(() => port.postMessage({ type: "keepalive" }), 20_000);
