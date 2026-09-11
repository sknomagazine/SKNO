async function loadSiteConfig() {
  try {
    const response = await fetch("data/site.json");
    const site = await response.json();
    const footer = document.getElementById("siteFooter");

    if (!footer) return;

    footer.replaceChildren();
    const description = document.createElement("p"); description.textContent = site.descricao || "";
    const contact = document.createElement("p"); contact.append("Contato: ");
    const email = document.createElement("a"); email.textContent = site.email || ""; email.href = `mailto:${encodeURIComponent(site.email || "")}`; contact.appendChild(email);
    const copyright = document.createElement("p"); copyright.textContent = site.copyright || "";
    footer.append(description, contact, copyright);
  } catch (error) {
    console.error(error);
  }
}

loadSiteConfig();
