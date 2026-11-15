/* ============================================================
   mejoras.js
   Proyecto: Circuitos básicos AR/VR
   Autor del módulo: Desarrollador Web Senior + Edumática
   Marco: Ley 115/1994 + Orientaciones MEN 2022 (Tecnología e Informática)
   Se engancha al HTML original SIN modificarlo.
   Depende de: loader.js (que publica window.PIEZAS desde data/piezas.json)
   ============================================================ */
(() => {
  "use strict";

  /* ----------------------------------------------------------
     1) PIEZAS se llena desde loader.js (data/piezas.json)
     ---------------------------------------------------------- */
  let PIEZAS = {};
  document.addEventListener("piezas:listas", (e) => {
    PIEZAS = e.detail.piezas || {};
    // Si el panel ya estaba construido, lo refrescamos
    if (document.getElementById("edu-panel")) {
      const art = localStorage.getItem("circuitosARVR_artefacto") || "linterna";
      if (PIEZAS[art]) construirPanel(art);
    }
  });

  /* ----------------------------------------------------------
     2) UTILIDADES
     ---------------------------------------------------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const toast = (msg, ms = 2200) => {
    let t = $("#toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), ms);
  };
  const narrar = (txt) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = "es-CO"; u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  /* ----------------------------------------------------------
     3) PANEL PEDAGÓGICO CON PESTAÑAS
     ---------------------------------------------------------- */
  function construirPanel(artefacto) {
    let panel = $("#edu-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "edu-panel";
      document.body.appendChild(panel);
    }
    const P = PIEZAS[artefacto];
    if (!P) { panel.innerHTML = "<p>Artefacto no reconocido.</p>"; return; }

    panel.innerHTML = `
      <header>
        <button data-tab="ficha" class="act">📘 Ficha</button>
        <button data-tab="retos">🎯 Retos</button>
        <button data-tab="glosario">📖 Glosario</button>
        <button data-tab="menu">📚 Menú</button>
      </header>
      <div class="tab act" data-tab="ficha">
        <h3>${P.nombre}<span class="badge">${P.componenteMEN}</span></h3>
        <p><b>Función:</b> ${P.ficha.funcion}</p>
        <p><b>Principio:</b> ${P.ficha.principio}</p>
        <p><b>Impacto social:</b> ${P.ficha.impactoSocial}</p>
        <p><b>Indaga:</b> ${P.ficha.preguntaIndagacion}</p>
      </div>
      <div class="tab" data-tab="retos"></div>
      <div class="tab" data-tab="glosario">
        <h3>Glosario técnico</h3>
        <dl class="glosario">
          ${Object.entries(P.glosario).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}
        </dl>
      </div>
      <div class="tab" data-tab="menu">
        <h3>Artefactos disponibles</h3>
        ${Object.entries(PIEZAS).map(([k, v]) => `
          <p><button data-art="${k}" style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:6px 10px;color:#fff;cursor:pointer">${v.nombre}</button> ${v.componenteMEN}</p>
        `).join("")}
        <p style="margin-top:10px;font-size:12px;color:#94a3b8">
          Marco: Ley 115/1994 · Orientaciones MEN 2022 – Tecnología e Informática.
        </p>
      </div>
    `;

    // Pestañas
    $$("#edu-panel header button").forEach(b => {
      b.onclick = () => {
        $$("#edu-panel header button").forEach(x => x.classList.remove("act"));
        $$("#edu-panel .tab").forEach(x => x.classList.remove("act"));
        b.classList.add("act");
        $(`#edu-panel .tab[data-tab="${b.dataset.tab}"]`).classList.add("act");
      };
    });

    // Retos
    construirRetos(artefacto);

    // Selector de artefacto desde menú
    $$("#edu-panel [data-art]").forEach(b => {
      b.onclick = () => {
        const art = b.dataset.art;
        toast(`Cambiando a ${PIEZAS[art].nombre}…`);
        construirPanel(art);
        if (typeof window.cargarArtefacto === "function") window.cargarArtefacto(art);
      };
    });
  }

  function construirRetos(artefacto) {
    const cont = $(`#edu-panel .tab[data-tab="retos"]`);
    if (!cont) return;
    const P = PIEZAS[artefacto];
    cont.innerHTML = `<h3>Retos formativos</h3>` + P.retos.map((r, i) => `
      <div class="pregunta" data-i="${i}">
        <p><b>${i + 1}.</b> ${r.q}</p>
        ${r.opciones.map((o, j) => `<button data-j="${j}">${o}</button>`).join("")}
        <div class="feedback" style="display:none"></div>
      </div>
    `).join("");

    $$("#edu-panel .pregunta").forEach(preg => {
      const i = +preg.dataset.i;
      const r = P.retos[i];
      $$("button", preg).forEach(btn => {
        btn.onclick = () => {
          const j = +btn.dataset.j;
          $$("button", preg).forEach(b => b.disabled = true);
          const ok = j === r.ok;
          btn.classList.add(ok ? "ok" : "no");
          if (!ok) $$("button", preg)[r.ok].classList.add("ok");
          const fb = $(".feedback", preg);
          fb.style.display = "block";
          fb.textContent = (ok ? "✅ ¡Correcto! " : "❌ Revisa: ") + r.fb;
          narrar((ok ? "Correcto. " : "Intenta de nuevo. ") + r.fb);
          registrarBitacora({ tipo: "reto", artefacto, pregunta: i, correcto: ok });
        };
      });
    });
  }

  /* ----------------------------------------------------------
     4) BITÁCORA DEL ESTUDIANTE (localStorage + exportar JSON)
     ---------------------------------------------------------- */
  const BITACORA_KEY = "circuitosARVR_bitacora_v1";
  function registrarBitacora(evento) {
    try {
      const raw = localStorage.getItem(BITACORA_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push({ ts: new Date().toISOString(), ...evento });
      localStorage.setItem(BITACORA_KEY, JSON.stringify(arr.slice(-500)));
    } catch (e) { /* silencioso */ }
  }
  function exportarBitacora() {
    const raw = localStorage.getItem(BITACORA_KEY) || "[]";
    const blob = new Blob([raw], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bitacora_circuitos_${Date.now()}.json`;
    a.click();
    toast("Bitácora exportada ✅");
  }

  /* ----------------------------------------------------------
     5) ACCESIBILIDAD
     ---------------------------------------------------------- */
  function construirA11y() {
    if ($("#a11y")) return;
    const box = document.createElement("div");
    box.id = "a11y";
    box.innerHTML = `
      <button id="a-contraste">🌓 Alto contraste</button>
      <button id="a-grande">🔠 Texto grande</button>
      <button id="a-narrar">🔊 Narrar ficha</button>
      <button id="a-bitacora">💾 Exportar bitácora</button>
      <button id="a-captura">📸 Captura</button>
      <button id="a-onboarding">❓ Gestos</button>
    `;
    document.body.appendChild(box);

    $("#a-contraste").onclick = e => {
      document.body.classList.toggle("contraste");
      e.currentTarget.classList.toggle("on");
    };
    $("#a-grande").onclick = e => {
      document.body.classList.toggle("texto-grande");
      e.currentTarget.classList.toggle("on");
    };
    $("#a-narrar").onclick = () => {
      const art = localStorage.getItem("circuitosARVR_artefacto") || "linterna";
      const P = PIEZAS[art];
      if (!P) return;
      narrar(`${P.nombre}. ${P.ficha.funcion} Principio: ${P.ficha.principio}`);
    };
    $("#a-bitacora").onclick = exportarBitacora;
    $("#a-captura").onclick = () => {
      const canvas = document.getElementById("c");
      if (!canvas) return;
      try {
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `captura_${Date.now()}.png`;
        a.click();
        toast("Captura guardada ✅");
      } catch (e) { toast("No se pudo capturar el canvas."); }
    };
    $("#a-onboarding").onclick = mostrarOnboarding;
  }

  /* ----------------------------------------------------------
     6) ONBOARDING DE GESTOS
     ---------------------------------------------------------- */
  function mostrarOnboarding() {
    let ob = $("#onboarding");
    if (!ob) {
      ob = document.createElement("div");
      ob.id = "onboarding";
      document.body.appendChild(ob);
    }
    const pasos = [
      { i: "✋", t: "Mano abierta", d: "Separa las partes del artefacto." },
      { i: "✊", t: "Puño", d: "Junta las partes." },
      { i: "👌", t: "Pellizco", d: "Toca una pieza para ver su función." },
      { i: "🖐️", t: "Mueve la mano", d: "Desplaza el objeto en AR." }
    ];
    let idx = 0;
    const render = () => {
      const p = pasos[idx];
      ob.innerHTML = `
        <div class="paso">
          <div class="icono">${p.i}</div>
          <h2>${p.t}</h2>
          <p>${p.d}</p>
          <button id="ob-next">${idx < pasos.length - 1 ? "Siguiente ▶" : "Entendido ✔"}</button>
        </div>`;
      $("#ob-next").onclick = () => {
        idx++;
        if (idx >= pasos.length) ob.classList.remove("show");
        else render();
      };
    };
    render();
    ob.classList.add("show");
  }

  /* ----------------------------------------------------------
     7) VALIDACIÓN DE .GLB CARGADO
     ---------------------------------------------------------- */
  function engancharGLB() {
    const inp = document.getElementById("glb");
    if (!inp) return;
    inp.addEventListener("change", () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      if (!/\.(glb|gltf)$/i.test(f.name)) {
        toast("Solo se aceptan archivos .glb o .gltf"); return;
      }
      if (f.size > 15 * 1024 * 1024) {
        toast("El archivo supera 15 MB; puede afectar el rendimiento."); return;
      }
      toast(`Cargando ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)…`);
      registrarBitacora({ tipo: "glb_personal", archivo: f.name });
    });
  }

  /* ----------------------------------------------------------
     8) DETECCIÓN DE CAPACIDADES AR/VR
     ---------------------------------------------------------- */
  async function detectarCapacidades() {
    const caps = { ar: false, vr: false, manos: false };
    try {
      if (navigator.xr) {
        caps.ar = await navigator.xr.isSessionSupported("immersive-ar");
        caps.vr = await navigator.xr.isSessionSupported("immersive-vr");
      }
      caps.manos = typeof window.Hands !== "undefined" || typeof window.MediaPipe !== "undefined";
    } catch (e) { }
    const st = document.getElementById("status");
    if (st) {
      const partes = [];
      partes.push(`AR: ${caps.ar ? "✅" : "—"}`);
      partes.push(`VR: ${caps.vr ? "✅" : "—"}`);
      partes.push(`Manos: ${caps.manos ? "✅" : "—"}`);
      st.textContent = partes.join(" · ");
    }
    if (!caps.ar && !caps.vr) {
      toast("Tu equipo no soporta WebXR; usarás modo 3D interactivo.");
    }
  }

  /* ----------------------------------------------------------
     9) CARGA DE PIEZAS HIJAS (.glb por pieza)
     ---------------------------------------------------------- */
  async function cargarPiezaHija(idPieza, url) {
    if (!url) return;
    try {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        const obj = gltf.scene;
        obj.name = `pieza_${idPieza}`;
        const padre = window.SCENE?.getObjectByName?.(idPieza);
        if (padre) padre.add(obj);
        else window.SCENE?.add?.(obj);
        toast(`Pieza "${idPieza}" cargada ✅`);
        registrarBitacora({ tipo: "pieza_cargada", idPieza });
      }, undefined, (err) => {
        console.warn("Error cargando pieza", idPieza, err);
        toast(`No se pudo cargar ${idPieza}`);
      });
    } catch (e) {
      console.warn("GLTFLoader no disponible", e);
    }
  }
  window.cargarPiezaHija = cargarPiezaHija;

  /* ----------------------------------------------------------
     10) INICIALIZACIÓN
     ---------------------------------------------------------- */
  function arranque() {
    const art = localStorage.getItem("circuitosARVR_artefacto") || "linterna";
    construirPanel(art);
    construirA11y();
    engancharGLB();
    detectarCapacidades();

    // Guardar artefacto cuando cambie (botones devBtns de tu HTML)
    document.addEventListener("click", (e) => {
      const b = e.target.closest("#devBtns button");
      if (!b) return;
      const txt = b.textContent.toLowerCase();
      let nuevo = null;
      if (txt.includes("linterna")) nuevo = "linterna";
      else if (txt.includes("timbre")) nuevo = "timbre";
      else if (txt.includes("ventilador")) nuevo = "ventilador";
      if (nuevo) {
        localStorage.setItem("circuitosARVR_artefacto", nuevo);
        if (PIEZAS[nuevo]) construirPanel(nuevo);
        registrarBitacora({ tipo: "cambio_artefacto", artefacto: nuevo });
      }
    });

    // Mostrar onboarding la primera vez
    if (!localStorage.getItem("circuitosARVR_onboarding")) {
      setTimeout(() => {
        mostrarOnboarding();
        localStorage.setItem("circuitosARVR_onboarding", "1");
      }, 800);
    }

    console.info("%cCircuitos AR/VR – mejoras pedagógicas cargadas (Ley 115/1994 · MEN 2022)", "color:#38bdf8;font-weight:bold");
  }

  function init() {
    if (window.PIEZAS && Object.keys(window.PIEZAS).length) {
      PIEZAS = window.PIEZAS;
      arranque();
    } else {
      // Esperar a loader.js
      document.addEventListener("piezas:listas", (e) => {
        PIEZAS = e.detail.piezas || {};
        arranque();
      }, { once: true });
    }
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();