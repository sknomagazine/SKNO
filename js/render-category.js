async function loadCategory(jsonFile, postPage) {
  try {
    const response = await fetch(jsonFile);
    const data = await response.json();
    const grid = document.getElementById("publicationGrid");

    if (!grid) return;

    grid.innerHTML = "";

    data.forEach((item) => {
      const card = document.createElement("div");
      card.className = "publication-item";
      card.dataset.title = `${item.titulo || ""} ${item.descricao || ""} ${item.texto || ""}`.toLowerCase();

      const link = document.createElement("a");
      link.href = `${postPage}?id=${item.id}`;

      const title = document.createElement("h3");
      title.textContent = item.titulo || "Sem título";

      const description = document.createElement("p");
      description.textContent = item.descricao || item.texto || "Publicação";

      link.appendChild(title);
      link.appendChild(description);
      card.appendChild(link);
      grid.appendChild(card);
    });
  } catch (error) {
    console.error(error);
  }
}
