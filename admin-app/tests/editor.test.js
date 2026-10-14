import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

async function editor() {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const code = await readFile(new URL("../app.js", import.meta.url), "utf8");
  function element() {
    return {
      value: "", hidden: true, children: [], dataset: {}, files: [], listeners: {},
      addEventListener(name, handler) { this.listeners[name] = handler; },
      setAttribute() {}, querySelectorAll() { return []; },
      append(...items) { this.children.push(...items); },
      replaceChildren() { this.children = []; }, reset() {},
    };
  }
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], element()]));
  const requests = [];
  const sandbox = vm.createContext({
    document: { getElementById: id => elements.get(id) || null, querySelectorAll: () => [], createElement: element },
    window: { scrollTo() {} }, structuredClone, FormData, Date,
    localStorage: { removeItem() {} },
    fetch: async (path, options = {}) => {
      if (path === "/api/status") return { ok: true, json: async () => ({ github: "ok", repository: "test" }) };
      const body = JSON.parse(options.body);
      requests.push(body);
      return { ok: true, json: async () => ({ publication: body.publication, commit: "abc123", updatedAt: new Date().toISOString() }) };
    },
  });
  vm.runInContext(code, sandbox);
  return { elements, requests, sandbox };
}

const common = { id: "exemplo", titulo: "Publicação", autor: "Autora", descricao: "Descrição", data: "2026-10-14" };
const fixtures = {
  texto: { ...common, conteudo: ["Primeiro parágrafo", "Segundo parágrafo"] },
  qc: { ...common, pdf: "uploads/qc/edicao01.pdf" },
  arte: { ...common, texto: "Apresentação", imagens: ["uploads/artes/imagem1.jpg", "uploads/artes/imagem2.jpg"] },
  musica: { ...common, capa: "uploads/musicas/capa.jpg", faixas: [{ titulo: "Faixa 01", arquivo: "uploads/musicas/faixa01.mp3" }] },
};

for (const [type, publication] of Object.entries(fixtures)) {
  test(`abre edição de ${type} com os campos reais do formulário e preserva os dados`, async () => {
    const { sandbox, elements } = await editor();
    sandbox.publication = publication;
    vm.runInContext(`resetEditor("${type}", publication)`, sandbox);
    assert.equal(elements.get("editorView").hidden, false);
    assert.equal(elements.get("manageView").hidden, true);
    assert.equal(elements.get("originalId").value, publication.id);
    assert.equal(elements.get("title").value, publication.titulo);
    if (type === "texto") assert.equal(elements.get("content").value, publication.conteudo.join("\n\n"));
    if (type === "qc") assert.equal(elements.get("pdfUrl").value, publication.pdf);
    if (type === "arte") assert.equal(elements.get("artList").children.length, publication.imagens.length);
    if (type === "musica") assert.equal(elements.get("tracks").children.length, publication.faixas.length);
  });
}

test("salva novamente após mudar o slug usando o novo ID original", async () => {
  const { sandbox, elements, requests } = await editor();
  sandbox.publication = { id: "anterior", titulo: "Texto", autor: "Autora", descricao: "Descrição", data: "2026-10-14", conteudo: ["Conteúdo"] };
  vm.runInContext('resetEditor("texto", publication)', sandbox);
  elements.get("slug").value = "novo";
  const submit = elements.get("publicationForm").listeners.submit;
  await submit({ preventDefault() {} });
  assert.equal(elements.get("originalId").value, "novo");
  await submit({ preventDefault() {} });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].originalId, "anterior");
  assert.equal(requests[1].originalId, "novo");
});
