/** Comandos que la paleta (Ctrl+K) y los atajos envían al chat. */
export type ChatCommand =
  | "new-chat" | "export" | "share" | "stop" | "regenerate" | "focus-input" | "toggle-web" | "suggest";

const EVENT = "nexo:command";

export const sendChatCommand = (command: ChatCommand) =>
  window.dispatchEvent(new CustomEvent<ChatCommand>(EVENT, { detail: command }));

export function onChatCommand(handler: (command: ChatCommand) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<ChatCommand>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
