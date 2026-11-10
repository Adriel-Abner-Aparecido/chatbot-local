/** Remove blocos <think>…</think> que modelos de raciocínio podem emitir. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trimStart();
}
