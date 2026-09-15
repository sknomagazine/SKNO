export const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }
});

export function errorResponse(error) {
  const known = error && Number.isInteger(error.status) ? error.status : 500;
  const code = error?.code || "INTERNAL_ERROR";
  if (known >= 500) console.error("SKNO Admin error", code);
  return json({ error: known >= 500 ? "Não foi possível concluir a operação." : error.message, code }, known);
}

export function fail(message, status = 400, code = "INVALID_REQUEST") {
  const error = new Error(message); error.status = status; error.code = code; throw error;
}

export async function readJson(request, maxBytes = 1_000_000) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) fail("A solicitação é grande demais.", 413, "PAYLOAD_TOO_LARGE");
  let value;
  try { value = await request.json(); } catch { fail("JSON inválido.", 400, "INVALID_JSON"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Formato de dados inválido.");
  return value;
}
