async function loadCategory(jsonFile){

    const response =
    await fetch(jsonFile);

    const data =
    await response.json();

    const grid =
    document.getElementById("publicationGrid");

    grid.innerHTML = "";

    data.forEach(item=>{

        grid.innerHTML += `
        
        <div
        class="publication-item"
        data-title="${item.titulo}">
        
           <a href="../post/textos/texto.html?id=${item.id}">
            
                <h3>${item.titulo}</h3>
                
                <p>${item.descricao}</p>
                
            </a>
            
        </div>
        
        `;

    });

}