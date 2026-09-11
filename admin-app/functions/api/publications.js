import { json, errorResponse, readJson, fail } from "../lib/http.js";
import { TYPES, validatePublication } from "../lib/validation.js";
import { getCollection, putText } from "../lib/github.js";

async function get({ env }) {
  try {
    const groups = await Promise.all(Object.entries(TYPES).map(async ([type, cfg]) => ({ type, items: (await getCollection(env, cfg.file)).items })));
    return json({ publications: groups.flatMap(group => group.items.map(item => ({ ...item, type: group.type }))).sort((a, b) => String(b.data).localeCompare(String(a.data))) });
  } catch (error) { return errorResponse(error); }
}

async function post({ request, env }) {
  try {
    const body = await readJson(request); const cfg = TYPES[body.type]; if (!cfg) fail("Tipo inválido.");
    const item = validatePublication(body.type, body.publication || {}); const current = await getCollection(env, cfg.file);
    const originalId = typeof body.originalId === "string" ? body.originalId : ""; const index = originalId ? current.items.findIndex(entry => entry.id === originalId) : -1;
    if (originalId && index < 0) fail("A publicação original não existe mais.", 409, "PUBLICATION_CHANGED");
    if (current.items.some((entry, i) => entry.id === item.id && i !== index)) fail("Já existe uma publicação com este slug.", 409, "DUPLICATE_SLUG");
    if (index >= 0) current.items[index] = item; else current.items.push(item);
    const action = index >= 0 ? "atualiza" : "publica"; const result = await putText(env, cfg.file, `${JSON.stringify(current.items, null, 2)}\n`, current.sha, `SKNO Admin: ${action} ${cfg.label} "${item.titulo}"`);
    return json({ ok: true, publication: item, commit: result.commit?.sha, url: result.commit?.html_url, updatedAt: new Date().toISOString() });
  } catch (error) { return errorResponse(error); }
}

async function remove({ request, env }) {
  try {
    const body = await readJson(request, 10000); const cfg = TYPES[body.type]; if (!cfg || typeof body.id !== "string" || body.confirm !== "EXCLUIR") fail("Confirmação de exclusão inválida.");
    const current = await getCollection(env, cfg.file); const index = current.items.findIndex(entry => entry.id === body.id); if (index < 0) fail("Publicação não encontrada.", 404, "NOT_FOUND");
    const [removed] = current.items.splice(index, 1); const result = await putText(env, cfg.file, `${JSON.stringify(current.items, null, 2)}\n`, current.sha, `SKNO Admin: remove publicação "${removed.titulo}"`);
    return json({ ok: true, commit: result.commit?.sha, retainedMedia: true });
  } catch (error) { return errorResponse(error); }
}

export function onRequest(context) {
  if (context.request.method === "GET") return get(context);
  if (context.request.method === "POST") return post(context);
  if (context.request.method === "DELETE") return remove(context);
  return json({ error: "Método não permitido.", code: "METHOD_NOT_ALLOWED" }, 405, { allow: "GET, POST, DELETE" });
}
