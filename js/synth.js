/* synth.js: Web Audio als Rückfall zum Abspielen (kein Piano am Gerät) und
 * für die kleinen Spielgeräusche. Kein Anspruch auf Klavierklang: zwei
 * Teiltöne mit Hüllkurve, das reicht, um ein Stück zu erkennen. Der
 * AudioContext entsteht erst bei der ersten Nutzeraktion, vorher lässt
 * iOS ihn nicht laufen. */
"use strict";
window.NT = window.NT || {};

NT.synth = (() => {
  let ac = null, master = null, enabled = true, fxEnabled = true;
  const voices = new Map();   // midi -> { gain, oscs }

  function ctx() {
    if (ac) { if (ac.state === "suspended") ac.resume().catch(() => {}); return ac; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
    return ac;
  }
  const unlock = () => { ctx(); };
  const freq = midi => 440 * Math.pow(2, (midi - 69) / 12);

  function noteOn(midi, velocity, when) {
    if (!enabled) return;
    const a = ctx(); if (!a) return;
    noteOff(midi, when);
    const t = when || a.currentTime;
    const v = Math.max(0.05, (velocity || 80) / 127);
    const g = a.createGain(); g.connect(master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.12 * v, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.03 * v, t + 2.5);
    const oscs = [["triangle", 1, 1], ["sine", 2, 0.35], ["sine", 3, 0.12]].map(([type, mul, amp]) => {
      const o = a.createOscillator(); const og = a.createGain();
      o.type = type; o.frequency.value = freq(midi) * mul; og.gain.value = amp;
      o.connect(og); og.connect(g); o.start(t); return o;
    });
    voices.set(midi, { gain: g, oscs, started: t });
  }
  function noteOff(midi, when) {
    const a = ac; const v = voices.get(midi); if (!a || !v) return;
    const t = Math.max(when || a.currentTime, v.started + 0.02);
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), t);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    for (const o of v.oscs) o.stop(t + 0.2);
    voices.delete(midi);
  }
  function allOff() { for (const m of Array.from(voices.keys())) noteOff(m); }

  // Spielgeräusche: kurz, hell, nicht nervig. Treffer steigt, Fehler fällt.
  function blip(kind) {
    if (!fxEnabled) return;
    const a = ctx(); if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.connect(g); g.connect(master);
    if (kind === "hit") { o.type = "sine"; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.08); }
    else if (kind === "miss") { o.type = "square"; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.12); }
    else if (kind === "streak") { o.type = "sine"; o.frequency.setValueAtTime(1046, t); o.frequency.setValueAtTime(1318, t + 0.06); o.frequency.setValueAtTime(1568, t + 0.12); }
    else { o.type = "sine"; o.frequency.setValueAtTime(660, t); }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(kind === "miss" ? 0.08 : 0.06, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "streak" ? 0.3 : 0.16));
    o.start(t); o.stop(t + 0.32);
  }

  return { unlock, noteOn, noteOff, allOff, blip,
           set enabled(v) { enabled = !!v; if (!enabled) allOff(); }, get enabled() { return enabled; },
           set fx(v) { fxEnabled = !!v; }, get fx() { return fxEnabled; },
           get context() { return ac; } };
})();
