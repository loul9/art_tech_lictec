import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

export class VR {
  constructor(renderer, ensamblaje) {
    this.renderer = renderer;
    this.ensamblaje = ensamblaje;
    this.controles = [];
    this.activo = false;
    this._setup();
  }

  _setup() {
    const factory = new XRControllerModelFactory();
    for (let i = 0; i < 2; i++) {
      const ctrl = this.renderer.xr.getController(i);
      ctrl.addEventListener('selectstart', (e) => this._onSelect(e, i));
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(factory.createControllerModel(grip));
      this.controles.push(ctrl);
    }
  }

  _onSelect(event, i) {
    if (!this.activo) return;
    // Raycast desde el controlador
    const ctrl = this.controles[i];
    if (!ctrl) return;

    const raycaster = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4().identity().extractRotation(ctrl.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const mesh = this.ensamblaje.obtenerPiezaDesdeRaycaster(raycaster);
    if (mesh) {
      const info = document.getElementById('info');
      if (info) {
        info.innerHTML = `
          <h2>${mesh.userData.id}</h2>
          <p><b>Función:</b> ${mesh.userData.funcion || '—'}</p>
          <p><b>Material:</b> ${mesh.userData.material || '—'}</p>
        `;
      }
      // Vibración háptica si disponible
      const session = this.renderer.xr.getSession();
      if (session) {
        const inputSource = session.inputSources[i];
        if (inputSource?.gamepad?.hapticActuators?.[0]) {
          inputSource.gamepad.hapticActuators[0].pulse(0.5, 50);
        }
      }
    }
  }

  async entrar() {
    if (!navigator.xr) {
      alert('WebXR no disponible en este dispositivo.');
      return;
    }
    const soportado = await navigator.xr.isSessionSupported('immersive-vr');
    if (!soportado) {
      alert('Este dispositivo no soporta VR inmersivo.');
      return;
    }

    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
    });

    this.renderer.xr.setSession(session);
    this.activo = true;
    document.body.classList.add('vr');

    session.addEventListener('end', () => {
      this.activo = false;
      document.body.classList.remove('vr');
    });

    // Colocar el objeto a la altura de los ojos
    this.ensamblaje.grupo.position.set(0, 1.4, -1.2);
    this.ensamblaje.grupo.scale.setScalar(0.6);
  }

  async salir() {
    const session = this.renderer.xr.getSession();
    if (session) await session.end();
  }
}