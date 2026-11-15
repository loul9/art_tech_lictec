import * as THREE from 'three';

export function crearEscena(contenedor) {
  const escena = new THREE.Scene();

  const camara = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.01,
    100
  );
  camara.position.set(0, 0.3, 2.5);

  const renderer = new THREE.WebGLRenderer({
    canvas: contenedor,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;

  // Luces
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 1.2);
  escena.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.5);
  dir.position.set(2, 3, 2);
  escena.add(dir);

  const dir2 = new THREE.DirectionalLight(0x88aaff, 0.6);
  dir2.position.set(-2, -1, -2);
  escena.add(dir2);

  // Rejilla suave para orientación espacial
  const grid = new THREE.GridHelper(4, 20, 0x1e3a5f, 0x0f1e33);
  grid.position.y = -0.9;
  escena.add(grid);

  // Resize
  window.addEventListener('resize', () => {
    camara.aspect = window.innerWidth / window.innerHeight;
    camara.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { escena, camara, renderer };
}