/// <reference lib="webworker" />
// Ponto de entrada do Web Worker: importe este módulo no arquivo de worker do app.
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => handler.onmessage(msg);
