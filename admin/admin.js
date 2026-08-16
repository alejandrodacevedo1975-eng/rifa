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
   GENERAR CARTÓN COMPLETO PARA WHATSAPP
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

    /* =========================
       CANVAS
       ========================= */

    const canvas = document.createElement("canvas");

    canvas.width = 1080;
    canvas.height = 1380;

    const ctx = canvas.getContext("2d");

    /* Fondo */
    ctx.fillStyle = "#080808";
    ctx.fillRect(0, 0, 1080, 1380);

    /* Borde */
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, 1056, 1356);

    ctx.textAlign = "center";

    /* =========================
       ENCABEZADO
       ========================= */

    ctx.fillStyle = "#f5c542";
    ctx.font = "900 52px Arial";
    ctx.fillText("DINÁMICA MILLONARIA", 540, 65);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px Arial";
    ctx.fillText("Rif@s Duarte", 540, 105);

    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(90, 130);
    ctx.lineTo(990, 130);
    ctx.stroke();

    /* Valor */
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(120, 150, 840, 58);

    ctx.fillStyle = "#111111";
    ctx.font = "900 30px Arial";
    ctx.fillText("VALOR DEL NÚMERO: $3.000", 540, 188);

    /* Aviso */
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 23px Arial";
    ctx.fillText(
      "SE JUEGA ÚNICAMENTE AL COMPLETAR EL CARTÓN",
      540, 245
    );

    ctx.fillStyle = "#aaaaaa";
    ctx.font = "20px Arial";
    ctx.fillText(
      "Los 100 números deben estar vendidos y pagados.",
      540, 275
    );

    /* =========================
       PREMIOS
       ========================= */

    ctx.fillStyle = "#f5c542";
    ctx.font = "900 27px Arial";
    ctx.fillText("🏆 PREMIOS", 540, 320);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 21px Arial";

    ctx.fillText(
      "🥇 2 ÚLTIMOS NÚMEROS: $130.000",
      540, 355
    );

    ctx.fillText(
      "🥈 2 PRIMEROS NÚMEROS: $35.000",
      540, 387
    );

    ctx.fillText(
      "🥉 2 NÚMEROS DEL MEDIO: $35.000",
      540, 419
    );

    /* Estado */
    ctx.fillStyle = "#f5c542";
    ctx.font = "bold 23px Arial";
    ctx.fillText(
      `PAGADOS: ${pagados}/100   |   APARTADOS: ${apartados}`,
      540, 455
    );

    /* =========================
       CARTÓN 00-99
       ========================= */

    const startX = 30;
    const startY = 480;

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
        ctx.fillStyle = "#e62b35";
      } else {
        ctx.fillStyle = "#ffffff";
      }

      ctx.fillRect(x, y, cellW, cellH);

      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cellW, cellH);

      ctx.fillStyle =
        estado === "libre" ? "#111111" : "#ffffff";

      ctx.font = "900 25px Arial";

      ctx.fillText(
        String(n).padStart(2, "0"),
        x + cellW / 2,
        y + 36
      );
    }

    /* =========================
       PUBLICIDAD INFERIOR
       ========================= */

    const abajo = 1045;

    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(60, abajo);
    ctx.lineTo(1020, abajo);
    ctx.stroke();

    ctx.fillStyle = "#f5c542";
    ctx.font = "900 28px Arial";
    ctx.fillText("💰 DINÁMICA MILLONARIA", 540, abajo + 42);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText(
      "💳 FORMAS DE PAGO",
      540, abajo + 78
    );

    ctx.fillStyle = "#20c55a";
    ctx.font = "bold 22px Arial";
    ctx.fillText(
      "💚 Nequi: 3214019528",
      540, abajo + 112
    );

    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      "💳 Daviplata: 3150835390",
      540, abajo + 146
    );

    ctx.fillStyle = "#f5c542";
    ctx.font = "bold 21px Arial";
    ctx.fillText(
      "📲 Consulte y elija su número directamente en el grupo.",
      540, abajo + 188
    );

    ctx.fillStyle = "#aaaaaa";
    ctx.font = "18px Arial";
    ctx.fillText(
      "Rif@s Duarte • Mucha suerte 🍀",
      540, abajo + 218
    );

    /* =========================
       DESCARGAR IMAGEN
       ========================= */

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
        .slice(0,19)
        .replace(/:/g,"-");

      enlace.download =
        `carton-rifas-duarte-${fecha}.png`;

      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 2000);

      alert(
        "✅ CARTÓN COMPLETO GENERADO\n\n" +
        "La imagen incluye publicidad, premios y los 100 números.\n\n" +
        "Ya puede compartirla directamente en WhatsApp."
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
