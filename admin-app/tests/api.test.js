import test from "node:test";
import assert from "node:assert/strict";
import { onRequest as publications } from "../functions/api/publications.js";
import { onRequest as middleware } from "../functions/_middleware.js";

const context = (method, body, env = {}) => ({ request: new Request("https://admin.example/api/publications", { method, body: body ? JSON.stringify(body) : undefined, headers: body ? { "content-type": "application/json" } : undefined }), env });
test("método inesperado retorna 405", async () => assert.equal((await publications(context("PATCH"))).status, 405));
test("JSON inválido retorna 400", async () => { const ctx = { request: new Request("https://admin.example/api/publications", { method: "POST", body: "{" }), env: {} }; const response = await publications(ctx); assert.equal(response.status, 400); });
test("token GitHub ausente é detectado", async () => { const response = await publications(context("GET")); assert.equal(response.status, 503); assert.equal((await response.json()).code, "CONFIG_ERROR"); });
test("GitHub indisponível não expõe resposta autenticada", async t => { const original = globalThis.fetch; globalThis.fetch = async () => new Response("secret detail", { status: 500 }); t.after(() => globalThis.fetch = original); const response = await publications(context("GET", null, { GITHUB_TOKEN: "fake", GITHUB_OWNER: "x", GITHUB_REPO: "y", GITHUB_BRANCH: "main" })); assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /secret detail|fake/); });
test("requisição sem JWT é rejeitada", async () => { const response = await middleware({ request: new Request("https://admin.example/"), env: { CLOUDFLARE_ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com", CLOUDFLARE_ACCESS_AUD: "aud", ADMIN_EMAIL: "admin@example.com" }, data: {}, next: () => new Response("ok") }); assert.equal(response.status, 403); });
test("JWT inválido é rejeitado", async () => { const response = await middleware({ request: new Request("https://admin.example/", { headers: { "cf-access-jwt-assertion": "abc.def.ghi" } }), env: { CLOUDFLARE_ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com", CLOUDFLARE_ACCESS_AUD: "aud", ADMIN_EMAIL: "admin@example.com" }, data: {}, next: () => new Response("ok") }); assert.equal(response.status, 403); });
