async function loadSiteConfig() {
  try {
    const response = await fetch("data/site.json");
    const site = await response.json();
    const footer = document.getElementById("siteFooter");

    if (!footer) return;

    footer.innerHTML = `
      <p>${site.descricao}</p>
      <p>Contato: <a href="mailto:${site.email}">${site.email}</a></p>
      <p>${site.copyright}</p>
    `;
  } catch (error) {
    console.error(error);
  }
}

loadSiteConfig();
