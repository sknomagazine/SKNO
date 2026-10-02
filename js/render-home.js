async function loadHomePosts() {
  const arquivos = [
    { categoria: "TEXTOS", arquivo: "data/textos.json", base: "post/texto.html" },
    { categoria: "QC", arquivo: "data/qc.json", base: "post/qc.html" },
    { categoria: "ARTES VISUAIS", arquivo: "data/artes.json", base: "post/arte.html" },
    { categoria: "ÁUDIO", arquivo: "data/musicas.json", base: "post/album.html" }
  ];

  const publicacoes = [];
  let falhas = 0;

  for (const item of arquivos) {
    try {
      const response = await fetch(item.arquivo);
      if (!response.ok) throw new Error(`Falha ao carregar: ${response.status}`);
      const dados = await response.json();
      if (!Array.isArray(dados)) throw new Error("Lista de publicações inválida.");

      dados.forEach((pub) => {
        publicacoes.push({
          categoria: item.categoria,
          titulo: pub.titulo || "Sem título",
          descricao: pub.descricao || pub.texto || "Publicação",
          data: pub.data || "",
          link: `${item.base}?id=${encodeURIComponent(pub.id)}`,
          thumbnails: [pub.thumbnail, pub.capa, pub.poster, pub.imagem, ...(Array.isArray(pub.imagens) ? pub.imagens : [])]
            .filter((src) => typeof src === "string" && src.trim()),
          fallback: `assets/thumbnails/${item.arquivo.split("/").pop().replace(".json", ".svg")}`
        });
      });
    } catch (error) {
      falhas++;
      console.error(error);
    }
  }

  publicacoes.sort((a, b) => new Date(b.data || "1970-01-01") - new Date(a.data || "1970-01-01"));

  const container = document.getElementById("latestPosts");
  const searchInput = document.getElementById("homeSearchInput");
  const noResults = document.getElementById("homeNoResults");

  if (!container) return;
  if (falhas) {
    const warning = document.createElement("p");
    warning.setAttribute("role", "status");
    warning.textContent = "Não foi possível carregar todas as publicações. Tente novamente mais tarde.";
    container.before(warning);
  }

  function render(lista) {
    container.replaceChildren();
    if (noResults) noResults.style.display = lista.length || falhas === arquivos.length ? "none" : "block";

    lista.slice(0, 10).forEach((pub) => {
      const card = document.createElement("article");
      card.className = "publication-card";
      card.dataset.search = `${pub.titulo} ${pub.descricao} ${pub.categoria}`.toLowerCase();

      const link = document.createElement("a");
      link.href = pub.link;

      link.setAttribute("aria-label", `${pub.titulo} — ${pub.categoria}`);
      const img = document.createElement("img");
      img.className = "publication-thumb";
      img.alt = "";
      img.loading = container.childElementCount < 2 ? "eager" : "lazy";
      img.decoding = "async";
      img.width = 800;
      img.height = 600;
      const sources = [...new Set(pub.thumbnails), pub.fallback];
      let sourceIndex = 0;
      img.addEventListener("error", () => {
        if (sourceIndex < sources.length - 1) img.src = sources[++sourceIndex];
      });
      img.src = sources[sourceIndex];
      link.appendChild(img);

      const content = document.createElement("div");
      content.className = "publication-content";

      const title = document.createElement("h3");
      title.textContent = pub.titulo;

      const meta = document.createElement("div");
      meta.className = "publication-meta";
      const category = document.createElement("span");
      category.textContent = pub.categoria;
      const date = document.createElement("time");
      if (/^\d{4}-\d{2}-\d{2}$/.test(pub.data)) {
        date.dateTime = pub.data;
        date.textContent = pub.data.slice(0, 4);
      }
      meta.append(category, date);

      content.appendChild(title);
      content.appendChild(meta);
      link.appendChild(content);
      card.appendChild(link);
      container.appendChild(card);
    });
  }

  render(publicacoes);

  if (searchInput) {
    searchInput.form?.addEventListener("submit", (event) => {
      event.preventDefault();
    });

    searchInput.addEventListener("input", () => {
      const term = searchInput.value.trim().toLowerCase();
      const filtered = publicacoes.filter((pub) =>
        `${pub.titulo} ${pub.descricao} ${pub.categoria}`.toLowerCase().includes(term)
      );

      render(filtered);

      if (noResults) {
        noResults.style.display = filtered.length ? "none" : "block";
      }
    });
  }
}

loadHomePosts();
