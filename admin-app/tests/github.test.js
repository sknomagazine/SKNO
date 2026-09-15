import test from "node:test";
import assert from "node:assert/strict";
import { getCollection, putBinary, putText, repositoryStatus } from "../functions/lib/github.js";
import { onRequest as status } from "../functions/api/status.js";
import { onRequest as publications } from "../functions/api/publications.js";
import { onRequest as media } from "../functions/api/media.js";
import { TYPES } from "../functions/lib/validation.js";

const env = { GITHUB_TOKEN: "FAKE_TEST_CREDENTIAL", GITHUB_OWNER: "sknomagazine", GITHUB_REPO: "SKNO", GITHUB_BRANCH: "main" };
const base = "https://api.github.com/repos/sknomagazine/SKNO";
const reply = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const encoded = value => Buffer.from(JSON.stringify(value), "utf8").toString("base64");

function mock(t, handler) {
  const calls = [], logs = [];
  const original = { fetch: globalThis.fetch, error: console.error, info: console.info };
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return handler(url, init, calls.length); };
  console.error = (...args) => logs.push(args);
  console.info = (...args) => logs.push(args);
  t.after(() => { globalThis.fetch = original.fetch; console.error = original.error; console.info = original.info; });
  return { calls, logs };
}

test("status validates repository, configured branch and Contents using only GET", async t => {
  const { calls, logs } = mock(t, (url, init, n) => reply(n === 1 ? { full_name: "sknomagazine/SKNO" } : n === 2 ? { name: "main" } : []));
  const response = await status({ request: new Request("https://admin.example/api/status"), env, data: { access: { email: "admin@example.com" } } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { github: "conectado", repository: "sknomagazine/SKNO", branch: "main", administrator: "admin@example.com" });
  assert.deepEqual(calls.map(c => c.url), [base, `${base}/branches/main`, `${base}/contents?ref=main`]);
  for (const { init } of calls) {
    assert.equal(init.method || "GET", "GET");
    assert.equal(init.body, undefined);
    assert.equal(init.headers.authorization, `Bearer ${env.GITHUB_TOKEN}`);
    assert.equal(init.headers.accept, "application/vnd.github+json");
    assert.equal(init.headers["x-github-api-version"], "2026-03-10");
    assert.equal(init.headers["user-agent"], "SKNO-Admin");
  }
  assert.equal(logs[0][0], "GitHub connection verified");
  assert.doesNotMatch(JSON.stringify(logs), /FAKE_TEST_CREDENTIAL|authorization/i);
});

for (const [httpStatus, headers, message, code] of [
  [401, {}, "Bad credentials", "GITHUB_AUTH_ERROR"],
  [403, {}, "Resource not accessible by personal access token", "GITHUB_PERMISSION_ERROR"],
  [403, { "x-ratelimit-remaining": "0" }, "limit", "GITHUB_RATE_LIMIT"],
  [403, { "retry-after": "60" }, "limit", "GITHUB_RATE_LIMIT"],
  [403, {}, "You have exceeded a secondary rate limit.", "GITHUB_RATE_LIMIT"],
  [404, {}, "Not Found", "GITHUB_NOT_FOUND"],
  [429, {}, "Too Many Requests", "GITHUB_RATE_LIMIT"],
  [500, {}, "Server error", "GITHUB_API_ERROR"],
  [409, {}, "Conflict", "GITHUB_CONFLICT"]
]) test(`HTTP ${httpStatus} maps to ${code} without leaking upstream data`, async t => {
  const { calls, logs } = mock(t, () => reply({ message: `${message} ${env.GITHUB_TOKEN} Cookie=PRIVATE_SESSION`, details: "PRIVATE_BODY" }, httpStatus, headers));
  const response = await status({ request: new Request("https://admin.example/api/status"), env, data: {} });
  assert.equal(response.status, httpStatus === 409 ? 409 : 502);
  const body = await response.json();
  assert.equal(body.code, code);
  assert.equal(calls.length, 1);
  assert.deepEqual(logs[0], ["GitHub API request failed", { endpoint: "/repos/{owner}/{repo}", method: "GET", status: httpStatus, code, reason: "http_error" }]);
  assert.doesNotMatch(JSON.stringify({ body, logs }), /FAKE_TEST_CREDENTIAL|PRIVATE_SESSION|PRIVATE_BODY|Cookie|Authorization/i);
});

test("fetch failure omits raw exception from server logs and browser", async t => {
  const { logs } = mock(t, () => { throw new Error(`${env.GITHUB_TOKEN} Authorization Cookie PRIVATE_SESSION`); });
  const response = await status({ request: new Request("https://admin.example/api/status"), env, data: {} });
  const body = await response.json();
  assert.equal(body.code, "GITHUB_NETWORK_ERROR");
  assert.equal(logs[0][1].status, null);
  assert.doesNotMatch(JSON.stringify({ logs, body }), /FAKE_TEST_CREDENTIAL|Authorization|Cookie|PRIVATE_SESSION/i);
});

test("malformed JSON is classified safely", async t => {
  const { logs } = mock(t, () => new Response("PRIVATE_BODY"));
  await assert.rejects(repositoryStatus(env), { code: "GITHUB_API_ERROR" });
  assert.equal(logs[0][1].reason, "invalid_json");
  assert.doesNotMatch(JSON.stringify(logs), /PRIVATE_BODY/);
});

for (const variable of Object.keys(env)) test(`missing ${variable} fails before fetch and reports only presence`, async t => {
  const { calls, logs } = mock(t, () => { throw new Error("Should not fetch"); });
  const missing = { ...env }; delete missing[variable];
  await assert.rejects(repositoryStatus(missing), { code: "CONFIG_ERROR", status: 503 });
  assert.equal(calls.length, 0);
  assert.equal(logs[0][0], "GitHub configuration invalid");
  assert.deepEqual(Object.keys(logs[0][1]).sort(), ["branchConfigured", "code", "ownerConfigured", "repoConfigured", "tokenConfigured"]);
  assert.doesNotMatch(JSON.stringify(logs), /FAKE_TEST_CREDENTIAL|sknomagazine|SKNO|main/);
});

test("invalid nonsecret configuration does not get encoded into a misleading URL", async t => {
  const { calls } = mock(t, () => reply({}));
  await assert.rejects(repositoryStatus({ ...env, GITHUB_OWNER: "sknomagazine/", GITHUB_BRANCH: "main " }), { code: "CONFIG_ERROR" });
  assert.equal(calls.length, 0);
});

for (const failedStep of [2, 3]) test(`status fails if read check ${failedStep} fails`, async t => {
  const { calls, logs } = mock(t, (url, init, n) => n === failedStep ? reply({}, 404) : reply(n === 1 ? { full_name: "sknomagazine/SKNO" } : { name: "main" }));
  await assert.rejects(repositoryStatus(env), { code: "GITHUB_NOT_FOUND" });
  assert.equal(calls.length, failedStep);
  assert.equal(logs.some(args => args[0] === "GitHub connection verified"), false);
});

test("branch slash and unicode file names are encoded without changing UTF-8 content", async t => {
  const items = [{ titulo: "Quadrinhos e Charges: ação" }];
  const { calls } = mock(t, () => reply({ type: "file", sha: "old", content: encoded(items) }));
  const branchEnv = { ...env, GITHUB_BRANCH: "editorial/revisao" };
  assert.deepEqual((await getCollection(branchEnv, "data/ação.json")).items, items);
  assert.equal(calls[0].url, `${base}/contents/data/a%C3%A7%C3%A3o.json?ref=editorial%2Frevisao`);
  await putText(branchEnv, "data/ação.json", JSON.stringify(items), "old", "Atualiza conteúdo");
  const body = JSON.parse(calls[1].init.body);
  assert.equal(body.branch, "editorial/revisao");
  assert.equal(body.sha, "old");
  assert.deepEqual(JSON.parse(Buffer.from(body.content, "base64").toString("utf8")), items);
  assert.equal(calls[1].init.headers["content-type"], "application/json");
});

for (const exists of [false, true]) test(`media ${exists ? "update" : "creation"} preserves SHA and branch behavior`, async t => {
  const { calls, logs } = mock(t, (url, init, n) => n === 1 ? reply({ sha: "existing" }, exists ? 200 : 404) : reply({ commit: { sha: "new" } }, 201));
  const result = await putBinary(env, "uploads/qc/charge/obra.pdf", new TextEncoder().encode("%PDF-1.7"), "Upload");
  assert.equal(result.commit.sha, "new");
  const body = JSON.parse(calls[1].init.body);
  assert.equal(body.sha, exists ? "existing" : undefined);
  assert.equal(body.branch, "main");
  assert.equal(Buffer.from(body.content, "base64").toString(), "%PDF-1.7");
  assert.equal(logs.length, 0);
});

test("failed media lookup prevents write and hides path/query from logs", async t => {
  const { calls, logs } = mock(t, () => reply({}, 403));
  await assert.rejects(putBinary(env, "uploads/qc/PRIVATE_PATH.pdf", new Uint8Array([1]), "Upload"), { code: "GITHUB_PERMISSION_ERROR" });
  assert.equal(calls.length, 1);
  assert.doesNotMatch(JSON.stringify(logs), /PRIVATE_PATH|ref=|FAKE_TEST_CREDENTIAL/);
});

const sample = { id: "obra", titulo: "Obra ação", autor: "Autora", descricao: "Descrição", data: "2026-09-14" };
const samples = {
  texto: { ...sample, conteudo: ["Parágrafo"] },
  qc: { ...sample, pdf: "uploads/qc/obra/obra.pdf" },
  arte: { ...sample, imagens: ["uploads/artes/obra/obra.png"], texto: "Apresentação" },
  musica: { ...sample, faixas: [{ titulo: "Faixa", arquivo: "uploads/musicas/obra/faixa.mp3" }] },
  filme: { ...sample, video: "uploads/filmes/obra/filme.mp4" }
};
const apiContext = (method, body) => ({ request: new Request("https://admin.example/api/publications", { method, ...(body ? { body: JSON.stringify(body) } : {}) }), env });

for (const [type, sample] of Object.entries(samples)) test(`${type}: create, list, edit and delete with mocked GitHub commits`, async t => {
  let items = [];
  const { calls } = mock(t, (url, init) => {
    if (init.method === "PUT") { items = JSON.parse(Buffer.from(JSON.parse(init.body).content, "base64").toString("utf8")); return reply({ commit: { sha: "commit" } }); }
    const selected = new URL(url).pathname.endsWith(TYPES[type].file);
    return reply({ type: "file", sha: "old", content: encoded(selected ? items : []) });
  });
  assert.equal((await publications(apiContext("POST", { type, publication: sample }))).status, 200);
  assert.equal(items[0].titulo, sample.titulo);
  const list = await (await publications(apiContext("GET"))).json();
  assert.equal(list.publications.length, 1);
  assert.equal(list.publications[0].type, type);
  assert.equal((await publications(apiContext("POST", { type, originalId: sample.id, publication: { ...sample, titulo: "Editada" } }))).status, 200);
  assert.equal(items[0].titulo, "Editada");
  const removed = await (await publications(apiContext("DELETE", { type, id: sample.id, confirm: "EXCLUIR" }))).json();
  assert.equal(removed.retainedMedia, true);
  assert.deepEqual(items, []);
  for (const call of calls.filter(c => c.init.method === "PUT")) {
    assert.equal(call.url, `${base}/contents/${TYPES[type].file}`);
    assert.equal(JSON.parse(call.init.body).sha, "old");
    assert.equal(JSON.parse(call.init.body).branch, "main");
  }
});

test("media API validates PDF and returns mocked commit without real writes", async t => {
  mock(t, (url, init) => init.method === "PUT" ? reply({ commit: { sha: "media-commit" } }) : reply({}, 404));
  const form = new FormData();
  for (const [key, value] of Object.entries({ type: "qc", slug: "obra", kind: "pdf" })) form.set(key, value);
  form.set("file", new File(["%PDF-1.7"], "obra.pdf", { type: "application/pdf" }));
  const response = await media({ request: new Request("https://admin.example/api/media", { method: "POST", body: form }), env });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, path: "uploads/qc/obra/obra.pdf", commit: "media-commit" });
});
