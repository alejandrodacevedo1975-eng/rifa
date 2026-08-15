const SUPABASE_URL = "https://egzyiruqivlvqjfhgrba.supabase.co";
const SUPABASE_KEY = "sb_publishable_t34FtTx_shKUXA_vAIPV8w_L5FLhw9V";

const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const grid = document.getElementById("grid");
const modal = document.getElementById("modal");

const tituloNumero = document.getElementById("tituloNumero");
const estadoActual = document.getElementById("estadoActual");
const nombreComprador = document.getElementById("nombreComprador");

const btnLibre = document.getElementById("btnLibre");
const btnApartado = document.getElementById("btnApartado");
const btnPagado = document.getElementById("btnPagado");
const btnCerrar = document.getElementById("btnCerrar");
const btnCerrarX = document.getElementById("btnCerrarX");
const btnNuevaDinamica = document.getElementById("btnNuevaDinamica");

let numeroActual = null;
let datos = [];

function normalizarEstado(estado) {
  if (estado === "ocupado" || estado === "pagado") return "pagado";
  if (estado === "apartado") return "apartado";
  return "libre";
}

function textoEstado(estado) {
  if (estado === "pagado") return "PAGADO";
  if (estado === "apartado") return "APARTADO";
  return "LIBRE";
}

function pintar() {

  grid.innerHTML = "";

  let libres = 0;
  let apartados = 0;
  let pagados = 0;

  // Siempre exactamente 00 hasta 99
  for (let numero = 0; numero <= 99; numero++) {

    const fila = datos.find(r => Number(r.numero) === numero);

    const estado = normalizarEstado(
      fila ? fila.estado : "libre"
    );

    const div = document.createElement("div");

    div.className = "numero " + estado;

    div.textContent = String(numero).padStart(2, "0");

    if (estado === "libre") libres++;
    if (estado === "apartado") apartados++;
    if (estado === "pagado") pagados++;

    div.onclick = () => abrirNumero(numero, fila, estado);

    grid.appendChild(div);
  }

  document.getElementById("libres").textContent = libres;
  document.getElementById("apartados").textContent = apartados;
  document.getElementById("pagados").textContent = pagados;

  document.getElementById("contador").textContent =
    pagados + " / 100";

  const porcentaje = pagados;

  document.getElementById("barraProgreso").style.width =
    porcentaje + "%";

  const mensaje = document.getElementById("mensajeProgreso");

  if (pagados === 100) {
    mensaje.textContent =
      "🎉 CARTÓN COMPLETO. YA SE PUEDE REALIZAR LA DINÁMICA.";
  } else {
    mensaje.textContent =
      "La dinámica se realizará únicamente cuando estén pagados los 100 números.";
  }
}

function abrirNumero(numero, fila, estado) {

  numeroActual = numero;

  tituloNumero.textContent =
    "Número " + String(numero).padStart(2, "0");

  estadoActual.textContent =
    textoEstado(estado);

  nombreComprador.textContent =
    fila && fila.comprador
      ? fila.comprador
      : "Sin registrar";

  modal.style.display = "flex";
}

async function cargar() {

  const { data, error } = await sb
    .from("numeros_rifa")
    .select("id, numero, estado, comprador")
    .order("numero", { ascending: true });

  if (error) {
    console.error("Error Supabase:", error);
    return;
  }

  datos = data || [];

  pintar();
}

async function cambiarEstado(nuevoEstado) {

  if (numeroActual === null) return;

  let comprador = null;

  if (nuevoEstado === "apartado" ||
      nuevoEstado === "pagado") {

    const actual = datos.find(
      r => Number(r.numero) === numeroActual
    );

    comprador = actual && actual.comprador
      ? actual.comprador
      : prompt(
          "Nombre del comprador para el número " +
          String(numeroActual).padStart(2, "0") + ":"
        );

    if (!comprador || comprador.trim() === "") {
      alert("Debes indicar el nombre del comprador.");
      return;
    }

    comprador = comprador.trim();
  }

  const cambios = {
    estado: nuevoEstado,
    comprador: comprador
  };

  const { error } = await sb
    .from("numeros_rifa")
    .update(cambios)
    .eq("numero", numeroActual);

  if (error) {
    alert("Error: " + error.message);
    console.error(error);
    return;
  }

  await cargar();

  const fila = datos.find(
    r => Number(r.numero) === numeroActual
  );

  abrirNumero(
    numeroActual,
    fila,
    normalizarEstado(nuevoEstado)
  );
}

btnLibre.onclick = () => cambiarEstado("libre");

btnApartado.onclick = () => cambiarEstado("apartado");

btnPagado.onclick = () => cambiarEstado("pagado");

function cerrarModal() {
  modal.style.display = "none";
  numeroActual = null;
}

btnCerrar.onclick = cerrarModal;
btnCerrarX.onclick = cerrarModal;

window.onclick = (e) => {
  if (e.target === modal) {
    cerrarModal();
  }
};

btnNuevaDinamica.onclick = async () => {

  const confirmar = confirm(
    "⚠️ ATENCIÓN\n\n" +
    "Esto pondrá TODOS los números 00–99 como LIBRES " +
    "y eliminará los compradores registrados.\n\n" +
    "¿Seguro que quieres iniciar una nueva dinámica?"
  );

  if (!confirmar) return;

  btnNuevaDinamica.disabled = true;

  const { error } = await sb
    .from("numeros_rifa")
    .update({
      estado: "libre",
      comprador: null
    })
    .gte("numero", 0)
    .lte("numero", 99);

  btnNuevaDinamica.disabled = false;

  if (error) {
    alert("Error: " + error.message);
    return;
  }

  alert("✅ Nueva dinámica iniciada. Los 100 números están libres.");

  cerrarModal();

  await cargar();
};

// Actualización en tiempo real
sb.channel("rifa_tiempo_real")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "numeros_rifa"
    },
    () => {
      cargar();
    }
  )
  .subscribe();

cargar();

// Respaldo: revisar cada 60 segundos
setInterval(cargar, 60000);
