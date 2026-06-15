function searchPublications(){

const term =
document
.getElementById("searchInput")
.value
.toLowerCase();

const items =
document.querySelectorAll(".publication-item");

let found = false;

items.forEach(item=>{

const title =
item.dataset.title.toLowerCase();

if(title.includes(term)){

item.style.display="block";

found=true;

}else{

item.style.display="none";

}

});

const noResults =
document.getElementById("noResults");

if(noResults){

noResults.style.display =
found ? "none" : "block";

}

}