import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Carga una pieza .glb o .gltf. Si falla, intenta cargar el modeloFallback.
 * Devuelve una Promesa con { scene, animations }.
 */
export function cargarPieza(def, fallback) {
  const loader = new GLTFLoader();
  const ruta = def.modelo || fallback;

  return new Promise((resolve, reject) => {
    loader.load(
      ruta,
      (gltf) => resolve(gltf),
      undefined,
      (err) => {
        console.warn(`[piezas] No se pudo cargar ${ruta}`, err);
        if (fallback && ruta !== fallback) {
          // Reintento con fallback
          loader.load(
            fallback,
            (gltf) => resolve(gltf),
            undefined,
            (err2) => reject(err2)
          );
        } else {
          reject(err);
        }
      }
    );
  });
}

/**
 * Normaliza un mesh: escala, centra y orienta según bounding box.
 */
export function normalizarMesh(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Centrar en origen
  mesh.position.sub(center);

  // Escalar a ~0.4 unidades de tamaño máximo (ajustable)
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) {
    const escala = 0.4 / maxDim;
    mesh.scale.setScalar(escala);
  }

  return mesh;
}