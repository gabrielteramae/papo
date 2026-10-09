import assert from "node:assert/strict";
import test from "node:test";
import { MAX_CHARS, MAX_MESSAGES, normalizeTurns } from "../src/limits.mjs";

test("rejeita corpo vazio", () => {
  assert.equal(normalizeTurns(null).ok, false);
  assert.equal(normalizeTurns({}).ok, false);
  assert.equal(normalizeTurns({ messages: [] }).ok, false);
});

test("aceita um turno do usuário e descarta vazio", () => {
  const result = normalizeTurns({
    messages: [
      { role: "user", content: "  oi  " },
      { role: "assistant", content: "   " },
    ],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.messages, [{ role: "user", content: "oi" }]);
});

test("recusa papel desconhecido e texto que não é string", () => {
  assert.match(normalizeTurns({ messages: [{ role: "system", content: "x" }] }).error, /Papel/);
  assert.match(normalizeTurns({ messages: [{ role: "user", content: 1 }] }).error, /inválida/);
});

test("recusa mensagem acima do limite", () => {
  const result = normalizeTurns({
    messages: [{ role: "user", content: "a".repeat(MAX_CHARS + 1) }],
  });
  assert.equal(result.ok, false);
});

test("a última mensagem precisa ser do usuário", () => {
  const result = normalizeTurns({
    messages: [
      { role: "user", content: "oi" },
      { role: "assistant", content: "olá" },
    ],
  });
  assert.equal(result.ok, false);
});

test("corta o histórico antigo e mantém a ordem", () => {
  const messages = [];
  for (let i = 0; i < MAX_MESSAGES + 4; i += 1) {
    messages.push({ role: i % 2 === 0 ? "user" : "assistant", content: `m${i}` });
  }
  messages.push({ role: "user", content: "fim" });
  const result = normalizeTurns({ messages });
  assert.equal(result.ok, true);
  assert.equal(result.messages.length, MAX_MESSAGES);
  assert.equal(result.messages.at(-1).content, "fim");
  assert.equal(result.messages[0].content, "m5");
});
