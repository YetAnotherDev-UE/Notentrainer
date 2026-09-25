/* charts.js: kleine Diagramme auf Canvas, ohne Bibliothek.
 * Zwei Formen reichen: Linie (Verlauf über Sitzungen) und Balken (Mengen,
 * Verteilungen). Farben aus der Palette der App, Beschriftung so ausgedünnt,
 * dass sich nichts überlappt. Bei zu wenig Daten steht ein Hinweis statt
 * eines leeren Rahmens. */
"use strict";
window.NT = window.NT || {};

NT.charts = (() => {
  const COL = { line: "#2dd4ff", fill: "rgba(45,212,255,.18)", grid: "rgba(255,255,255,.10)", axis: "rgba(255,255,255,.28)",
                text: "#a9bbe0", bar: "#a78bfa", accent: "#ffd23f", zero: "rgba(255,255,255,.45)" };
  const PAD = { l: 50, r: 18, t: 22, b: 34 };

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

  const nice = (v, unit) => {
    const abs = Math.abs(v);
    const s = abs >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(Math.round(v));
    return s + (unit ? " " + unit : "");
  };

  function empty(c, W, H, text) {
    c.fillStyle = COL.text; c.font = "14px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(text || "Noch nicht genug Daten. Spiel ein paar Runden.", W / 2, H / 2);
  }

  // spec: { type: "line"|"bars", points: [{ label, value, color }], unit, yMin, yMax, zeroLine, minPoints }
  function draw(canvas, spec) {
    const p = prepare(canvas); if (!p) return;
    const { ctx: c, W, H } = p;
    const pts = spec.points.filter(q => typeof q.value === "number" && !isNaN(q.value));
    if (pts.length < (spec.minPoints == null ? 2 : spec.minPoints)) return empty(c, W, H, spec.emptyText);

    let lo = spec.yMin != null ? spec.yMin : Math.min(...pts.map(q => q.value));
    let hi = spec.yMax != null ? spec.yMax : Math.max(...pts.map(q => q.value));
    if (spec.symmetric) { const m = Math.max(Math.abs(lo), Math.abs(hi), 1); lo = -m; hi = m; }
    if (hi === lo) { hi = lo + 1; }
    if (spec.yMin == null && !spec.symmetric) { const span = hi - lo; lo -= span * 0.1; hi += span * 0.1; if (spec.floorZero && lo < 0) lo = 0; }
    const x0 = PAD.l, x1 = W - PAD.r, y0 = PAD.t, y1 = H - PAD.b;
    const yOf = v => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
    const n = pts.length;
    const slot = (x1 - x0) / n;
    const xOf = i => spec.type === "bars" ? x0 + slot * (i + 0.5) : n === 1 ? (x0 + x1) / 2 : x0 + (i / (n - 1)) * (x1 - x0);

    // Raster und y-Beschriftung
    c.font = "11px system-ui, sans-serif"; c.textBaseline = "middle"; c.textAlign = "right";
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const v = lo + (hi - lo) * i / ticks, y = yOf(v);
      c.strokeStyle = COL.grid; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
      c.fillStyle = COL.text; c.fillText(nice(v, spec.unit), x0 - 8, y);
    }
    if (spec.zeroLine && lo < 0 && hi > 0) { c.strokeStyle = COL.zero; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0, yOf(0)); c.lineTo(x1, yOf(0)); c.stroke(); }

    // x-Beschriftung, ausgedünnt
    c.textAlign = "center"; c.textBaseline = "top"; c.fillStyle = COL.text;
    const maxLabels = Math.max(2, Math.floor((x1 - x0) / 54));
    const step = Math.ceil(n / maxLabels);
    pts.forEach((q, i) => { if (i % step === 0 || i === n - 1) c.fillText(q.label, xOf(i), y1 + 8); });

    if (spec.type === "bars") {
      const w = Math.max(3, slot * 0.66);
      pts.forEach((q, i) => {
        const x = xOf(i) - w / 2, yv = yOf(q.value), yz = yOf(Math.max(lo, Math.min(hi, 0)));
        const top = Math.min(yv, yz), h = Math.max(2, Math.abs(yz - yv));
        c.fillStyle = q.color || COL.bar;
        c.beginPath(); c.roundRect ? c.roundRect(x, top, w, h, Math.min(5, w / 2)) : c.rect(x, top, w, h); c.fill();
      });
    } else {
      // Fläche unter der Linie
      c.beginPath(); c.moveTo(xOf(0), yOf(pts[0].value));
      pts.forEach((q, i) => c.lineTo(xOf(i), yOf(q.value)));
      c.lineTo(xOf(n - 1), y1); c.lineTo(xOf(0), y1); c.closePath();
      // Fläche in der Linienfarbe, nach unten auslaufend
      const lc = spec.color || COL.line, rgb = [1, 3, 5].map(i => parseInt(lc.slice(i, i + 2), 16)).join(",");
      const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, "rgba(" + rgb + ",.22)"); g.addColorStop(1, "rgba(" + rgb + ",0)");
      c.fillStyle = g; c.fill();
      // Linie
      c.strokeStyle = spec.color || COL.line; c.lineWidth = 2.5; c.lineJoin = "round"; c.lineCap = "round";
      c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(xOf(i), yOf(q.value)) : c.moveTo(xOf(i), yOf(q.value))); c.stroke();
      // Punkte
      pts.forEach((q, i) => { c.fillStyle = q.color || spec.color || COL.line; c.beginPath(); c.arc(xOf(i), yOf(q.value), i === n - 1 ? 4.5 : 3, 0, Math.PI * 2); c.fill(); });
      // letzter Wert beschriftet
      const last = pts[n - 1];
      c.font = "700 12px system-ui, sans-serif"; c.fillStyle = "#ffffff"; c.textAlign = "right"; c.textBaseline = "bottom";
      c.fillText(nice(last.value, spec.unit), xOf(n - 1) - 2, yOf(last.value) - 8);
    }
  }

  return { draw };
})();
