const APP_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzVO_X6IxsX18mGx3GoG5Ie3Q2yjc0thf6iAxseEHcVDLdwnjdDJILd-RHsCl6KRKn9_g/exec";

let video;
let estado;
let selectorCamara;
let entradaLectorFisico;

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

    crearModoLectorFisico();

    lector = new ZX.BrowserQRCodeReader();

    selectorCamara.addEventListener("change", function () {
      iniciarCamara(selectorCamara.value);

      setTimeout(function () {
        enfocarLectorFisico();
      }, 300);
    });

    document.addEventListener("click", function (evento) {
      if (
        evento.target === selectorCamara ||
        evento.target === entradaLectorFisico
      ) {
        return;
      }

      setTimeout(function () {
        enfocarLectorFisico();
      }, 100);
    });

    window.addEventListener("focus", function () {
      enfocarLectorFisico();
    });

    await cargarCamaras();

    enfocarLectorFisico();
  } catch (error) {
    console.error(error);

    mostrarMensajeSimple(
      "No se pudo iniciar el lector QR.",
      "error"
    );
  }
}


/**
 * Crea automáticamente el campo para utilizar
 * un lector físico USB o inalámbrico.
 */
function crearModoLectorFisico() {
  const contenedor = document.createElement("div");

  contenedor.id = "modo-lector-fisico";

  contenedor.style.margin = "18px 0";
  contenedor.style.padding = "16px";
  contenedor.style.borderRadius = "12px";
  contenedor.style.background = "#ffffff";
  contenedor.style.boxShadow =
    "0 4px 16px rgba(0, 0, 0, 0.12)";

  const titulo = document.createElement("div");

  titulo.textContent = "Lector físico 1D / 2D";
  titulo.style.fontWeight = "700";
  titulo.style.marginBottom = "8px";
  titulo.style.fontSize = "16px";

  entradaLectorFisico = document.createElement("input");

  entradaLectorFisico.id = "entrada-lector-fisico";
  entradaLectorFisico.type = "text";
  entradaLectorFisico.placeholder =
    "Escanea aquí con el lector físico";
  entradaLectorFisico.autocomplete = "off";
  entradaLectorFisico.spellcheck = false;

  entradaLectorFisico.style.width = "100%";
  entradaLectorFisico.style.boxSizing = "border-box";
  entradaLectorFisico.style.padding = "14px";
  entradaLectorFisico.style.fontSize = "18px";
  entradaLectorFisico.style.textAlign = "center";
  entradaLectorFisico.style.border = "2px solid #1f7a4d";
  entradaLectorFisico.style.borderRadius = "8px";
  entradaLectorFisico.style.outline = "none";

  entradaLectorFisico.addEventListener(
    "keydown",
    function (evento) {
      if (evento.key !== "Enter") {
        return;
      }

      evento.preventDefault();

      const codigo = String(
        entradaLectorFisico.value || ""
      ).trim();

      entradaLectorFisico.value = "";

      procesarCodigo(codigo);
    }
  );

  entradaLectorFisico.addEventListener(
    "paste",
    function () {
      setTimeout(function () {
        const codigo = String(
          entradaLectorFisico.value || ""
        ).trim();

        entradaLectorFisico.value = "";

        if (codigo) {
          procesarCodigo(codigo);
        }
      }, 50);
    }
  );

  contenedor.appendChild(titulo);
  contenedor.appendChild(entradaLectorFisico);

  selectorCamara.insertAdjacentElement(
    "afterend",
    contenedor
  );
}


async function cargarCamaras() {
  try {
    mostrarMensajeSimple(
      "Solicitando permiso de cámara...",
      "neutral"
    );

    const stream =
      await navigator.mediaDevices.getUserMedia({
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
        "No se encontró ninguna cámara. Puedes usar el lector físico.",
        "neutral"
      );

      enfocarLectorFisico();
      return;
    }

    dispositivos.forEach(function (
      dispositivo,
      indice
    ) {
      const opcion =
        document.createElement("option");

      opcion.value = dispositivo.deviceId;

      opcion.textContent =
        dispositivo.label ||
        "Cámara " + (indice + 1);

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
      "Cámara no disponible. Puedes utilizar el lector físico.",
      "neutral"
    );

    enfocarLectorFisico();
  }
}


async function iniciarCamara(deviceId) {
  try {
    detenerCamara();

    mostrarMensajeSimple(
      "Iniciando cámara...",
      "neutral"
    );

    controles =
      await lector.decodeFromVideoDevice(
        deviceId || undefined,
        video,
        function (resultado) {
          if (!resultado) {
            return;
          }

          const codigo = String(
            resultado.getText() || ""
          ).trim();

          procesarCodigo(codigo);
        }
      );

    mostrarMensajeSimple(
      "Esperando código QR...",
      "neutral"
    );

    enfocarLectorFisico();
  } catch (error) {
    console.error(error);

    mostrarMensajeSimple(
      "No se pudo iniciar la cámara. Puedes utilizar el lector físico.",
      "neutral"
    );

    enfocarLectorFisico();
  }
}


/**
 * Recibe códigos tanto de la cámara
 * como del lector físico.
 */
function procesarCodigo(codigo) {
  codigo = String(codigo || "").trim();

  if (!codigo || bloqueado) {
    enfocarLectorFisico();
    return;
  }

  if (codigo === ultimoCodigo) {
    enfocarLectorFisico();
    return;
  }

  bloqueado = true;
  ultimoCodigo = codigo;

  if (entradaLectorFisico) {
    entradaLectorFisico.value = "";
    entradaLectorFisico.disabled = true;
  }

  mostrarMensajeSimple(
    "Validando acceso...",
    "neutral"
  );

  validarCheckin(codigo);
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
    if (finalizado) {
      return;
    }

    finalizado = true;
    limpiar();

    mostrarResultado({
      resultado: "ERROR",
      mensaje:
        "No hubo respuesta de Apps Script."
    });
  }, 15000);

  window[callback] = function (respuesta) {
    if (finalizado) {
      return;
    }

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
    if (finalizado) {
      return;
    }

    finalizado = true;
    limpiar();

    mostrarResultado({
      resultado: "ERROR",
      mensaje:
        "No fue posible conectar con Apps Script."
    });
  };

  script.src =
    APP_SCRIPT_URL +
    "?api=checkin" +
    "&qr=" +
    encodeURIComponent(codigo) +
    "&callback=" +
    encodeURIComponent(callback) +
    "&t=" +
    Date.now();

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

  const repetido = [
    "REPETIDO",
    "DUPLICADO",
    "YA_REGISTRADO",
    "YA INGRESÓ",
    "YA INGRESO"
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

  let icono = "✕";
  let titulo = "Acceso rechazado";

  if (autorizado) {
    icono = "✓";
    titulo = "Acceso autorizado";
  } else if (repetido) {
    icono = "!";
    titulo = "Código ya utilizado";
  }

  estado.innerHTML = `
    <div class="resultado-icono">
      ${icono}
    </div>

    <div class="resultado-titulo">
      ${titulo}
    </div>

    <div class="resultado-mensaje">
      ${escaparHtml(mensaje)}
    </div>

    ${
      nombre || categoria || folio
        ? `
          <div class="resultado-datos">
            ${
              nombre
                ? `<div>${escaparHtml(nombre)}</div>`
                : ""
            }

            ${
              categoria
                ? `<div>Categoría: ${escaparHtml(categoria)}</div>`
                : ""
            }

            ${
              folio
                ? `<div>Folio: ${escaparHtml(folio)}</div>`
                : ""
            }
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
    const AudioContextDisponible =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextDisponible) {
      return;
    }

    const contexto =
      new AudioContextDisponible();

    const oscilador =
      contexto.createOscillator();

    const ganancia =
      contexto.createGain();

    oscilador.connect(ganancia);
    ganancia.connect(contexto.destination);

    oscilador.frequency.value =
      autorizado ? 880 : 220;

    ganancia.gain.value = 0.15;

    oscilador.start();

    setTimeout(function () {
      oscilador.stop();
      contexto.close();
    }, autorizado ? 180 : 450);
  } catch (error) {
    console.warn(
      "No se pudo reproducir sonido."
    );
  }
}


function programarSiguienteLectura() {
  setTimeout(function () {
    bloqueado = false;
    ultimoCodigo = "";

    if (entradaLectorFisico) {
      entradaLectorFisico.disabled = false;
      entradaLectorFisico.value = "";
    }

    mostrarMensajeSimple(
      "Esperando código QR...",
      "neutral"
    );

    enfocarLectorFisico();
  }, 3500);
}


function enfocarLectorFisico() {
  if (
    !entradaLectorFisico ||
    entradaLectorFisico.disabled
  ) {
    return;
  }

  entradaLectorFisico.focus({
    preventScroll: true
  });
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
