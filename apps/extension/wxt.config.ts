import { defineConfig } from "wxt";
import { ALLOWED_ORIGINS } from "./allowed-origins";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "LocalChat",
    description: "Chat com IA 100% local no navegador (WebGPU). Nada sai do seu computador.",
    permissions: ["offscreen", "sidePanel", "storage", "unlimitedStorage"],
    action: { default_title: "Abrir LocalChat" },
    // Permite que o app web use o modelo já baixado pela extensão.
    externally_connectable: { matches: ALLOWED_ORIGINS.map((o) => `${o}/*`) },
    // WebLLM compila o runtime em WebAssembly.
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
  },
  vite: () => ({ worker: { format: "es" }, build: { target: "es2022" } }),
});
