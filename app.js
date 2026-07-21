const APP_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzVO_X6IxsX18mGx3GoG5Ie3Q2yjc0thf6iAxseEHcVDLdwnjdDJILd-RHsCl6KRKn9_g/exec";

let video;
let estado;
let selectorCamara;

let ZX;
let lector;
let controles;

let bloqueado = false;
let ultimoCodigo = "";

window.addEventListener("load", iniciarAplicacion);

async function iniciarAplicacion() {
  try {
    video = document.getElementById("video");
    estado = document.getElementById("estado");
    selectorCamara = document.getElementById("camaras");

    ZX = window.ZXingBrowser || window.ZXing;

    if (!video || !estado || !selectorCamara || !ZX) {
      throw new Error("No se pudo cargar el lector.");
    }

    lector = new ZX.BrowserQRCodeReader();

    selectorCamara.addEventListener("change", function () {
      iniciarCamara(selectorCamara.value);
    });

    await cargarCamaras();
  } catch (error) {
    console.error(error);
    mostrarMensajeSimple(
      "No se pudo iniciar el lector QR.",
      "error"
    );
  }
}

async function cargarCamaras() {
  try {
    mostrarMensajeSimple(
      "Solicitando permiso de cámara...",
      "neutral"
    );

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });

    stream.getTracks().forEach(function (track) {
      track.stop();
    });

    const dispositivos =
      await ZX.BrowserCodeReader.listVideoInputDevices();

    selectorCamara.innerHTML = "";

    if (!dispositivos.length) {
      mostrarMensajeSimple(
        "No se encontró ninguna cámara.",
        "error"
      );
      return;
    }

    dispositivos.forEach(function (dispositivo, indice) {
      const opcion = document.createElement("option");

      opcion.value = dispositivo.deviceId;
      opcion.textContent =
        dispositivo.label || "Cámara " + (indice + 1);

      selectorCamara.appendChild(opcion);
    });

    const preferida =
      dispositivos.find(function (dispositivo) {
        return /back|rear|environment|trasera|hd camera/i.test(
          dispositivo.label
        );
      }) || dispositivos[0];

    selectorCamara.value = preferida.deviceId;

    await iniciarCamara(preferida.deviceId);
  } catch (error) {
    console.error(error);
    mostrarMensajeSimple(
      "No se pudo acceder a la cámara.",
      "error"
    );
  }
}

async function iniciarCamara(deviceId) {
  try {
    detenerCamara();

    mostrarMensajeSimple(
      "Iniciando cámara...",
      "neutral"
    );

    controles = await lector.decodeFromVideoDevice(
      deviceId || undefined,
      video,
      function (resultado) {
        if (!resultado || bloqueado) {
          return;
        }

        const codigo = String(
          resultado.getText() || ""
        ).trim();

        if (!codigo || codigo === ultimoCodigo) {
          return;
        }

        bloqueado = true;
        ultimoCodigo = codigo;

        mostrarMensajeSimple(
          "Validando acceso...",
          "neutral"
        );

        validarCheckin(codigo);
      }
    );

    mostrarMensajeSimple(
      "Esperando código QR...",
      "neutral"
    );
  } catch (error) {
    console.error(error);
    mostrarMensajeSimple(
      "No se pudo iniciar la cámara.",
      "error"
    );
  }
}

function validarCheckin(codigo) {
  const callback =
    "iceCheckin_" +
    Date.now() +
    "_" +
    Math.floor(Math.random() * 100000);

  const script = document.createElement("script");

  let finalizado = false;

  const temporizador = setTimeout(function () {
    if (finalizado) return;

    finalizado = true;
    limpiar();

    mostrarResultado({
      resultado: "ERROR",
      mensaje: "No hubo respuesta de Apps Script."
    });
  }, 15000);

  window[callback] = function (respuesta) {
    if (finalizado) return;

    finalizado = true;
    limpiar();
    mostrarResultado(respuesta);
  };

  function limpiar() {
    clearTimeout(temporizador);

    if (script.parentNode) {
      script.remove();
    }

    try {
      delete window[callback];
    } catch (error) {
      window[callback] = undefined;
    }
  }

  script.onerror = function () {
    if (finalizado) return;

    finalizado = true;
    limpiar();

    mostrarResultado({
      resultado: "ERROR",
      mensaje: "No fue posible conectar con Apps Script."
    });
  };

  script.src =
    APP_SCRIPT_URL +
    "?api=checkin" +
    "&qr=" + encodeURIComponent(codigo) +
    "&callback=" + encodeURIComponent(callback) +
    "&t=" + Date.now();

  document.body.appendChild(script);
}

function mostrarResultado(respuesta) {
  const resultado = String(
    respuesta?.resultado ||
    respuesta?.estado ||
    ""
  ).toUpperCase();

  const autorizado = [
    "AUTORIZADO",
    "VALIDO",
    "VÁLIDO",
    "OK",
    "EXITOSO"
  ].includes(resultado);

  const mensaje =
    respuesta?.mensaje ||
    "Respuesta recibida.";

  const nombre =
    respuesta?.nombre ||
    respuesta?.asistente ||
    "";

  const categoria =
    respuesta?.categoria ||
    "";

  const folio =
    respuesta?.folio ||
    respuesta?.boleto ||
    respuesta?.id ||
    "";

  estado.className = autorizado
    ? "success"
    : "error";

  estado.innerHTML = `
    <div class="resultado-icono">
      ${autorizado ? "✓" : "✕"}
    </div>

    <div class="resultado-titulo">
      ${autorizado ? "Acceso autorizado" : "Acceso rechazado"}
    </div>

    <div class="resultado-mensaje">
      ${escaparHtml(mensaje)}
    </div>

    ${
      nombre || categoria || folio
        ? `
          <div class="resultado-datos">
            ${nombre ? `<div>${escaparHtml(nombre)}</div>` : ""}
            ${categoria ? `<div>Categoría: ${escaparHtml(categoria)}</div>` : ""}
            ${folio ? `<div>Folio: ${escaparHtml(folio)}</div>` : ""}
          </div>
        `
        : ""
    }
  `;

  reproducirSonido(autorizado);
  programarSiguienteLectura();
}

function reproducirSonido(autorizado) {
  try {
    const contexto = new AudioContext();
    const oscilador = contexto.createOscillator();
    const ganancia = contexto.createGain();

    oscilador.connect(ganancia);
    ganancia.connect(contexto.destination);

    oscilador.frequency.value = autorizado ? 880 : 220;
    ganancia.gain.value = 0.15;

    oscilador.start();

    setTimeout(function () {
      oscilador.stop();
      contexto.close();
    }, autorizado ? 180 : 450);
  } catch (error) {
    console.warn("No se pudo reproducir sonido.");
  }
}

function programarSiguienteLectura() {
  setTimeout(function () {
    bloqueado = false;
    ultimoCodigo = "";

    mostrarMensajeSimple(
      "Esperando código QR...",
      "neutral"
    );
  }, 3500);
}

function detenerCamara() {
  if (
    controles &&
    typeof controles.stop === "function"
  ) {
    controles.stop();
  }

  controles = null;
}

function mostrarMensajeSimple(mensaje, tipo) {
  estado.className = tipo || "neutral";
  estado.textContent = mensaje;
}

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}