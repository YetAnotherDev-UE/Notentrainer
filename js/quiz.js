/* quiz.js: Quiz ohne Klavier. Drei Arten: Notennamen (eine Note im System,
 * Name antippen), Tonarten (Vorzeichnung sehen, Tonart antippen), Intervalle
 * (zwei Noten, Abstand benennen). Laeuft auf dem Handy unterwegs; haengt ein
 * Instrument dran, zaehlt beim Notennamen-Quiz auch die gespielte Taste,
 * dann mit Oktave. Fragen richten sich nach den Einstellungen (Schluessel,
 * Umfang, Tasten). Notennamen-Antworten gehen als Ereignisse in den Verlauf,
 * die Runde als Sitzung. Der Bildschirm gehoert diesem Modul (Knoepfe,
 * Rueckmeldung), app.js schaltet ihn nur ein und aus. */
"use strict";
window.NT = window.NT || {};

NT.quiz = (() => {
  const $ = id => document.getElementById(id);
  const MU = NT.music, N = NT.notation;
  const Q = { kind: "note", running: false, i: 0, count: 20, hits: 0, misses: 0, streak: 0, bestStreak: 0, xp: 0,
              q: null, shownAt: 0, session: null, startedAt: 0, locked: false, timer: 0, flash: null, reacts: [], picked: null };
  let settings = null;
  const hooks = { finish: () => {}, sound: () => {} };
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const KIND_TITLE = { note: "Notennamen", key: "Tonarten", interval: "Intervalle" };

  function start(kind, s) {
    settings = s; stop();
    Object.assign(Q, { kind, count: s.quizCount || 20, i: 0, hits: 0, misses: 0, streak: 0, bestStreak: 0, xp: 0, q: null, locked: false, flash: null, reacts: [], picked: null,
                       running: true, session: NT.store.newId(), startedAt: Date.now() });
    next();
  }
  function stop() { Q.running = false; clearTimeout(Q.timer); }

  function pool() {
    const out = [];
    for (let m = settings.low; m <= settings.high; m++) {
      const b = MU.isBlack(m);
      if (settings.keys === "white" && b) continue;
      if (settings.keys === "black" && !b) continue;
      out.push(m);
    }
    return out.length ? out : [60, 62, 64, 65, 67];
  }

  function makeQuestion() {
    const naming = settings.naming;
    if (Q.kind === "note") {
      const midi = rnd(pool()), s = MU.spell(midi);
      const pcs = settings.keys === "white" ? [0, 2, 4, 5, 7, 9, 11] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      return { kind: "note", midi, note: { diatonic: s.diatonic, dur: 1, accidental: s.alter === 1 ? "sharp" : s.alter === -1 ? "flat" : null },
               answer: midi % 12, choices: pcs.map(pc => ({ value: pc, label: MU.shortName(60 + pc, naming) })), prompt: "Wie heißt die Note?" };
    }
    if (Q.kind === "key") {
      const fifths = Math.floor(Math.random() * 11) - 5;
      const set = new Set([fifths]);
      while (set.size < 6) set.add(Math.floor(Math.random() * 11) - 5);
      const all = Array.from(set).sort((a, b) => a - b);
      return { kind: "key", fifths, answer: fifths, choices: all.map(f => ({ value: f, label: MU.keyName(f, naming), sub: MU.minorName(f, naming) })), prompt: "Welche Tonart hat diese Vorzeichnung?" };
    }
    // Intervall: zwei Noten auf weissen Tasten, Abstand 1 bis 7 Buchstaben, im und knapp um das System.
    const bd = N.bottomDiatonic(settings.clef);
    const steps = 1 + Math.floor(Math.random() * 7), up = Math.random() < 0.5;
    const lo = bd - 2, hi = bd + 10;
    const a = lo + Math.floor(Math.random() * (hi - lo + 1 - steps)), b = a + steps;
    return { kind: "interval", d1: up ? a : b, d2: up ? b : a, up, answer: steps,
             choices: [1, 2, 3, 4, 5, 6, 7].map(k => ({ value: k, label: MU.intervalName(k) })), prompt: "Welches Intervall (" + (up ? "aufwärts" : "abwärts") + ")?" };
  }

  function next() {
    if (!Q.running) return;
    Q.q = makeQuestion(); Q.shownAt = performance.now(); Q.flash = null; Q.picked = null; Q.locked = false;
    $("quizPrompt").textContent = Q.q.prompt;
    const fb = $("quizFeedback"); fb.className = "feedback"; fb.textContent = "";
    renderAnswers(); renderHud(); draw();
  }

  function renderAnswers() {
    const q = Q.q; if (!q) return;
    $("quizAnswers").innerHTML = q.choices.map(c => {
      const cls = Q.picked == null ? "" : c.value === q.answer ? " ok" : c.value === Q.picked ? " miss" : " dim";
      return `<button class="ans${cls}" data-value="${c.value}"><span class="display">${c.label}</span>${c.sub ? `<small>${c.sub}</small>` : ""}</button>`;
    }).join("");
  }
  function renderHud() {
    $("quizScore").textContent = `${Math.min(Q.i + 1, Q.count)} / ${Q.count} · ${Q.hits} richtig` + (Q.streak >= 3 ? ` · Serie ${Q.streak}` : "");
    $("quizProgress").style.width = Math.round(100 * Q.i / Q.count) + "%";
    $("quizKindTitle").textContent = KIND_TITLE[Q.kind] || "Quiz";
  }

  // Zeichnet auf den eigenen Canvas; notation.js zeichnet auf den zuletzt angehaengten.
  function draw() {
    const c = $("quizStaff"); if (!c || !settings) return;
    N.attach(c);
    const q = Q.q;
    let above = 4, below = 4;
    if (q && q.kind === "note") { const bd = N.bottomDiatonic(settings.clef); for (const m of pool()) { const st = MU.spell(m).diatonic - bd; above = Math.max(above, st - 8); below = Math.max(below, -st); } }
    const L = N.layout({ staves: [{ clef: settings.clef, above, below }], keyFifths: q && q.kind === "key" ? q.fifths : 0, time: null, labels: q && q.kind === "note", maxGap: 40 });
    if (!L) return;
    N.drawStaves(L);
    if (!q) return;
    const x0 = L.contentLeft + (L.right - L.contentLeft) * 0.36;
    const colour = Q.flash === "ok" ? N.COL.ok : Q.flash === "miss" ? N.COL.miss : N.COL.ink;
    if (q.kind === "note") N.drawNote(L, 0, q.note, x0, { colour, label: Q.flash ? MU.name(q.midi, settings.naming) : null });
    else if (q.kind === "interval") {
      N.drawNote(L, 0, { diatonic: q.d1, dur: 1 }, x0, { colour });
      N.drawNote(L, 0, { diatonic: q.d2, dur: 1 }, x0 + L.GAP * 3.6, { colour });
      if (Q.flash) N.drawText(L, MU.intervalName(q.answer), x0 + L.GAP * 2.4, L.staves[0].topY - L.GAP * 1.6, 1.1, colour);
    } else if (q.kind === "key" && Q.flash) {
      N.drawText(L, MU.keyName(q.fifths, settings.naming) + " · " + MU.minorName(q.fifths, settings.naming), (L.contentLeft + L.right) / 2, (L.staves[0].topY + L.staves[0].bottomY) / 2, 1.3, colour);
    }
  }

  function answer(value, playedMidi) {
    if (!Q.running || Q.locked || !Q.q) return;
    const q = Q.q, t = performance.now();
    const correct = value === q.answer;
    Q.locked = true; Q.picked = value; Q.flash = correct ? "ok" : "miss";
    if (q.kind === "note") {
      const row = { id: Q.session + "-" + Q.i, session: Q.session, t: Date.now(), mode: "quiz", midi: q.midi, shownAt: Q.shownAt, hitAt: t, playedMidi: playedMidi || 0, correct };
      NT.game.history.push(row); NT.store.queue("events", row);
    }
    if (correct) {
      Q.hits++; Q.streak++; Q.bestStreak = Math.max(Q.bestStreak, Q.streak);
      Q.xp += 10 * Math.min(4, 1 + Math.floor(Q.streak / 10)); Q.reacts.push(t - Q.shownAt);
      hooks.sound(Q.streak % 10 === 0 ? "streak" : "hit");
    } else { Q.misses++; Q.streak = 0; hooks.sound("miss"); }
    const fb = $("quizFeedback"); fb.className = "feedback " + (correct ? "ok" : "miss");
    const right = q.choices.find(c => c.value === q.answer);
    fb.textContent = correct ? "Richtig · " + Math.round(t - Q.shownAt) + " ms"
      : playedMidi && playedMidi % 12 === q.answer ? "Richtiger Name, falsche Oktave: gesucht war " + MU.name(q.midi, settings.naming)
      : "Leider nein. Richtig: " + right.label + (right.sub ? " (" + right.sub + ")" : "");
    Q.i++;
    renderAnswers(); renderHud(); draw();
    Q.timer = setTimeout(() => { if (Q.i >= Q.count) finish(); else next(); }, correct ? 600 : 1300);
  }
  // Gespielte Taste beim Notennamen-Quiz: mit Oktave, sonst zaehlt es nicht.
  function onNoteOn(midi) {
    if (!Q.running || !Q.q || Q.q.kind !== "note") return;
    answer(midi === Q.q.midi ? Q.q.answer : -1, midi);
  }

  function finish() {
    Q.running = false;
    const n = Q.hits + Q.misses;
    const res = { mode: "quiz", kind: Q.kind, hits: Q.hits, misses: Q.misses, accuracy: n ? Q.hits / n : null, xp: Q.xp, bestStreak: Q.bestStreak,
                  avgOff: null, avgReact: Q.reacts.length ? Q.reacts.reduce((a, b) => a + b, 0) / Q.reacts.length : null,
                  evenness: null, weakest: [], missed: [], badMeasures: [], timed: false, aborted: false, total: Q.count };
    NT.store.put("sessions", { id: Q.session, startedAt: Q.startedAt, endedAt: Date.now(), mode: "quiz", kind: Q.kind, hits: Q.hits, misses: Q.misses, xp: Q.xp, bestStreak: Q.bestStreak });
    hooks.finish(res);
  }

  function bind() {
    $("quizAnswers").addEventListener("click", e => { const b = e.target.closest("button[data-value]"); if (b) answer(+b.dataset.value); });
  }

  return { start, stop, draw, answer, onNoteOn, bind, hooks, KIND_TITLE, get running() { return Q.running; }, get kind() { return Q.kind; }, get current() { return Q.q; } };
})();
