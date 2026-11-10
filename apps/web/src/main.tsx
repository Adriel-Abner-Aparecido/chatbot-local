import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { resolveEngine } from "@localchat/core";
import { Chat } from "@localchat/ui";
import "@localchat/ui/styles.css";

const getEngine = () =>
  resolveEngine({
    extensionId: import.meta.env.VITE_EXTENSION_ID || undefined,
    preferLocal: new URLSearchParams(location.search).has("local"),
    createWorker: () => new Worker(new URL("./llm.worker.ts", import.meta.url), { type: "module" }),
  });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Chat getEngine={getEngine} systemPrompt="Você é um assistente útil. Responda no idioma do usuário." />
  </StrictMode>,
);
