/* grip.js: Akkorde und Tonfolgen greifen lernen.
 * Vier Abläufe auf einem Bildschirm (Noten oben, Klaviatur mit Hand unten):
 *  - chordLearn: ein Akkord Schritt für Schritt: Finger für Finger, dann
 *    aufbauen und liegen lassen, dann dreimal gleichzeitig
 *  - chordTime:  Akkorde auf Zeit: der Name erscheint, die Uhr läuft, bis
 *    alle Töne liegen; Bestzeit je Akkord
 *  - scaleLearn: eine Tonfolge (Tonleiter, Fünffingerlage, chromatisch,
 *    gebrochener Akkord) Ton für Ton, mit Fingersatz und Hinweisen zum
 *    Unter- und Übersetzen
 *  - scaleTime:  dieselbe Tonfolge auf Zeit, Bestzeit je Tonfolge
 * Eingabe kommt vom Piano (MIDI) oder vom Tippen auf die Klaviatur. Gewertet
 * wird die Taste ohne Rücksicht auf die Oktave, damit die Handlage zählt und
 * nicht die Stelle am Instrument. */
"use strict";
window.NT = window.NT || {};

NT.grip = (() => {
  const $ = id => document.getElementById(id);
  const MU = NT.music, N = NT.notation, K = NT.keys;
  const pcOf = m => ((m % 12) + 12) % 12;
  const secs = ms => (ms / 1000).toFixed(2).replace(".", ",") + " s";
  const S = { kind: null, opts: null, running: false, hand: "r", help: "full",
    chord: null, queue: [], qi: 0, phase: "single", j: 0, reps: 0, solved: false,
    seq: null, si: 0, held: new Map(), wrong: new Set(), waitRelease: false,
    errors: 0, errorsThis: 0, hits: 0, misses: 0, xp: 0, streak: 0, bestStreak: 0,
    t0: 0, tFirst: 0, times: [], stamps: [], newRecords: [], session: null, startedAt: 0, raf: 0, nextTimer: 0, pointers: new Map(), text: "", textKind: "" };
  let settings = null, records = {};
  const hooks = { finish: () => {}, sound: () => {}, saveRecords: () => {} };
  const naming = () => (settings && settings.naming) || "de";
  const isChord = () => S.kind === "chordLearn" || S.kind === "chordTime";

  /* --- Bestzeiten --------------------------------------------------------- */
  const chordKey = ch => ["c", ch.type, ch.rootPc, ch.inv, ch.hand].join("|");
  const scaleKey = o => ["s", o.type, o.root, o.octaves, o.hand].join("|");
  function noteRecord(key, ms, title) {
    const r = records[key] || { best: null, n: 0 };
    ms = Math.round(ms);
    r.n++; r.last = ms; r.at = Date.now();
    const isNew = r.best == null || ms < r.best;
    if (isNew) {
      // Je Griff nur die letzte, also beste Zeit dieser Runde nennen; "vorher" ist der Stand vor der Runde.
      const old = S.newRecords.find(x => x.key === key), before = old ? old.before : r.best;
      if (old) S.newRecords.splice(S.newRecords.indexOf(old), 1);
      S.newRecords.push({ key, before, text: `${title}: ${secs(ms)}` + (before != null ? ` (vorher ${secs(before)})` : "") });
      r.best = ms;
    }
    records[key] = r; hooks.saveRecords(records);
    return isNew;
  }
  const bestOf = key => (records[key] && records[key].best != null) ? records[key].best : null;

  /* --- Auswahl der Akkorde für „Auf Zeit" --------------------------------- */
  const SETS = {
    one: "Nur dieser Akkord", cadence: "Kadenz in dieser Tonart (I IV V I)", durWhite: "Dur, weiße Grundtöne", dur: "Alle Dur-Akkorde",
    moll: "Alle Moll-Akkorde", durmoll: "Dur und Moll gemischt", circle: "Dur im Quintenzirkel", triads: "Alle Dreiklänge", sevenths: "Septakkorde", all: "Alle Arten",
  };
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function buildQueue(o) {
    const n = Math.max(4, o.count || 10), hand = o.hand, inv = o.inv || 0;
    const mk = (root, type, i) => MU.chord(root, type, MU.CHORDS[type].steps.length === 3 ? (i == null ? inv : i) : 0, hand);
    const all12 = type => Array.from({ length: 12 }, (_, r) => [r, type]);
    let pool;
    if (o.set === "cadence") {
      const out = []; const t = (o.type === "moll" || o.type === "m7" || o.type === "dim") ? "moll" : "dur";
      while (out.length < n) for (const c of MU.cadence(o.root, t, hand)) out.push(c);
      return out.slice(0, Math.ceil(n / 4) * 4);
    }
    if (o.set === "circle") { const order = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]; return Array.from({ length: Math.max(n, 12) }, (_, i) => mk(order[i % 12], "dur")); }
    if (o.set === "one" || !SETS[o.set]) return Array.from({ length: n }, () => mk(o.root, o.type));
    if (o.set === "durWhite") pool = [0, 2, 4, 5, 7, 9, 11].map(r => [r, "dur"]);
    else if (o.set === "dur") pool = all12("dur");
    else if (o.set === "moll") pool = all12("moll");
    else if (o.set === "durmoll") pool = all12("dur").concat(all12("moll"));
    else if (o.set === "triads") pool = ["dur", "moll", "dim", "aug"].flatMap(all12);
    else if (o.set === "sevenths") pool = ["dom7", "maj7", "m7"].flatMap(all12);
    else pool = Object.keys(MU.CHORDS).flatMap(all12);
    const out = []; let bag = [];
    while (out.length < n) { if (!bag.length) bag = shuffle(pool.slice()); const [r, t] = bag.pop(); if (out.length && out[out.length - 1].rootPc === r && out[out.length - 1].type === t && pool.length > 1) { bag.unshift([r, t]); continue; } out.push(mk(r, t)); }
    return out;
  }
  const chordLabel = ch => MU.chordTitle(ch.rootPc, ch.type, naming()) + (ch.inv ? ", " + MU.INVERSIONS[ch.inv] : "") + (ch.degree ? " · Stufe " + ch.degree : "");

  /* --- Start und Ende ------------------------------------------------------ */
  function start(kind, o) {
    stop();
    Object.assign(S, { kind, opts: o, running: true, hand: o.hand || "r", help: o.help || "full", chord: null, queue: [], qi: 0, phase: "single", j: 0, reps: 0, solved: false,
      seq: null, si: 0, waitRelease: false, errors: 0, errorsThis: 0, hits: 0, misses: 0, xp: 0, streak: 0, bestStreak: 0, t0: 0, tFirst: 0, times: [], stamps: [], newRecords: [],
      session: NT.store.newId(), startedAt: Date.now(), text: "", textKind: "", doneAll: false, bassWarned: false, afterRelease: null });
    S.held.clear(); S.wrong.clear();
    if (kind === "chordLearn") { S.chord = MU.chord(o.root, o.type, o.inv || 0, S.hand); S.help = "full"; say(singleText()); }
    else if (kind === "chordTime") { S.queue = buildQueue(o); showChord(0); }
    else { S.seq = MU.scaleNotes(o.root, o.type, o.octaves || 1, S.hand); if (kind === "scaleLearn") { S.help = "full"; say(scaleText()); } else say("Die Uhr startet mit dem ersten Ton. Spiel die Tonfolge rauf und wieder runter, so gleichmäßig und schnell du kannst."); }
    renderHead(); draw(); loop();
  }
  function stop() {
    S.running = false; cancelAnimationFrame(S.raf); clearTimeout(S.nextTimer);
    for (const m of S.pointers.values()) NT.synth.noteOff(m);
    S.pointers.clear(); S.held.clear(); S.wrong.clear();
  }
  function say(text, kind) { S.text = text; S.textKind = kind || ""; const el = $("gripText"); if (el) { el.className = "feedback " + (kind || ""); el.textContent = text; } }

  function finish() {
    S.running = false; cancelAnimationFrame(S.raf);
    const total = S.hits + S.misses;
    const res = { mode: S.kind === "chordTime" ? "chord" : S.kind, grip: true, hits: S.hits, misses: S.misses, accuracy: total ? S.hits / total : null, xp: S.xp, bestStreak: S.bestStreak,
      avgOff: null, avgReact: null, evenness: null, weakest: [], missed: [], badMeasures: [], timed: false, aborted: false, total };
    if (S.kind === "chordTime") {
      const clean = S.times.filter(t => t.clean), all = S.times;
      const mean = all.length ? all.reduce((a, t) => a + t.ms, 0) / all.length : 0;
      const fast = all.slice().sort((a, b) => a.ms - b.ms)[0];
      res.title = clean.length === all.length ? "Sauber gegriffen!" : clean.length >= all.length * 0.7 ? "Gut gegriffen" : "Weiter greifen";
      res.timingText = all.length ? `Im Schnitt ${secs(mean)} je Akkord, am schnellsten ${secs(fast.ms)} (${fast.title}).` : "";
      res.sub = "Akkorde auf Zeit · " + (SETS[S.opts.set] || SETS.one);
    } else if (S.kind === "scaleTime") {
      const ms = S.stamps.length > 1 ? S.stamps[S.stamps.length - 1] - S.stamps[0] : 0, title = MU.scaleTitle(S.opts.root, S.opts.type, naming());
      if (S.errors === 0 && ms > 0) noteRecord(scaleKey(S.opts), ms, title);
      const d = S.stamps.slice(1).map((t, i) => t - S.stamps[i]), m = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;
      const sd = d.length ? Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / d.length) : 0;
      res.title = S.errors === 0 ? "Sauber durch!" : "Durch, mit Fehlern";
      res.timingText = `${title}: ${secs(ms)}, das sind ${(S.stamps.length / Math.max(0.001, ms / 1000)).toFixed(1).replace(".", ",")} Töne je Sekunde. Abstände ±${Math.round(sd)} ms.` + (S.errors ? " Bestzeiten zählen nur ohne Fehler." : "");
      res.sub = "Tonfolge auf Zeit";
      const row = { id: S.session + "-0", session: S.session, t: Date.now(), mode: "scaleTime", midi: 60 + S.opts.root, form: S.opts.type, shownAt: S.stamps[0] || 0, hitAt: S.stamps[S.stamps.length - 1] || 0, correct: S.errors === 0 };
      NT.game.history.push(row); NT.store.queue("events", row);
    } else {
      res.title = "Geschafft!";
      res.sub = (S.kind === "chordLearn" ? chordLabel(S.chord) : MU.scaleTitle(S.opts.root, S.opts.type, naming())) + " · " + (S.hand === "l" ? "linke Hand" : "rechte Hand");
      res.timingText = S.errors ? `${S.errors} ${S.errors === 1 ? "falsche Taste" : "falsche Tasten"} unterwegs. Beim nächsten Mal langsamer und genauer.` : "Ohne eine falsche Taste. Jetzt auf Zeit?";
    }
    res.note = S.newRecords.length ? "Neue Bestzeit: " + S.newRecords.slice(0, 3).map(x => x.text).join(" · ") + (S.newRecords.length > 3 ? ` und ${S.newRecords.length - 3} weitere` : "") : "";
    NT.store.put("sessions", { id: S.session, startedAt: S.startedAt, endedAt: Date.now(), mode: res.mode, hits: S.hits, misses: S.misses, xp: S.xp, bestStreak: S.bestStreak });
    hooks.finish(res);
  }

  /* --- Texte --------------------------------------------------------------- */
  const fingerText = f => `Finger ${f} (${K.FINGER_NAME[f]})`;
  const toneName = t => MU.nameOf(t.letter, t.alter, naming());
  function singleText() {
    const t = S.chord.tones[S.j];
    return `${fingerText(t.finger)} auf ${toneName(t)}.` + (S.j === 0 ? " Finger rund wie um einen Ball, Handgelenk locker auf Höhe der Tasten." : "");
  }
  function scaleText() {
    const n = S.seq.notes[S.si], prev = S.si > 0 ? S.seq.notes[S.si - 1] : null;
    let extra = "";
    if (prev) {
      const up = n.midi > prev.midi, toThumb = n.finger === 1 && prev.finger >= 2, fromThumb = prev.finger === 1 && n.finger >= 2 && Math.abs(n.finger - prev.finger) > 1;
      const rightHand = S.hand !== "l";
      if (toThumb && (rightHand ? up : !up) && prev.finger > 1) extra = ` Untersetzen: Der Daumen wandert unter Finger ${prev.finger} hindurch.`;
      else if (fromThumb && (rightHand ? !up : up)) extra = ` Übersetzen: Finger ${n.finger} greift über den Daumen.`;
      else if (S.si === S.seq.up - 1) extra = " Oben angekommen, jetzt geht es zurück.";
    } else extra = " Hand locker, Finger rund.";
    return `${fingerText(n.finger)} auf ${toneName(n)}.` + extra;
  }

  /* --- Akkorde auf Zeit ------------------------------------------------------ */
  function showChord(i) {
    S.qi = i; S.chord = S.queue[i]; S.solved = false; S.errorsThis = 0; S.bassWarned = false; S.t0 = performance.now();
    say(S.help === "name" ? "Greif den Akkord, dessen Name oben steht." : "Greif alle Töne gleichzeitig.");
    renderHead(); draw();
  }
  function chordState() {
    const pcs = new Set(S.chord.pcs), got = new Set(); let lowest = Infinity, bad = false;
    for (const m of S.held.keys()) { const pc = pcOf(m); if (!pcs.has(pc)) bad = true; else got.add(pc); lowest = Math.min(lowest, m); }
    const complete = !bad && got.size === pcs.size;
    return { complete, bad, bassOk: complete && pcOf(lowest) === S.chord.bassPc };
  }
  function reward(clean) {
    if (clean) { S.hits++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak); S.xp += 10 * Math.min(4, 1 + Math.floor(S.streak / 5)); hooks.sound(S.streak % 5 === 0 ? "streak" : "hit"); }
    else { S.misses++; S.streak = 0; S.xp += 4; hooks.sound("hit"); }
  }
  function wrongKey(midi) {
    S.errors++; S.errorsThis++; S.wrong.add(midi); hooks.sound("miss");
  }

  /* --- Eingabe ---------------------------------------------------------------- */
  function onNoteOn(midi) {
    if (!S.running || S.doneAll) return;
    const t = performance.now();
    if (S.waitRelease && S.held.size === 0) S.waitRelease = false;
    S.held.set(midi, t);
    if (S.waitRelease) { draw(); return; }
    if (S.kind === "chordLearn") learnChord(midi, t);
    else if (S.kind === "chordTime") timeChord(midi, t);
    else runScale(midi, t);
    renderHead(); draw();
  }
  function onNoteOff(midi) {
    S.held.delete(midi); S.wrong.delete(midi);
    if (S.waitRelease && S.held.size === 0) { S.waitRelease = false; if (S.running && S.afterRelease) { const f = S.afterRelease; S.afterRelease = null; f(); } }
    if (S.running) draw();
  }
  function releaseThen(fn) { S.waitRelease = true; S.afterRelease = fn; if (S.held.size === 0) { S.waitRelease = false; S.afterRelease = null; fn(); } }

  function learnChord(midi, t) {
    const tones = S.chord.tones, pcs = S.chord.pcs;
    if (S.phase === "single") {
      if (pcOf(midi) === pcOf(tones[S.j].midi)) {
        hooks.sound("hit"); S.hits++; S.j++;
        if (S.j >= tones.length) { S.phase = "build"; say("Alle Töne einzeln gefunden. Jetzt loslassen.", "ok"); releaseThen(() => { say("Jetzt einen nach dem anderen drücken und liegen lassen, bis alle Töne zusammen klingen."); draw(); }); }
        else say(singleText());
      } else { wrongKey(midi); S.misses++; say(`Das war ${MU.name(midi, naming())}. ` + singleText(), "miss"); }
      return;
    }
    if (!pcs.includes(pcOf(midi))) { wrongKey(midi); S.misses++; say(`${MU.name(midi, naming())} gehört nicht zum Akkord. Loslassen und nochmal.`, "miss"); return; }
    const st = chordState();
    if (!st.complete) return;
    if (S.phase === "build") {
      hooks.sound("streak"); S.hits++; S.phase = "together"; S.reps = 0;
      say("Das ist der Akkord. Loslassen.", "ok");
      releaseThen(() => { say("Jetzt alle Töne gleichzeitig anschlagen, dreimal. Die Bewegung kommt aus dem Arm, die Finger bleiben fest."); draw(); });
      return;
    }
    const times = Array.from(S.held.values()), spread = Math.max(...times) - Math.min(...times);
    if (spread <= 350) {
      S.reps++; S.hits++; hooks.sound(S.reps === 3 ? "streak" : "hit");
      if (S.reps >= 3) { S.xp = 30 + (S.errors === 0 ? 10 : 0); say("Dreimal zusammen. Der Griff sitzt.", "ok"); S.doneAll = true; S.nextTimer = setTimeout(finish, 900); return; }
      say(`Zusammen, ${S.reps} von 3. Loslassen und nochmal.`, "ok");
    } else say(`Noch nicht zusammen: ${Math.round(spread)} ms auseinander. Loslassen, dann alle Finger auf einmal senken.`, "miss");
    S.waitRelease = true; S.afterRelease = () => draw();
  }

  function timeChord(midi, t) {
    if (S.solved) return;
    if (!S.chord.pcs.includes(pcOf(midi))) { wrongKey(midi); say(`${MU.name(midi, naming())} gehört nicht dazu.`, "miss"); return; }
    const st = chordState();
    if (!st.complete) return;
    if (!st.bassOk) { say(`Richtige Töne, aber unten muss ${toneName(S.chord.tones[0])} liegen (${MU.INVERSIONS[S.chord.inv]}).`, "miss"); if (!S.bassWarned) { S.bassWarned = true; S.errors++; S.errorsThis++; hooks.sound("miss"); } return; }
    S.bassWarned = false;
    const ms = t - S.t0, clean = S.errorsThis === 0, title = chordLabel(S.chord), plain = MU.chordTitle(S.chord.rootPc, S.chord.type, naming()) + (S.chord.inv ? ", " + MU.INVERSIONS[S.chord.inv] : "");
    S.solved = true; S.times.push({ ms, clean, title });
    const row = { id: S.session + "-" + S.qi, session: S.session, t: Date.now(), mode: "chord", midi: 60 + S.chord.rootPc, chord: MU.chordSymbol(S.chord.rootPc, S.chord.type, "int"), shownAt: S.t0, hitAt: t, correct: clean };
    NT.game.history.push(row); NT.store.queue("events", row);
    const rec = clean ? noteRecord(chordKey(S.chord), ms, plain) : false;
    reward(clean);
    say(`${title}: ${secs(ms)}` + (rec ? " · neue Bestzeit" : "") + (clean ? "" : " · mit falscher Taste"), clean ? "ok" : "miss");
    releaseThen(() => { S.nextTimer = setTimeout(() => { if (!S.running) return; if (S.qi + 1 >= S.queue.length) finish(); else showChord(S.qi + 1); }, 350); });
  }

  function runScale(midi, t) {
    const notes = S.seq.notes, n = notes[S.si];
    if (pcOf(midi) === pcOf(n.midi)) {
      if (S.si === 0) S.tFirst = t;
      S.stamps.push(t); S.hits++; S.si++;
      if (S.kind === "scaleLearn") hooks.sound("hit");
      if (S.si >= notes.length) {
        S.xp = S.kind === "scaleLearn" ? 30 + (S.errors === 0 ? 10 : 0) : Math.round(notes.length * 1.5) + (S.errors === 0 ? 20 : 0);
        say(S.kind === "scaleLearn" ? "Einmal rauf und runter. Geschafft." : "Im Ziel.", "ok"); hooks.sound("streak");
        S.si = notes.length - 1; S.doneAll = true; S.nextTimer = setTimeout(finish, 700); return;
      }
      if (S.kind === "scaleLearn") say(scaleText());
    } else {
      wrongKey(midi); S.misses++;
      say(`Das war ${MU.name(midi, naming())}, gesucht ist ${toneName(n)} mit Finger ${n.finger}.`, "miss");
    }
  }

  /* --- Zeichnen ---------------------------------------------------------------- */
  const BLUE = "#2563eb";
  function chordStaff(cv, ch, o) {
    N.attach(cv);
    const clef = ch.hand === "l" ? "bass" : "treble", bd = N.bottomDiatonic(clef);
    let above = 0, below = 0;
    for (const t of ch.tones) { const st = t.diatonic - bd; above = Math.max(above, st - 8); below = Math.max(below, -st); }
    const L = N.layout({ staves: [{ clef, above, below }], keyFifths: 0, time: null, labels: false, maxGap: o.maxGap || 30 });
    if (!L) return;
    N.drawStaves(L);
    const x = L.contentLeft + (L.right - L.contentLeft) * 0.38;
    if (o.hidden) { N.drawText(L, "?", x + L.GAP, (L.staves[0].topY + L.staves[0].bottomY) / 2, 2.2, N.COL.muted); return; }
    // Vorzeichen von oben nach unten abwechselnd nah und weiter links, sonst stoßen sie bei Terzen zusammen.
    let k = 0; const shift = new Map();
    for (const t of ch.tones.slice().reverse()) if (t.accidental) shift.set(t, (k++ % 2) * 1.15);
    ch.tones.forEach((t, i) => {
      const colour = o.colour ? o.colour(i, t) : N.COL.ink;
      N.drawNote(L, 0, { diatonic: t.diatonic, dur: 4, accidental: t.accidental }, x, { colour, accShift: shift.get(t) || 0 });
      N.drawText(L, String(t.finger), x + N.M.wholeW * L.GAP + L.GAP * 1.0, N.yFor(L, 0, t.diatonic), 0.95, K.FINGER_COL[t.finger]);
    });
  }
  function scaleStaff(cv, sc, o) {
    N.attach(cv);
    const clef = sc.hand === "l" ? "bass" : "treble", bd = N.bottomDiatonic(clef);
    let above = 0, below = 0;
    for (const t of sc.notes) { const st = t.diatonic - bd; above = Math.max(above, st - 8); below = Math.max(below, -st); }
    const L = N.layout({ staves: [{ clef, above, below }], keyFifths: sc.key.fifths, time: null, labels: false, fingers: true, maxGap: o.maxGap || 26 });
    if (!L) return;
    N.drawStaves(L);
    // Lange Folgen laufen als Fenster mit: die aktuelle Note bleibt im vorderen Drittel.
    const room = L.right - L.contentLeft - L.GAP, per = L.GAP * 2.3, vis = Math.max(5, Math.min(sc.notes.length, Math.floor(room / per)));
    const at = o.at == null ? 0 : o.at;
    const first = Math.max(0, Math.min(sc.notes.length - vis, at - Math.floor(vis / 3)));
    const w = room / vis;
    for (let i = first; i < first + vis; i++) {
      const n = sc.notes[i], x = L.contentLeft + L.GAP * 0.5 + w * (i - first) + w / 2 - N.M.headW * L.GAP / 2;
      const colour = o.at == null ? N.COL.ink : i < o.at || o.all ? N.COL.ok : i === o.at ? BLUE : N.COL.ink;
      N.drawNote(L, 0, { diatonic: n.diatonic, dur: 1, accidental: n.accidental }, x, { colour, finger: n.finger, fingerColour: K.FINGER_COL[n.finger] });
    }
    if (first > 0) N.drawText(L, "…", L.contentLeft + L.GAP * 0.2, L.staves[0].bottomY + L.GAP * 1.2, 1, N.COL.muted);
    if (first + vis < sc.notes.length) N.drawText(L, "…", L.right - L.GAP * 0.6, L.staves[0].bottomY + L.GAP * 1.2, 1, N.COL.muted);
  }
  // Die Handlage für eine Note der Tonfolge: die Gruppe von Tönen, die ohne Unter- oder Übersetzen in der Hand liegt.
  function scaleHand(sc, at) {
    const up = sc.notes.slice(0, sc.up), cur = sc.notes[at];
    const p = up.findIndex(n => n.midi === cur.midi);
    const rising = (a, b) => sc.hand === "l" ? a.finger > b.finger : a.finger < b.finger;
    let a = p, b = p;
    while (a > 0 && rising(up[a - 1], up[a])) a--;
    while (b < up.length - 1 && rising(up[b], up[b + 1])) b++;
    const group = up.slice(a, b + 1);
    return { group, tips: K.restingTips(group.map(n => ({ finger: n.finger, midi: n.midi })), sc.hand) };
  }
  function keysFor(cv, o) { return K.draw(cv, Object.assign({ naming: naming() }, o)); }

  function draw() {
    const staff = $("gripStaff"), keys = $("gripKeys"); if (!staff || !keys || !S.kind) return;
    const held = new Set(S.held.keys()), pulse = (Math.sin(performance.now() / 260) + 1) / 2;
    if (isChord()) {
      const ch = S.chord; if (!ch) return;
      const learn = S.kind === "chordLearn", showAll = learn || S.help === "full" || S.solved;
      const heldPc = new Set(Array.from(held).map(pcOf));
      const stateOf = (i, t) => learn && S.phase === "single" ? (i < S.j ? "done" : i === S.j ? "next" : "target") : (heldPc.has(pcOf(t.midi)) || S.solved ? "done" : "target");
      chordStaff(staff, ch, { hidden: !learn && S.help === "name" && !S.solved, colour: (i, t) => { const s = stateOf(i, t); return s === "done" ? N.COL.ok : s === "next" ? BLUE : N.COL.ink; } });
      const r = K.rangeFor(ch.tones.map(t => t.midi), ch.hand, 2);
      keysFor(keys, { low: r.low, high: r.high, held, wrong: S.wrong, pulse,
        marks: showAll ? ch.tones.map((t, i) => ({ midi: t.midi, finger: t.finger, state: stateOf(i, t) })) : [],
        hand: showAll ? { hand: ch.hand, tips: K.restingTips(ch.tones.map(t => ({ finger: t.finger, midi: t.midi })), ch.hand) } : null });
    } else {
      const sc = S.seq; if (!sc) return;
      const at = Math.min(S.si, sc.notes.length - 1), learn = S.kind === "scaleLearn";
      scaleStaff(staff, sc, { at, all: !!S.doneAll });
      const r = K.rangeFor(sc.notes.map(n => n.midi), sc.hand, 2);
      const h = scaleHand(sc, at), cur = sc.notes[at];
      keysFor(keys, { low: r.low, high: r.high, held, wrong: S.wrong, pulse,
        marks: learn || S.help === "full" ? h.group.map(n => ({ midi: n.midi, finger: n.finger, state: n.midi === cur.midi ? "next" : "target" })) : [],
        hand: learn || S.help === "full" ? { hand: sc.hand, tips: h.tips } : null });
    }
  }
  function renderHead() {
    if (!S.kind) return;
    const set = (id, v) => { const el = $(id); if (el && el.textContent !== String(v)) el.textContent = v; };
    let step = "", name = "", best = null, title = "";
    if (S.kind === "chordLearn") { const n = S.chord.tones.length, total = n + 4; step = Math.min(total, (S.phase === "single" ? S.j : S.phase === "build" ? n : n + 1 + S.reps) + 1) + "/" + total; name = MU.chordSymbol(S.chord.rootPc, S.chord.type, naming()); title = "Akkord lernen · " + chordLabel(S.chord); best = bestOf(chordKey(S.chord)); }
    else if (S.kind === "chordTime") { step = (S.qi + 1) + "/" + S.queue.length; name = MU.chordSymbol(S.chord.rootPc, S.chord.type, naming()); title = "Akkorde auf Zeit · " + chordLabel(S.chord); best = bestOf(chordKey(S.chord)); }
    else { step = Math.min(S.si + 1, S.seq.notes.length) + "/" + S.seq.notes.length; name = MU.scaleTitle(S.opts.root, S.opts.type, naming()); title = (S.kind === "scaleLearn" ? "Tonfolge lernen · " : "Tonfolge auf Zeit · ") + name; best = bestOf(scaleKey(S.opts)); }
    set("gripStep", step); set("gripErr", S.errors); set("gripName", name); set("gripTitle", title);
    set("gripBest", best == null ? "–" : secs(best));
    $("gripTimeBox").hidden = S.kind === "chordLearn" || S.kind === "scaleLearn";
    $("gripBestBox").hidden = S.kind === "chordLearn" || S.kind === "scaleLearn";
    $("gripName").classList.toggle("long", name.length > 8);
  }
  function loop() {
    cancelAnimationFrame(S.raf);
    let last = 0;
    const step = now => {
      if (!S.running) return;
      if (now - last > 33) {
        last = now;
        const el = $("gripTime");
        if (el) {
          let ms = 0;
          if (S.kind === "chordTime") ms = S.solved ? (S.times.length ? S.times[S.times.length - 1].ms : 0) : now - S.t0;
          else if (S.kind === "scaleTime") ms = S.stamps.length ? (S.doneAll ? S.stamps[S.stamps.length - 1] : now) - S.stamps[0] : 0;
          el.textContent = (ms / 1000).toFixed(1).replace(".", ",");
        }
        draw();
      }
      S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  }

  /* --- Vorschau für die Übersicht ------------------------------------------- */
  function previewChord(staff, keys, o) {
    const ch = MU.chord(o.root, o.type, o.inv || 0, o.hand);
    chordStaff(staff, ch, { maxGap: 22 });
    const r = K.rangeFor(ch.tones.map(t => t.midi), ch.hand, 2);
    keysFor(keys, { low: r.low, high: r.high, marks: ch.tones.map(t => ({ midi: t.midi, finger: t.finger, state: "target" })),
      hand: o.withHand ? { hand: ch.hand, tips: K.restingTips(ch.tones.map(t => ({ finger: t.finger, midi: t.midi })), ch.hand) } : null });
    return ch;
  }
  function previewScale(staff, keys, o) {
    const sc = MU.scaleNotes(o.root, o.type, o.octaves || 1, o.hand);
    scaleStaff(staff, sc, { maxGap: 20 });
    const r = K.rangeFor(sc.notes.map(n => n.midi), sc.hand, 2), h = scaleHand(sc, 0);
    // Alle Tasten der Tonfolge mit ihrem Finger, die Hand liegt in der ersten Lage.
    const seen = new Map(); for (const n of sc.notes.slice(0, sc.up)) seen.set(n.midi, n.finger);
    keysFor(keys, { low: r.low, high: r.high, marks: Array.from(seen.entries()).map(([midi, finger]) => ({ midi, finger, state: "target" })), hand: o.withHand ? { hand: sc.hand, tips: h.tips } : null });
    return sc;
  }

  /* --- Tippen auf die Klaviatur ----------------------------------------------- */
  function bind(s, initialRecords) {
    settings = s; records = initialRecords || {};
    const cv = $("gripKeys");
    const down = e => { const m = K.hit(cv, e.clientX, e.clientY); if (m == null) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} S.pointers.set(e.pointerId, m); NT.synth.unlock(); NT.synth.noteOn(m, 84); onNoteOn(m); };
    const up = e => { const m = S.pointers.get(e.pointerId); if (m == null) return; S.pointers.delete(e.pointerId); NT.synth.noteOff(m); onNoteOff(m); };
    cv.addEventListener("pointerdown", down); cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up); cv.addEventListener("pointerleave", up);
    cv.style.touchAction = "none";
    const legend = $("fingerLegend");
    if (legend) legend.innerHTML = [1, 2, 3, 4, 5].map(f => `<span class="fdot"><i style="background:${K.FINGER_COL[f]}">${f}</i>${K.FINGER_NAME[f]}</span>`).join("");
  }

  return { start, stop, draw, onNoteOn, onNoteOff, bind, hooks, SETS, previewChord, previewScale, chordStaff, scaleStaff, bestOf, chordKey, scaleKey, secs, chordLabel,
           get running() { return S.running; }, get kind() { return S.kind; }, get state() { return S; },
           get records() { return records; }, set records(v) { records = v || {}; } };
})();
