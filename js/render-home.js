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
          thumbnail: pub.thumbnail || pub.capa || pub.poster || ""
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

      if (pub.thumbnail) {
        const img = document.createElement("img");
        img.className = "publication-thumb";
        img.src = pub.thumbnail;
        img.alt = pub.titulo;
        link.appendChild(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "publication-thumb-placeholder";
        placeholder.textContent = pub.categoria;
        link.appendChild(placeholder);
      }

      const content = document.createElement("div");
      content.className = "publication-content";

      const title = document.createElement("h3");
      title.textContent = pub.titulo;

      const description = document.createElement("p");
      description.textContent = pub.descricao;

      const date = document.createElement("small");
      date.textContent = pub.data;

      content.appendChild(title);
      content.appendChild(description);
      content.appendChild(date);
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
