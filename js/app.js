/* app.js — Bildschirme, Einstellungen, Verdrahtung.
 * Hauptmenü, Spielbildschirm, Ergebnis, Statistik, Bibliothek, Einstellungen.
 * Alles, was den DOM anfasst, wohnt hier; die Spielmechanik in game.js weiß
 * nichts von Knöpfen. */
"use strict";
window.NT = window.NT || {};

NT.app = (() => {
  const $ = id => document.getElementById(id);
  const G = NT.game, MU = NT.music, N = NT.notation;

  const DEFAULTS = { clef: "treble", keys: "white", naming: "de", low: 60, high: 81, hand: "r", bpm: 80,
    runLength: 24, phrases: 6, labels: true, ghost: true, sound: true, fx: true, shake: true, playback: "auto",
    library: null, scaleRoot: 0, scaleType: "dur", scaleOctaves: 1 };
  const settings = Object.assign({}, DEFAULTS);
  const pieces = [];               // geparste Stücke (Starter + importierte)
  let progress = { xp: 0 };
  let device = { pedal: {} };
  const pedalLive = { sustain: { down: false, value: 0 }, sostenuto: { down: false, value: 0 }, soft: { down: false, value: 0 } };
  const PEDAL_CC = { 64: "sustain", 66: "sostenuto", 67: "soft" };
  const PEDAL_NAME = { sustain: "Haltepedal", sostenuto: "Sostenuto", soft: "Una corda" };
  const held = new Set();
  let midiState = { kind: "busy", text: "MIDI wird gesucht…", real: [] };
  let current = "home";
  let lastPlayMode = "single";

  /* --- Level ------------------------------------------------------------- */
  const levelFor = xp => { let lv = 1; while (xp >= xpForLevel(lv + 1)) lv++; return lv; };
  const xpForLevel = lv => Math.round(100 * Math.pow(lv - 1, 1.5));
  function levelInfo() {
    const lv = levelFor(progress.xp), a = xpForLevel(lv), b = xpForLevel(lv + 1);
    return { level: lv, xp: progress.xp, into: progress.xp - a, span: b - a, pct: (progress.xp - a) / (b - a) };
  }

  /* --- Bildschirme ------------------------------------------------------- */
  function show(name) {
    if (current === "play" && name !== "play" && name !== "results") G.stop(name !== "home" ? true : false);
    current = name;
    document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === "screen-" + name));
    document.body.dataset.screen = name;
    if (name === "home") renderHome();
    if (name === "stats") renderStats();
    if (name === "library") renderLibrary();
    if (name === "settings") syncSettingsUi();
    if (name === "play") setTimeout(() => G.relayout() && G.draw(), 30);
  }

  function renderHome() {
    const li = levelInfo();
    $("homeLevel").textContent = li.level;
    $("homeXp").textContent = li.into + " / " + li.span + " XP";
    $("homeXpBar").style.width = Math.round(li.pct * 100) + "%";
    const sessions = G.history.length ? new Set(G.history.map(e => e.session)).size : 0;
    const hits = G.history.filter(e => e.correct).length;
    $("homeTotals").textContent = G.history.length ? `${G.history.length} Noten · ${Math.round(100 * hits / G.history.length)} % · ${sessions} Sitzungen` : "Noch kein Verlauf — leg los.";
  }

  /* --- Spielbildschirm ---------------------------------------------------- */
  const MODE_TITLE = { single: "Einzeln", run: "Lauf", phrase: "Stücke", scale: "Tonleiter", play: "Abspielen" };
  function startMode(mode, opts) {
    lastPlayMode = mode;
    show("play");
    $("playTitle").textContent = MODE_TITLE[mode] + (opts && opts.piece ? " · " + opts.piece.title : "");
    $("tempoRow").hidden = mode === "single";
    $("hud").classList.toggle("hidden", mode === "play");
    $("feedback").className = "feedback"; $("feedback").textContent = mode === "single" ? "Spiel die angezeigte Note." : mode === "play" ? "Hör zu — und schau, wie die Noten laufen." : "Triff die Note, wenn sie die Linie erreicht.";
    $("stopBtn").textContent = mode === "single" ? "Beenden" : "Abbrechen";
    NT.synth.unlock();
    G.start(mode, opts);
  }
  function hud(h) {
    const set = (id, v) => { const el = $(id); if (el.textContent !== String(v)) { el.textContent = v; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); } };
    set("hudStreak", h.streak);
    set("hudMult", "×" + h.multiplier);
    set("hudAcc", h.accuracy == null ? "–" : Math.round(h.accuracy * 100) + " %");
    set("hudXp", "+" + h.xp);
    $("hudProgress").style.width = h.progress == null ? "0%" : Math.round(h.progress * 100) + "%";
  }
  function feedback(kind, text) { const el = $("feedback"); el.className = "feedback " + kind; el.textContent = text; }
  // Wackeln bei Fehlern: abschaltbar, weil es beim Lesen der nächsten Note stört.
  function shake() { if (!settings.shake) return; const st = $("stage"); st.classList.remove("shake"); void st.offsetWidth; st.classList.add("shake"); }
  function sound(kind) { if (settings.fx) NT.synth.blip(kind); }

  // Abspielen: Piano über MIDI-Ausgang, sonst Synth.
  function playNote(n) {
    const durMs = Math.max(80, n.dur * (60000 / settings.bpm) * 0.9);
    const port = settings.playback !== "synth" ? NT.midi.output() : null;
    if (port && settings.playback !== "synth") {
      NT.midi.send(port, [0x90, n.midi, 90]);
      setTimeout(() => NT.midi.send(port, [0x80, n.midi, 0]), durMs);
      if (settings.playback === "midi") return;
      if (settings.playback === "auto") return;
    }
    NT.synth.noteOn(n.midi, 90);
    setTimeout(() => NT.synth.noteOff(n.midi), durMs);
  }

  function finish(res) {
    if (res.playback) { show(res.mode === "play" ? "library" : "home"); return; }
    progress.xp += res.xp; NT.store.kvSet("progress", progress);
    renderResults(res);
    show("results");
  }
  function renderResults(r) {
    const li = levelInfo();
    $("resTitle").textContent = r.accuracy == null ? "Nichts gespielt" : r.accuracy >= 0.9 ? "Stark!" : r.accuracy >= 0.7 ? "Gut gemacht" : "Weiter üben";
    $("resHits").textContent = r.hits; $("resMisses").textContent = r.misses;
    $("resAcc").textContent = r.accuracy == null ? "–" : Math.round(r.accuracy * 100) + " %";
    $("resStreak").textContent = r.bestStreak;
    $("resXp").textContent = "+" + r.xp + " XP";
    $("resTiming").textContent = r.avgOff != null ? (r.avgOff > 0 ? "+" : "") + Math.round(r.avgOff) + " ms " + (r.avgOff > 15 ? "(eher spät)" : r.avgOff < -15 ? "(eher früh)" : "(auf den Punkt)")
      : r.avgReact != null ? Math.round(r.avgReact) + " ms Reaktion" : "–";
    $("resEven").hidden = !r.evenness;
    if (r.evenness) $("resEven").textContent = `Gleichmäßigkeit: Abstände ±${Math.round(r.evenness.ioiSd)} ms, Anschlag-Spanne ${r.evenness.velRange}`;
    $("resLevel").textContent = "Level " + li.level; $("resLevelBar").style.width = Math.round(li.pct * 100) + "%";
    $("resWeak").innerHTML = r.weakest.length ? r.weakest.map(w => `<span class="chip miss">${MU.name(w.midi, settings.naming)} · ${w.bad}/${w.n}</span>`).join("") : "<span class='muted'>Keine Fehler — nichts zu bemängeln.</span>";
  }

  /* --- MIDI ---------------------------------------------------------------- */
  function onMidiMessage(data) {
    const [status, d1, d2] = data; const kind = status & 0xf0;
    const t = performance.now();
    if (kind === 0x90 && d2 > 0) { held.add(d1); NT.store.queue("input", { id: NT.store.newId(), t: Date.now(), at: t, type: "on", midi: d1, velocity: d2, session: G.S.session }); G.onNoteOn(d1, d2); renderChips(); }
    else if (kind === 0x80 || (kind === 0x90 && d2 === 0)) { held.delete(d1); NT.store.queue("input", { id: NT.store.newId(), t: Date.now(), at: t, type: "off", midi: d1, session: G.S.session }); renderChips(); }
    else if (kind === 0xb0 && PEDAL_CC[d1]) {
      const key = PEDAL_CC[d1], down = d2 >= 64;
      const p = device.pedal[key] = device.pedal[key] || { seen: false, between: false, min: 127, max: 0 };
      const changed = !p.seen || (d2 > 0 && d2 < 127 && !p.between) || d2 < p.min || d2 > p.max;
      p.seen = true; if (d2 > 0 && d2 < 127) p.between = true; p.min = Math.min(p.min, d2); p.max = Math.max(p.max, d2);
      if (changed) NT.store.kvSet("device", device);
      pedalLive[key].down = down; pedalLive[key].value = d2;
      NT.store.queue("input", { id: NT.store.newId(), t: Date.now(), at: t, type: "pedal", pedal: key, value: d2, down, session: G.S.session });
      renderChips();
    }
  }
  function renderChips() {
    const parts = [`<span class="chip ${held.size ? "on" : ""}"><i></i>Tasten <b>${held.size}</b></span>`];
    for (const key of ["sustain", "sostenuto", "soft"]) {
      const p = device.pedal[key]; if (!p || !p.seen) continue;
      parts.push(`<span class="chip ${pedalLive[key].down ? "on" : ""}"><i></i>${PEDAL_NAME[key]}${p.between ? ` <b>${pedalLive[key].value}</b>` : ""}</span>`);
    }
    $("chips").innerHTML = parts.join("");
  }
  function midiStatus(kind, text, info) {
    midiState = { kind, text, real: (info && info.real) || [] };
    for (const el of document.querySelectorAll(".midiChip")) { el.dataset.kind = kind; el.querySelector("span").textContent = kind === "live" ? "Verbunden: " + midiState.real.join(", ") : text; }
    $("connectBtn").hidden = !(info && info.retry) && kind !== "idle";
    $("midiDetail").textContent = text;
    renderOutputs();
  }
  function renderOutputs() {
    const sel = $("set-playback"); if (!sel) return;
    const outs = NT.midi.outputs();
    sel.innerHTML = `<option value="auto">Automatisch (Piano, sonst Synth)</option><option value="synth">Nur Synth</option><option value="midi">Nur Piano (MIDI-Ausgang)</option>`;
    $("outputsInfo").textContent = outs.length ? "MIDI-Ausgänge: " + outs.map(o => o.name).join(", ") : "Kein MIDI-Ausgang gefunden — es spielt der Synth.";
    sel.value = settings.playback;
  }

  /* --- Statistik ------------------------------------------------------------ */
  function renderStats() {
    const H = G.history;
    const hits = H.filter(e => e.correct).length;
    const sessions = new Map();
    for (const e of H) { const s = sessions.get(e.session) || { n: 0, hits: 0, t: e.t, mode: e.mode }; s.n++; if (e.correct) s.hits++; s.t = Math.min(s.t, e.t); sessions.set(e.session, s); }
    $("statTotals").innerHTML = `<div class="fig"><b>${H.length}</b><span>Noten</span></div><div class="fig"><b>${H.length ? Math.round(100 * hits / H.length) + " %" : "–"}</b><span>Treffer</span></div><div class="fig"><b>${sessions.size}</b><span>Sitzungen</span></div><div class="fig"><b>${levelInfo().level}</b><span>Level</span></div>`;
    const byNote = new Map();
    for (const e of H) { const v = byNote.get(e.midi) || { n: 0, bad: 0, off: [], react: [] }; v.n++; if (!e.correct) v.bad++; else if (typeof e.dueAt === "number") v.off.push(e.hitAt - e.dueAt); else v.react.push(e.hitAt - e.shownAt); byNote.set(e.midi, v); }
    const rows = Array.from(byNote.entries()).sort((a, b) => a[0] - b[0]);
    $("statNotes").innerHTML = rows.length ? rows.map(([midi, v]) => {
      const acc = 1 - v.bad / v.n, hue = Math.round(acc * 120);
      const timing = v.off.length ? Math.round(v.off.reduce((a, b) => a + b, 0) / v.off.length) + " ms" : v.react.length ? Math.round(v.react.reduce((a, b) => a + b, 0) / v.react.length) + " ms" : "–";
      return `<div class="bar"><span class="name">${MU.name(midi, settings.naming)}</span><div class="track"><div class="fill" style="width:${Math.round(acc * 100)}%;background:hsl(${hue} 80% 50%)"></div></div><span class="pct">${Math.round(acc * 100)} %</span><span class="n">${v.n}× · ${timing}</span></div>`;
    }).join("") : "<p class='muted'>Noch keine Daten.</p>";
    const list = Array.from(sessions.entries()).sort((a, b) => b[1].t - a[1].t).slice(0, 12);
    $("statSessions").innerHTML = list.length ? list.map(([id, s]) => `<div class="row"><span>${new Date(s.t).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span><span class="tag">${MODE_TITLE[s.mode] || s.mode}</span><span>${s.n} Noten</span><b>${Math.round(100 * s.hits / s.n)} %</b></div>`).join("") : "";
    const p = device.pedal;
    $("statPedal").textContent = Object.keys(p).filter(k => p[k].seen).length ? "Pedal: " + Object.keys(p).filter(k => p[k].seen).map(k => `${PEDAL_NAME[k]} — ${p[k].between ? "stufenlos, Werte " + p[k].min + "–" + p[k].max : "Schalter"}`).join(" · ") : "Pedal: noch nichts erkannt.";
    $("storeInfo").textContent = NT.store.available ? "Gespeichert in diesem Browser. Export/Import überträgt den Verlauf zwischen Geräten." : "Kein dauerhafter Speicher verfügbar (privater Modus?) — nur diese Sitzung.";
  }

  async function exportData() {
    const data = await NT.store.exportAll();
    const text = JSON.stringify(data);
    const name = "notentrainer-" + new Date().toISOString().slice(0, 10) + ".json";
    const blob = new Blob([text], { type: "application/json" });
    try {
      const file = new File([blob], name, { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Notentrainer-Verlauf" }); return; }
    } catch (e) { /* weiter zum Download */ }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    $("exportText").value = text; $("exportText").hidden = false;
  }
  async function importData(file) {
    try {
      const data = JSON.parse(await file.text());
      const counts = await NT.store.importAll(data);
      await loadHistory();
      alertBox(`Übernommen: ${counts.events} Noten, ${counts.input} Eingaben, ${counts.sessions} Sitzungen, ${counts.pieces} Stücke.`);
      renderStats();
    } catch (e) { alertBox("Import fehlgeschlagen: " + e.message); }
  }
  function alertBox(text) { const el = $("toast"); el.textContent = text; el.classList.add("show"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 3500); }

  /* --- Bibliothek ------------------------------------------------------------ */
  function renderLibrary() {
    const sel = new Set(settings.library || pieces.map(p => p.id));
    $("pieceList").innerHTML = pieces.map(p => `
      <div class="piece ${sel.has(p.id) ? "sel" : ""}" data-id="${p.id}">
        <label><input type="checkbox" ${sel.has(p.id) ? "checked" : ""} data-sel="${p.id}"> <b>${p.title}</b> <span class="muted">${p.composer}</span></label>
        <span class="muted small">${p.measures.length} Takte · ${p.staves === 2 ? "beide Hände" : "eine Hand"} · ${MU.keyName(p.fifths, settings.naming)} · ${p.time.beats}/${p.time.beatType}${p.tempo ? " · ♩ " + Math.round(p.tempo) : ""}</span>
        <div class="actions"><button data-play="${p.id}">▶ Abspielen</button>${p.source === "import" ? `<button data-del="${p.id}" class="ghostBtn">Entfernen</button>` : ""}</div>
      </div>`).join("");
    $("libHand").value = settings.hand;
    $("libEmpty").hidden = pieces.length > 0;
  }
  async function importPiece(file) {
    try {
      if (/\.mxl$/i.test(file.name)) throw new Error(".mxl ist gezippt — in MuseScore als „Unkomprimiertes MusicXML“ exportieren.");
      const xml = await file.text();
      const piece = NT.musicxml.parse(xml, { title: file.name.replace(/\.[^.]+$/, ""), source: "import" });
      await NT.store.put("pieces", { id: piece.id, title: piece.title, composer: piece.composer, xml, addedAt: Date.now() });
      pieces.push(piece);
      alertBox("Importiert: " + piece.title + " (" + piece.measures.length + " Takte)");
      renderLibrary();
    } catch (e) { alertBox("Import fehlgeschlagen: " + e.message); }
  }
  const selectedPieces = () => { const sel = new Set(settings.library || pieces.map(p => p.id)); return pieces.filter(p => sel.has(p.id)); };

  /* --- Einstellungen --------------------------------------------------------- */
  function syncSettingsUi() {
    for (const k of ["clef", "keys", "naming", "hand", "playback", "scaleType"]) if ($("set-" + k)) $("set-" + k).value = settings[k];
    $("set-scaleRoot").value = settings.scaleRoot;
    $("set-scaleOctaves").value = settings.scaleOctaves;
    for (const k of ["labels", "ghost", "sound", "fx", "shake"]) $("set-" + k).checked = !!settings[k];
    $("set-low").value = settings.low; $("set-high").value = settings.high;
    $("set-runLength").value = settings.runLength; $("set-phrases").value = settings.phrases;
    $("lowVal").textContent = MU.name(settings.low, settings.naming); $("highVal").textContent = MU.name(settings.high, settings.naming);
    $("set-bpm").value = settings.bpm; $("bpmVal").textContent = settings.bpm;
    renderOutputs();
  }
  function saveSettings() { NT.store.kvSet("settings", settings); }
  function bindSettings() {
    const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
    for (const k of ["clef", "keys", "naming", "hand", "playback", "scaleType"]) on("set-" + k, "change", e => { settings[k] = e.target.value; saveSettings(); if (k === "naming") syncSettingsUi(); });
    on("set-scaleRoot", "change", e => { settings.scaleRoot = +e.target.value; saveSettings(); });
    on("set-scaleOctaves", "change", e => { settings.scaleOctaves = +e.target.value; saveSettings(); });
    for (const k of ["labels", "ghost", "sound", "fx", "shake"]) on("set-" + k, "change", e => { settings[k] = e.target.checked; NT.synth.enabled = settings.sound; NT.synth.fx = settings.fx; saveSettings(); });
    const range = () => {
      let lo = +$("set-low").value, hi = +$("set-high").value;
      if (lo > hi) { if (document.activeElement === $("set-low")) hi = lo; else lo = hi; }
      settings.low = lo; settings.high = hi; $("set-low").value = lo; $("set-high").value = hi;
      $("lowVal").textContent = MU.name(lo, settings.naming); $("highVal").textContent = MU.name(hi, settings.naming); saveSettings();
    };
    on("set-low", "input", range); on("set-high", "input", range);
    on("set-runLength", "change", e => { settings.runLength = +e.target.value; saveSettings(); });
    on("set-phrases", "change", e => { settings.phrases = +e.target.value; saveSettings(); });
    const bpm = v => { settings.bpm = +v; $("bpmVal").textContent = v; $("tempoVal").textContent = v; $("tempo").value = v; $("set-bpm").value = v; saveSettings(); };
    on("set-bpm", "input", e => bpm(e.target.value));
    on("tempo", "input", e => { bpm(e.target.value); if (G.running && G.mode !== "single") G.start(G.mode, { pieces: selectedPieces(), piece: G.S.piece, hand: G.S.hand }); });
  }

  /* --- Start --------------------------------------------------------------- */
  async function loadHistory() {
    const rows = await NT.store.all("events");
    G.history.length = 0; for (const r of rows) G.history.push(r);
    G.history.sort((a, b) => (a.t || 0) - (b.t || 0));
  }
  async function init() {
    G.settings = settings;
    N.attach($("staff"));
    await NT.store.open();
    Object.assign(settings, DEFAULTS, (await NT.store.kvGet("settings")) || {});
    progress = (await NT.store.kvGet("progress")) || { xp: 0 };
    device = (await NT.store.kvGet("device")) || { pedal: {} };
    await loadHistory();
    NT.synth.enabled = settings.sound; NT.synth.fx = settings.fx;
    for (const p of NT.starterPieces) { try { pieces.push(NT.musicxml.parse(p.xml, { id: p.id, source: "starter" })); } catch (e) { console.error("Starter-Stück kaputt:", p.title, e); } }
    for (const r of await NT.store.all("pieces")) { try { pieces.push(NT.musicxml.parse(r.xml, { id: r.id, source: "import", title: r.title })); } catch (e) { console.error("Stück nicht lesbar:", r.title, e); } }

    G.hooks.hud = hud; G.hooks.feedback = feedback; G.hooks.finish = finish; G.hooks.shake = shake; G.hooks.sound = sound; G.hooks.play = playNote;
    NT.midi.onMessage = onMidiMessage; NT.midi.onStatus = midiStatus;

    // Menü
    document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => { NT.synth.unlock(); show(b.dataset.go); }));
    document.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => {
      const mode = b.dataset.mode;
      if (mode === "phrase") { const sel = selectedPieces(); if (!sel.length) { alertBox("Erst Stücke in der Bibliothek auswählen."); show("library"); return; } startMode("phrase", { pieces: sel, hand: settings.hand }); }
      else startMode(mode);
    }));
    $("stopBtn").addEventListener("click", () => { if (G.running) G.stop(false); else show("home"); if (!G.running && current === "play") show("home"); });
    $("againBtn").addEventListener("click", () => { if (lastPlayMode === "phrase") startMode("phrase", { pieces: selectedPieces(), hand: settings.hand }); else startMode(lastPlayMode); });
    $("connectBtn").addEventListener("click", () => { $("connectBtn").hidden = true; NT.midi.init(); });
    document.querySelectorAll(".midiChip").forEach(el => el.addEventListener("click", () => show("settings")));
    $("tempo").min = 30; $("tempo").max = 200; $("tempoVal").textContent = settings.bpm; $("tempo").value = settings.bpm;
    bindSettings();

    // Bibliothek
    $("pieceList").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      const p = pieces.find(x => x.id === (b.dataset.play || b.dataset.del));
      if (b.dataset.play && p) startMode("play", { piece: p, hand: settings.hand });
      if (b.dataset.del && p) { NT.store.del("pieces", p.id); pieces.splice(pieces.indexOf(p), 1); renderLibrary(); }
    });
    $("pieceList").addEventListener("change", e => {
      if (!e.target.dataset.sel) return;
      const sel = new Set(settings.library || pieces.map(p => p.id));
      e.target.checked ? sel.add(e.target.dataset.sel) : sel.delete(e.target.dataset.sel);
      settings.library = Array.from(sel); saveSettings(); renderLibrary();
    });
    $("libHand").addEventListener("change", e => { settings.hand = e.target.value; saveSettings(); });
    $("importPiece").addEventListener("change", e => { for (const f of e.target.files) importPiece(f); e.target.value = ""; });
    $("libPlayBtn").addEventListener("click", () => { const sel = selectedPieces(); if (sel.length) startMode("phrase", { pieces: sel, hand: settings.hand }); });

    // Statistik
    $("exportBtn").addEventListener("click", exportData);
    $("importBtn").addEventListener("change", e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; });
    $("wipeBtn").addEventListener("click", () => {
      const b = $("wipeBtn");
      if (b.dataset.armed) { NT.store.wipe().then(() => { G.history.length = 0; progress = { xp: 0 }; renderStats(); alertBox("Verlauf gelöscht."); }); b.dataset.armed = ""; b.textContent = "Verlauf löschen"; return; }
      b.dataset.armed = "1"; b.textContent = "Wirklich löschen? Nochmal tippen"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Verlauf löschen"; }, 4000);
    });

    // Vollbild, Wake Lock, Größe
    const root = document.documentElement, fs = $("fullBtn");
    if (!(root.requestFullscreen || root.webkitRequestFullscreen)) fs.hidden = true;
    fs.addEventListener("click", () => { const active = document.fullscreenElement || document.webkitFullscreenElement; if (active) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else { const p = (root.requestFullscreen || root.webkitRequestFullscreen).call(root); if (p && p.catch) p.catch(() => {}); } });
    keepAwake(); document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(); });
    new ResizeObserver(() => { if (current === "play") { G.relayout(); G.draw(); } }).observe($("staff"));
    document.addEventListener("keydown", e => { if (e.key === "Escape" && current !== "home") show(current === "play" ? "home" : "home"); });
    window.addEventListener("error", e => alertBox("Fehler: " + (e.message || e.type)));
    window.addEventListener("unhandledrejection", e => alertBox("Fehler: " + ((e.reason && e.reason.message) || e.reason)));

    document.fonts.load('10px "NotenSymbole"').catch(() => {}).then(() => { if (current === "play") G.draw(); });
    renderChips(); syncSettingsUi(); show("home");
    NT.midi.init();
  }
  let wakeLock = null;
  async function keepAwake() { if (!navigator.wakeLock || wakeLock) return; try { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } catch (e) {} }

  document.addEventListener("DOMContentLoaded", init);
  return { settings, pieces, show, startMode, get midiState() { return midiState; } };
})();
