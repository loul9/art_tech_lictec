import { Ensamblaje } from './ensamblaje.js';

/**
 * AR con manos usando MediaPipe Hands.
 * Detecta gestos: mano abierta → explotar; puño → juntar; pellizco → seleccionar.
 * Mueve el objeto con la mano (tracking posicional).
 */
export class ARManos {
  constructor({ video, ensamblaje, camera, renderer, cursor, etiquetas }) {
    this.video = video;
    this.ensamblaje = ensamblaje;
    this.camera = camera;
    this.renderer = renderer;
    this.cursor = cursor;
    this.etiquetas = etiquetas;
    this.activo = false;

    this.hands = null;
    this.cameraAR = null;
    this.stream = null;
    this.ultimoGesto = null;

    this.manoX = 0;
    this.manoY = 0;

    this._bindLoop();
  }

  async iniciar() {
    if (this.activo) return;

    // Pedir cámara
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.video.style.display = 'block';

    // Cargar MediaPipe Hands
    const MPHands = await import(
      'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'
    );
    this.hands = new MPHands.Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    this.hands.onResults((r) => this._onResult(r));

    // Loop de detección
    const detectar = async () => {
      if (!this.activo) return;
      await this.hands.send({ image: this.video });
      requestAnimationFrame(detectar);
    };
    this.activo = true;
    detectar();
  }

  detener() {
    this.activo = false;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.video.style.display = 'none';
    this.cursor.style.display = 'none';
  }

  _onResult(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.cursor.style.display = 'none';
      return;
    }

    const lm = results.multiHandLandmarks[0];
    const gesto = this._detectarGesto(lm);

    // Posición del pellizco o palma (landmark 9 = centro de la mano)
    const centro = lm[9];
    this.manoX = centro.x;
    this.manoY = centro.y;

    // Cursor
    this.cursor.style.display = 'block';
    this.cursor.style.left = `${(1 - centro.x) * window.innerWidth}px`; // espejado
    this.cursor.style.top = `${centro.y * window.innerHeight}px`;
    this.cursor.classList.toggle('pinch', gesto === 'pinch');

    // Mover objeto con la mano (desplazamiento suave)
    const offsetX = (0.5 - centro.x) * 2;
    const offsetY = (0.5 - centro.y) * 2;
    if (this.ensamblaje && this.ensamblaje.grupo) {
      this.ensamblaje.grupo.position.x += (offsetX - this.ensamblaje.grupo.position.x) * 0.05;
      this.ensamblaje.grupo.position.y += (offsetY - this.ensamblaje.grupo.position.y) * 0.05;
    }

    // Acciones por gesto (solo en transición para no repetir)
    if (gesto !== this.ultimoGesto) {
      this._onGestoCambia(gesto, centro);
      this.ultimoGesto = gesto;
    }
  }

  _onGestoCambia(gesto, centro) {
    if (gesto === 'abierta') {
      this._animarExplosion(1);
    } else if (gesto === 'puño') {
      this._animarExplosion(0);
    } else if (gesto === 'pinch') {
      this._seleccionarEn(centro);
    }
  }

  _animarExplosion(destino) {
    const start = this.ensamblaje.t;
    const inicio = performance.now();
    const dur = 500;
    const paso = (now) => {
      const k = Math.min((now - inicio) / dur, 1);
      const t = start + (destino - start) * k;
      this.ensamblaje.setExplosion(t);
      const slider = document.getElementById('exp');
      if (slider) slider.value = t;
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  _seleccionarEn(centro) {
    // Convertir a NDC (espejado horizontal)
    const ndcX = (1 - centro.x) * 2 - 1;
    const ndcY = -(centro.y * 2 - 1);
    const mesh = this.ensamblaje.obtenerPiezaDesdeNDC(ndcX, ndcY, this.camera);
    if (mesh && this.etiquetas) {
      this.etiquetas.mostrarInfo(mesh.userData.id);
    }
  }

  _detectarGesto(lm) {
    // Dedos extendidos (comparar y de punta vs y de nudillo)
    const dedos = [
      [8, 6],   // índice
      [12, 10], // medio
      [16, 14], // anular
      [20, 18], // meñique
    ];
    let extendidos = 0;
    for (const [punta, nudillo] of dedos) {
      if (lm[punta].y < lm[nudillo].y) extendidos++;
    }

    // Pellizco: pulgar (4) e índice (8) muy cerca
    const dx = lm[4].x - lm[8].x;
    const dy = lm[4].y - lm[8].y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05 && extendidos >= 1) return 'pinch';

    if (extendidos >= 4) return 'abierta';
    if (extendidos === 0) return 'puño';
    return 'otro';
  }

  _bindLoop() {
    // No hace nada; el loop lo maneja main.js
  }
}