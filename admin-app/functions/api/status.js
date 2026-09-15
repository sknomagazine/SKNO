import { json, errorResponse } from "../lib/http.js";
import { repositoryStatus } from "../lib/github.js";
async function get({ env, data }) { try { const repo = await repositoryStatus(env); return json({ github: "conectado", repository: repo.full_name, branch: env.GITHUB_BRANCH, administrator: data.access.email }); } catch (error) { return errorResponse(error); } }
export function onRequest(context) { return context.request.method === "GET" ? get(context) : json({ error: "Método não permitido.", code: "METHOD_NOT_ALLOWED" }, 405, { allow: "GET" }); }
