/* keys.js: Klaviatur und Hand als Bild.
 * Die Klaviatur zeigt, welche Tasten dran sind, mit farbigen Fingerkreisen
 * (1 Daumen bis 5 kleiner Finger, je Finger eine Farbe). Darüber liegt eine
 * gezeichnete Hand von oben, in festen Proportionen: Sie wird als Ganzes so
 * gelegt, dass die Kuppen auf ihren Tasten landen; unbenutzte Finger ruhen
 * heller dazwischen. So sieht man die Handlage, nicht nur die Töne. Die Klaviatur nimmt auch Tippen und Klicken
 * an (hit), damit alles ohne Piano ausprobiert werden kann. */
"use strict";
window.NT = window.NT || {};

NT.keys = (() => {
  const MU = NT.music;
  const FINGER_COL = { 1: "#ef4444", 2: "#f59e0b", 3: "#22c55e", 4: "#3b82f6", 5: "#a855f7" };
  const FINGER_NAME = { 1: "Daumen", 2: "Zeigefinger", 3: "Mittelfinger", 4: "Ringfinger", 5: "kleiner Finger" };
  const UI = '"Baloo 2", "Segoe UI", system-ui, sans-serif';
  const SKIN = "#f4cfae", SKIN_LIGHT = "#f9e2cd", SKIN_EDGE = "#c48a5a";
  const WHITE = "#fffdf7", BLACK = "#1f1a16", EDGE = "#3b2f24";

  function prepare(canvas) {
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    if (!cssW || !cssH) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(cssW * dpr), bh = Math.round(cssH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    return { ctx, W: cssW, H: cssH };
  }
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }

  // Bereich auf ganze Oktaven runden (C bis H), mindestens minOctaves; die rechte Hand wächst nach oben, die linke nach unten.
  function rangeFor(midis, hand, minOctaves) {
    const lo = Math.min(...midis), hi = Math.max(...midis);
    let low = Math.floor(lo / 12) * 12, high = Math.floor(hi / 12) * 12 + 11;
    while ((high - low + 1) / 12 < (minOctaves || 2)) { if (hand === "l") low -= 12; else high += 12; }
    return { low, high };
  }

  function geometry(W, H, low, high, withHand) {
    const whites = []; for (let m = low; m <= high; m++) if (!MU.isBlack(m)) whites.push(m);
    const padX = 4, top = 4;
    const ww = (W - 2 * padX) / whites.length;
    const kh = Math.min(withHand ? H * 0.6 : H - 8, ww * 4.8);
    const bh = kh * 0.62, bw = ww * 0.6;
    const keys = new Map();
    whites.forEach((m, i) => keys.set(m, { midi: m, black: false, x: padX + i * ww, w: ww, y: top, h: kh }));
    for (let m = low; m <= high; m++) if (MU.isBlack(m)) { const left = keys.get(m - 1); if (left) keys.set(m, { midi: m, black: true, x: left.x + ww - bw / 2, w: bw, y: top, h: bh }); }
    return { W, H, low, high, ww, kh, bh, bw, top, padX, keys, bottom: top + kh };
  }
  // Wo die Fingerkuppe auf der Taste liegt. Eine weiße Taste lässt sich vorn
  // spielen oder weiter hinten, im schmalen Teil zwischen den schwarzen; y
  // (optional) sagt, wie weit hinten, dann rückt x in die Mitte dieses Teils.
  const FRONT = 0.8, DEEP = 0.36;
  function tipOf(geo, midi, y) {
    const k = geo.keys.get(midi);
    if (!k) { const c = Math.max(geo.low, Math.min(geo.high, midi)), kk = geo.keys.get(c); return kk ? { x: kk.x + kk.w / 2 + (midi - c) * geo.ww * 0.6, y: kk.y + kk.h * FRONT } : { x: 0, y: 0 }; }
    if (k.black) return { x: k.x + k.w / 2, y: k.y + k.h * 0.7 };
    const front = k.y + k.h * FRONT;
    if (y == null) return { x: k.x + k.w / 2, y: front };
    const yy = Math.max(k.y + k.h * DEEP, Math.min(front, y));
    if (yy > geo.top + geo.bh + geo.ww * 0.2) return { x: k.x + k.w / 2, y: yy };
    const l = geo.keys.has(midi - 1) && geo.keys.get(midi - 1).black ? geo.bw / 2 : 0, r = geo.keys.has(midi + 1) && geo.keys.get(midi + 1).black ? geo.bw / 2 : 0;
    return { x: k.x + l + (k.w - l - r) / 2, y: yy };
  }

  /* o: { low, high, marks: [{ midi, finger, state }], held: Set, wrong: Set,
   *      names: true|false, naming, hand: { hand, tips: [{ finger, midi, down }] } | null, pulse: 0..1 }
   * state: "next" (jetzt dran), "target" (gehört zum Griff), "done" (erledigt) */
  function draw(canvas, o) {
    const p = prepare(canvas); if (!p) return null;
    const c = p.ctx, geo = geometry(p.W, p.H, o.low, o.high, !!o.hand);
    const marks = new Map((o.marks || []).map(m => [m.midi, m]));
    const held = o.held || new Set(), wrong = o.wrong || new Set();
    const paint = k => {
      const m = marks.get(k.midi), isWrong = wrong.has(k.midi), isHeld = held.has(k.midi);
      rr(c, k.x + 0.5, k.y, k.w - 1, k.h, k.black ? [0, 0, 4, 4] : [0, 0, 6, 6]);
      c.fillStyle = k.black ? BLACK : WHITE; c.fill();
      let tint = null;
      if (isWrong) tint = rgba("#ef4444", k.black ? 0.85 : 0.6);
      else if (m && m.state === "done") tint = rgba("#22c55e", k.black ? 0.8 : 0.45);
      else if (m && m.state === "next") tint = rgba(FINGER_COL[m.finger] || "#2dd4ff", (k.black ? 0.75 : 0.45) + 0.2 * (o.pulse || 0));
      else if (m) tint = rgba(FINGER_COL[m.finger] || "#2dd4ff", k.black ? 0.5 : 0.22);
      if (tint) { c.fillStyle = tint; c.fill(); }
      if (isHeld && !isWrong) { c.fillStyle = k.black ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"; c.fill(); }
      c.strokeStyle = EDGE; c.lineWidth = 1.2; c.stroke();
    };
    for (const k of geo.keys.values()) if (!k.black) paint(k);
    for (const k of geo.keys.values()) if (k.black) paint(k);
    // Namen: jedes C und jede markierte weiße Taste
    if (o.names !== false) {
      c.font = `600 ${Math.max(9, Math.round(geo.ww * 0.27))}px ${UI}`; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillStyle = "#6b5a48";
      for (const k of geo.keys.values()) if (!k.black && (k.midi % 12 === 0 || marks.has(k.midi))) c.fillText(MU.name(k.midi, o.naming || "de"), k.x + k.w / 2, k.y + k.h - 5);
    }
    const placed = o.hand ? drawHand(c, geo, o.hand) : null;
    const at = (midi, finger) => placed && placed[finger] && placed[finger].midi === midi ? placed[finger] : tipOf(geo, midi);
    // Fingerkreise obenauf
    const dot = (x, y, finger, r, alpha, ring) => {
      c.save(); c.globalAlpha = alpha;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = FINGER_COL[finger] || "#64748b"; c.fill();
      c.lineWidth = ring ? 3 : 2; c.strokeStyle = ring || "#ffffff"; c.stroke();
      c.fillStyle = "#ffffff"; c.font = `700 ${Math.round(r * 1.25)}px ${UI}`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(String(finger), x, y + r * 0.08);
      c.restore();
    };
    if (o.hand) for (const t of o.hand.tips) {
      if (marks.has(t.midi) && marks.get(t.midi).finger === t.finger) continue;
      const q = at(t.midi, t.finger); dot(q.x, q.y, t.finger, Math.min(geo.ww * 0.24, 11), 0.55);
    }
    for (const m of marks.values()) {
      if (!m.finger) continue;
      const k = geo.keys.get(m.midi); if (!k) continue;
      const q = at(m.midi, m.finger), r = k.black || q.y < geo.top + geo.bh ? Math.min(geo.bw * 0.5, 14) : Math.min(geo.ww * 0.36, 17);
      if (m.state === "next") { c.save(); c.globalAlpha = 0.5 * (1 - (o.pulse || 0)); c.beginPath(); c.arc(q.x, q.y, r + 4 + 10 * (o.pulse || 0), 0, Math.PI * 2); c.strokeStyle = FINGER_COL[m.finger]; c.lineWidth = 3; c.stroke(); c.restore(); }
      dot(q.x, q.y, m.finger, r, 1, m.state === "done" ? "#16a34a" : null);
    }
    canvas._geo = geo;
    return geo;
  }

  /* --- Die Hand ------------------------------------------------------------ *
   * Feste Proportionen nach üblichen Handmaßen, gemessen in Tastenbreiten
   * (eine weiße Taste ist 2,35 cm breit): Mittelfinger 8,2 cm vom Grundgelenk
   * zur Kuppe, Zeigefinger 7,3, Ringfinger 7,6, kleiner Finger 6,1, Daumen
   * 6,3; Handfläche an den Knöcheln 8,5 cm breit. Der Daumen setzt seitlich
   * und tiefer an. Von oben gesehen sind gekrümmte Finger verkürzt, auf etwa
   * 70 % ihrer Länge; gestreckt reichen sie weiter. Die Hand wird als Ganzes
   * so gelegt, dass jede Kuppe ihre Taste erreicht, ohne dass ein Finger
   * länger wird, als er ist. Links ist rechts gespiegelt.
   * ------------------------------------------------------------------------ */
  const HAND = {
    len:   { 1: 2.7, 2: 3.1, 3: 3.5, 4: 3.25, 5: 2.6 },
    width: { 1: 0.92, 2: 0.76, 3: 0.78, 4: 0.72, 5: 0.64 },
    // Grundgelenke relativ zur Mitte der Knöchellinie (rechte Hand von oben: x nach rechts, y zum Spieler hin)
    joint: { 1: [-1.7, 1.25], 2: [-1.15, 0.04], 3: [-0.38, -0.14], 4: [0.4, 0.0], 5: [1.12, 0.32] },
    palm:  [[-1.6, -0.12], [-0.4, -0.42], [0.5, -0.3], [1.52, 0.06], [1.66, 1.3], [1.32, 3.3], [-1.0, 3.4], [-1.8, 2.5], [-2.12, 1.35]],
    curl: 0.7, reach: 0.97,
  };
  // Verjüngter Finger von a (Gelenk) nach b (Kuppe)
  function fingerPath(c, a, b, wa, wb) {
    const ang = Math.atan2(b.y - a.y, b.x - a.x), s = Math.sin(ang), co = Math.cos(ang);
    c.beginPath();
    c.moveTo(a.x + s * wa / 2, a.y - co * wa / 2);
    c.lineTo(b.x + s * wb / 2, b.y - co * wb / 2);
    c.arc(b.x, b.y, wb / 2, ang - Math.PI / 2, ang + Math.PI / 2);
    c.lineTo(a.x - s * wa / 2, a.y + co * wa / 2);
    c.arc(a.x, a.y, wa / 2, ang + Math.PI / 2, ang - Math.PI / 2 + Math.PI * 2);
    c.closePath();
  }
  function smoothShape(c, pts) {
    const n = pts.length, mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    c.beginPath();
    let m = mid(pts[n - 1], pts[0]); c.moveTo(m.x, m.y);
    for (let i = 0; i < n; i++) { const q = pts[i], nx = pts[(i + 1) % n]; m = mid(q, nx); c.quadraticCurveTo(q.x, q.y, m.x, m.y); }
    c.closePath();
  }
  // Wo die Hand liegen muss, damit alle Kuppen ihre Tasten erreichen. tips: { finger: { x, y } }
  // only: die Finger, nach denen sich die Höhe richtet (sonst alle langen Finger).
  function poseFor(tips, u, dir, only) {
    const long = [2, 3, 4, 5].filter(f => tips[f]);
    const lead = only && only.length ? only : long;
    let cx = long.reduce((a, f) => a + tips[f].x - dir * HAND.joint[f][0] * u, 0) / Math.max(1, long.length);
    const solveY = () => {
      let pref = 0, bound = Infinity;
      for (const f of lead) {
        const jx = cx + dir * HAND.joint[f][0] * u, dx = tips[f].x - jx, max = HAND.len[f] * u * HAND.reach;
        const dyMax = Math.sqrt(Math.max(0, max * max - dx * dx));
        pref += tips[f].y + HAND.curl * HAND.len[f] * u - HAND.joint[f][1] * u;
        bound = Math.min(bound, tips[f].y + dyMax - HAND.joint[f][1] * u);
      }
      return Math.min(pref / Math.max(1, lead.length), bound);
    };
    let cy = solveY();
    // Der Daumen: reicht er nicht, rückt die Hand ein Stück zu ihm hin.
    if (tips[1]) for (let k = 0; k < 3; k++) {
      const jx = cx + dir * HAND.joint[1][0] * u, jy = cy + HAND.joint[1][1] * u;
      const dx = tips[1].x - jx, dy = tips[1].y - jy, d = Math.hypot(dx, dy), max = HAND.len[1] * u * HAND.reach;
      if (d <= max) break;
      cx += (dx / d) * (d - max) * 0.7; cy = Math.min(solveY(), cy + (dy / d) * (d - max) * 0.4);
    }
    return { cx, cy };
  }
  function paintHand(c, pose, tips, u, dir, bottom, down) {
    const P = (q) => ({ x: pose.cx + dir * q[0] * u, y: pose.cy + q[1] * u });
    c.save();
    c.globalAlpha = 0.95; c.lineJoin = "round"; c.lineCap = "round";
    c.fillStyle = SKIN; c.strokeStyle = SKIN_EDGE; c.lineWidth = 2;
    // Unterarm
    const wl = P([-1.0, 3.3]), wr = P([1.32, 3.2]);
    c.beginPath(); c.moveTo(wl.x, wl.y - u * 0.3); c.lineTo(P([-1.15, 9]).x, bottom + 40); c.lineTo(P([1.5, 9]).x, bottom + 40); c.lineTo(wr.x, wr.y - u * 0.3); c.closePath(); c.fill(); c.stroke();
    // Handfläche
    smoothShape(c, HAND.palm.map(P)); c.fill(); c.stroke();
    // Finger, der Daumen zuerst, damit der Zeigefinger über seinem Ansatz liegt
    for (const f of [1, 5, 4, 2, 3]) {
      const t = tips[f]; if (!t) continue;
      const a = P(HAND.joint[f]), w = HAND.width[f] * u;
      fingerPath(c, a, t, w, w * 0.78);
      c.fillStyle = down && !down[f] ? SKIN_LIGHT : SKIN; c.fill(); c.stroke();
      // Fingernagel: von oben sieht man den Handrücken
      const ang = Math.atan2(t.y - a.y, t.x - a.x), nx = t.x - Math.cos(ang) * w * 0.18, ny = t.y - Math.sin(ang) * w * 0.18;
      c.save(); c.translate(nx, ny); c.rotate(ang); c.beginPath(); c.ellipse(0, 0, w * 0.3, w * 0.24, 0, 0, Math.PI * 2); c.fillStyle = "rgba(255,240,232,.85)"; c.fill(); c.lineWidth = 1; c.strokeStyle = "rgba(196,138,90,.6)"; c.stroke(); c.restore();
    }
    // Knöchel andeuten
    c.strokeStyle = "rgba(196,138,90,.55)"; c.lineWidth = 1.5;
    for (const f of [2, 3, 4, 5]) { const a = P(HAND.joint[f]); c.beginPath(); c.arc(a.x, a.y + u * 0.12, u * 0.22, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    c.restore();
  }
  /* h: { hand: "r"|"l", tips: [{ finger, midi, down }] } mit allen fünf Fingern.
   * Liegt ein langer Finger auf einer schwarzen Taste, rückt die Hand in die
   * Tasten hinein: die Höhe richtet sich nach den schwarzen Tasten, und die
   * Finger auf weißen Tasten spielen weiter hinten, zwischen den schwarzen.
   * Gibt zurück, wo jede Kuppe liegt. */
  function drawHand(c, geo, h) {
    if (!h.tips || h.tips.length < 5) return null;
    const dir = h.hand === "l" ? -1 : 1, u = geo.ww, tips = {}, down = {}, midi = {};
    for (const t of h.tips) { tips[t.finger] = tipOf(geo, t.midi); down[t.finger] = !!t.down; midi[t.finger] = t.midi; }
    const onBlack = [2, 3, 4, 5].filter(f => MU.isBlack(midi[f]) && down[f]);
    let pose = poseFor(tips, u, dir, onBlack);
    if (onBlack.length || (MU.isBlack(midi[1]) && down[1])) {
      for (let pass = 0; pass < 2; pass++) {
        for (const f of [1, 2, 3, 4, 5]) {
          if (MU.isBlack(midi[f])) continue;
          const natural = pose.cy + HAND.joint[f][1] * u - HAND.curl * HAND.len[f] * u * (f === 1 ? 0.8 : 1);
          tips[f] = tipOf(geo, midi[f], natural);
        }
        pose = poseFor(tips, u, dir, onBlack);
      }
    }
    paintHand(c, pose, tips, u, dir, geo.H, down);
    const out = {}; for (const f of [1, 2, 3, 4, 5]) out[f] = Object.assign({ midi: midi[f] }, tips[f]);
    return out;
  }

  // Legende: eine offene Hand von oben mit nummerierten Fingerkuppen, in denselben Proportionen.
  function drawHandIcon(canvas, hand) {
    const p = prepare(canvas); if (!p) return;
    const c = p.ctx, W = p.W, H = p.H, dir = hand === "l" ? -1 : 1;
    const u = Math.min(W / 6.6, (H - 22) / 8.2);
    const pose = { cx: W / 2 + dir * u * 0.25, cy: 22 + u * 3.7 };
    const ANG = { 1: -58, 2: -13, 3: -1, 4: 11, 5: 27 }, tips = {};
    for (const f of [1, 2, 3, 4, 5]) {
      const an = (ANG[f] * dir - 90) * Math.PI / 180, L = HAND.len[f] * u * 0.95;
      tips[f] = { x: pose.cx + dir * HAND.joint[f][0] * u + Math.cos(an) * L, y: pose.cy + HAND.joint[f][1] * u + Math.sin(an) * L };
    }
    paintHand(c, pose, tips, u, dir, H - 18, null);
    for (const f of [1, 2, 3, 4, 5]) {
      const r = u * 0.42, t = tips[f];
      c.beginPath(); c.arc(t.x, t.y, r, 0, Math.PI * 2); c.fillStyle = FINGER_COL[f]; c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 2; c.stroke();
      c.fillStyle = "#fff"; c.font = `700 ${Math.round(r * 1.25)}px ${UI}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(f), t.x, t.y + r * 0.08);
    }
    c.fillStyle = "rgba(246,237,217,.92)"; c.fillRect(0, H - 18, W, 18);
    c.fillStyle = "#6b5a48"; c.font = `600 12px ${UI}`; c.textAlign = "center"; c.textBaseline = "alphabetic";
    c.fillText(hand === "l" ? "linke Hand" : "rechte Hand", W / 2, H - 5);
  }

  function hit(canvas, clientX, clientY) {
    const geo = canvas._geo; if (!geo) return null;
    const r = canvas.getBoundingClientRect(), x = clientX - r.left, y = clientY - r.top;
    if (y < geo.top || y > geo.bottom) return null;
    for (const k of geo.keys.values()) if (k.black && x >= k.x && x <= k.x + k.w && y <= k.y + k.h) return k.midi;
    for (const k of geo.keys.values()) if (!k.black && x >= k.x && x <= k.x + k.w) return k.midi;
    return null;
  }

  /* Wohin die fünf Finger gehören, wenn einige davon Tasten greifen: die
   * übrigen ruhen auf den Tasten dazwischen bzw. daneben. assigned: [{ finger, midi }] */
  function restingTips(assigned, hand) {
    const by = new Map(assigned.map(a => [a.finger, a.midi]));
    const known = Array.from(by.keys()).sort((a, b) => a - b);
    const up = hand === "l" ? -1 : 1;                    // rechte Hand: höhere Finger liegen höher
    const whiteStep = (m, n) => { let x = m, k = Math.abs(n), d = Math.sign(n); while (k > 0) { x += d; if (!MU.isBlack(x)) k--; } return x; };
    const tips = [];
    for (let f = 1; f <= 5; f++) {
      if (by.has(f)) { tips.push({ finger: f, midi: by.get(f), down: true }); continue; }
      const below = known.filter(k => k < f).pop(), above = known.find(k => k > f);
      let midi;
      if (below != null && above != null) {
        const a = by.get(below), b = by.get(above);
        midi = Math.round(a + (b - a) * (f - below) / (above - below));
        if (MU.isBlack(midi) && !MU.isBlack(midi + (b > a ? 1 : -1)) && Math.abs(b - a) > 2) midi += (b > a ? 1 : -1);
      } else if (below != null) midi = whiteStep(by.get(below), up * (f - below));
      else if (above != null) midi = whiteStep(by.get(above), -up * (above - f));
      else midi = 60 + up * (f - 3) * 2;
      tips.push({ finger: f, midi, down: false });
    }
    return tips;
  }

  return { FINGER_COL, FINGER_NAME, rangeFor, draw, drawHand, drawHandIcon, hit, restingTips, tipOf };
})();
