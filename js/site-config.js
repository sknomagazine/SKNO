async function loadSiteConfig(){

    try{

        const response =
        await fetch(
        "data/site.json"
        );

        const site =
        await response.json();

        const footer =
        document.getElementById(
        "siteFooter"
        );

        if(footer){

       footer.innerHTML =

`
<p>

${site.descricao}

</p>

<p>

Contato:
${site.email}

</p>

<p>

<a href="${site.instagram}">
Instagram
</a>

|

<a href="${site.youtube}">
YouTube
</a>

</p>

<p>

${site.copyright}

</p>
`;
        }

    }

    catch(error){

        console.error(error);

    }

}

loadSiteConfig();