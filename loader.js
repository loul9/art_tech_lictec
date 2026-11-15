/* ============================================================
   loader.js
   Proyecto: Circuitos básicos AR/VR
   Rol: Cargador de contenido pedagógico desde piezas.json
   Marco: Ley 115/1994 · Orientaciones MEN 2022 (Tecnología e Informática)

   Responsabilidad única:
     - Descargar data/piezas.json
     - Validar su estructura mínima
     - Exponer window.PIEZAS y window.PIEZAS_META
     - Notificar (evento 'piezas:listas') cuando esté disponible
   NO pinta UI: eso lo hace mejoras.js
   ============================================================ */
(() => {
  "use strict";

  const RUTA_JSON = "data/piezas.json";
  const CACHE_KEY = "circuitosARVR_piezas_cache_v1";
  const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 h

  /* ----------------------------------------------------------
     Utilidades
     ---------------------------------------------------------- */
  const log = (...a) => console.info("%c[loader]", "color:#22d3ee", ...a);
  const warn = (...a) => console.warn("%c[loader]", "color:#f59e0b", ...a);

  function esObjetoValido(x) {
    return x && typeof x === "object" && !Array.isArray(x);
  }

  /**
   * Validación mínima estructural.
   * No exige contenido perfecto, pero sí lo indispensable para que
   * mejoras.js no falle al renderizar.
   */
  function validar(data) {
    const errores = [];
    if (!esObjetoValido(data)) errores.push("La raíz no es un objeto.");
    if (!esObjetoValido(data.artefactos)) errores.push("Falta 'artefactos'.");

    if (esObjetoValido(data.artefactos)) {
      for (const [id, art] of Object.entries(data.artefactos)) {
        const pre = `artefactos.${id}`;
        if (!art.nombre) errores.push(`${pre}.nombre es obligatorio.`);
        if (!esObjetoValido(art.ficha)) errores.push(`${pre}.ficha es obligatorio.`);
        else {
          for (const k of ["funcion","principio","impactoSocial","preguntaIndagacion"]) {
            if (typeof art.ficha[k] !== "string") errores.push(`${pre}.ficha.${k} debe ser texto.`);
          }
        }
        if (!esObjetoValido(art.piezas)) errores.push(`${pre}.piezas es obligatorio.`);
        else {
          for (const [pid, p] of Object.entries(art.piezas)) {
            if (!p.nombre || !p.funcion) errores.push(`${pre}.piezas.${pid} requiere nombre y funcion.`);
            if (typeof p.glb !== "string") errores.push(`${pre}.piezas.${pid}.glb debe ser texto (puede ser vacío).`);
          }
        }
        if (!Array.isArray(art.retos)) errores.push(`${pre}.retos debe ser arreglo.`);
        else art.retos.forEach((r, i) => {
          if (!r.q || !Array.isArray(r.opciones) || r.opciones.length < 2)
            errores.push(`${pre}.retos[${i}] incompleto.`);
          if (typeof r.ok !== "number" || r.ok < 0 || r.ok >= (r.opciones?.length || 0))
            errores.push(`${pre}.retos[${i}].ok fuera de rango.`);
          if (typeof r.fb !== "string") errores.push(`${pre}.retos[${i}].fb debe ser texto.`);
        });
        if (!esObjetoValido(art.glosario)) errores.push(`${pre}.glosario debe ser objeto.`);
      }
    }
    return errores;
  }

  /* ----------------------------------------------------------
     Caché en localStorage (rendimiento en aulas con red lenta)
     ---------------------------------------------------------- */
  function leerCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL_MS) return null;
      return data;
    } catch { return null; }
  }
  function guardarCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) { warn("No se pudo cachear piezas.json", e); }
  }

  /* ----------------------------------------------------------
     Carga principal
     ---------------------------------------------------------- */
  async function cargarPiezas({ usarCache = true, forzar = false } = {}) {
    if (usarCache && !forzar) {
      const cache = leerCache();
      if (cache) {
        log("Usando caché local.");
        publicar(cache, { fuente: "cache" });
        // Refresco en segundo plano
        descargar().then(fresco => {
          if (fresco) { guardarCache(fresco); publicar(fresco, { fuente: "red-refresco" }); }
        }).catch(()=>{});
        return cache;
      }
    }
    const data = await descargar();
    if (data) {
      guardarCache(data);
      publicar(data, { fuente: "red" });
    }
    return data;
  }

  async function descargar() {
    try {
      const res = await fetch(RUTA_JSON, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const errores = validar(data);
      if (errores.length) {
        warn("piezas.json tiene advertencias:", errores);
        // No bloqueamos: mostramos lo que se pueda
        if (window.toast) window.toast(`Aviso: ${errores.length} detalle(s) en piezas.json`);
      }
      return data;
    } catch (e) {
      warn("No se pudo cargar piezas.json:", e);
      return null;
    }
  }

  /* ----------------------------------------------------------
     Publicación global + evento
     ---------------------------------------------------------- */
  function publicar(data, extra = {}) {
    if (!data || !data.artefactos) return;
    // Compatibilidad con mejoras.js (que espera {linterna, timbre, ventilador})
    window.PIEZAS = data.artefactos;
    window.PIEZAS_META = data._meta || {};
    document.dispatchEvent(new CustomEvent("piezas:listas", {
      detail: { piezas: data.artefactos, meta: data._meta, ...extra }
    }));
    log(`Piezas publicadas (${Object.keys(data.artefactos).length} artefactos).`, extra);
  }

  /* ----------------------------------------------------------
     API pública
     ---------------------------------------------------------- */
  window.PiezasLoader = {
    cargar: cargarPiezas,
    recargar: () => cargarPiezas({ forzar: true }),
    limpiarCache: () => { localStorage.removeItem(CACHE_KEY); log("Caché limpiada."); },
    validar,
    RUTA_JSON
  };

  /* ----------------------------------------------------------
     Autoarranque
     ---------------------------------------------------------- */
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => cargarPiezas());
  else
    cargarPiezas();
})();