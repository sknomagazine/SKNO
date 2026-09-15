async function loadCategory(jsonFile, postPage) {
  try {
    const response = await fetch(jsonFile);
    if (!response.ok) throw new Error(`Falha ao carregar: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Lista de publicações inválida.");
    const grid = document.getElementById("publicationGrid");

    if (!grid) return;

    grid.replaceChildren();

    data.forEach((item) => {
      const card = document.createElement("div");
      card.className = "publication-item";
      card.dataset.title = `${item.titulo || ""} ${item.descricao || ""} ${item.texto || ""}`.toLowerCase();

      const link = document.createElement("a");
      link.href = `${postPage}?id=${encodeURIComponent(item.id)}`;

      const title = document.createElement("h3");
      title.textContent = item.titulo || "Sem título";

      const description = document.createElement("p");
      description.textContent = item.descricao || item.texto || "Publicação";

      link.appendChild(title);
      link.appendChild(description);
      card.appendChild(link);
      grid.appendChild(card);
    });
    searchPublications();
  } catch (error) {
    console.error(error);
    const grid = document.getElementById("publicationGrid");
    if (grid) grid.textContent = "Não foi possível carregar as publicações. Tente novamente mais tarde.";
  }
}
