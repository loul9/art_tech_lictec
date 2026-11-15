import * as THREE from 'three';
import { crearEscena } from './scene.js';
import { Ensamblaje } from './ensamblaje.js';
import { Etiquetas } from './etiquetas.js';
import { ARManos } from './ar-manos.js';
import { VR } from './vr.js';
import { initUI } from './ui.js';

// ---------- Estado global ----------
const estado = {
  artefactoActual: 'linterna',
  ensamblaje: null,
  etiquetas: null,
  ar: null,
  vr: null,
  transparenciaCarcasa: false,
  circuitoCerrado: false,
};

// ---------- Escena ----------
const { escena, camara, renderer } = crearEscena(
  document.getElementById('c')
);

// ---------- Carga de datos ----------
async function cargarArtefacto(nombre) {
  // Limpiar
  if (estado.ensamblaje) {
    estado.ensamblaje.limpiar();
  }

  const resp = await fetch('data/artefactos.json');
  const data = await resp.json();
  const datos = data[nombre];
  if (!datos) throw new Error(`Artefacto "${nombre}" no encontrado`);

  estado.ensamblaje = new Ensamblaje(escena, datos);
  await estado.ensamblaje.cargar();

  // Etiquetas
  estado.etiquetas?.crear(); // re-crear con el nuevo ensamblaje
  estado.etiquetas = new Etiquetas(
    document.getElementById('labels'),
    camara,
    estado.ensamblaje
  );
  estado.etiquetas.crear();

  // Info inicial
  document.getElementById('info').innerHTML = `
    <h2>${datos.nombre}</h2>
    <p>${datos.descripcion || ''}</p>
    <p><i>Desliza "Separar partes" o abre la mano frente a la cámara.</i></p>
  `;

  estado.artefactoActual = nombre;
}

// ---------- UI ----------
initUI({
  onCircuito: () => {
    estado.circuitoCerrado = !estado.circuitoCerrado;
    document.getElementById('bCirc').classList.toggle('act', estado.circuitoCerrado);
    // Aquí puedes activar un efecto visual de luz/energía
    if (estado.ensamblaje) {
      // Ejemplo: iluminar el bombillo
      const bombillo = estado.ensamblaje.piezas.get('bombillo');
      if (bombillo) {
        bombillo.traverse((o) => {
          if (o.isMesh && o.material.emissive) {
            o.material.emissive.setHex(
              estado.circuitoCerrado ? 0xffdd66 : 0x000000
            );
            o.material.emissiveIntensity = estado.circuitoCerrado ? 2 : 0;
          }
        });
      }
    }
  },

  onTransparente: () => {
    estado.transparenciaCarcasa = !estado.transparenciaCarcasa;
    document.getElementById('bTr').classList.toggle('act', estado.transparenciaCarcasa);
    estado.ensamblaje?.setTransparencia('carcasa', estado.transparenciaCarcasa);
  },

  onAR: async () => {
    if (!estado.ar) {
      estado.ar = new ARManos({
        video: document.getElementById('video'),
        ensamblaje: estado.ensamblaje,
        camera: camara,
        renderer,
        cursor: document.getElementById('cursor'),
        etiquetas: estado.etiquetas,
      });
    }
    const btn = document.getElementById('bAR');
    if (estado.ar.activo) {
      estado.ar.detener();
      btn.classList.remove('act');
      btn.classList.add('off');
      btn.textContent = '📷 AR + manos: OFF';
    } else {
      await estado.ar.iniciar();
      btn.classList.add('act');
      btn.classList.remove('off');
      btn.textContent = '📷 AR + manos: ON';
    }
  },

  onVR: async () => {
    if (!estado.vr) estado.vr = new VR(renderer, estado.ensamblaje);
    if (estado.vr.activo) {
      await estado.vr.salir();
    } else {
      await estado.vr.entrar();
    }
  },

  onGLB: async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    // Cargar como artefacto de una sola pieza
    const resp = await fetch('data/artefactos.json');
    const data = await resp.json();
    const piezaUnica = {
      nombre: file.name.replace(/\.(glb|gltf)$/i, ''),
      descripcion: 'Modelo cargado por el usuario.',
      modeloFallback: url,
      piezas: [
        {
          id: 'modelo',
          modelo: url,
          posicion: [0, 0, 0],
          posicionExplotada: [0, 0.3, 0],
          funcion: 'Modelo cargado manualmente.',
          material: '—',
          etiquetaOffset: [0, 0.1, 0],
        },
      ],
    };
    if (estado.ensamblaje) estado.ensamblaje.limpiar();
    estado.ensamblaje = new Ensamblaje(escena, piezaUnica);
    await estado.ensamblaje.cargar();
    estado.etiquetas = new Etiquetas(
      document.getElementById('labels'),
      camara,
      estado.ensamblaje
    );
    estado.etiquetas.crear();
  },

  onExplosion: (t) => estado.ensamblaje?.setExplosion(t),
});

// ---------- Loop de render ----------
function animate() {
  renderer.setAnimationLoop(() => {
    // Rotación suave automática (opcional, comenta si no la quieres)
    if (estado.ensamblaje && !estado.vr?.activo) {
      estado.ensamblaje.grupo.rotation.y += 0.002;
    }
    estado.etiquetas?.actualizar();
    renderer.render(escena, camara);
  });
}

// ---------- Arranque ----------
(async () => {
  try {
    await cargarArtefacto('linterna');
    animate();
    document.getElementById('status').textContent = '✅ Listo. Linterna cargada.';
  } catch (e) {
    console.error(e);
    document.getElementById('status').textContent =
      '⚠️ Error cargando artefacto. Revisa /modelos y data/artefactos.json';
  }
})();