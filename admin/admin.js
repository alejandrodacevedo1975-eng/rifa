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


/* =========================================================
   GENERADOR DE CARTÓN PARA WHATSAPP
   ========================================================= */

const btnGenerarCarton = document.getElementById("btnGenerarCarton");

btnGenerarCarton.onclick = async () => {
  btnGenerarCarton.disabled = true;
  btnGenerarCarton.textContent = "⏳ GENERANDO...";

  try {
    const { data, error } = await sb
      .from("numeros_rifa")
      .select("numero, estado")
      .order("numero");

    if (error) {
      alert("Error consultando Supabase: " + error.message);
      return;
    }

    const estados = {};

    (data || []).forEach(r => {
      let estado = r.estado;
      if (estado === "ocupado") estado = "pagado";
      estados[Number(r.numero)] = estado;
    });

    const pagados = (data || []).filter(r =>
      r.estado === "pagado" || r.estado === "ocupado"
    ).length;

    const apartados = (data || []).filter(r =>
      r.estado === "apartado"
    ).length;

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1800;

    const ctx = canvas.getContext("2d");

    /* FONDO */
    ctx.fillStyle = "#11191b";
    ctx.fillRect(0, 0, 1080, 1800);

    /* BORDE */
    ctx.strokeStyle = "#d9ae27";
    ctx.lineWidth = 12;
    ctx.strokeRect(14, 14, 1052, 1772);

    ctx.textAlign = "center";

    /* TITULO */
    ctx.fillStyle = "#f5c542";
    ctx.font = "900 58px Arial";
    ctx.fillText("DINÁMICA MILLONARIA", 540, 78);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px Arial";
    ctx.fillText("Rif@s Duarte", 540, 122);

    ctx.strokeStyle = "#d9ae27";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(90, 155);
    ctx.lineTo(990, 155);
    ctx.stroke();

    /* PREMIOS ARRIBA */
    ctx.fillStyle = "#f5c542";
    ctx.font = "900 34px Arial";
    ctx.fillText("🏆 PREMIOS 🏆", 540, 205);

    function premio(x, titulo, valor, detalle) {
      ctx.fillStyle = "#0b0e0f";
      ctx.fillRect(x, 225, 300, 105);

      ctx.strokeStyle = "#d9ae27";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, 225, 300, 105);

      ctx.fillStyle = "#f5c542";
      ctx.font = "bold 20px Arial";
      ctx.fillText(titulo, x + 150, 252);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 30px Arial";
      ctx.fillText(valor, x + 150, 287);

      ctx.fillStyle = "#dddddd";
      ctx.font = "bold 15px Arial";
      ctx.fillText(detalle, x + 150, 313);
    }

    premio(35, "🥇 PRIMER PREMIO", "$130.000", "2 ÚLTIMAS CIFRAS");
    premio(390, "🥈 SEGUNDO PREMIO", "$35.000", "2 PRIMERAS CIFRAS");
    premio(745, "🥉 TERCER PREMIO", "$35.000", "2 NÚMEROS DEL MEDIO");

    /* CARTON 00-99 */
    const startX = 35;
    const startY = 355;
    const cellW = 100;
    const cellH = 55;
    const gap = 3;

    for (let n = 0; n <= 99; n++) {
      const fila = Math.floor(n / 10);
      const columna = n % 10;

      const x = startX + columna * (cellW + gap);
      const y = startY + fila * (cellH + gap);

      let estado = estados[n] || "libre";

      if (estado === "ocupado") estado = "pagado";

      if (estado === "apartado") {
        ctx.fillStyle = "#20c55a";
      } else if (estado === "pagado") {
        ctx.fillStyle = "#ef3038";
      } else {
        ctx.fillStyle = "#ffffff";
      }

      ctx.fillRect(x, y, cellW, cellH);

      ctx.strokeStyle = "#d9ae27";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cellW, cellH);

      ctx.fillStyle =
        estado === "libre" ? "#111111" : "#ffffff";

      ctx.font = "900 28px Arial";

      ctx.fillText(
        String(n).padStart(2, "0"),
        x + cellW / 2,
        y + 37
      );
    }

    /* PUBLICIDAD ABAJO */
    const adY = 930;

    ctx.strokeStyle = "#d9ae27";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(70, adY);
    ctx.lineTo(1010, adY);
    ctx.stroke();

    ctx.fillStyle = "#f5c542";
    ctx.font = "900 42px Arial";
    ctx.fillText("🎉 ¡DINÁMICA ABIERTA! 🎉", 540, adY + 60);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px Arial";
    ctx.fillText("🎟️ Valor por número: $3.000", 540, adY + 108);

    ctx.fillStyle = "#f5c542";
    ctx.font = "bold 25px Arial";

    ctx.fillText(
      "🏆 Primer premio: $130.000 — 2 últimas cifras",
      540, adY + 153
    );

    ctx.fillText(
      "🥈 Segundo premio: $35.000 — 2 primeras cifras",
      540, adY + 193
    );

    ctx.fillText(
      "🥉 Tercer premio: $35.000 — 2 números del medio",
      540, adY + 233
    );

    /* PAGOS */
    ctx.fillStyle = "#0b0e0f";
    ctx.fillRect(75, adY + 260, 930, 145);

    ctx.strokeStyle = "#d9ae27";
    ctx.lineWidth = 3;
    ctx.strokeRect(75, adY + 260, 930, 145);

    ctx.fillStyle = "#f5c542";
    ctx.font = "900 30px Arial";
    ctx.fillText("💳 FORMAS DE PAGO 💳", 540, adY + 302);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 27px Arial";
    ctx.fillText("💚 Nequi: 3214019528", 540, adY + 345);
    ctx.fillText("💳 Daviplata: 3150835390", 540, adY + 383);

    /* INSTRUCCIONES */
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 25px Arial";
    ctx.fillText(
      "📲 Elige tu número disponible y escribe en el grupo cuál quieres.",
      540, adY + 455
    );

    ctx.fillStyle = "#f5c542";
    ctx.font = "bold 23px Arial";
    ctx.fillText(
      "⏳ La dinámica se realizará cuando el cartón esté completamente lleno y pagado.",
      540, adY + 495
    );

    ctx.fillStyle = "#20c55a";
    ctx.font = "bold 25px Arial";
    ctx.fillText(`🟢 Apartados: ${apartados}`, 350, adY + 545);

    ctx.fillStyle = "#ef3038";
    ctx.fillText(`🔴 Pagados: ${pagados}/100`, 730, adY + 545);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 29px Arial";
    ctx.fillText(
      "🍀 ¡MUCHA SUERTE PARA TODOS! 💛",
      540, adY + 610
    );

    /* DESCARGAR */
    canvas.toBlob(blob => {
      if (!blob) {
        alert("No se pudo generar la imagen.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");

      enlace.href = url;

      const fecha = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-");

      enlace.download = `carton-rifas-duarte-${fecha}.png`;

      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();

      setTimeout(() => URL.revokeObjectURL(url), 2000);

      alert(
        "✅ CARTÓN ACTUALIZADO\n\n" +
        "La imagen fue generada con los números actuales.\n\n" +
        "Ya puede enviarla al grupo de WhatsApp."
      );
    }, "image/png");

  } finally {
    btnGenerarCarton.disabled = false;
    btnGenerarCarton.textContent =
      "📸 GENERAR CARTÓN PARA WHATSAPP";
  }
};

// Respaldo: revisar cada 60 segundos
setInterval(cargar, 60000);
