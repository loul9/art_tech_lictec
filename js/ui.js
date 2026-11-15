export function initUI({ onCircuito, onTransparente, onAR, onVR, onGLB, onExplosion }) {
  document.getElementById('bCirc')?.addEventListener('click', onCircuito);
  document.getElementById('bTr')?.addEventListener('click', onTransparente);
  document.getElementById('bAR')?.addEventListener('click', onAR);
  document.getElementById('bVR')?.addEventListener('click', onVR);
  document.getElementById('glb')?.addEventListener('change', onGLB);
  document.getElementById('exp')?.addEventListener('input', (e) => {
    onExplosion(parseFloat(e.target.value));
  });
  document.getElementById('exitvr')?.addEventListener('click', () => {
    document.getElementById('bVR')?.click();
  });
  document.getElementById('go')?.addEventListener('click', () => {
    document.getElementById('start').style.display = 'none';
  });
}