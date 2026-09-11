import { json } from "./lib/http.js";

let jwksCache = { domain: "", expires: 0, keys: [] };
const normalized = value => { const text = value.replace(/-/g, "+").replace(/_/g, "/"); return text + "=".repeat((4 - text.length % 4) % 4); };
const decode = value => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(normalized(value)), c => c.charCodeAt(0))));
const bytes = value => Uint8Array.from(atob(normalized(value)), c => c.charCodeAt(0));

async function verifyAccess(request, env) {
  const domain = String(env.CLOUDFLARE_ACCESS_TEAM_DOMAIN || "").replace(/\/$/, "");
  const audience = String(env.CLOUDFLARE_ACCESS_AUD || "");
  const adminEmail = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!domain || !audience || !adminEmail) throw new Error("ACCESS_CONFIG");
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) throw new Error("ACCESS_MISSING");
  const parts = token.split("."); if (parts.length !== 3) throw new Error("ACCESS_INVALID");
  let header, payload; try { header = decode(parts[0]); payload = decode(parts[1]); } catch { throw new Error("ACCESS_INVALID"); }
  if (header.alg !== "RS256" || !header.kid) throw new Error("ACCESS_INVALID");
  if (jwksCache.domain !== domain || jwksCache.expires < Date.now()) {
    const response = await fetch(`${domain}/cdn-cgi/access/certs`);
    if (!response.ok) throw new Error("ACCESS_CERTS");
    const body = await response.json(); jwksCache = { domain, expires: Date.now() + 3_600_000, keys: body.keys || [] };
  }
  const jwk = jwksCache.keys.find(key => key.kid === header.kid); if (!jwk) { jwksCache.expires = 0; throw new Error("ACCESS_KEY"); }
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, bytes(parts[2]), signed)) throw new Error("ACCESS_SIGNATURE");
  const now = Math.floor(Date.now() / 1000); const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== domain || !aud.includes(audience) || !payload.exp || payload.exp <= now || (payload.nbf && payload.nbf > now)) throw new Error("ACCESS_CLAIMS");
  if (String(payload.email || "").toLowerCase() !== adminEmail) throw new Error("ACCESS_FORBIDDEN");
  return payload;
}

export async function onRequest(context) {
  try { context.data.access = await verifyAccess(context.request, context.env); }
  catch (error) {
    const config = error.message === "ACCESS_CONFIG";
    return json({ error: config ? "Configuração do Cloudflare Access incompleta." : "Acesso não autorizado.", code: error.message }, config ? 503 : 403);
  }
  const response = await context.next();
  const headers = new Headers(response.headers); headers.set("cache-control", context.request.url.includes("/api/") ? "no-store" : (headers.get("cache-control") || "private, no-store"));
  headers.set("x-content-type-options", "nosniff"); headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
