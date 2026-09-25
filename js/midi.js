/* midi.js — Web MIDI, robust gegen Brücken, die den Standard nur ungefähr
 * nachbauen (App-Browser auf dem iPad). Drei Wege, auf denen es scheitern
 * kann, jeder mit eigener Meldung: fehlende API, Ablehnung, keine Antwort.
 * Eingänge werden alle angebunden; virtuelle Systemanschlüsse („Session 1",
 * IAC) zählen nicht als Instrument. Ausgänge stehen fürs Abspielen bereit. */
"use strict";
window.NT = window.NT || {};

NT.midi = (() => {
  const TIMEOUT = 4000;
  let access = null, onMessage = () => {}, onStatus = () => {};
  const bound = new WeakSet();
  const isVirtual = name => /^session \d+$/i.test(name) || /network|virtual|virtuell|iac/i.test(name);

  function asList(x) {
    if (!x) return null;
    if (Array.isArray(x)) return x;
    if (typeof x[Symbol.iterator] === "function") return Array.from(x);
    if (typeof x.next === "function") { const out = []; for (let r = x.next(); r && !r.done; r = x.next()) out.push(r.value); return out; }
    if (typeof x.length === "number") return Array.from(x);
    if (typeof x === "object") return Object.values(x);
    return null;
  }
  function ports(coll) {
    if (!coll) return [];
    const isPort = p => p && typeof p === "object";
    if (typeof coll.values === "function") { try { const v = asList(coll.values()); if (v) return v.filter(isPort); } catch (e) {} }
    if (typeof coll.forEach === "function") { try { const out = []; coll.forEach(v => out.push(v)); return out.filter(isPort); } catch (e) {} }
    const d = asList(coll); return d ? d.filter(isPort) : [];
  }
  function listen(input) {
    if (bound.has(input)) return;
    const handler = e => onMessage(e.data || (e.detail && e.detail.data) || e);
    let took = false;
    try { input.onmidimessage = handler; took = input.onmidimessage === handler; } catch (e) {}
    if (!took && typeof input.addEventListener === "function") input.addEventListener("midimessage", handler);
    bound.add(input);
  }

  function bind() {
    const real = [], virtual = [];
    for (const input of ports(access.inputs)) {
      listen(input);
      (isVirtual(input.name || "") ? virtual : real).push(input.name || "MIDI-Eingang");
    }
    if (real.length) return onStatus("live", "Verbunden: " + real.join(", "), { real, virtual });
    if (virtual.length) return onStatus("idle", "Bereit, aber kein Instrument: nur " + virtual.join(", ") + " (virtueller Anschluss). Interface anstecken.", { real, virtual });
    const outs = ports(access.outputs).map(o => o.name || "Ausgang");
    onStatus("idle", outs.length
      ? "Nur Ausgang gefunden (" + outs.join(", ") + "), kein Eingang — das Instrument sendet nichts."
      : "Kein Gerät gefunden. Interface anstecken, Piano einschalten, dann „MIDI verbinden“.", { real, virtual });
  }

  function fail(err, shape) {
    const why = (err && err.name) || "unbekannt";
    const hint = why === "NotAllowedError" ? "Tipp auf „MIDI verbinden“ — manche Browser fragen nur aus einer Nutzeraktion heraus."
      : why === "NotSupportedError" ? "Dieser Browser liefert kein MIDI aus — nimm Chrome."
      : "Unerwarteter Grund, siehe Meldung.";
    let shapeText = "";
    if (shape !== undefined) { try { shapeText = " Form von inputs: " + Object.prototype.toString.call(shape) + " keys[" + Object.keys(shape || {}).slice(0, 6).join(",") + "]"; } catch (e) {} }
    onStatus("fail", "MIDI fehlgeschlagen — " + why + ((err && err.message) ? ": " + err.message : "") + " " + hint + shapeText, { retry: true });
  }

  async function init() {
    if (!navigator.requestMIDIAccess) {
      onStatus("fail", window.isSecureContext
        ? "Dieser Browser kennt kein Web MIDI. Nimm Chrome, oder auf dem iPad die App „MIDIWeb Browser“."
        : location.origin + " gilt nicht als sicher, darum ist Web MIDI abgeschaltet. Über HTTPS öffnen oder die Adresse in chrome://flags freischalten.", {});
      return;
    }
    const bridged = !/native code/.test(String(navigator.requestMIDIAccess));
    onStatus("busy", "MIDI wird gesucht…" + (bridged ? " (MIDI-Brücke der App erkannt)" : ""), {});
    let request;
    try { request = Promise.resolve(navigator.requestMIDIAccess()); } catch (err) { fail(err); return; }
    let answered = false;
    const timer = setTimeout(() => {
      if (answered) return;
      onStatus("fail", "Keine Antwort auf die MIDI-Anfrage nach " + (TIMEOUT / 1000) + " s. In der App die MIDI-Freigabe prüfen, dann „MIDI verbinden“.", { retry: true });
    }, TIMEOUT);
    try {
      const a = await request;
      answered = true; clearTimeout(timer);
      if (!a || !("inputs" in a)) throw new Error("Antwort ohne inputs (" + typeof a + ")");
      access = a;
      try { a.onstatechange = bind; } catch (e) {}
      if (typeof a.addEventListener === "function") a.addEventListener("statechange", bind);
      bind();
    } catch (err) { answered = true; clearTimeout(timer); fail(err, access ? access.inputs : undefined); }
  }

  /* --- Ausgang -------------------------------------------------------- */
  const outputs = () => access ? ports(access.outputs).map(o => ({ name: o.name || "Ausgang", port: o })) : [];
  function output(name) {
    const list = outputs();
    if (!list.length) return null;
    const pick = list.find(o => o.name === name) || list.find(o => !isVirtual(o.name)) || list[0];
    return pick.port;
  }
  function send(port, bytes, atMs) {
    if (!port || typeof port.send !== "function") return false;
    try { atMs ? port.send(bytes, atMs) : port.send(bytes); return true; } catch (e) { return false; }
  }

  return { init, outputs, output, send, isVirtual,
           set onMessage(f) { onMessage = f; }, set onStatus(f) { onStatus = f; },
           get access() { return access; } };
})();
