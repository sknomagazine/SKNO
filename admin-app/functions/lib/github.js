import { fail } from "./http.js";

const apiVersion = "2026-03-10";
function config(env) {
  if (!env.GITHUB_TOKEN) fail("Configuração incompleta: GITHUB_TOKEN não foi configurado.", 503, "MISSING_GITHUB_TOKEN");
  return { token: env.GITHUB_TOKEN, owner: env.GITHUB_OWNER || "sknomagazine", repo: env.GITHUB_REPO || "SKNO", branch: env.GITHUB_BRANCH || "main" };
}
const encodePath = path => path.split("/").map(encodeURIComponent).join("/");
async function request(env, path, init = {}) {
  const cfg = config(env);
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/${path}`, { ...init, headers: { accept: "application/vnd.github+json", authorization: `Bearer ${cfg.token}`, "x-github-api-version": apiVersion, "user-agent": "SKNO-Admin", ...init.headers } });
  if (!response.ok) {
    const code = response.status === 409 ? "GITHUB_CONFLICT" : response.status === 401 ? "GITHUB_TOKEN_INVALID" : response.status === 403 ? "GITHUB_FORBIDDEN" : "GITHUB_ERROR";
    fail(response.status === 409 ? "O conteúdo mudou no GitHub. Recarregue e tente novamente." : "Não foi possível acessar o GitHub.", response.status === 409 ? 409 : 502, code);
  }
  return response.json();
}
const utf8ToBase64 = value => { const bytes = new TextEncoder().encode(value); let binary = ""; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(binary); };
const base64ToUtf8 = value => { const binary = atob(value.replace(/\n/g, "")); const bytes = Uint8Array.from(binary, c => c.charCodeAt(0)); return new TextDecoder().decode(bytes); };

export async function getFile(env, path) {
  const cfg = config(env); const data = await request(env, `contents/${encodePath(path)}?ref=${encodeURIComponent(cfg.branch)}`);
  if (data.type !== "file" || typeof data.content !== "string") fail("Resposta inesperada do GitHub.", 502, "GITHUB_INVALID_RESPONSE");
  return { sha: data.sha, text: base64ToUtf8(data.content) };
}
export async function getCollection(env, path) {
  const file = await getFile(env, path); let items; try { items = JSON.parse(file.text); } catch { fail(`O arquivo ${path} contém JSON inválido.`, 502, "INVALID_REPOSITORY_JSON"); }
  if (!Array.isArray(items)) fail(`O arquivo ${path} não contém uma lista.`, 502, "INVALID_REPOSITORY_JSON"); return { ...file, items };
}
export async function putText(env, path, text, sha, message) { const cfg = config(env); return request(env, `contents/${encodePath(path)}`, { method: "PUT", body: JSON.stringify({ message, content: utf8ToBase64(text), sha, branch: cfg.branch }) }); }
export async function putBinary(env, path, bytes, message) {
  const cfg = config(env); let binary = ""; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  let sha;
  const existing = await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(cfg.branch)}`, { headers: { accept: "application/vnd.github+json", authorization: `Bearer ${cfg.token}`, "x-github-api-version": apiVersion, "user-agent": "SKNO-Admin" } });
  if (existing.ok) sha = (await existing.json()).sha; else if (existing.status !== 404) fail("Não foi possível verificar o arquivo no GitHub.", 502, "GITHUB_ERROR");
  return request(env, `contents/${encodePath(path)}`, { method: "PUT", body: JSON.stringify({ message, content: btoa(binary), branch: cfg.branch, ...(sha ? { sha } : {}) }) });
}
export async function repositoryStatus(env) { const cfg = config(env); return request(env, ""); }
