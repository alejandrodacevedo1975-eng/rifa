const SUPABASE_URL="https://egzyiruqivlvqjfhgrba.supabase.co";
const SUPABASE_KEY="sb_publishable_t34FtTx_shKUXA_vAIPV8w_L5FLhw9V";

const sb=window.supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
);

const grid=document.getElementById("grid");

const modal=document.getElementById("modal");

const tituloNumero=document.getElementById("tituloNumero");
const nombreComprador=document.getElementById("nombreComprador");

const btnLibre=document.getElementById("btnLibre");
const btnApartado=document.getElementById("btnApartado");
const btnVendido=document.getElementById("btnVendido");
const btnCerrar=document.getElementById("btnCerrar");

let numeroActual=null;


async function cargar(){

const {data,error}=await sb
.from("numeros_rifa")
.select("*")
.order("numero");

if(error){
console.error(error);
return;
}

grid.innerHTML="";

let libres=0;
let apartados=0;
let vendidos=0;

data.forEach(r=>{

const d=document.createElement("div");

d.className="numero";

if(r.estado==="ocupado"){
d.classList.add("vendido");
vendidos++;
}else if(r.estado==="apartado"){
d.classList.add("apartado");
apartados++;
}else{
d.classList.add("libre");
libres++;
}

d.textContent=String(r.numero).padStart(2,"0");

d.onclick=()=>{

numeroActual=r.numero;

tituloNumero.textContent="Número "+String(r.numero).padStart(2,"0");

nombreComprador.textContent=
r.comprador || "Sin comprador";

modal.style.display="flex";

};

grid.appendChild(d);

});

document.getElementById("libres").textContent=libres;
document.getElementById("apartados").textContent=apartados;
document.getElementById("vendidos").textContent=vendidos;

}


async function cambiarEstado(estado){

if(numeroActual===null)return;

const {error}=await sb
.from("numeros_rifa")
.update({estado})
.eq("numero",numeroActual);

if(error){
alert(error.message);
return;
}

await cargar();

}

btnLibre.onclick=()=>cambiarEstado("libre");

btnApartado.onclick=()=>cambiarEstado("apartado");

btnVendido.onclick=()=>cambiarEstado("ocupado");

btnCerrar.onclick=()=>{

modal.style.display="none";

};

sb.channel("panel")
.on(
"postgres_changes",
{
event:"*",
schema:"public",
table:"numeros_rifa"
},
()=>{

cargar();

}
)
.subscribe();

cargar();

