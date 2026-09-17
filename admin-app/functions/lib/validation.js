export const TYPES = {
  texto: { file: "data/textos.json", label: "texto" },
  qc: { file: "data/qc.json", label: "QC" },
  arte: { file: "data/artes.json", label: "arte" },
  musica: { file: "data/musicas.json", label: "áudio" }
};

export const LIMITS = { image: 10 * 1024 * 1024, pdf: 20 * 1024 * 1024, audio: 20 * 1024 * 1024, video: 20 * 1024 * 1024 };
const MIME = {
  image: { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"] },
  pdf: { "application/pdf": ["pdf"] },
  audio: { "audio/mpeg": ["mp3"], "audio/ogg": ["ogg", "opus"], "audio/opus": ["opus"], "audio/wav": ["wav"] },
  video: { "video/mp4": ["mp4"], "video/webm": ["webm"] }
};

export function slugify(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const url = (value) => { const text = clean(value, 2048); if (!text) return ""; try { const parsed = new URL(text); return parsed.protocol === "https:" ? parsed.href : ""; } catch { return ""; } };
const dateValid = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export function validatePublication(type, input) {
  if (!TYPES[type]) throw Object.assign(new Error("Tipo de publicação inválido."), { status: 400, code: "INVALID_TYPE" });
  const item = { id: slugify(input.id), titulo: clean(input.titulo, 160), descricao: clean(input.descricao, 1000), data: clean(input.data, 10) };
  if (!item.id || item.id !== input.id) throw Object.assign(new Error("Slug inválido."), { status: 400, code: "INVALID_SLUG" });
  if (!item.titulo || !item.descricao || !dateValid(item.data)) throw Object.assign(new Error("Preencha título, descrição e uma data válida."), { status: 400, code: "INVALID_FIELDS" });
  if (["texto", "arte", "musica"].includes(type)) item.autor = clean(input.autor, 160);
  if (["texto", "arte"].includes(type) && !item.autor) throw Object.assign(new Error("Informe o autor."), { status: 400, code: "INVALID_AUTHOR" });
  if (type === "texto") { item.conteudo = Array.isArray(input.conteudo) ? input.conteudo.map(v => clean(v, 100000)).filter(Boolean).slice(0, 500) : []; if (!item.conteudo.length) throw Object.assign(new Error("Informe o conteúdo."), { status: 400, code: "INVALID_CONTENT" }); }
  if (type === "qc") { item.pdf = validMediaPath(input.pdf, "qc") || url(input.pdf); if (!item.pdf) throw Object.assign(new Error("Envie um PDF ou informe uma URL válida."), { status: 400, code: "INVALID_MEDIA" }); if (input.autor) item.autor = clean(input.autor, 160); }
  if (type === "arte") { item.texto = clean(input.texto, 100000); item.imagens = Array.isArray(input.imagens) ? input.imagens.map(v => validMediaPath(v, "arte") || url(v)).filter(Boolean).slice(0, 20) : []; if (!item.imagens.length) throw Object.assign(new Error("Adicione pelo menos uma imagem."), { status: 400, code: "INVALID_MEDIA" }); }
  if (type === "musica") { item.capa = validMediaPath(input.capa, "musica") || url(input.capa); item.faixas = Array.isArray(input.faixas) ? input.faixas.slice(0, 30).map(track => ({ titulo: clean(track?.titulo, 160), arquivo: validMediaPath(track?.arquivo, "musica") || url(track?.arquivo) })).filter(t => t.titulo && t.arquivo) : []; if (!item.faixas.length) throw Object.assign(new Error("Adicione ao menos uma faixa com título e arquivo ou URL."), { status: 400, code: "INVALID_MEDIA" }); }
  return item;
}

export function validMediaPath(value, type) {
  if (typeof value !== "string" || value.includes("..") || value.includes("\\") || value.startsWith("/")) return "";
  return value.startsWith(`uploads/${type === "qc" ? "qc" : type === "arte" ? "artes" : "musicas"}/`) ? value : "";
}

export function validateUpload({ type, slug, kind, name, mime, size }) {
  if (!TYPES[type] || !["qc", "arte", "musica"].includes(type)) throw Object.assign(new Error("Tipo inválido."), { status: 400, code: "INVALID_TYPE" });
  if (!slug || slugify(slug) !== slug) throw Object.assign(new Error("Slug inválido."), { status: 400, code: "INVALID_SLUG" });
  if (!MIME[kind] || !MIME[kind][mime]) throw Object.assign(new Error("Tipo de arquivo não permitido."), { status: 415, code: "INVALID_MIME" });
  const ext = String(name || "").toLowerCase().split(".").pop();
  if (!MIME[kind][mime].includes(ext)) throw Object.assign(new Error("A extensão não corresponde ao tipo do arquivo."), { status: 415, code: "MIME_MISMATCH" });
  if (!Number.isFinite(size) || size <= 0 || size > LIMITS[kind]) throw Object.assign(new Error(`Arquivo excede o limite de ${LIMITS[kind] / 1048576} MiB.`), { status: 413, code: "FILE_TOO_LARGE" });
  const base = String(name).replace(/\.[^.]+$/, ""); const safe = slugify(base) || "arquivo";
  const folder = { qc: "qc", arte: "artes", musica: "musicas" }[type];
  return `uploads/${folder}/${slug}/${safe}.${ext}`;
}

export function matchesMagicBytes(kind, mime, bytes) {
  const ascii = (start, length) => String.fromCharCode(...bytes.slice(start, start + length));
  if (kind === "image" && mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (kind === "image" && mime === "image/png") return bytes.length >= 8 && bytes.slice(0, 8).every((v, i) => v === [137, 80, 78, 71, 13, 10, 26, 10][i]);
  if (kind === "image" && mime === "image/webp") return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
  if (kind === "pdf") return ascii(0, 5) === "%PDF-";
  if (kind === "audio" && mime === "audio/wav") return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE";
  if (kind === "audio" && ["audio/ogg", "audio/opus"].includes(mime)) return ascii(0, 4) === "OggS";
  if (kind === "audio" && mime === "audio/mpeg") return ascii(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (kind === "video" && mime === "video/mp4") return ascii(4, 4) === "ftyp";
  if (kind === "video" && mime === "video/webm") return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return false;
}
