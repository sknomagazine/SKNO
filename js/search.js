function searchPublications() {
  const input = document.getElementById("searchInput");
  const noResults = document.getElementById("noResults");

  if (!input) return;

  const term = input.value.trim().toLowerCase();
  const items = document.querySelectorAll(".publication-item");
  let found = false;

  items.forEach((item) => {
    const title = (item.dataset.title || "").toLowerCase();
    const matches = title.includes(term);

    item.style.display = matches ? "block" : "none";
    found = found || matches;
  });

  if (noResults) {
    noResults.style.display = found || !term ? "none" : "block";
  }
}
