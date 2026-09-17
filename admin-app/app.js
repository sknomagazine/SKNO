const $ = id => document.getElementById(id);
const views = [$("homeView"), $("editorView"), $("manageView")];
const typeLabels = { texto: "TEXTO", qc: "QC", arte: "ARTE VISUAL", musica: "ÁUDIO" };
const publicLinks = { texto: "post/texto.html", qc: "post/qc.html", arte: "post/arte.html", musica: "post/album.html" };
let publications = [], currentExisting = {}, artFiles = [], deleteTarget = null, titleTouchedSlug = false;

function show(view) { views.forEach(item => item.hidden = item !== view); window.scrollTo(0, 0); }
function slugify(value) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100); }
function message(text, kind = "error") { const box = $("formMessage"); box.textContent = text; box.className = `notice ${kind}`; box.hidden = false; }
function setBusy(busy) { $("publicationForm").querySelectorAll("button,input,textarea").forEach(el => el.disabled = busy); }
async function api(path, options = {}) { const response = await fetch(path, { ...options, headers: { ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }), ...options.headers } }); let body = {}; try { body = await response.json(); } catch {} if (!response.ok) throw Object.assign(new Error(body.error || "Não foi possível concluir a operação."), { code: body.code, status: response.status }); return body; }

async function loadStatus() {
  try { const data = await api("/api/status"); $("githubStatus").textContent = `${data.github} (${data.repository})`; }
  catch (error) { $("githubStatus").textContent = "não conectado"; $("configWarning").textContent = error.message; $("configWarning").hidden = false; }
}

function resetEditor(type, publication = null) {
  $("publicationForm").reset(); $("formMessage").hidden = true; $("type").value = type; $("originalId").value = publication?.id || ""; currentExisting = publication ? structuredClone(publication) : {}; artFiles = []; titleTouchedSlug = Boolean(publication);
  $("editorTitle").textContent = `${publication ? "EDITAR" : "NOVA"} ${typeLabels[type]}`;
  document.querySelectorAll(".kind-fields").forEach(el => el.hidden = true);
  ({ texto: "textFields", qc: "qcFields", arte: "artFields", musica: "musicFields" })[type] && ($( ({ texto: "textFields", qc: "qcFields", arte: "artFields", musica: "musicFields" })[type]).hidden = false);
  $("author").required = ["texto", "arte"].includes(type); $("tracks").replaceChildren(); renderArtFiles();
  if (publication) {
    $("title").value = publication.titulo || ""; $("author").value = publication.autor || ""; $("date").value = publication.data || ""; $("description").value = publication.descricao || ""; $("slug").value = publication.id || "";
    $("content").value = (publication.conteudo || []).join("\n\n"); $("presentation").value = publication.texto || ""; $("pdfUrl").value = publication.pdf || ""; $("videoUrl").value = publication.video || "";
    if (type === "arte") { artFiles = (publication.imagens || []).map(path => ({ path, name: path.split("/").pop() })); renderArtFiles(); }
    if (type === "musica") (publication.faixas || []).forEach(track => addTrack(track));
  } else { $("date").value = new Date().toISOString().slice(0, 10); if (type === "musica") addTrack(); }
  show($("editorView"));
}

function button(text, action, className = "") { const el = document.createElement("button"); el.type = "button"; el.textContent = text; el.className = className; el.addEventListener("click", action); return el; }
function addTrack(track = {}) {
  const row = document.createElement("div"); row.className = "track"; if (track.arquivo) row.dataset.path = track.arquivo;
  const title = document.createElement("input"); title.placeholder = "Título da faixa"; title.className = "track-title"; title.value = track.titulo || ""; title.setAttribute("aria-label", "Título da faixa");
  const url = document.createElement("input"); url.type = "url"; url.placeholder = "URL externa (opcional)"; url.className = "track-url"; if (track.arquivo?.startsWith("http")) url.value = track.arquivo; url.setAttribute("aria-label", "URL da faixa");
  const file = document.createElement("input"); file.type = "file"; file.className = "track-file"; file.accept = "audio/mpeg,audio/ogg,audio/opus,audio/wav,.mp3,.ogg,.opus,.wav"; file.setAttribute("aria-label", "Arquivo da faixa, máximo 20 MiB");
  const controls = document.createElement("div"); controls.className = "track-controls"; controls.append(button("↑", () => row.previousElementSibling && row.parentElement.insertBefore(row, row.previousElementSibling)), button("↓", () => row.nextElementSibling && row.parentElement.insertBefore(row.nextElementSibling, row)), button("REMOVER", () => row.remove()));
  row.append(title, url, file, controls); $("tracks").append(row);
}
function renderArtFiles() {
  const list = $("artList"); list.replaceChildren(); artFiles.forEach((entry, index) => { const row = document.createElement("div"); row.className = "file-item"; const name = document.createElement("span"); name.textContent = entry.name; const controls = document.createElement("span"); controls.append(button("↑", () => { if (index) [artFiles[index - 1], artFiles[index]] = [artFiles[index], artFiles[index - 1]]; renderArtFiles(); }), button("↓", () => { if (index < artFiles.length - 1) [artFiles[index + 1], artFiles[index]] = [artFiles[index], artFiles[index + 1]]; renderArtFiles(); }), button("REMOVER", () => { artFiles.splice(index, 1); renderArtFiles(); })); row.append(name, controls); list.append(row); });
}

function collect() {
  const type = $("type").value; const item = { id: $("slug").value.trim(), titulo: $("title").value.trim(), autor: $("author").value.trim(), data: $("date").value, descricao: $("description").value.trim() };
  if (type === "texto") item.conteudo = $("content").value.split(/\n\s*\n/).map(v => v.trim()).filter(Boolean);
  if (type === "qc") item.pdf = $("pdfUrl").value.trim() || currentExisting.pdf || "";
  if (type === "arte") { item.texto = $("presentation").value.trim(); item.imagens = artFiles.filter(v => v.path).map(v => v.path); }
  if (type === "musica") { item.capa = currentExisting.capa || ""; item.faixas = [...$("tracks").children].map(row => ({ titulo: row.querySelector(".track-title").value.trim(), arquivo: row.querySelector(".track-url").value.trim() || row.dataset.path || "" })); }
  return item;
}
function validateClient(item, type) {
  if (!item.titulo || !item.descricao || !item.data || !item.id) throw new Error("Preencha todos os campos obrigatórios.");
  if (item.id !== slugify(item.id)) throw new Error("O slug deve conter apenas letras minúsculas, números e hífens.");
  if (["texto", "arte"].includes(type) && !item.autor) throw new Error("Informe o autor.");
  if (type === "texto" && !item.conteudo.length) throw new Error("Informe o conteúdo.");
}
async function upload(file, type, slug, kind) { const form = new FormData(); form.set("file", file); form.set("type", type); form.set("slug", slug); form.set("kind", kind); return api("/api/media", { method: "POST", body: form }); }

async function uploadPending(item, type) {
  const uploaded = [];
  try {
    if (type === "qc" && $("pdfFile").files[0]) { const result = await upload($("pdfFile").files[0], type, item.id, "pdf"); item.pdf = result.path; uploaded.push(result.path); }
    if (type === "arte") for (const entry of artFiles) { if (entry.file) { const result = await upload(entry.file, type, item.id, "image"); entry.path = result.path; uploaded.push(result.path); } } item.imagens = artFiles.map(v => v.path);
    if (type === "musica") { if ($("coverFile").files[0]) { const result = await upload($("coverFile").files[0], type, item.id, "image"); item.capa = result.path; uploaded.push(result.path); } const rows = [...$("tracks").children]; for (let i = 0; i < rows.length; i++) { const file = rows[i].querySelector(".track-file").files[0]; if (file) { const result = await upload(file, type, item.id, "audio"); item.faixas[i].arquivo = result.path; uploaded.push(result.path); } } }
  } catch (error) { if (uploaded.length) error.message += ` Arquivos já enviados, mas ainda não publicados: ${uploaded.join(", ")}.`; throw error; }
}

function preview(item, type) {
  const root = $("previewContent"); root.replaceChildren(); const title = document.createElement("h1"); title.textContent = item.titulo || "Sem título"; const meta = document.createElement("p"); meta.textContent = [item.autor, item.data].filter(Boolean).join(" · "); const desc = document.createElement("p"); desc.textContent = item.descricao || ""; root.append(title, meta, desc);
  if (type === "texto") item.conteudo.forEach(value => { const p = document.createElement("p"); p.textContent = value; root.append(p); });
  if (type === "arte") { const p = document.createElement("p"); p.textContent = item.texto || ""; root.append(p); artFiles.forEach(entry => { if (entry.file) { const img = document.createElement("img"); img.src = URL.createObjectURL(entry.file); img.alt = entry.name; root.append(img); } }); }
  if (type === "qc") { const p = document.createElement("p"); p.textContent = item.pdf || $("pdfFile").files[0]?.name || "PDF não selecionado"; root.append(p); }
  if (type === "musica") item.faixas.forEach(track => { const p = document.createElement("p"); p.textContent = `Faixa: ${track.titulo}`; root.append(p); });
  $("previewDialog").showModal();
}

async function loadPublications() { const list = $("publicationList"); list.textContent = "Carregando…"; show($("manageView")); try { publications = (await api("/api/publications")).publications; renderPublications(); } catch (error) { list.textContent = error.message; } }
function renderPublications(filter = document.querySelector("[data-filter].active")?.dataset.filter || "all") {
  const list = $("publicationList"); list.replaceChildren(); const selected = publications.filter(p => filter === "all" || p.type === filter);
  if (!selected.length) { list.textContent = "Nenhuma publicação encontrada."; return; }
  selected.forEach(pub => { const row = document.createElement("article"); row.className = "publication-row"; const info = document.createElement("div"); const h = document.createElement("h3"); h.textContent = pub.titulo; const p = document.createElement("p"); p.textContent = `${typeLabels[pub.type]} · ${pub.autor || "Sem autor"} · ${pub.data || "Sem data"} · PUBLICADO`; info.append(h, p); const actions = document.createElement("div"); actions.className = "row-actions"; actions.append(button("VISUALIZAR", () => window.open(`https://skno.pages.dev/${publicLinks[pub.type]}?id=${encodeURIComponent(pub.id)}`, "_blank", "noopener")), button("EDITAR", () => resetEditor(pub.type, pub)), button("EXCLUIR", () => openDelete(pub), "danger")); row.append(info, actions); list.append(row); });
}
function openDelete(pub) { deleteTarget = pub; $("deleteTitle").textContent = pub.titulo; $("deleteConfirm").value = ""; $("deleteFinal").disabled = true; $("deleteDialog").showModal(); }

document.querySelectorAll("[data-new]").forEach(el => el.addEventListener("click", () => resetEditor(el.dataset.new)));
document.querySelectorAll("[data-home]").forEach(el => el.addEventListener("click", () => show($("homeView"))));
document.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", () => $(el.dataset.close).close()));
$("manageButton").addEventListener("click", loadPublications); $("addTrack").addEventListener("click", () => addTrack());
$("title").addEventListener("input", () => { if (!titleTouchedSlug) $("slug").value = slugify($("title").value); }); $("slug").addEventListener("input", () => titleTouchedSlug = true);
$("artFiles").addEventListener("change", event => { artFiles.push(...[...event.target.files].slice(0, 20 - artFiles.length).map(file => ({ file, name: file.name }))); event.target.value = ""; renderArtFiles(); });
$("previewButton").addEventListener("click", () => { try { const type = $("type").value, item = collect(); validateClient(item, type); preview(item, type); } catch (error) { message(error.message); } });
$("draftButton").addEventListener("click", () => { const type = $("type").value; localStorage.setItem(`skno-draft-${type}`, JSON.stringify(collect())); message("Rascunho editorial salvo somente neste navegador.", "success"); });
$("publicationForm").addEventListener("submit", async event => { event.preventDefault(); const type = $("type").value; try { setBusy(true); let item = collect(); validateClient(item, type); await uploadPending(item, type); const result = await api("/api/publications", { method: "POST", body: JSON.stringify({ type, originalId: $("originalId").value, publication: item }) }); localStorage.removeItem(`skno-draft-${type}`); const short = result.commit?.slice(0, 10) || "indisponível"; message(`✓ Publicação enviada ao GitHub. Título: ${item.titulo}. Tipo: ${typeLabels[type]}. Commit: ${short}. Horário: ${new Date(result.updatedAt).toLocaleString("pt-BR")}. Ela pode levar algum tempo para aparecer no site enquanto o Cloudflare conclui o novo deploy.`, "success"); } catch (error) { message(error.message); } finally { setBusy(false); } });
$("filters").addEventListener("click", event => { if (!event.target.dataset.filter) return; document.querySelectorAll("[data-filter]").forEach(el => el.classList.toggle("active", el === event.target)); renderPublications(event.target.dataset.filter); });
$("deleteConfirm").addEventListener("input", () => $("deleteFinal").disabled = $("deleteConfirm").value !== "EXCLUIR");
$("deleteFinal").addEventListener("click", async () => { if (!deleteTarget) return; try { $("deleteFinal").disabled = true; await api("/api/publications", { method: "DELETE", body: JSON.stringify({ type: deleteTarget.type, id: deleteTarget.id, confirm: $("deleteConfirm").value }) }); publications = publications.filter(p => !(p.type === deleteTarget.type && p.id === deleteTarget.id)); $("deleteDialog").close(); renderPublications(); } catch (error) { $("deleteConfirm").value = ""; $("deleteFinal").disabled = true; alert(error.message); } });

loadStatus();
