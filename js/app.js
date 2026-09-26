/* app.js: Bildschirme, Einstellungen, Verdrahtung.
 * Hauptmenü, Abenteuer-Karte, Spielbildschirm, Quiz, Ergebnis, Statistik,
 * Bibliothek, Einstellungen. Alles, was den DOM anfasst, wohnt hier; die
 * Spielmechanik in game.js weiß nichts von Knöpfen, die Levelliste in
 * story.js nichts vom Bildschirm. */
"use strict";
window.NT = window.NT || {};

NT.app = (() => {
  const $ = id => document.getElementById(id);
  const G = NT.game, MU = NT.music, N = NT.notation, ST = NT.story;

  const DEFAULTS = { clef: "treble", keys: "white", naming: "de", low: 60, high: 81, hand: "r", bpm: 80,
    runLength: 24, phrases: 6, labels: "name", ghost: true, sound: true, fx: true, shake: true, playback: "auto",
    library: null, scaleRoot: 0, scaleType: "dur", scaleOctaves: 1,
    metronome: false, countIn: true, lookahead: 0, tempoLadder: false, dailyGoal: 100,
    intervalMax: 5, rhythmBars: 8, rhythmSet: 3, rhythmRests: false, quizCount: 20, quizKind: "note" };
  const settings = Object.assign({}, DEFAULTS);
  const pieces = [];               // geparste Stücke (Starter + importierte)
  let progress = { xp: 0 };
  let story = { levels: {} };      // Abenteuer-Fortschritt, kv "story"
  let device = { pedal: {} };
  const pedalLive = { sustain: { down: false, value: 0 }, sostenuto: { down: false, value: 0 }, soft: { down: false, value: 0 } };
  const PEDAL_CC = { 64: "sustain", 66: "sostenuto", 67: "soft" };
  const PEDAL_NAME = { sustain: "Haltepedal", sostenuto: "Sostenuto", soft: "Una corda" };
  const held = new Set();
  let midiState = { kind: "busy", text: "MIDI wird gesucht…", real: [] };
  let current = "home";
  let lastMode = "single", lastOpts = {}, lastResults = null;
  let storyLevel = null;           // das Level, das gerade läuft (oder null beim freien Üben)
  let bookReturn = "home", bookLevel = null;   // wohin „Zurück“ im Handbuch führt
  let plan = null;                 // Aufwärmprogramm: { steps: [{mode, opts}], i }

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
    if (current === "quiz" && name !== "quiz" && name !== "results") NT.quiz.stop();
    if (current === "book" && name !== "book") NT.book.leave();
    if (name !== "story") closeModal();
    current = name;
    document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === "screen-" + name));
    document.body.dataset.screen = name;
    if (name === "home") renderHome();
    if (name === "stats") renderStats();
    if (name === "library") renderLibrary();
    if (name === "settings") syncSettingsUi();
    if (name === "story") renderMap();
    if (name === "book") NT.book.render();
    if (name === "play") setTimeout(() => G.relayout() && G.draw(), 30);
    if (name === "quiz") setTimeout(NT.quiz.draw, 30);
  }

  function renderHome() {
    const li = levelInfo();
    $("homeLevel").textContent = li.level;
    $("homeXp").textContent = li.into + " / " + li.span + " XP";
    $("homeXpBar").style.width = Math.round(li.pct * 100) + "%";
    const sessions = G.history.length ? new Set(G.history.map(e => e.session)).size : 0;
    const hits = G.history.filter(e => e.correct).length;
    $("homeTotals").textContent = G.history.length ? `${G.history.length} Noten · ${Math.round(100 * hits / G.history.length)} % · ${sessions} Sitzungen` : "Noch kein Verlauf, leg los.";
    const cur = ST.current(story), tot = ST.totals(story);
    $("storyHint").textContent = tot.done >= tot.count ? "Alle Welten geschafft. Sterne sammeln!" : `Welt ${cur.world.n} · Level ${cur.index}: ${cur.title}`;
    $("storyStars").textContent = "★ " + tot.stars;
    // Heute: Tagesziel, Serie, Empfehlung
    const td = todayStats();
    $("todayCount").textContent = td.today; $("todayGoal").textContent = td.goal || "∞";
    const ring = $("todayRing"), pct = td.goal ? Math.min(1, td.today / td.goal) : 0;
    $("ringFill").style.strokeDashoffset = (163.4 * (1 - pct)).toFixed(1);
    ring.classList.toggle("done", td.goal > 0 && td.today >= td.goal);
    $("streakDays").textContent = td.streak === 1 ? "Serie: 1 Tag" : `Serie: ${td.streak} Tage`;
    const rec = recommend();
    $("recoText").textContent = rec.text; $("recoBtn").textContent = rec.label; $("recoBtn").onclick = rec.go;
  }

  /* --- Heute: Tagesziel, Uebe-Serie, Empfehlung ----------------------------- */
  const dayKey = t => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  function todayStats() {
    const counts = new Map();
    for (const e of G.history) { const k = dayKey(e.t || 0); counts.set(k, (counts.get(k) || 0) + 1); }
    const goal = settings.dailyGoal || 0, min = goal ? Math.min(goal, 20) : 20;
    const today = counts.get(dayKey(Date.now())) || 0;
    // Serie: ein Tag zählt ab 20 Noten (oder dem kleineren Tagesziel). Heute
    // darf noch offen sein, sonst wäre die Serie morgens immer null.
    let streak = 0; const d = new Date(); d.setHours(12, 0, 0, 0);
    if ((counts.get(dayKey(+d)) || 0) < min) d.setDate(d.getDate() - 1);
    while ((counts.get(dayKey(+d)) || 0) >= min && streak < 3650) { streak++; d.setDate(d.getDate() - 1); }
    return { today, goal, streak };
  }
  // Die schwächste Note der letzten 400 Ereignisse, wenn sie oft genug dran war.
  function weakSpot() {
    const H = G.history.slice(-400), by = new Map();
    for (const e of H) { if (e.midi == null || e.mode === "rhythm") continue; const v = by.get(e.midi) || { n: 0, bad: 0 }; v.n++; if (!e.correct) v.bad++; by.set(e.midi, v); }
    const weak = Array.from(by.entries()).filter(([, v]) => v.n >= 5 && v.bad / v.n >= 0.25).sort((a, b) => b[1].bad / b[1].n - a[1].bad / a[1].n);
    if (!weak.length) return null;
    const midi = weak[0][0], v = weak[0][1];
    return { midi, err: v.bad / v.n, override: { clef: midi < 60 ? "bass" : "treble", low: Math.max(21, midi - 5), high: Math.min(108, midi + 5), keys: MU.isBlack(midi) ? "all" : "white" } };
  }
  function recommend() {
    if (!G.history.length) return { text: "Starte das Abenteuer: Welt 1 führt dich Schritt für Schritt hinein.", label: "Abenteuer", go: () => show("story") };
    const w = weakSpot();
    if (w) return { text: `${MU.name(w.midi, settings.naming)} sitzt noch nicht (${Math.round(w.err * 100)} % daneben). Ein Lauf rund um diese Note hilft.`, label: "Lauf starten",
                    go: () => startMode("run", { override: w.override, title: "Empfehlung" }) };
    const timed = G.history.filter(e => e.correct && typeof e.dueAt === "number").slice(-60);
    if (timed.length >= 20) {
      const off = mean(timed.map(e => e.hitAt - e.dueAt));
      if (Math.abs(off) > 35) return { text: `Du spielst im Schnitt ${Math.round(Math.abs(off))} ms ${off > 0 ? "zu spät" : "zu früh"}. Ein Lauf mit Metronom schärft den Puls.`, label: "Lauf mit Metronom",
                                        go: () => startMode("run", { override: { metronome: true }, title: "Mit Metronom" }) };
    }
    const cur = ST.current(story);
    return { text: `Weiter im Abenteuer: ${cur.title} (Welt ${cur.world.n}, Level ${cur.index}).`, label: "Zum Level", go: () => { show("story"); openLevel(cur); } };
  }
  // Aufwärmen: Tonleiter, dann ein Lauf um die schwache Stelle, dann Phrasen.
  function startWarmup() {
    const steps = [{ mode: "scale", opts: { title: "Aufwärmen 1/3" } }];
    const w = weakSpot();
    steps.push({ mode: "run", opts: { override: w ? w.override : {}, title: "Aufwärmen 2/3" } });
    const sel = selectedPieces();
    if (sel.length) steps.push({ mode: "phrase", opts: { pieces: sel, hand: settings.hand, title: "Aufwärmen 3/3" } });
    plan = { steps, i: 0 };
    startMode(steps[0].mode, steps[0].opts);
  }

  /* --- Abenteuer: Karte und Level-Karte ------------------------------------- */
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const starText = n => "<b>" + "★".repeat(n) + "</b>" + "★".repeat(3 - n);
  const DECO = ["♪", "♫", "♩", "♬", "✦", "★", "◆", "●"];
  function smoothPath(pts) {
    if (pts.length < 2) return "";
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)},${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)},${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x},${p2.y}`;
    }
    return d;
  }
  let mapWidth = 0;
  function renderMap() {
    const wrap = $("mapScroll"), map = $("map");
    const W = wrap.clientWidth || 800; mapWidth = W;
    const LV = ST.LEVELS, STEP = 110, BANNER = 130, PAD = 110;
    const A = Math.min(250, W * 0.3), cx = W / 2;
    // Level 1 liegt unten, es geht nach oben; vor jeder neuen Welt ein Banner.
    const yUp = []; let acc = PAD, lastW = null;
    LV.forEach(l => { if (lastW && l.world !== lastW) acc += BANNER; lastW = l.world; yUp.push(acc + 30); acc += STEP; });
    const H = acc + PAD;
    map.style.height = H + "px";
    const pos = LV.map((l, i) => ({ x: Math.round(cx + A * Math.sin(i * 0.8)), y: Math.round(H - yUp[i]) }));
    const cur = ST.current(story), curIdx = LV.indexOf(cur);
    const tot = ST.totals(story);
    $("storyTotal").textContent = `★ ${tot.stars} / ${tot.max}`;
    let html = "";
    ST.WORLDS.forEach((w, wi) => {
      const f = LV.indexOf(w.levels[0]), l = LV.indexOf(w.levels[w.levels.length - 1]);
      // Sterne haengen bis etwa 60 px unter der Knotenmitte; das Banner beginnt darunter.
      const bannerY = wi === 0 ? pos[f].y + 100 : pos[f].y + STEP / 2 + BANNER / 2;
      const top = pos[l].y - STEP * 0.62, bottom = bannerY + 44;
      html += `<div class="world" style="top:${top}px;height:${bottom - top}px;background:linear-gradient(180deg,${rgba(w.colors[0], .38)},${rgba(w.colors[1], .16)})"></div>`;
      // Deko: feste Pseudozufallsplätze je Welt, damit die Karte nicht flackert.
      for (let k = 0; k < 9; k++) {
        const s1 = Math.sin((wi + 1) * 13.7 + k * 7.3) * 0.5 + 0.5, s2 = Math.sin((wi + 1) * 5.1 + k * 3.9) * 0.5 + 0.5;
        html += `<span class="deco" style="left:${Math.round(4 + s1 * 92)}%;top:${Math.round(top + 20 + s2 * (bottom - top - 60))}px;font-size:${18 + Math.round(s2 * 22)}px;--r:${Math.round(s1 * 60 - 30)}deg;--dur:${(5 + s2 * 4).toFixed(1)}s;--delay:${(-s1 * 6).toFixed(1)}s">${DECO[(wi + k) % DECO.length]}</span>`;
      }
      const unlockedWorld = ST.isUnlocked(story, w.levels[0]);
      html += `<div class="worldBanner" style="--wa:${w.colors[0]};--wb:${w.colors[1]};top:${bannerY}px;${unlockedWorld ? "" : "filter:saturate(.3);opacity:.75"}"><div class="display">Welt ${w.n}: ${w.title}</div><small>${w.sub}</small></div>`;
    });
    const full = smoothPath(pos), open = smoothPath(pos.slice(0, Math.max(2, curIdx + 1)));
    html += `<svg><path d="${full}" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="16" stroke-linecap="round"/>` +
            `<path d="${full}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="7" stroke-dasharray="14 12" stroke-linecap="round"/>` +
            `<path d="${open}" fill="none" stroke="#fff" stroke-width="7" stroke-dasharray="14 12" stroke-linecap="round"/></svg>`;
    LV.forEach((l, i) => {
      const w = l.world, unlocked = ST.isUnlocked(story, l), stars = ST.starsOf(story, l);
      const cls = ["node", l.boss ? "boss" : "", unlocked ? "" : "locked", l === cur ? "current" : ""].filter(Boolean).join(" ");
      html += `<button class="${cls}" data-level="${l.id}" style="left:${pos[i].x}px;top:${pos[i].y}px;--wa:${w.colors[0]};--wb:${w.colors[1]}" title="${l.title}"><span class="display">${l.index}</span><span class="stars">${starText(stars)}</span></button>`;
      if (l === cur) html += `<div class="marker" style="left:${pos[i].x}px;top:${pos[i].y}px"><span>♪</span></div>`;
    });
    map.innerHTML = html;
    wrap.scrollTop = Math.max(0, pos[curIdx].y - wrap.clientHeight * 0.6);
  }
  function openLevel(l) {
    const w = l.world, unlocked = ST.isUnlocked(story, l), p = story.levels[l.id];
    const prev = ST.LEVELS[ST.LEVELS.indexOf(l) - 1];
    $("levelCard").innerHTML = `
      <div class="levelHead" style="--wa:${w.colors[0]};--wb:${w.colors[1]}"><div class="small">Welt ${w.n}: ${w.title} · Level ${l.index}${l.boss ? " · Boss" : ""}</div><div class="display">${l.title}</div></div>
      <div class="levelBody">
        <p style="margin:0">${ST.describe(l, settings.naming, pieces)}</p>
        <div class="goalRow">${l.stars.map((th, i) => `<span class="goal"><b>${"★".repeat(i + 1)}</b> ab ${th} %</span>`).join("")}<span class="goal">Weiter ab <b>★★</b></span></div>
        ${l.tip ? `<p class="small muted" style="margin:6px 0">${l.tip}</p>` : ""}
        <p class="small" style="margin:6px 0">${p ? `Bisher: ${starText(p.stars)} · beste Quote ${p.best} % · ${p.attempts} ${p.attempts === 1 ? "Versuch" : "Versuche"}` : "Noch nicht gespielt."}</p>
        ${unlocked ? "" : `<p class="small" style="color:var(--c2);margin:6px 0">Gesperrt: hol dir erst zwei Sterne in Level ${prev.index} (${prev.title}).</p>`}
        <div class="actions">${unlocked ? `<button class="gold display" id="levelGo">Los!</button>` : ""}<button class="ghostBtn" id="levelHelp">Erklärung</button><button class="ghostBtn" id="levelClose">Schließen</button></div>
      </div>`;
    $("levelModal").hidden = false;
    const go = $("levelGo"); if (go) go.addEventListener("click", () => { closeModal(); startLevel(l); });
    $("levelClose").addEventListener("click", closeModal);
    $("levelHelp").addEventListener("click", () => openBook(NT.book.forMode(l.mode), "story", l));
  }
  function closeModal() { const m = $("levelModal"); if (m && !m.hidden) m.hidden = true; }
  // Handbuch aus dem Spiel oder von der Level-Karte: merkt sich den Rueckweg.
  function openBook(chapter, from, level) {
    bookReturn = from || "home"; bookLevel = level || null;
    NT.book.open(chapter, 0);
    show("book");
  }
  function startLevel(l) {
    const { mode, opts } = ST.optsFor(l, pieces);
    if (l.pieceId && !opts.piece) { alertBox("Das Stück für dieses Level fehlt in der Bibliothek."); return; }
    plan = null;
    startMode(mode, opts);
  }

  /* --- Spielbildschirm ---------------------------------------------------- */
  const MODE_TITLE = { single: "Einzeln", ear: "Gehör", run: "Lauf", interval: "Intervalle", rhythm: "Rhythmus", phrase: "Stücke", scale: "Tonleiter", piece: "Stück", play: "Abspielen", quiz: "Quiz" };
  const MODE_HINT = { single: "Spiel die angezeigte Note.", ear: "Hör den Ton und such die Taste. Nach einem Fehler sagt die Anzeige, ob es höher oder tiefer geht.",
    run: "Triff die Note, wenn sie die Linie erreicht.", interval: "Die Beschriftung sagt, wohin es von der vorigen Note geht. Die erste Note ist dein Anker.",
    rhythm: "Klopf den Rhythmus mit einer beliebigen Taste. Nur der Zeitpunkt zählt.", scale: "Gleichmäßig rauf und runter, im Tempo.",
    phrase: "Triff die Note, wenn sie die Linie erreicht.", piece: "Das ganze Stück, von vorn bis hinten.", play: "Hör zu und schau, wie die Noten laufen." };
  function startMode(mode, opts) {
    opts = opts || {};
    if (mode === "quiz") {
      lastMode = "quiz"; lastOpts = opts; storyLevel = null;
      const kind = opts.kind || settings.quizKind || "note";
      settings.quizKind = kind; saveSettings();
      show("quiz"); $("quizKind").value = kind;
      NT.synth.unlock(); NT.quiz.start(kind, settings);
      return;
    }
    lastMode = mode; lastOpts = opts; storyLevel = opts.level || null;
    show("play");
    const lvl = storyLevel;
    $("playTitle").textContent = lvl ? `Welt ${lvl.world.n} · Level ${lvl.index}: ${lvl.title}`
      : MODE_TITLE[mode] + (opts.title ? " · " + opts.title : "") + (opts.piece ? " · " + opts.piece.title : "");
    $("tempoRow").hidden = G.STATIC.includes(mode) || !!(opts.override && opts.override.bpm);
    $("hearBtn").hidden = mode !== "ear";
    $("hud").classList.toggle("hidden", mode === "play");
    $("feedback").className = "feedback"; $("feedback").textContent = (lvl && lvl.tip) ? lvl.tip : MODE_HINT[mode] || "";
    $("stopBtn").textContent = G.STATIC.includes(mode) && !lvl ? "Beenden" : "Abbrechen";
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
  function click(accent, atMs) { NT.synth.click(accent, NT.synth.timeFor(atMs)); }
  function count(n) { const el = $("countIn"); if (n == null) { el.hidden = true; el.innerHTML = ""; } else { el.hidden = false; el.innerHTML = `<span>${n}</span>`; } }

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

  /* --- Ergebnis --------------------------------------------------------------- */
  function finish(res) {
    lastResults = res;
    if (res.playback) { show(lastOpts.fromLibrary ? "library" : "home"); return; }
    if (res.aborted && storyLevel) { storyLevel = null; show("story"); alertBox("Level abgebrochen, kein Stern."); return; }
    if (res.aborted) plan = null;
    let stars = null, bonus = 0, ladder = null, planText = null;
    const lvl = storyLevel;
    if (lvl) {
      stars = ST.starsFor(lvl, res);
      const p = story.levels[lvl.id] || { stars: 0, best: 0, attempts: 0 };
      p.attempts++; p.stars = Math.max(p.stars, stars); p.best = Math.max(p.best, Math.round((res.accuracy || 0) * 100)); p.at = Date.now();
      story.levels[lvl.id] = p; NT.store.kvSet("story", story);
      bonus = stars * 25 + (stars >= 2 && lvl.boss ? 50 : 0);
      if (res.sessionRow) NT.store.put("sessions", Object.assign(res.sessionRow, { level: lvl.id, stars }));
    } else if (settings.tempoLadder && res.timed && res.accuracy != null && !res.aborted && res.mode !== "play") {
      // Tempo-Leiter: nur beim freien, gezeiteten Üben.
      const old = settings.bpm;
      if (res.accuracy >= 0.9) settings.bpm = Math.min(200, old + 5); else if (res.accuracy < 0.7) settings.bpm = Math.max(30, old - 5);
      if (settings.bpm !== old) { saveSettings(); syncTempoUi(); ladder = `Tempo-Leiter: nächste Runde ${settings.bpm} Schläge/min (${res.accuracy >= 0.9 ? "schneller" : "langsamer"}).`; }
      else ladder = `Tempo-Leiter: Tempo bleibt bei ${old}. Ab 90 % geht es hoch.`;
    }
    if (plan) { plan.i++; if (plan.i < plan.steps.length) planText = `Aufwärmen: Runde ${plan.i} von ${plan.steps.length} geschafft.`; else { planText = "Aufwärmen abgeschlossen."; plan = null; } }
    progress.xp += res.xp + bonus; NT.store.kvSet("progress", progress);
    renderResults(res, { level: lvl, stars, bonus, ladder, planText });
    show("results");
  }
  let starTimers = [];
  function renderResults(r, x) {
    x = x || {};
    const li = levelInfo(), lvl = x.level || null;
    $("resTitle").textContent = r.accuracy == null ? "Nichts gespielt"
      : lvl ? (x.stars >= 3 ? "Perfekt!" : x.stars >= 2 ? "Level geschafft!" : x.stars === 1 ? "Fast!" : "Noch nicht")
      : r.accuracy >= 0.9 ? "Stark!" : r.accuracy >= 0.7 ? "Gut gemacht" : "Weiter üben";
    const sub = lvl ? `Welt ${lvl.world.n} · Level ${lvl.index}: ${lvl.title}` : r.kind ? "Quiz: " + NT.quiz.KIND_TITLE[r.kind] : x.planText || "";
    $("resSub").hidden = !sub; $("resSub").textContent = sub;
    // Sterne: nacheinander aufleuchten, mit Klang.
    const stars = $("resStars"); stars.hidden = !lvl;
    for (const t of starTimers) clearTimeout(t); starTimers = [];
    stars.querySelectorAll("span").forEach(s => s.classList.remove("lit"));
    if (lvl) {
      stars.querySelectorAll("span").forEach((s, i) => { if (i < x.stars) starTimers.push(setTimeout(() => { s.classList.add("lit"); sound("star"); }, 350 + i * 380)); });
      starTimers.push(setTimeout(() => sound(x.stars >= 2 ? "win" : "lose"), 350 + Math.max(0, x.stars) * 380 + 120));
      $("resGoal").hidden = false;
      $("resGoal").textContent = (x.stars < 3 ? `Für ${x.stars + 1 === 1 ? "einen Stern" : x.stars + 1 + " Sterne"} brauchst du ${lvl.stars[x.stars]} %.` : "Alle drei Sterne, besser geht es nicht.")
        + (x.bonus ? ` Bonus: +${x.bonus} XP.` : "") + (x.stars < 2 ? " Ab zwei Sternen geht es weiter." : "");
    } else $("resGoal").hidden = true;
    $("resHits").textContent = r.hits; $("resMisses").textContent = r.misses;
    $("resAcc").textContent = r.accuracy == null ? "–" : Math.round(r.accuracy * 100) + " %";
    $("resStreak").textContent = r.bestStreak;
    $("resXp").textContent = "+" + (r.xp + (x.bonus || 0)) + " XP";
    $("resTiming").textContent = r.avgOff != null ? (r.avgOff > 0 ? "+" : "") + Math.round(r.avgOff) + " ms " + (r.avgOff > 15 ? "(eher spät)" : r.avgOff < -15 ? "(eher früh)" : "(auf den Punkt)")
      : r.avgReact != null ? Math.round(r.avgReact) + " ms Reaktion" : "–";
    $("resEven").hidden = !r.evenness;
    if (r.evenness) $("resEven").textContent = `Gleichmäßigkeit: Abstände ±${Math.round(r.evenness.ioiSd)} ms, Anschlag-Spanne ${r.evenness.velRange}`;
    $("resLadder").hidden = !x.ladder; $("resLadder").textContent = x.ladder || "";
    $("resLevel").textContent = "Level " + li.level; $("resLevelBar").style.width = Math.round(li.pct * 100) + "%";
    const weak = r.weakest || [];
    $("resWeakWrap").hidden = r.mode === "rhythm" || r.kind === "key" || r.kind === "interval";
    $("resWeak").innerHTML = weak.length ? weak.map(w => `<span class="chip miss">${MU.name(w.midi, settings.naming)} · ${w.bad}/${w.n}</span>`).join("") : "<span class='muted'>Keine Fehler, nichts zu bemängeln.</span>";
    // Knöpfe je nach Lage
    const next = lvl ? ST.next(lvl) : null;
    $("nextBtn").hidden = !(lvl && x.stars >= 2 && next);
    if (next) $("nextBtn").textContent = "Weiter: " + next.title;
    $("mapBtn").hidden = !lvl;
    $("planBtn").hidden = !(plan && plan.i < plan.steps.length);
    if (plan) $("planBtn").textContent = `Weiter (${plan.i + 1}/${plan.steps.length})`;
    const canRetry = !lvl && !plan && !r.aborted && ((r.missed && r.missed.length) || (r.badMeasures && r.badMeasures.length)) && ["run", "interval", "single", "ear", "phrase", "piece"].includes(r.mode);
    $("retryBtn").hidden = !canRetry;
    $("againBtn").textContent = lvl && x.stars < 2 ? "Nochmal versuchen" : "Nochmal";
  }
  // Nachsitzen: verfehlte Noten als kurzer Lauf, verfehlte Takte als Phrasen.
  function retryMisses() {
    const r = lastResults; if (!r) return;
    if (["phrase", "piece"].includes(r.mode) && r.badMeasures.length) {
      const ps = lastOpts.pieces && lastOpts.pieces.length ? lastOpts.pieces : lastOpts.piece ? [lastOpts.piece] : selectedPieces();
      startMode("phrase", { pieces: ps, hand: lastOpts.hand || settings.hand, only: new Set(r.badMeasures),
                            override: Object.assign({}, lastOpts.override || {}, { phrases: Math.min(12, r.badMeasures.length * 2) }), title: "Nachsitzen" });
    } else if (r.missed.length) {
      const pool = r.missed.slice(), mode = ["single", "ear"].includes(r.mode) ? r.mode : "run";
      const ov = Object.assign({}, lastOpts.override || {});
      if (mode === "run") ov.runLength = Math.max(8, pool.length * 3); else ov.singleCount = Math.max(6, pool.length * 3);
      startMode(mode, { pool, override: ov, title: "Nachsitzen" });
    }
  }
  function quizFinish(res) {
    lastResults = res;
    progress.xp += res.xp; NT.store.kvSet("progress", progress);
    renderResults(res, {});
    show("results");
  }

  /* --- MIDI ---------------------------------------------------------------- */
  function onMidiMessage(data) {
    const [status, d1, d2] = data; const kind = status & 0xf0;
    const t = performance.now();
    if (kind === 0x90 && d2 > 0) {
      held.add(d1); NT.store.queue("input", { id: NT.store.newId(), t: Date.now(), at: t, type: "on", midi: d1, velocity: d2, session: G.S.session });
      if (current === "quiz") NT.quiz.onNoteOn(d1); else G.onNoteOn(d1, d2);
      renderChips();
    }
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
    $("outputsInfo").textContent = outs.length ? "MIDI-Ausgänge: " + outs.map(o => o.name).join(", ") : "Kein MIDI-Ausgang gefunden, es spielt der Synth.";
    sel.value = settings.playback;
  }

  /* --- Statistik ------------------------------------------------------------ */
  function renderStats() {
    const H = G.history;
    const hits = H.filter(e => e.correct).length;
    const sessions = new Map();
    for (const e of H) { const s = sessions.get(e.session) || { n: 0, hits: 0, t: e.t, mode: e.mode, level: e.level }; s.n++; if (e.correct) s.hits++; s.t = Math.min(s.t, e.t); sessions.set(e.session, s); }
    const tot = ST.totals(story);
    $("statTotals").innerHTML = `<div class="fig"><b>${H.length}</b><span>Noten</span></div><div class="fig"><b>${H.length ? Math.round(100 * hits / H.length) + " %" : "–"}</b><span>Treffer</span></div><div class="fig"><b>${sessions.size}</b><span>Sitzungen</span></div><div class="fig"><b>${levelInfo().level}</b><span>Level</span></div><div class="fig"><b>${tot.stars}</b><span>Sterne</span></div>`;
    const byNote = new Map();
    for (const e of H) { if (e.mode === "rhythm") continue; const v = byNote.get(e.midi) || { n: 0, bad: 0, off: [], react: [] }; v.n++; if (!e.correct) v.bad++; else if (typeof e.dueAt === "number") v.off.push(e.hitAt - e.dueAt); else v.react.push(e.hitAt - e.shownAt); byNote.set(e.midi, v); }
    const rows = Array.from(byNote.entries()).sort((a, b) => a[0] - b[0]);
    $("statNotes").innerHTML = rows.length ? rows.map(([midi, v]) => {
      const acc = 1 - v.bad / v.n, hue = Math.round(acc * 120);
      const timing = v.off.length ? Math.round(v.off.reduce((a, b) => a + b, 0) / v.off.length) + " ms" : v.react.length ? Math.round(v.react.reduce((a, b) => a + b, 0) / v.react.length) + " ms" : "–";
      return `<div class="bar"><span class="name">${MU.name(midi, settings.naming)}</span><div class="track"><div class="fill" style="width:${Math.round(acc * 100)}%;background:hsl(${hue} 80% 50%)"></div></div><span class="pct">${Math.round(acc * 100)} %</span><span class="n">${v.n}× · ${timing}</span></div>`;
    }).join("") : "<p class='muted'>Noch keine Daten.</p>";
    const list = Array.from(sessions.entries()).sort((a, b) => b[1].t - a[1].t).slice(0, 12);
    $("statSessions").innerHTML = list.length ? list.map(([id, s]) => {
      const lv = s.level ? ST.levelById(s.level) : null;
      return `<div class="row"><span>${new Date(s.t).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span><span class="tag">${lv ? "Abenteuer " + lv.index : MODE_TITLE[s.mode] || s.mode}</span><span>${s.n} Noten</span><b>${Math.round(100 * s.hits / s.n)} %</b></div>`;
    }).join("") : "";
    const p = device.pedal;
    $("statPedal").textContent = Object.keys(p).filter(k => p[k].seen).length ? "Pedal: " + Object.keys(p).filter(k => p[k].seen).map(k => `${PEDAL_NAME[k]}: ${p[k].between ? "stufenlos, Werte " + p[k].min + "–" + p[k].max : "Schalter"}`).join(" · ") : "Pedal: noch nichts erkannt.";
    renderChart();
    $("storeInfo").textContent = NT.store.available ? "Gespeichert in diesem Browser. Export/Import überträgt den Verlauf zwischen Geräten." : "Kein dauerhafter Speicher verfügbar (privater Modus?), nur diese Sitzung.";
  }

  /* --- Diagramme --------------------------------------------------------- */
  function sessionRows() {
    const map = new Map();
    for (const e of G.history) {
      let s = map.get(e.session);
      if (!s) { s = { id: e.session, t: e.t || 0, n: 0, hits: 0, off: [], react: [], mode: e.mode }; map.set(e.session, s); }
      s.n++; s.t = Math.min(s.t, e.t || s.t);
      if (e.correct) { s.hits++; if (typeof e.dueAt === "number") s.off.push(e.hitAt - e.dueAt); else s.react.push(e.hitAt - e.shownAt); }
    }
    return Array.from(map.values()).sort((a, b) => a.t - b.t);
  }
  const dayLabel = t => { const d = new Date(t); return d.getDate() + "." + (d.getMonth() + 1) + "."; };
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  async function renderChart() {
    const kind = $("chartKind").value, canvas = $("chart"), note = $("chartNote");
    const sess = sessionRows().slice(-30);
    let spec = { type: "line", points: [], unit: "" }, text = "";
    if (kind === "acc") {
      spec = { type: "line", unit: "%", yMin: 0, yMax: 100, color: "#34d399", points: sess.map(s => ({ label: dayLabel(s.t), value: 100 * s.hits / s.n })) };
      text = "Anteil richtiger Anschläge je Sitzung, die letzten 30 Sitzungen.";
    } else if (kind === "volume") {
      const days = new Map(); const now = new Date();
      for (let i = 20; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i); days.set(d.toDateString(), { label: dayLabel(d), value: 0, color: "#ff8a3d" }); }
      for (const e of G.history) { const k = new Date(e.t || 0).toDateString(); if (days.has(k)) days.get(k).value++; }
      spec = { type: "bars", unit: "", yMin: 0, points: Array.from(days.values()), minPoints: 1 };
      text = "Gespielte Noten je Tag, die letzten drei Wochen. Regelmäßig schlägt viel.";
    } else if (kind === "timing") {
      spec = { type: "line", unit: "ms", symmetric: true, zeroLine: true, color: "#2dd4ff", points: sess.filter(s => s.off.length).map(s => ({ label: dayLabel(s.t), value: mean(s.off) })) };
      text = "Mittlere Abweichung vom Zeitpunkt je Sitzung (Lauf, Stücke, Tonleiter, Rhythmus). Über null ist zu spät, unter null zu früh.";
    } else if (kind === "reaction") {
      spec = { type: "line", unit: "ms", yMin: 0, floorZero: true, color: "#ff4fa3", points: sess.filter(s => s.react.length).map(s => ({ label: dayLabel(s.t), value: mean(s.react) })) };
      text = "Mittlere Zeit von der gezeigten bis zur getroffenen Note je Sitzung (Einzeln, Gehör, Quiz).";
    } else if (kind === "xp" || kind === "streak") {
      const rows = (await NT.store.all("sessions")).sort((a, b) => a.startedAt - b.startedAt).slice(-40);
      if (kind === "xp") { let sum = 0; spec = { type: "line", unit: "XP", yMin: 0, color: "#ffd23f", points: rows.map(r => ({ label: dayLabel(r.startedAt), value: (sum += r.xp || 0) })) }; text = "Gesammelte XP über alle abgeschlossenen Runden."; }
      else { spec = { type: "bars", unit: "", yMin: 0, points: rows.map(r => ({ label: dayLabel(r.startedAt), value: r.bestStreak || 0, color: (r.bestStreak || 0) >= 10 ? "#ffd23f" : "#a78bfa" })), minPoints: 1 }; text = "Längste Serie ohne Fehler je Runde. Ab zehn leuchtet der Balken gelb."; }
    } else if (kind === "hist") {
      const offs = G.history.filter(e => e.correct && typeof e.dueAt === "number").map(e => e.hitAt - e.dueAt);
      const bins = []; for (let b = -150; b < 150; b += 30) bins.push({ from: b, label: (b + 15 > 0 ? "+" : "") + (b + 15), value: 0, color: b < -15 ? "#2dd4ff" : b >= 15 ? "#ff8a3d" : "#22c55e" });
      for (const o of offs) { const i = Math.min(bins.length - 1, Math.max(0, Math.floor((o + 150) / 30))); bins[i].value++; }
      spec = { type: "bars", unit: "", yMin: 0, points: bins, minPoints: offs.length ? 1 : 99, emptyText: "Erst im Lauf, mit Stücken oder Tonleitern spielen." };
      text = "Wie deine Treffer im Zeitfenster liegen: blau zu früh, grün auf den Punkt, orange zu spät.";
    }
    note.textContent = text;
    NT.charts.draw(canvas, spec);
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
      // Abenteuer-Stand aus der Sicherung: je Level das Beste behalten.
      for (const r of (data.kv || [])) if (r && r.key === "story" && r.value && r.value.levels) {
        for (const [id, p] of Object.entries(r.value.levels)) { const mine = story.levels[id]; if (!mine || (p.stars || 0) > mine.stars) story.levels[id] = Object.assign({ stars: 0, best: 0, attempts: 0 }, mine || {}, p); }
        NT.store.kvSet("story", story);
      }
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
        <span class="muted small">${p.measures.length} Takte · ${p.staves === 2 ? "beide Hände" : "eine Hand"} · ${MU.keyName(p.fifths, settings.naming)} · ${p.time.beats}/${p.time.beatType}${p.tempo ? " · ♩ " + Math.round(p.tempo) : ""}${p.notes.some(n => n.finger) ? " · Fingersätze" : ""}</span>
        <div class="actions"><button data-play="${p.id}">▶ Abspielen</button><button data-judge="${p.id}" class="green">Ganz spielen</button>${p.source === "import" ? `<button data-del="${p.id}" class="ghostBtn">Entfernen</button>` : ""}</div>
      </div>`).join("");
    $("libHand").value = settings.hand;
    $("libEmpty").hidden = pieces.length > 0;
  }
  async function importPiece(file) {
    try {
      if (/\.mxl$/i.test(file.name)) throw new Error(".mxl ist gezippt. In MuseScore als „Unkomprimiertes MusicXML“ exportieren.");
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
  const SEL = ["clef", "keys", "naming", "hand", "playback", "scaleType", "labels"];
  const SEL_NUM = ["scaleRoot", "scaleOctaves", "lookahead", "intervalMax", "rhythmSet"];
  const CHECKS = ["ghost", "sound", "fx", "shake", "metronome", "countIn", "tempoLadder", "rhythmRests"];
  const NUMS = ["runLength", "phrases", "dailyGoal", "rhythmBars", "quizCount"];
  function syncSettingsUi() {
    for (const k of SEL) if ($("set-" + k)) $("set-" + k).value = settings[k];
    for (const k of SEL_NUM) $("set-" + k).value = settings[k];
    for (const k of CHECKS) $("set-" + k).checked = !!settings[k];
    for (const k of NUMS) $("set-" + k).value = settings[k];
    $("set-low").value = settings.low; $("set-high").value = settings.high;
    $("lowVal").textContent = MU.name(settings.low, settings.naming); $("highVal").textContent = MU.name(settings.high, settings.naming);
    syncTempoUi();
    renderOutputs();
  }
  function syncTempoUi() { const v = settings.bpm; $("bpmVal").textContent = v; $("tempoVal").textContent = v; $("tempo").value = v; $("set-bpm").value = v; }
  function saveSettings() { NT.store.kvSet("settings", settings); }
  function bindSettings() {
    const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
    for (const k of SEL) on("set-" + k, "change", e => { settings[k] = e.target.value; saveSettings(); if (k === "naming") syncSettingsUi(); });
    for (const k of SEL_NUM) on("set-" + k, "change", e => { settings[k] = +e.target.value; saveSettings(); });
    for (const k of CHECKS) on("set-" + k, "change", e => { settings[k] = e.target.checked; NT.synth.enabled = settings.sound; NT.synth.fx = settings.fx; saveSettings(); });
    for (const k of NUMS) on("set-" + k, "change", e => { settings[k] = Math.max(+e.target.min || 0, Math.min(+e.target.max || 9999, +e.target.value || 0)); e.target.value = settings[k]; saveSettings(); });
    const range = () => {
      let lo = +$("set-low").value, hi = +$("set-high").value;
      if (lo > hi) { if (document.activeElement === $("set-low")) hi = lo; else lo = hi; }
      settings.low = lo; settings.high = hi; $("set-low").value = lo; $("set-high").value = hi;
      $("lowVal").textContent = MU.name(lo, settings.naming); $("highVal").textContent = MU.name(hi, settings.naming); saveSettings();
    };
    on("set-low", "input", range); on("set-high", "input", range);
    const bpm = v => { settings.bpm = +v; syncTempoUi(); saveSettings(); };
    on("set-bpm", "input", e => bpm(e.target.value));
    on("tempo", "input", e => { bpm(e.target.value); if (G.running && G.TIMED.includes(G.mode)) G.start(G.mode, lastOpts || {}); });
  }

  /* --- Start --------------------------------------------------------------- */
  async function loadHistory() {
    const rows = await NT.store.all("events");
    G.history.length = 0; for (const r of rows) G.history.push(r);
    G.history.sort((a, b) => (a.t || 0) - (b.t || 0));
  }
  async function init() {
    G.settings = settings; G.canvas = $("staff");
    N.attach($("staff"));
    await NT.store.open();
    Object.assign(settings, DEFAULTS, (await NT.store.kvGet("settings")) || {});
    // Fruehere Fassung: Haken statt Auswahl.
    if (typeof settings.labels === "boolean") settings.labels = settings.labels ? "name" : "off";
    progress = (await NT.store.kvGet("progress")) || { xp: 0 };
    story = (await NT.store.kvGet("story")) || { levels: {} }; if (!story.levels) story.levels = {};
    device = (await NT.store.kvGet("device")) || { pedal: {} };
    await loadHistory();
    NT.synth.enabled = settings.sound; NT.synth.fx = settings.fx;
    for (const p of NT.starterPieces) { try { pieces.push(NT.musicxml.parse(p.xml, { id: p.id, source: "starter" })); } catch (e) { console.error("Starter-Stück kaputt:", p.title, e); } }
    for (const r of await NT.store.all("pieces")) { try { pieces.push(NT.musicxml.parse(r.xml, { id: r.id, source: "import", title: r.title })); } catch (e) { console.error("Stück nicht lesbar:", r.title, e); } }

    G.hooks.hud = hud; G.hooks.feedback = feedback; G.hooks.finish = finish; G.hooks.shake = shake; G.hooks.sound = sound; G.hooks.play = playNote;
    G.hooks.click = click; G.hooks.count = count;
    NT.quiz.hooks.finish = quizFinish; NT.quiz.hooks.sound = sound; NT.quiz.bind();
    NT.book.bind(settings);
    NT.midi.onMessage = onMidiMessage; NT.midi.onStatus = midiStatus;

    // Menü
    document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => { NT.synth.unlock(); if (b.dataset.go === "book") { bookReturn = "home"; bookLevel = null; } show(b.dataset.go); }));
    $("helpBtn").addEventListener("click", () => openBook(NT.book.forMode(G.mode), storyLevel ? "story" : "home", storyLevel));
    $("bookBack").addEventListener("click", () => { const to = bookReturn, l = bookLevel; bookReturn = "home"; bookLevel = null; show(to); if (to === "story" && l) openLevel(l); });
    document.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => {
      const mode = b.dataset.mode;
      if (mode === "phrase") { const sel = selectedPieces(); if (!sel.length) { alertBox("Erst Stücke in der Bibliothek auswählen."); show("library"); return; } startMode("phrase", { pieces: sel, hand: settings.hand }); }
      else startMode(mode);
    }));
    $("storyBtn").addEventListener("click", () => { NT.synth.unlock(); show("story"); });
    $("recoBtn").addEventListener("click", () => NT.synth.unlock());
    $("warmBtn").addEventListener("click", () => { NT.synth.unlock(); startWarmup(); });
    $("stopBtn").addEventListener("click", () => {
      const lvl = storyLevel;
      if (G.running) G.stop(false);   // hat schon etwas gezählt: Ergebnis bzw. Karte über hooks.finish
      if (current === "play") { storyLevel = null; show(lvl ? "story" : "home"); }
    });
    $("hearBtn").addEventListener("click", () => G.replay());
    $("againBtn").addEventListener("click", () => startMode(lastMode, lastOpts));
    $("nextBtn").addEventListener("click", () => { const n = storyLevel ? ST.next(storyLevel) : null; if (n) startLevel(n); else show("story"); });
    $("mapBtn").addEventListener("click", () => { storyLevel = null; show("story"); });
    $("planBtn").addEventListener("click", () => { if (plan && plan.i < plan.steps.length) startMode(plan.steps[plan.i].mode, plan.steps[plan.i].opts); });
    $("retryBtn").addEventListener("click", retryMisses);
    $("connectBtn").addEventListener("click", () => { $("connectBtn").hidden = true; NT.midi.init(); });
    document.querySelectorAll(".midiChip").forEach(el => el.addEventListener("click", () => show("settings")));
    $("tempo").min = 30; $("tempo").max = 200;
    bindSettings();

    // Abenteuer-Karte
    $("map").addEventListener("click", e => { const b = e.target.closest("button[data-level]"); if (b) { NT.synth.unlock(); openLevel(ST.levelById(b.dataset.level)); } });
    $("levelModal").addEventListener("click", e => { if (e.target === $("levelModal")) closeModal(); });
    new ResizeObserver(() => { if (current === "story" && $("mapScroll").clientWidth !== mapWidth) renderMap(); }).observe($("mapScroll"));

    // Quiz
    $("quizStopBtn").addEventListener("click", () => { NT.quiz.stop(); show("home"); });
    $("quizKind").addEventListener("change", e => { settings.quizKind = e.target.value; saveSettings(); lastOpts = { kind: e.target.value }; NT.quiz.start(e.target.value, settings); });
    new ResizeObserver(() => { if (current === "quiz") NT.quiz.draw(); }).observe($("quizStaff"));

    // Bibliothek
    $("pieceList").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      const p = pieces.find(x => x.id === (b.dataset.play || b.dataset.judge || b.dataset.del));
      if (b.dataset.play && p) startMode("play", { piece: p, hand: settings.hand, fromLibrary: true });
      if (b.dataset.judge && p) startMode("piece", { piece: p, hand: settings.hand });
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
    $("chartKind").addEventListener("change", renderChart);
    new ResizeObserver(() => { if (current === "stats") renderChart(); }).observe($("chart"));
    $("importBtn").addEventListener("change", e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; });
    $("wipeBtn").addEventListener("click", () => {
      const b = $("wipeBtn");
      if (b.dataset.armed) { NT.store.wipe().then(() => { G.history.length = 0; progress = { xp: 0 }; story = { levels: {} }; renderStats(); alertBox("Verlauf gelöscht."); }); b.dataset.armed = ""; b.textContent = "Verlauf löschen"; return; }
      b.dataset.armed = "1"; b.textContent = "Wirklich löschen? Nochmal tippen"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Verlauf löschen"; }, 4000);
    });

    // Vollbild, Wake Lock, Größe
    const root = document.documentElement, fs = $("fullBtn");
    if (!(root.requestFullscreen || root.webkitRequestFullscreen)) fs.hidden = true;
    fs.addEventListener("click", () => { const active = document.fullscreenElement || document.webkitFullscreenElement; if (active) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else { const p = (root.requestFullscreen || root.webkitRequestFullscreen).call(root); if (p && p.catch) p.catch(() => {}); } });
    keepAwake(); document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(); });
    new ResizeObserver(() => { if (current === "play") { G.relayout(); G.draw(); } }).observe($("staff"));
    document.addEventListener("keydown", e => {
      if (current === "book" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { NT.book.step(e.key === "ArrowRight" ? 1 : -1); return; }
      if (e.key !== "Escape") return;
      if (current === "book") { $("bookBack").click(); return; }
      if (!$("levelModal").hidden) { closeModal(); return; }
      if (current !== "home") show(current === "play" && storyLevel ? "story" : "home");
    });
    window.addEventListener("error", e => alertBox("Fehler: " + (e.message || e.type)));
    window.addEventListener("unhandledrejection", e => alertBox("Fehler: " + ((e.reason && e.reason.message) || e.reason)));

    Promise.all([document.fonts.load('10px "NotenSymbole"'), document.fonts.load('700 10px "Baloo 2"')]).catch(() => {}).then(() => { if (current === "play") G.draw(); if (current === "quiz") NT.quiz.draw(); if (current === "stats") renderChart(); });
    renderChips(); syncSettingsUi(); show("home");
    NT.midi.init();
  }
  let wakeLock = null;
  async function keepAwake() { if (!navigator.wakeLock || wakeLock) return; try { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } catch (e) {} }

  document.addEventListener("DOMContentLoaded", init);
  return { settings, pieces, show, startMode, startLevel, openLevel, get story() { return story; }, get midiState() { return midiState; } };
})();
