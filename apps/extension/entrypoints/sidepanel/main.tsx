import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ExtensionChatEngine } from "@localchat/core";
import { Chat } from "@localchat/ui";
import "@localchat/ui/styles.css";

async function getEngine() {
  // Sem ID: conecta ao background da própria extensão (o offscreen sobe sob demanda).
  const engine = await ExtensionChatEngine.connect(undefined, 5000);
  if (!engine) throw new Error("Não foi possível iniciar o engine da extensão.");
  return engine;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Chat compact getEngine={getEngine} systemPrompt="Você é um assistente útil. Responda no idioma do usuário." />
  </StrictMode>,
);
