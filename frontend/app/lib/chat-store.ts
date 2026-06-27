/** Lightweight module-level channel so both navbar and floating ball can open the chat. */
let _openFn: (() => void) | null = null;

export function registerOpenChat(fn: () => void) {
  _openFn = fn;
}

export function openChat() {
  _openFn?.();
}
