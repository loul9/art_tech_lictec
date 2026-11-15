import * as THREE from 'three';

export class Etiquetas {
  constructor(contenedor, camara, ensamblaje) {
    this.contenedor = contenedor;
    this.camara = camara;
    this.ensamblaje = ensamblaje;
    this.map = new Map(); // id -> HTMLElement
    this._v = new THREE.Vector3();
  }

  crear() {
    this.contenedor.innerHTML = '';
    this.map.clear();
    for (const [id, mesh] of this.ensamblaje.piezas) {
      const el = document.createElement('div');
      el.className = 'label';
      el.textContent = id;
      el.dataset.id = id;
      el.addEventListener('click', () => {
        this.mostrarInfo(id);
      });
      this.contenedor.appendChild(el);
      this.map.set(id, el);
    }
  }

  actualizar() {
    for (const [id, mesh] of this.ensamblaje.piezas) {
      const el = this.map.get(id);
      if (!el) continue;

      mesh.getWorldPosition(this._v);
      this._v.add(mesh.userData.etiquetaOffset);
      this._v.project(this.camara);

      const visible = this._v.z < 1 && this._v.z > -1;
      el.style.display = visible ? 'block' : 'none';
      if (!visible) continue;

      const x = (this._v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-this._v.y * 0.5 + 0.5) * window.innerHeight;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
  }

  seleccionar(id) {
    for (const [k, el] of this.map) {
      el.classList.toggle('sel', k === id);
    }
  }

  mostrarInfo(id) {
    const mesh = this.ensamblaje.piezas.get(id);
    if (!mesh) return;
    this.seleccionar(id);
    const info = document.getElementById('info');
    info.innerHTML = `
      <h2>${id}</h2>
      <p><b>Función:</b> ${mesh.userData.funcion || '—'}</p>
      <p><b>Material:</b> ${mesh.userData.material || '—'}</p>
    `;
  }
}