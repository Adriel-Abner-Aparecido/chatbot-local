/** Remove blocos <think>…</think> que modelos de raciocínio podem emitir. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trimStart();
}

/** true enquanto o modelo está dentro de um bloco <think> ainda não fechado (raciocinando). */
export function isThinking(text: string): boolean {
  const open = text.lastIndexOf("<think>");
  return open !== -1 && text.indexOf("</think>", open) === -1;
}
