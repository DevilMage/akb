/* Звуковые эффекты симулятора: перегорание компонентов, лопанье лампы,
   щелчок якоря реле.

   Публичный API:
     getAudioCtx()        — ленивая инициализация AudioContext
     playBurnSound()      — треск перегорания
     playLampPopSound()   — «поп» лампы
     playRelayClick(on)   — щелчок реле (on=true — срабатывание, on=false — отпускание)
     setEnabled(bool)     — вкл/выкл звук
     resume()             — разблокировать контекст (вызывается по клику)
*/
(function () {
  'use strict';

  window.SchematicApp = window.SchematicApp || {};

  let audioCtx = null;
  let soundEnabled = true;

  function getAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function setEnabled(v) { soundEnabled = !!v; }
  function isEnabled() { return soundEnabled; }

  // ---------------------------------------------------------------------------
  //  Короткий шумовой всплеск — основа для «щелчка» якоря
  // ---------------------------------------------------------------------------
  function noiseBurst(ac, t0, dur, gain, hpFreq, lpFreq, decay) {
    const buf = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / d.length;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;

    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hpFreq;

    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lpFreq;

    const g = ac.createGain();
    g.gain.value = gain;

    src.connect(hp).connect(lp).connect(g).connect(ac.destination);
    src.start(t0);
    return g;
  }

  function playBurnSound() {
    if (!soundEnabled) return;
    const ac = getAudioCtx(); if (!ac) return;
    const t0 = ac.currentTime;
    const dur = 0.6;
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / d.length;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.8) * (0.5 + 0.5 * Math.sin(t * 60));
    }
    const src = ac.createBufferSource(); src.buffer = buf;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 800;
    const g = ac.createGain(); g.gain.value = 0.45;
    src.connect(hp).connect(g).connect(ac.destination);
    src.start(t0);
  }

  function playLampPopSound() {
    if (!soundEnabled) return;
    const ac = getAudioCtx(); if (!ac) return;
    const t0 = ac.currentTime;
    const o1 = ac.createOscillator();
    o1.type = 'triangle';
    o1.frequency.setValueAtTime(2600, t0);
    o1.frequency.exponentialRampToValueAtTime(900, t0 + 0.18);
    const g1 = ac.createGain();
    g1.gain.setValueAtTime(0.28, t0);
    g1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    o1.connect(g1).connect(ac.destination);
    o1.start(t0); o1.stop(t0 + 0.3);

    const o2 = ac.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(4200, t0);
    o2.frequency.exponentialRampToValueAtTime(1500, t0 + 0.12);
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.15, t0);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    o2.connect(g2).connect(ac.destination);
    o2.start(t0); o2.stop(t0 + 0.18);
  }

  // ---------------------------------------------------------------------------
  //  Щелчок якоря реле
  //
  //  Модель: короткий ВЧ-шумовой «щелчок» + тонкий «тик» якоря. При
  //  срабатывании добавляется низкий «clunk» катушки. Отпускание — ниже
  //  по частоте и глуше.
  // ---------------------------------------------------------------------------
  function playRelayClick(on) {
    if (!soundEnabled) return;
    const ac = getAudioCtx(); if (!ac) return;
    const t0 = ac.currentTime;
    const up = !!on;

    // 1) Основной «щелчок» — высокочастотный шумовой всплеск ~ 8–12 мс
    noiseBurst(
      ac,
      t0,
      up ? 0.012 : 0.016,
      up ? 0.32 : 0.22,
      up ? 1800 : 1200,
      up ? 9000 : 7000,
      2.2
    );

    // 2) «Тик» якоря — короткий тон чуть позже, с быстрым затуханием
    const o1 = ac.createOscillator();
    o1.type = 'square';
    o1.frequency.setValueAtTime(up ? 1400 : 950, t0 + 0.004);
    o1.frequency.exponentialRampToValueAtTime(up ? 380 : 260, t0 + 0.035);
    const g1 = ac.createGain();
    g1.gain.setValueAtTime(0.0001, t0 + 0.004);
    g1.gain.exponentialRampToValueAtTime(up ? 0.14 : 0.10, t0 + 0.007);
    g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
    o1.connect(g1).connect(ac.destination);
    o1.start(t0 + 0.004);
    o1.stop(t0 + 0.055);

    // 3) Короткий низкий «clunk» от катушки — только при срабатывании
    if (up) {
      const o2 = ac.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(180, t0 + 0.002);
      o2.frequency.exponentialRampToValueAtTime(90, t0 + 0.03);
      const g2 = ac.createGain();
      g2.gain.setValueAtTime(0.0001, t0 + 0.002);
      g2.gain.exponentialRampToValueAtTime(0.08, t0 + 0.005);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
      o2.connect(g2).connect(ac.destination);
      o2.start(t0 + 0.002);
      o2.stop(t0 + 0.05);
    }
  }

  window.SchematicApp.audio = {
    getAudioCtx,
    playBurnSound,
    playLampPopSound,
    playRelayClick,
    setEnabled,
    isEnabled
  };
})();