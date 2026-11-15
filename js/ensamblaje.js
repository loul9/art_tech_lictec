import * as THREE from 'three';
import { cargarPieza, normalizarMesh } from './piezas.js';

/**
 * Gestiona un artefacto como conjunto de piezas independientes.
 * Cada pieza puede explotarse (desarmarse) de forma individual.
 */
export class Ensamblaje {
  constructor(escena, datosArtefacto) {
    this.escena = escena;
    this.datos = datosArtefacto;
    this.grupo = new THREE.Group();
    this.escena.add(this.grupo);

    /** @type {Map<string, THREE.Object3D>} id -> mesh */
    this.piezas = new Map();

    this.t = 0; // 0 = armado, 1 = desarmado
    this.raycaster = new THREE.Raycaster();
    this._vector = new THREE.Vector2();
  }

  async cargar() {
    const fallback = this.datos.modeloFallback;
    const promesas = this.datos.piezas.map(async (def) => {
      try {
        const gltf = await cargarPieza(def, fallback);
        const mesh = gltf.scene;

        normalizarMesh(mesh);
        mesh.position.fromArray(def.posicion || [0, 0, 0]);

        mesh.userData = {
          id: def.id,
          funcion: def.funcion,
          material: def.material,
          etiquetaOffset: new THREE.Vector3().fromArray(def.etiquetaOffset || [0, 0, 0]),
          posBase: new THREE.Vector3().fromArray(def.posicion || [0, 0, 0]),
          posExplotada: new THREE.Vector3().fromArray(def.posicionExplotada || def.posicion || [0, 0, 0]),
        };

        this.piezas.set(def.id, mesh);
        this.grupo.add(mesh);
      } catch (e) {
        console.error(`[ensamblaje] Pieza "${def.id}" no cargada:`, e);
      }
    });

    await Promise.all(promesas);
    return this;
  }

  /** t ∈ [0,1] — 0 armado, 1 desarmado */
  setExplosion(t) {
    this.t = THREE.MathUtils.clamp(t, 0, 1);
    for (const mesh of this.piezas.values()) {
      const u = mesh.userData;
      mesh.position.lerpVectors(u.posBase, u.posExplotada, this.t);
    }
  }

  /** Cambia opacidad de una pieza (ej. carcasa transparente) */
  setTransparencia(id, activa) {
    const mesh = this.piezas.get(id);
    if (!mesh) return;
    mesh.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = activa;
        o.material.opacity = activa ? 0.25 : 1;
        o.material.depthWrite = !activa;
      }
    });
  }

  /** Raycast desde coordenadas NDC (o desde cámara/controlador en VR) */
  obtenerPiezaDesdeNDC(ndcX, ndcY, camara) {
    this._vector.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this._vector, camara);
    return this.obtenerPiezaDesdeRaycaster(this.raycaster);
  }

  obtenerPiezaDesdeRaycaster(raycaster) {
    const intersecciones = raycaster.intersectObjects(this.grupo.children, true);
    if (intersecciones.length === 0) return null;

    let obj = intersecciones[0].object;
    while (obj && !obj.userData.id) obj = obj.parent;
    return obj || null;
  }

  /** Devuelve la posición mundial de una pieza (para etiquetas) */
  getPosicionMundial(id) {
    const mesh = this.piezas.get(id);
    if (!mesh) return null;
    const v = new THREE.Vector3();
    mesh.getWorldPosition(v);
    v.add(mesh.userData.etiquetaOffset);
    return v;
  }

  limpiar() {
    this.grupo.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose();
      }
    });
    this.escena.remove(this.grupo);
    this.piezas.clear();
  }
}