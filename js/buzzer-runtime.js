/* Звуковоспроизведение пьезодинамиков через Web Audio API.
   Управляется из arduino-runtime.js через API tone()/noTone().

   Публичный API:
     attach(comp)        — привязать динамик к аудиоконтексту
     setTone(comp, freq, durationMs) — включить тон
     noTone(comp)        — выключить тон
     stopAll()           — выключить все динамики
     getAudioCtx()       — доступ к общему AudioContext (тот же, что в audio.js)

   Регистрируется в window.BuzzerRuntime.
*/
(function () {
  'use strict';

  const Snd = window.SchematicApp && window.SchematicApp.audio;
  const state = new WeakMap();   // comp → { osc, gain, timer }

  function getAudioCtx() {
    if (Snd && typeof Snd.getAudioCtx === 'function') return Snd.getAudioCtx();
    return null;
  }

  function ensure(comp) {
    const ac = getAudioCtx();
    if (!ac) return null;

    let s = state.get(comp);
    if (!s) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'square';
      osc.frequency.value = 440;
      gain.gain.value = 0;
      osc.connect(gain).connect(ac.destination);
      osc.start();
      s = { osc, gain, timer: null };
      state.set(comp, s);
    }
    return s;
  }

  function setTone(comp, freq, durationMs) {
    if (!comp) return;
    const ac = getAudioCtx();
    if (!ac) return;

    const s = ensure(comp);
    if (!s) return;

    const f = Math.max(20, Math.min(20000, Number(freq) || 0));
    if (f <= 0) { noTone(comp); return; }

    s.osc.frequency.setValueAtTime(f, ac.currentTime);
    s.gain.gain.cancelScheduledValues(ac.currentTime);
    s.gain.gain.setTargetAtTime(0.12, ac.currentTime, 0.005);

    comp.buzzFreq = f;
    comp.buzzVol = 1;
    comp._freq = f;

    if (s.timer) { clearTimeout(s.timer); s.timer = null; }

    if (durationMs && durationMs > 0) {
      s.timer = setTimeout(() => {
        s.timer = null;
        noTone(comp);
      }, durationMs);
    }
  }

  function noTone(comp) {
    if (!comp) return;
    const s = state.get(comp);
    if (s) {
      const ac = getAudioCtx();
      if (ac) {
        s.gain.gain.cancelScheduledValues(ac.currentTime);
        s.gain.gain.setTargetAtTime(0, ac.currentTime, 0.01);
      }
      if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    }
    comp.buzzFreq = 0;
    comp.buzzVol = 0;
    comp._freq = 0;
  }

  function stopAll() {
    // остановить все известные динамики
    // WeakMap не итерируем — проходим по window.components
    const comps = (window.SchematicApp && window.SchematicApp.getComponents)
      ? window.SchematicApp.getComponents()
      : [];
    for (const c of comps) if (c && c.type === 'buzzer') noTone(c);
  }

  function attach(comp) {
    // просто гарантируем наличие AudioContext
    getAudioCtx();
    if (comp && comp.buzzFreq) setTone(comp, comp.buzzFreq, 0);
  }

  window.BuzzerRuntime = {
    attach,
    setTone,
    noTone,
    stopAll,
    getAudioCtx
  };
})();