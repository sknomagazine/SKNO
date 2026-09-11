import { json, errorResponse, fail } from "../lib/http.js";
import { matchesMagicBytes, validateUpload } from "../lib/validation.js";
import { putBinary } from "../lib/github.js";

async function post({ request, env }) {
  try {
    const length = Number(request.headers.get("content-length") || 0); if (length > 21 * 1024 * 1024) fail("Arquivo excede o limite permitido.", 413, "FILE_TOO_LARGE");
    let form; try { form = await request.formData(); } catch { fail("Upload inválido."); }
    const file = form.get("file"); if (!(file instanceof File)) fail("Selecione um arquivo.");
    const kind = form.get("kind");
    const path = validateUpload({ type: form.get("type"), slug: form.get("slug"), kind, name: file.name, mime: file.type, size: file.size });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesMagicBytes(kind, file.type, bytes.subarray(0, 16))) fail("O conteúdo do arquivo não corresponde ao tipo informado.", 415, "INVALID_FILE_SIGNATURE");
    const result = await putBinary(env, path, bytes, `SKNO Admin: envia mídia para "${form.get("slug")}"`);
    return json({ ok: true, path, commit: result.commit?.sha });
  } catch (error) { return errorResponse(error); }
}
export function onRequest(context) { return context.request.method === "POST" ? post(context) : json({ error: "Método não permitido.", code: "METHOD_NOT_ALLOWED" }, 405, { allow: "POST" }); }
