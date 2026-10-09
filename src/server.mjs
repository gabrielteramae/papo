import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTurns } from "./limits.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "public");
const PORT = Number(process.env.PORT || 3000);
const MODEL = "grok-4.5";
const MAX_TOKENS = 700;

const SYSTEM = `Você é o Papo, um assistente de conversa direto e caloroso.
Responda no idioma da pessoa. Se ela não escolher, use português brasileiro.
Seja curto quando a pergunta for simples. Listas só quando organizarem de verdade.
Não invente fatos. Se não souber, diga.
Não comece com "Claro", "Ótima pergunta" ou elogio vazio.`;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function toPlain(upstream, res) {
  res.writeHead(200, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  const decoder = new TextDecoder();
  let buffer = "";
  upstream.on("data", (chunk) => {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const piece = parsed.choices?.[0]?.delta?.content;
        if (piece) res.write(piece);
      } catch {
        /* linha incompleta */
      }
    }
  });
  upstream.on("end", () => res.end());
  upstream.on("error", () => {
    if (!res.writableEnded) res.end();
  });
  res.on("close", () => upstream.destroy());
}

async function chat(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    sendJson(res, 400, { error: "JSON inválido." });
    return;
  }
  const parsed = normalizeTurns(body);
  if (!parsed.ok) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, { error: "O chat não está disponível neste ambiente." });
    return;
  }

  let upstream;
  try {
    upstream = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        max_tokens: MAX_TOKENS,
        temperature: 0.6,
        messages: [{ role: "system", content: SYSTEM }, ...parsed.messages],
      }),
    });
  } catch {
    sendJson(res, 502, { error: "Não consegui falar com o modelo." });
    return;
  }

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status === 429 ? 429 : 502;
    const error =
      upstream.status === 429
        ? "A cota da API estourou. Tenta de novo daqui a pouco."
        : "O modelo não respondeu.";
    sendJson(res, status, { error });
    return;
  }

  const { Readable } = await import("node:stream");
  toPlain(Readable.fromWeb(upstream.body), res);
}

async function staticFile(res, urlPath) {
  const requested = (urlPath === "/" ? "index.html" : urlPath).replace(/^\/+/, "");
  if (!requested || requested.includes("\0") || requested.includes("..")) {
    sendJson(res, 404, { error: "Não achei." });
    return;
  }
  const file = resolve(ROOT, requested);
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    sendJson(res, 404, { error: "Não achei." });
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      "content-type": TYPES[extname(file)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "Não achei." });
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (req.method === "POST" && url.pathname === "/api/chat") {
    chat(req, res).catch(() => {
      if (!res.headersSent) sendJson(res, 500, { error: "Falhou." });
    });
    return;
  }
  if (req.method === "GET") {
    staticFile(res, url.pathname).catch(() => {
      if (!res.headersSent) sendJson(res, 500, { error: "Falhou." });
    });
    return;
  }
  sendJson(res, 405, { error: "Método não permitido." });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`papo em http://127.0.0.1:${PORT}`);
});
