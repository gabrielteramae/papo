const KEY = "papo.v1";
const EMPTY_TITLE = "Novo papo";

const STARTERS = [
  "Resume o que é um webhook em três linhas.",
  "Me ajuda a nomear um projeto de linha de comando.",
  "Qual a diferença prática entre 404 e timeout?",
  "Reescreve este recado de forma mais clara: a reunião mudou para quinta.",
];

const nav = document.querySelector("#nav");
const list = document.querySelector("#list");
const log = document.querySelector("#log");
const draft = document.querySelector("#draft");
const form = document.querySelector("#composer");
const sendBtn = document.querySelector("#send");

let state = load();
let streaming = false;
let stopFlag = null;

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!parsed || !Array.isArray(parsed.threads)) return { threads: [], activeId: null };
    return {
      threads: parsed.threads.slice(0, 40),
      activeId: parsed.activeId ?? null,
    };
  } catch {
    return { threads: [], activeId: null };
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  render();
}

function uid() {
  return crypto.randomUUID();
}

function active() {
  return state.threads.find((thread) => thread.id === state.activeId) ?? null;
}

function titleFrom(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= 42 ? clean : `${clean.slice(0, 41)}…`;
}

function createThread() {
  const thread = { id: uid(), title: EMPTY_TITLE, updatedAt: Date.now(), messages: [] };
  state.threads = [thread, ...state.threads].slice(0, 40);
  state.activeId = thread.id;
  save();
  return thread.id;
}

function when(ts) {
  const date = new Date(ts);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function renderList() {
  list.replaceChildren();
  if (state.threads.length === 0) {
    const empty = document.createElement("p");
    empty.className = "tiny";
    empty.textContent = "Nenhum papo ainda.";
    list.append(empty);
    return;
  }
  for (const thread of state.threads) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `row${thread.id === state.activeId ? " on" : ""}`;
    const title = document.createElement("span");
    title.textContent = thread.title;
    const time = document.createElement("span");
    time.className = "tiny";
    time.textContent = when(thread.updatedAt);
    button.append(title, time);
    button.addEventListener("click", () => {
      state.activeId = thread.id;
      nav.hidden = true;
      save();
    });
    list.append(button);
  }
}

function renderLog() {
  const thread = active();
  log.replaceChildren();
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  if (!thread || thread.messages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    const heading = document.createElement("h1");
    heading.textContent = "Um papo de cada vez.";
    const note = document.createElement("p");
    note.className = "mute";
    note.textContent = "Direto, em português se você quiser. Nada fica no servidor — só neste navegador.";
    empty.append(heading, note);
    for (const prompt of STARTERS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "starter";
      button.textContent = prompt;
      button.disabled = streaming;
      button.addEventListener("click", () => send(prompt));
      empty.append(button);
    }
    sheet.append(empty);
  } else {
    for (const message of thread.messages) {
      const block = document.createElement("div");
      block.className = message.role === "user" ? "mine" : "theirs";
      block.textContent = message.content;
      sheet.append(block);
    }
  }
  log.append(sheet);
  log.scrollTop = log.scrollHeight;
}

function render() {
  renderList();
  renderLog();
}

async function send(text) {
  const content = (text ?? draft.value).trim();
  if (!content || streaming) return;
  const threadId = active() ? state.activeId : createThread();
  const thread = state.threads.find((item) => item.id === threadId);
  const prior = thread.messages.filter((message) => message.content.trim());
  if (thread.title === EMPTY_TITLE) thread.title = titleFrom(content);
  const assistant = { id: uid(), role: "assistant", content: "" };
  thread.messages.push({ id: uid(), role: "user", content }, assistant);
  thread.updatedAt = Date.now();
  draft.value = "";
  streaming = true;
  sendBtn.textContent = "■";
  sendBtn.setAttribute("aria-label", "Parar");
  save();

  const controller = new AbortController();
  stopFlag = () => controller.abort();
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [...prior, { role: "user", content }].map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }),
      signal: controller.signal,
    });
    const type = response.headers.get("content-type") || "";
    if (!response.ok || type.includes("application/json")) {
      const body = await response.json().catch(() => null);
      assistant.content = body?.error || "Não consegui responder.";
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      assistant.content += decoder.decode(value, { stream: true });
      thread.updatedAt = Date.now();
      save();
    }
    if (!assistant.content.trim()) assistant.content = "Sem resposta.";
  } catch {
    if (!assistant.content.trim()) assistant.content = controller.signal.aborted ? "Parado." : "A conexão caiu.";
  } finally {
    streaming = false;
    stopFlag = null;
    sendBtn.textContent = "↑";
    sendBtn.setAttribute("aria-label", "Enviar");
    save();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (streaming) stopFlag?.();
  else send();
});

draft.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    send();
  }
});

document.querySelector("#fresh").addEventListener("click", () => {
  if (streaming) return;
  const thread = active();
  if (!thread || thread.messages.length > 0) createThread();
  nav.hidden = window.innerWidth < 768;
  draft.focus();
});

document.querySelector("#open").addEventListener("click", () => {
  nav.hidden = false;
});

render();
