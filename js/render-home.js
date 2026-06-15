async function loadHomePosts() {

    const arquivos = [

        {
            categoria: "TEXTOS",
            arquivo: "data/textos.json"
        },

        {
            categoria: "eZINES",
            arquivo: "data/ezines.json"
        },

        {
            categoria: "ARTES VISUAIS",
            arquivo: "data/artes.json"
        },

        {
            categoria: "MÚSICAS",
            arquivo: "data/musicas.json"
        },

        {
            categoria: "FILMES",
            arquivo: "data/filmes.json"
        }

    ];

    const publicacoes = [];

    for(const item of arquivos){

        try{

            const response =
            await fetch(item.arquivo);

            const dados =
            await response.json();

            dados.forEach(pub=>{

              publicacoes.push({

    categoria:
    item.categoria,

    titulo:
    pub.titulo,

    descricao:
    pub.descricao,

    data:
    pub.data,

    link:
    pub.link,

    thumbnail:
    pub.thumbnail

});

            });

        }catch(error){

            console.error(error);

        }

    }

    publicacoes.sort((a,b)=>{

        return new Date(b.data)
        -
        new Date(a.data);

    });

    const container =
    document.getElementById(
    "latestPosts"
    );

    container.innerHTML = "";

    publicacoes
    .slice(0,10)
    .forEach(pub=>{

        container.innerHTML += `

        <div class="publication-card">

          <a href="${pub.link}">

    <img
    src="${pub.thumbnail || 'assets/no-image.jpg'}"
    class="publication-thumb">

    <div class="publication-content">

        <h3>${pub.titulo}</h3>

        <p>${pub.categoria}</p>

        <small>${pub.data}</small>

    </div>

</a>
        </div>

        `;

    });

}

loadHomePosts();