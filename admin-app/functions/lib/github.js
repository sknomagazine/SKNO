import { fail } from "./http.js";

const apiVersion = "2026-03-10";
function config(env) {
  const configured = {
    tokenConfigured: Boolean(env.GITHUB_TOKEN),
    ownerConfigured: Boolean(env.GITHUB_OWNER),
    repoConfigured: Boolean(env.GITHUB_REPO),
    branchConfigured: Boolean(env.GITHUB_BRANCH)
  };
  const validName = value => typeof value === "string" && /^[A-Za-z0-9_.-]+$/.test(value) && value !== "." && value !== "..";
  const validBranch = typeof env.GITHUB_BRANCH === "string" && env.GITHUB_BRANCH.trim() === env.GITHUB_BRANCH && !/[\s\x00-\x1f\x7f]/.test(env.GITHUB_BRANCH);
  if (!Object.values(configured).every(Boolean) || !validName(env.GITHUB_OWNER) || !validName(env.GITHUB_REPO) || !validBranch) {
    console.error("GitHub configuration invalid", { code: "CONFIG_ERROR", ...configured });
    fail("Configuração do GitHub incompleta ou inválida.", 503, "CONFIG_ERROR");
  }
  return { token: env.GITHUB_TOKEN, owner: env.GITHUB_OWNER, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH };
}
const encodePath = path => path.split("/").map(encodeURIComponent).join("/");
// Log only fixed endpoint templates: no environment values, query strings or media names.
const endpointLabel = path => path.startsWith("contents/") || path.startsWith("contents?") ? "/repos/{owner}/{repo}/contents/{path}" : path.startsWith("branches/") ? "/repos/{owner}/{repo}/branches/{branch}" : "/repos/{owner}/{repo}";
function githubFailure(path, method, status, code, reason) {
  console.error("GitHub API request failed", { endpoint: endpointLabel(path), method, status, code, reason });
  fail(code === "GITHUB_CONFLICT" ? "O conteúdo mudou no GitHub. Recarregue e tente novamente." : "Não foi possível acessar o GitHub.", code === "GITHUB_CONFLICT" ? 409 : 502, code);
}
async function request(env, path, init = {}, allowMissing = false) {
  const cfg = config(env);
  const method = init.method || "GET";
  const base = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
  let response;
  try {
    response = await fetch(`${base}${path ? `/${path}` : ""}`, { ...init, headers: { accept: "application/vnd.github+json", authorization: `Bearer ${cfg.token}`, "x-github-api-version": apiVersion, "user-agent": "SKNO-Admin", ...(init.body ? { "content-type": "application/json" } : {}) } });
  } catch {
    githubFailure(path, method, null, "GITHUB_NETWORK_ERROR", "fetch_failed");
  }
  if (allowMissing && response.status === 404) return null;
  if (!response.ok) {
    // Inspect only to classify secondary limits. Never log/return the upstream body.
    let message = "";
    if (response.status === 403) {
      try { const body = await response.json(); if (typeof body?.message === "string") message = body.message; } catch {}
    }
    const limited = response.status === 429 || (response.status === 403 && (response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after") || /rate limit|abuse detection/i.test(message)));
    const code = limited ? "GITHUB_RATE_LIMIT" : response.status === 401 ? "GITHUB_AUTH_ERROR" : response.status === 403 ? "GITHUB_PERMISSION_ERROR" : response.status === 404 ? "GITHUB_NOT_FOUND" : response.status === 409 ? "GITHUB_CONFLICT" : "GITHUB_API_ERROR";
    githubFailure(path, method, response.status, code, "http_error");
  }
  try { return await response.json(); } catch (error) {
    githubFailure(path, method, response.status, error instanceof SyntaxError ? "GITHUB_API_ERROR" : "GITHUB_NETWORK_ERROR", error instanceof SyntaxError ? "invalid_json" : "response_read_failed");
  }
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
  const existing = await request(env, `contents/${encodePath(path)}?ref=${encodeURIComponent(cfg.branch)}`, {}, true);
  if (existing) sha = existing.sha;
  return request(env, `contents/${encodePath(path)}`, { method: "PUT", body: JSON.stringify({ message, content: btoa(binary), branch: cfg.branch, ...(sha ? { sha } : {}) }) });
}
export async function repositoryStatus(env) {
  const cfg = config(env);
  const repo = await request(env, "");
  if (!repo || typeof repo.full_name !== "string") githubFailure("", "GET", 200, "GITHUB_API_ERROR", "invalid_repository_response");
  const branchPath = `branches/${encodeURIComponent(cfg.branch)}`;
  const branch = await request(env, branchPath);
  if (!branch || branch.name !== cfg.branch) githubFailure(branchPath, "GET", 200, "GITHUB_API_ERROR", "invalid_branch_response");
  const contentsPath = `contents?ref=${encodeURIComponent(cfg.branch)}`;
  const contents = await request(env, contentsPath);
  if (!Array.isArray(contents)) githubFailure(contentsPath, "GET", 200, "GITHUB_API_ERROR", "invalid_contents_response");
  console.info("GitHub connection verified", { tokenConfigured: true, repositoryAccessible: true, branchAccessible: true, contentsReadable: true });
  return repo;
}
