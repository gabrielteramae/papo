export const MAX_MESSAGES = 20;
export const MAX_CHARS = 4000;

export function normalizeTurns(input) {
  if (!input || typeof input !== "object") return { ok: false, error: "Pedido inválido." };
  const raw = input.messages;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "Manda uma mensagem." };

  const turns = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return { ok: false, error: "Pedido inválido." };
    const { role, content } = item;
    if (role !== "user" && role !== "assistant") {
      return { ok: false, error: "Papel de mensagem inválido." };
    }
    if (typeof content !== "string") return { ok: false, error: "Mensagem inválida." };
    const text = content.trim();
    if (!text) continue;
    if (text.length > MAX_CHARS) {
      return { ok: false, error: "Mensagem longa demais. O limite é 4000 caracteres." };
    }
    turns.push({ role, content: text });
  }

  if (turns.length === 0) return { ok: false, error: "Manda uma mensagem." };
  const clipped = turns.slice(-MAX_MESSAGES);
  if (clipped[clipped.length - 1]?.role !== "user") {
    return { ok: false, error: "A última mensagem precisa ser sua." };
  }
  return { ok: true, messages: clipped };
}
