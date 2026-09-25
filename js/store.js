/* store.js: IndexedDB: Ereignisse, roher Eingabestrom, Sitzungen, Stücke,
 * Schlüssel/Wert. Schreibzugriffe werden gesammelt und alle 400 ms in einer
 * Transaktion weggeschrieben; ein stufenloses Pedal erzeugt sonst Dutzende
 * Transaktionen pro Sekunde. Fehlt IndexedDB (privater Modus), läuft alles
 * im Speicher weiter, nur eben nicht über das Neuladen hinaus. */
"use strict";
window.NT = window.NT || {};

NT.store = (() => {
  const NAME = "notentrainer", VERSION = 1;
  let db = null, available = false;
  const pending = { events: [], input: [] };
  let flushTimer = 0;

  function open() {
    return new Promise(resolve => {
      if (!window.indexedDB) return resolve(false);
      let req;
      try { req = indexedDB.open(NAME, VERSION); } catch (e) { return resolve(false); }
      req.onupgradeneeded = () => {
        const d = req.result;
        const ev = d.createObjectStore("events", { keyPath: "id" });
        ev.createIndex("session", "session"); ev.createIndex("midi", "midi");
        const inp = d.createObjectStore("input", { keyPath: "id" });
        inp.createIndex("session", "session");
        d.createObjectStore("sessions", { keyPath: "id" });
        d.createObjectStore("pieces", { keyPath: "id" });
        d.createObjectStore("kv", { keyPath: "key" });
      };
      req.onsuccess = () => { db = req.result; available = true; resolve(true); };
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    });
  }

  function queue(store, row) {
    pending[store].push(row);
    if (!flushTimer) flushTimer = setTimeout(flush, 400);
  }
  function flush() {
    flushTimer = 0;
    if (!db) { pending.events.length = 0; pending.input.length = 0; return; }
    const stores = Object.keys(pending).filter(k => pending[k].length);
    if (!stores.length) return;
    try {
      const tx = db.transaction(stores, "readwrite");
      for (const k of stores) { const os = tx.objectStore(k); for (const r of pending[k]) os.put(r); pending[k].length = 0; }
    } catch (e) { /* Speicher voll oder geschlossen: weiter ohne */ }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  window.addEventListener("pagehide", flush);

  const withStore = (name, mode, fn) => new Promise((resolve, reject) => {
    if (!db) return resolve(undefined);
    let tx; try { tx = db.transaction(name, mode); } catch (e) { return resolve(undefined); }
    const req = fn(tx.objectStore(name));
    if (!req) { tx.oncomplete = () => resolve(undefined); return; }
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  const all = name => withStore(name, "readonly", os => os.getAll()).then(r => r || []);
  const put = (name, row) => withStore(name, "readwrite", os => os.put(row));
  const del = (name, key) => withStore(name, "readwrite", os => os.delete(key));
  const clear = name => withStore(name, "readwrite", os => os.clear());
  const kvGet = key => withStore("kv", "readonly", os => os.get(key)).then(r => r ? r.value : undefined);
  const kvSet = (key, value) => put("kv", { key, value });

  async function exportAll() {
    flush();
    const [events, input, sessions, pieces, kv] = await Promise.all([all("events"), all("input"), all("sessions"), all("pieces"), all("kv")]);
    return { app: "notentrainer", version: 1, exportedAt: new Date().toISOString(), events, input, sessions, pieces, kv };
  }
  // Zusammenführen, nicht ersetzen: gleiche ids werden übersprungen (put ist
  // idempotent), Einstellungen des anderen Geräts bleiben draußen.
  async function importAll(data) {
    if (!data || data.app !== "notentrainer") throw new Error("Keine Notentrainer-Sicherung");
    const counts = {};
    for (const name of ["events", "input", "sessions", "pieces"]) {
      const rows = Array.isArray(data[name]) ? data[name] : [];
      const have = new Set((await all(name)).map(r => r.id));
      let n = 0;
      if (db && rows.length) {
        const tx = db.transaction(name, "readwrite"); const os = tx.objectStore(name);
        for (const r of rows) if (r && r.id && !have.has(r.id)) { os.put(r); n++; }
        await new Promise(res => { tx.oncomplete = res; tx.onerror = res; });
      }
      counts[name] = n;
    }
    for (const r of (data.kv || [])) if (r && r.key === "device") {
      const mine = await kvGet("device");
      await kvSet("device", mergeDevice(mine, r.value));
    }
    return counts;
  }
  function mergeDevice(a, b) {
    if (!a) return b; if (!b) return a;
    const out = JSON.parse(JSON.stringify(a));
    for (const k of Object.keys(b.pedal || {})) {
      const p = out.pedal[k] = out.pedal[k] || {};
      const q = b.pedal[k];
      p.seen = p.seen || q.seen; p.between = p.between || q.between;
      p.min = Math.min(p.min ?? 127, q.min ?? 127); p.max = Math.max(p.max ?? 0, q.max ?? 0);
    }
    return out;
  }
  async function wipe() {
    for (const n of ["events", "input", "sessions"]) await clear(n);
    const keep = await kvGet("device");
    await clear("kv");
    if (keep) await kvSet("device", keep);
  }

  const newId = () => Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);

  return { open, queue, flush, all, put, del, clear, kvGet, kvSet, exportAll, importAll, wipe, newId,
           get available() { return available; } };
})();
