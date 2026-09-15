import test from "node:test";
import assert from "node:assert/strict";
import { matchesMagicBytes, slugify, validatePublication, validateUpload } from "../functions/lib/validation.js";

const text = { id: "meu-texto", titulo: "Meu texto", autor: "Autora", data: "2026-09-10", descricao: "Descrição", conteudo: ["Parágrafo"] };
test("gera slug normalizado", () => assert.equal(slugify("Meu Primeiro Têxto!"), "meu-primeiro-texto"));
test("rejeita dia inexistente no calendário", () => assert.throws(() => validatePublication("texto", { ...text, data: "2026-02-30" }), /data válida/));
test("aceita data de ano bissexto", () => assert.equal(validatePublication("texto", { ...text, data: "2024-02-29" }).data, "2024-02-29"));
test("rejeita assinatura PNG incompleta", () => {
  assert.equal(matchesMagicBytes("image", "image/png", new Uint8Array()), false);
  assert.equal(matchesMagicBytes("image", "image/png", new Uint8Array([137, 80])), false);
  assert.equal(matchesMagicBytes("image", "image/png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), true);
});
test("rejeita slug vazio no upload", () => assert.throws(() => validateUpload({ type: "qc", slug: "", kind: "pdf", name: "obra.pdf", mime: "application/pdf", size: 20 }), /Slug/));
test("publica QC e direciona PDF para a nova pasta", () => {
  const pdf = validateUpload({ type: "qc", slug: "charge", kind: "pdf", name: "obra.pdf", mime: "application/pdf", size: 20 });
  assert.equal(pdf, "uploads/qc/charge/obra.pdf");
  assert.equal(validatePublication("qc", { ...text, pdf }).pdf, pdf);
});
test("aceita texto válido", () => assert.equal(validatePublication("texto", text).id, "meu-texto"));
test("rejeita título vazio", () => assert.throws(() => validatePublication("texto", { ...text, titulo: "" }), /Preencha/));
test("rejeita autor vazio", () => assert.throws(() => validatePublication("texto", { ...text, autor: "" }), /autor/));
test("rejeita data inválida", () => assert.throws(() => validatePublication("texto", { ...text, data: "2026-99-90" }), /data válida/));
test("rejeita slug adulterado", () => assert.throws(() => validatePublication("texto", { ...text, id: "../ataque" }), /Slug/));
test("rejeita arquivo grande", () => assert.throws(() => validateUpload({ type: "arte", slug: "obra", kind: "image", name: "a.png", mime: "image/png", size: 11 * 1024 * 1024 }), /limite/));
test("rejeita extensão proibida", () => assert.throws(() => validateUpload({ type: "arte", slug: "obra", kind: "image", name: "a.exe", mime: "application/octet-stream", size: 10 }), /não permitido/));
test("rejeita MIME incompatível", () => assert.throws(() => validateUpload({ type: "arte", slug: "obra", kind: "image", name: "a.jpg", mime: "image/png", size: 10 }), /não corresponde/));
test("normaliza nome de upload e impede traversal", () => assert.equal(validateUpload({ type: "arte", slug: "obra", kind: "image", name: "../Minha Foto.png", mime: "image/png", size: 10 }), "uploads/artes/obra/minha-foto.png"));
test("confere assinatura real do arquivo", () => { assert.equal(matchesMagicBytes("pdf", "application/pdf", new TextEncoder().encode("%PDF-1.7")), true); assert.equal(matchesMagicBytes("pdf", "application/pdf", new TextEncoder().encode("<html>")), false); });
