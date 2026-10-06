(() => {
  'use strict';
  const L = window.TTLogic; // pure rules, see logic.js

  // ---------- Constants ----------
  const VERSION = '0.3.0'; // keep equal to CACHE in sw.js
  const SCHEMA = 1;
  const DB_NAME = 'training-tracker';
  const BACKUP_FILE = 'training-tracker-backup.json';
  const BACKUP_STALE_DAYS = 7;
  const MODE_KEY = 'tt.mode';
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

  // name -> { keyPath, indexes }
  const STORES = {
    settings: { keyPath: 'id' },
    program: { keyPath: 'id' },
    workouts: { keyPath: 'id', indexes: ['date', 'status'] },
    sets: { keyPath: 'id', indexes: ['workoutId', 'exerciseName'] },
    runs: { keyPath: 'id', indexes: ['date'] },
    water: { keyPath: 'id', indexes: ['date'] },
    sleep: { keyPath: 'id', indexes: ['date'] },
    bodyweight: { keyPath: 'date' },
    nutrition: { keyPath: 'date' },
    checklist: { keyPath: 'date' },
  };
  const STORE_NAMES = Object.keys(STORES);

  // The app ships with no program. The user imports their own from Settings.
  const SEED_PROGRAM = { id: 'main', version: 1, warmup: '', notes: {}, sessions: [] };

  // ---------- Icons ----------
  const S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const F = 'fill="currentColor" opacity=".22"';
  const ICONS = {
    today: [`<rect x="3.5" y="5" width="17" height="15" rx="3" ${F}/>`, `<rect x="3.5" y="5" width="17" height="15" rx="3" ${S}/><path d="M3.5 10h17M8 3v4M16 3v4" ${S}/>`],
    dumbbell: [`<rect x="6" y="7" width="3" height="10" rx="1.2" ${F}/><rect x="15" y="7" width="3" height="10" rx="1.2" ${F}/>`, `<path d="M9 12h6M6 7.5v9M18 7.5v9M3.5 10v4M20.5 10v4" ${S}/>`],
    log: [`<rect x="5" y="3.5" width="14" height="17" rx="3" ${F}/>`, `<rect x="5" y="3.5" width="14" height="17" rx="3" ${S}/><path d="M9 9h6M9 13h6M9 17h3" ${S}/>`],
    chart: [`<rect x="4" y="12" width="4" height="8" rx="1" ${F}/><rect x="10" y="7" width="4" height="13" rx="1" ${F}/><rect x="16" y="4" width="4" height="16" rx="1" ${F}/>`, `<path d="M6 20v-8M12 20V7M18 20V4M3.5 20.5h17" ${S}/>`],
    gear: [`<circle cx="12" cy="12" r="7.5" ${F}/>`, `<circle cx="12" cy="12" r="3" ${S}/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6" ${S}/>`],
    check: [``, `<path d="M5 12.5l4.5 4.5L19 7.5" ${S}/>`],
    swap: [``, `<path d="M4 8h14M14.5 4.5L18 8l-3.5 3.5M20 16H6M9.5 12.5L6 16l3.5 3.5" ${S}/>`],
    plus: [``, `<path d="M12 5v14M5 12h14" ${S}/>`],
    minus: [``, `<path d="M5 12h14" ${S}/>`],
    download: [`<rect x="4" y="15" width="16" height="5" rx="2" ${F}/>`, `<path d="M12 4v10M8 10.5l4 4 4-4M5 19.5h14" ${S}/>`],
    upload: [`<rect x="4" y="15" width="16" height="5" rx="2" ${F}/>`, `<path d="M12 14V4M8 7.5l4-4 4 4M5 19.5h14" ${S}/>`],
    trash: [`<rect x="6" y="7" width="12" height="13" rx="2.5" ${F}/>`, `<path d="M4 7h16M9.5 7V4.5h5V7M7 7l.8 12.5h8.4L17 7" ${S}/>`],
    timer: [`<circle cx="12" cy="13.5" r="7.5" ${F}/>`, `<circle cx="12" cy="13.5" r="7.5" ${S}/><path d="M12 9.5v4l2.4 1.6M9.5 3.5h5" ${S}/>`],
    flame: [`<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4.2.2 1.2.8 1.8 1.5 2C10.4 8 11 5.5 12 3z" ${F}/>`, `<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4.2.2 1.2.8 1.8 1.5 2C10.4 8 11 5.5 12 3z" ${S}/>`],
    bed: [`<rect x="3" y="10" width="18" height="6" rx="2" ${F}/>`, `<path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" ${S}/>`],
    drop: [`<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z" ${F}/>`, `<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z" ${S}/>`],
    moon: [`<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" ${F}/>`, `<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" ${S}/>`],
    scale: [`<rect x="4" y="4" width="16" height="16" rx="4" ${F}/>`, `<rect x="4" y="4" width="16" height="16" rx="4" ${S}/><path d="M8.5 9.5a5 5 0 0 1 7 0M12 13l2-2.5" ${S}/>`],
    run: [`<path d="M3.5 16.5V13l4-1.5 2 2.5h4l3 1.5c2.5.3 4 .8 4 2v.5h-17z" ${F}/>`, `<path d="M3.5 16.5V13l4-1.5 2 2.5h4l3 1.5c2.5.3 4 .8 4 2v.5h-17zM3.5 19.5h17" ${S}/>`],
    left: [``, `<path d="M14.5 5l-7 7 7 7" ${S}/>`],
    right: [``, `<path d="M9.5 5l7 7-7 7" ${S}/>`],
    shield: [`<path d="M12 3.5l7 2.5v5.5c0 4.2-3 7.3-7 9-4-1.700-7-4.800-7-9V6l7-2.500z" ${F}/>`, `<path d="M12 3.5l7 2.5v5.5c0 4.2-3 7.3-7 9-4-1.700-7-4.800-7-9V6l7-2.500z" ${S}/><path d="M9 12l2.200 2.200L15.500 10" ${S}/>`],
  };
  function icon(name, size = 20, duo = true) {
    const [fill, stroke] = ICONS[name] || ICONS.check;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${duo ? fill : ''}${stroke}</svg>`;
  }

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
  const fmtDate = (k, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => parseKey(k).toLocaleDateString(undefined, opts);
  const fmtTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: state.settings.units.time !== '24h' });
  const fmtClock = (sec) => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
  const fmtNum = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
  const range = (r) => (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`);
  const shortName = (name) => String(name).replace(/\s*\(.*\)\s*$/, '');
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

  // ---------- Database (IndexedDB) ----------
  let handle = null;
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, SCHEMA);
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const [name, cfg] of Object.entries(STORES)) {
          const os = d.objectStoreNames.contains(name) ? req.transaction.objectStore(name) : d.createObjectStore(name, { keyPath: cfg.keyPath });
          for (const ix of cfg.indexes || []) if (!os.indexNames.contains(ix)) os.createIndex(ix, ix);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  const wrap = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const store = (name, mode = 'readonly') => handle.transaction(name, mode).objectStore(name);
  const db = {
    get: (s, k) => wrap(store(s).get(k)),
    all: (s) => wrap(store(s).getAll()),
    byIndex: (s, ix, v) => wrap(store(s).index(ix).getAll(v)),
    put: (s, rec) => wrap(store(s, 'readwrite').put(rec)),
    del: (s, k) => wrap(store(s, 'readwrite').delete(k)),
    // ops: [['put', store, record] | ['delete', store, key]] applied in one transaction
    write(ops) {
      return new Promise((resolve, reject) => {
        const names = [...new Set(ops.map((o) => o[1]))];
        const t = handle.transaction(names, 'readwrite');
        for (const [kind, s, v] of ops) kind === 'put' ? t.objectStore(s).put(v) : t.objectStore(s).delete(v);
        t.oncomplete = resolve;
        t.onerror = t.onabort = () => reject(t.error);
      });
    },
    replaceAll(data) {
      return new Promise((resolve, reject) => {
        const t = handle.transaction(STORE_NAMES, 'readwrite');
        for (const s of STORE_NAMES) {
          const os = t.objectStore(s);
          os.clear();
          for (const r of data[s] || []) os.put(r);
        }
        t.oncomplete = resolve;
        t.onerror = t.onabort = () => reject(t.error);
      });
    },
  };

  // ---------- State ----------
  const state = {
    view: 'today',
    settings: null,
    program: null,
    logDate: null, // day shown in the Log tab (null = today)
    active: null, // { w: workout, sets: [], last: { [exIndex]: { date, sets } | null } }
  };
  let renderToken = 0;

  function defaultSettings() {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // most recent Monday
    return {
      id: 'main',
      bodyweightLb: null,
      units: { weight: 'lb', water: 'oz', time: '12h' },
      programStartDate: dateKey(d),
      dayMapping: { 0: 'rest', 1: 'rest', 2: 'rest', 3: 'rest', 4: 'rest', 5: 'rest', 6: 'rest' },
      waterQuickAdds: [8, 16, 34],
      targets: { protein: 140, calories: 3100, waterBaseOz: 100, sleepHours: 8, bedtime: '22:30', runMinutesWeek: [60, 120] },
      customItems: [],
      setsPromptDone: false,
      deloadDismissedOn: null,
      reviewAppliedOn: null,
      lastBackupAt: null,
    };
  }

  async function loadState() {
    let settings = await db.get('settings', 'main');
    if (!settings) { settings = defaultSettings(); await db.put('settings', settings); }
    const base = defaultSettings();
    state.settings = { ...base, ...settings, units: { ...base.units, ...settings.units }, targets: { ...base.targets, ...settings.targets }, dayMapping: { ...base.dayMapping, ...settings.dayMapping } };
    if (!Array.isArray(state.settings.customItems)) state.settings.customItems = [];
    let program = await db.get('program', 'main');
    if (!program) { program = structuredClone(SEED_PROGRAM); await db.put('program', program); }
    state.program = program;
    await loadActive();
  }

  async function loadActive() {
    const open = (await db.byIndex('workouts', 'status', 'in-progress')).sort((a, b) => b.startedAt - a.startedAt);
    if (!open.length) { state.active = null; return; }
    const w = open[0];
    const sets = (await db.byIndex('sets', 'workoutId', w.id)).sort(setOrder);
    const hist = await loadHistory();
    const last = {}, sugg = {};
    for (let i = 0; i < w.plan.length; i++) ({ last: last[i], sugg: sugg[i] } = exerciseInfo(hist, w.plan[i], w.id, programWeek(w.date)));
    state.active = { w, sets, last, sugg };
  }

  const setOrder = (a, b) => a.exIndex - b.exIndex || a.setNumber - b.setNumber;
  const saveSettings = () => db.put('settings', state.settings).catch(() => toast('Could not save. Browser storage is full or blocked.'));
  const saveSet = (s) => db.put('sets', s).catch(() => toast('Could not save that set. Browser storage is full or blocked.'));

  // ---------- Program logic ----------
  function programWeek(today = dateKey()) {
    return Math.floor(daysBetween(state.settings.programStartDate, today) / 7) + 1;
  }
  function sessionById(id) { return state.program.sessions.find((s) => s.id === id); }
  function plannedFor(date) {
    const id = state.settings.dayMapping[parseKey(date).getDay()];
    const note = state.program.notes?.[id];
    if (id === 'rest' || !id) return { kind: 'rest', label: 'Rest Day' };
    if (id === 'run') return { kind: 'run', label: 'Run Day', note };
    const session = sessionById(id);
    if (!session) return { kind: 'rest', label: 'Rest Day' };
    return { kind: 'lift', session, label: `${shortName(session.name)}${note ? ' ' + note : ''}` };
  }
  async function doneWorkouts() {
    return (await db.all('workouts')).filter((w) => w.status === 'done').sort((a, b) => (b.finishedAt || b.startedAt) - (a.finishedAt || a.startedAt));
  }
  function nextInRotation(done) {
    const order = state.program.sessions.map((s) => s.id);
    if (!order.length) return null;
    const last = done.find((w) => order.includes(w.sessionId));
    if (!last) return sessionById(order[0]);
    return sessionById(order[(order.indexOf(last.sessionId) + 1) % order.length]);
  }

  function fmtSet(s, ex) {
    if (ex?.type === 'timed') return `${s.seconds ?? '?'}s`;
    const w = s.weightLb != null ? `${fmtNum(s.weightLb)}×` : '×';
    return `${w}${s.reps ?? '?'}${s.rir != null ? ` @${s.rir}` : ''}`;
  }

  // ---------- Workout actions ----------
  function blankSet(w, exIndex, setNumber, ex, weight) {
    return {
      id: `${w.id}:${exIndex}:${setNumber}`, workoutId: w.id, exIndex, exerciseName: ex.name,
      swappedFrom: ex.swappedFrom || null, setNumber, weightLb: weight ?? null,
      reps: null, seconds: null, rir: null, done: false, timestamp: Date.now(),
    };
  }

  async function startWorkout(sessionId) {
    if (state.active) { go('train'); return; }
    const session = sessionById(sessionId);
    if (!session) return;
    const plan = session.exercises.map((e) => ({ ...structuredClone(e), origName: e.name, swappedFrom: null }));
    const w = { id: uid(), date: dateKey(), sessionId, sessionName: session.name, startedAt: Date.now(), finishedAt: null, energy: null, note: '', status: 'in-progress', plan };
    const hist = await loadHistory();
    const week = programWeek(w.date);
    const last = {}, sugg = {};
    const sets = [];
    for (let i = 0; i < plan.length; i++) {
      ({ last: last[i], sugg: sugg[i] } = exerciseInfo(hist, plan[i], w.id, week));
      for (let n = 1; n <= plan[i].sets; n++) sets.push(blankSet(w, i, n, plan[i], sugg[i].weight));
    }
    try {
      await db.write([['put', 'workouts', w], ...sets.map((s) => ['put', 'sets', s])]);
    } catch { toast('Could not start the workout. Browser storage is full or blocked.'); return; }
    state.active = { w, sets, last, sugg };
    clearRest();
    go('train');
  }

  async function swapExercise(exIndex, newName) {
    const a = state.active;
    const ex = a.w.plan[exIndex];
    newName = newName.trim().slice(0, 80);
    if (!newName || newName === ex.name) return;
    ex.name = newName;
    ex.swappedFrom = newName === ex.origName ? null : ex.origName;
    ({ last: a.last[exIndex], sugg: a.sugg[exIndex] } = exerciseInfo(await loadHistory(), ex, a.w.id, programWeek(a.w.date)));
    const mine = a.sets.filter((s) => s.exIndex === exIndex);
    mine.forEach((s) => {
      s.exerciseName = newName; s.swappedFrom = ex.swappedFrom;
      if (!s.done) s.weightLb = a.sugg[exIndex].weight;
    });
    await db.write([['put', 'workouts', a.w], ...mine.map((s) => ['put', 'sets', s])]).catch(() => toast('Could not save the swap.'));
    render();
  }

  async function finishWorkout(energy, note) {
    const a = state.active;
    const dropped = a.sets.filter((s) => !s.done);
    const kept = a.sets.filter((s) => s.done);
    a.w.status = 'done';
    a.w.finishedAt = Date.now();
    a.w.energy = energy;
    a.w.note = note.trim().slice(0, 500);
    try {
      await db.write([['put', 'workouts', a.w], ...dropped.map((s) => ['delete', 'sets', s.id])]);
    } catch { a.w.status = 'in-progress'; toast('Could not save. Browser storage is full or blocked.'); return; }
    state.active = null;
    clearRest();
    releaseWake();
    const mins = Math.max(1, Math.round((a.w.finishedAt - a.w.startedAt) / 60000));
    toast(`Workout saved · ${kept.length} ${kept.length === 1 ? 'set' : 'sets'} · ${mins} min`);
    go('today');
  }

  async function discardWorkout() {
    const a = state.active;
    await db.write([['delete', 'workouts', a.w.id], ...a.sets.map((s) => ['delete', 'sets', s.id])]).catch(() => {});
    state.active = null;
    clearRest();
    releaseWake();
    toast('Workout discarded');
    go('today');
  }

  // ---------- Rest timer ----------
  let rest = null; // { endsAt, over, overAt }
  let audioCtx = null;
  function ensureAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch { /* sound is optional */ }
  }
  function beep() {
    if (!audioCtx) return;
    try {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime;
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.start(t); o.stop(t + 0.7);
    } catch { /* ignore */ }
  }
  function startRest(sec) {
    ensureAudio();
    rest = { endsAt: Date.now() + sec * 1000, over: false, overAt: 0 };
    const bar = $('#restbar');
    bar.className = 'restbar';
    bar.innerHTML = `<span class="lbl">Rest</span><span class="time" id="rest-time">${fmtClock(sec)}</span><button data-rest="add">+15s</button><button data-rest="skip">Skip</button>`;
    bar.hidden = false;
    document.body.classList.add('resting');
  }
  function clearRest() {
    rest = null;
    $('#restbar').hidden = true;
    document.body.classList.remove('resting');
  }
  function tick() {
    if (rest) {
      const left = Math.ceil((rest.endsAt - Date.now()) / 1000);
      const bar = $('#restbar'), time = $('#rest-time');
      if (left > 0) { if (time) time.textContent = fmtClock(left); }
      else if (!rest.over) {
        rest.over = true; rest.overAt = Date.now();
        bar.classList.add('over');
        bar.innerHTML = `<span class="time">Rest over · Go!</span><button data-rest="skip">Dismiss</button>`;
        try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch { /* ignore */ }
        beep();
      } else if (Date.now() - rest.overAt > 8000) clearRest();
    }
    const el = $('[data-elapsed]');
    if (el && state.active) el.textContent = `${Math.max(0, Math.floor((Date.now() - state.active.w.startedAt) / 60000))} min`;
  }

  // Keep the screen awake during a workout (best effort).
  let wake = null;
  async function acquireWake() {
    try { if (!wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch { /* ignore */ }
  }
  function releaseWake() { try { wake && wake.release(); } catch { /* ignore */ } wake = null; }

  // ---------- Render: shared pieces ----------
  const pageHead = (ic, title, sub, rawSub = false) => `<header class="page-head"><div class="ico">${icon(ic, 24)}</div><div><h1>${esc(title)}</h1><p class="sub">${rawSub ? sub : esc(sub)}</p></div></header>`;
  const cardHead = (ic, title, pill = '') => `<div class="card-head"><div class="ico">${icon(ic, 18, false)}</div><h2>${esc(title)}</h2>${pill}</div>`;

  function applyMode() {
    let mode = 'dark';
    try { mode = localStorage.getItem(MODE_KEY) || 'dark'; } catch { /* ignore */ }
    const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-mode', dark ? 'dark' : 'light');
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    return mode;
  }

  const noProgramCard = () => `<section class="card">${cardHead('dumbbell', 'No Program Yet')}
    <p class="caption">This app does not include a workout program. Import yours from a JSON file to get started.</p>
    <button class="btn btn-primary" data-act="import-program">Import Program</button></section>`;

  // ---------- Daily logs ----------
  const OZ_L = 0.0295735;
  const r1 = (n) => Math.round(n * 10) / 10;
  const r2 = (n) => Math.round(n * 100) / 100;
  const useL = () => state.settings.units.water === 'L';
  const fmtWater = (oz) => (useL() ? `${r2(oz * OZ_L)} L` : `${r1(oz)} oz`);
  const waterToDisplay = (oz) => (useL() ? r2(oz * OZ_L) : r1(oz));
  const waterToOz = (v) => (useL() ? v / OZ_L : v);
  const waterUnit = () => (useL() ? 'L' : 'oz');
  const mins = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const hhmm = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtHM = (t) => {
    if (!t) return '—';
    if (state.settings.units.time === '24h') return t;
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
  };
  const sleepHours = L.sleepHours;
  // Times before noon count as "after midnight", so 12:30 AM is later than 11 PM.
  const lateAdj = (m) => (m < 720 ? m + 1440 : m);
  const bedOnTime = (bed) => lateAdj(mins(bed)) <= lateAdj(mins(state.settings.targets.bedtime));
  function parseDuration(v) {
    v = String(v).trim();
    if (!v) return null;
    if (v.includes(':')) { const [m, s] = v.split(':'); const mm = num(m), ss = num(s); return mm == null || ss == null ? null : mm + ss / 60; }
    return num(v);
  }
  function fmtPace(min, mi) {
    const sec = Math.round((min * 60) / mi);
    return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
  }
  const fmtDur = (min) => `${r1(min)} min`;

  async function dayData(date) {
    const [water, sleepRows, weight, nutrition, checklist, runs, workouts] = await Promise.all([
      db.byIndex('water', 'date', date), db.byIndex('sleep', 'date', date), db.get('bodyweight', date),
      db.get('nutrition', date), db.get('checklist', date), db.byIndex('runs', 'date', date), db.byIndex('workouts', 'date', date),
    ]);
    const lifts = workouts.filter((w) => w.status === 'done');
    const trainingMin = lifts.reduce((n, w) => n + Math.max(0, ((w.finishedAt || w.startedAt) - w.startedAt) / 60000), 0) + runs.reduce((n, r) => n + r.durationMin, 0);
    return {
      date, water: water.sort((a, b) => a.timestamp - b.timestamp), sleep: sleepRows[0] || null, weight: weight || null,
      nutrition: nutrition || null, checklist: checklist || { date, creatine: false, items: {} },
      runs, workouts: lifts, trainingMin: Math.round(trainingMin),
      waterTarget: L.waterTarget(state.settings.targets.waterBaseOz, trainingMin),
    };
  }
  const sumOz = (d) => d.water.reduce((n, w) => n + w.amountOz, 0);

  // Checklist rows. Auto rows tick themselves from logged data; manual rows toggle on tap.
  function checklistItems(d) {
    const t = state.settings.targets;
    const total = sumOz(d);
    const protein = d.nutrition?.proteinG ?? null;
    const items = [
      { key: 'creatine', label: 'Creatine (5 g)', done: !!d.checklist.creatine, sub: 'Tap to check off', act: 'toggle' },
      { key: 'protein', label: 'Protein target hit', done: protein != null && protein >= t.protein, sub: `${protein ?? 0} of ${t.protein} g`, act: 'sheet-nutrition' },
      { key: 'water', label: 'Water target hit', done: total >= d.waterTarget, sub: `${fmtWater(total)} of ${fmtWater(d.waterTarget)}`, act: 'sheet-water' },
      { key: 'weight', label: 'Weighed in', done: !!d.weight, sub: d.weight ? `${fmtNum(d.weight.weightLb)} lb` : 'Morning weight', act: 'sheet-weight' },
      { key: 'sleep', label: 'Logged sleep', done: !!d.sleep, sub: d.sleep ? `${d.sleep.hours} h` : 'Bedtime and wake time', act: 'sheet-sleep' },
      { key: 'bed', label: 'In bed on time', done: !!d.sleep && bedOnTime(d.sleep.bedtime), sub: d.sleep ? `Bedtime ${fmtHM(d.sleep.bedtime)}` : `Target ${fmtHM(t.bedtime)}`, act: 'sheet-sleep' },
    ];
    for (const it of state.settings.customItems) items.push({ key: it.id, label: it.label, done: !!d.checklist.items?.[it.id], sub: 'Tap to check off', act: 'toggle' });
    return items;
  }
  function checklistCard(d, date) {
    const items = checklistItems(d);
    const n = items.filter((i) => i.done).length;
    return `<section class="card">${cardHead('check', 'Daily Checklist', `<span class="pill ${n === items.length ? 'good-pill' : 'soft-pill'}">${n} of ${items.length}</span>`)}
      <div class="rows">${items.map((i) => `<button class="list-btn" data-act="${i.act}" data-key="${esc(i.key)}" data-date="${date}" aria-pressed="${i.done}">
        <span class="tick${i.done ? ' on' : ''}">${icon('check', 16, false)}</span>
        <div class="main"><p class="t">${esc(i.label)}</p><p class="s">${esc(i.sub)}</p></div></button>`).join('')}</div></section>`;
  }
  async function toggleItem(date, key) {
    const c = (await db.get('checklist', date)) || { date, creatine: false, items: {} };
    if (key === 'creatine') c.creatine = !c.creatine;
    else c.items = { ...c.items, [key]: !c.items?.[key] };
    if (await persist([['put', 'checklist', c]])) render();
  }

  async function persist(ops) {
    try { await db.write(ops); return true; }
    catch { toast('Could not save. Browser storage is full or blocked.'); return false; }
  }
  async function removeWithUndo(storeName, rec) {
    const key = rec[STORES[storeName].keyPath];
    if (!(await persist([['delete', storeName, key]]))) return;
    toast('Deleted', { action: 'Undo', duration: 5000, onAction: async () => { if (await persist([['put', storeName, rec]])) render(); } });
    render();
  }

  async function addWater(date, oz) {
    const rec = { id: uid(), date, amountOz: oz, timestamp: Date.now() };
    if (!(await persist([['put', 'water', rec]]))) return;
    toast(`+${fmtWater(oz)}`, { action: 'Undo', duration: 4000, onAction: async () => { if (await persist([['delete', 'water', rec.id]])) render(); } });
    render();
  }

  // Generic form sheet: onSave(dlg, fail) returns false to keep the sheet open.
  function formSheet({ title, body, onSave, onDelete, onInput, onClick, onClose }) {
    const dlg = openSheet(title, `<div class="stack">${body}<p class="caption err" id="sheet-err" hidden></p>
      <button class="btn btn-primary" data-save>Save</button>${onDelete ? '<button class="btn btn-danger" data-delete>Delete</button>' : ''}<button class="btn btn-outline" data-cancel>Cancel</button></div>`);
    // onClose runs once however the sheet closes (buttons call it directly; Esc and swipes use the close event).
    let afterRan = false;
    const after = () => { if (afterRan || !onClose) return; afterRan = true; onClose(); };
    dlg.onclose = after;
    const shut = () => { dlg.close(); after(); };
    const fail = (m) => { const el = $('#sheet-err', dlg); el.textContent = m; el.hidden = false; return false; };
    const save = async () => { if ((await onSave(dlg, fail)) !== false) shut(); };
    dlg.onclick = (e) => {
      if (e.target === dlg || e.target.closest('[data-cancel]')) return shut();
      if (e.target.closest('[data-save]')) return save();
      if (e.target.closest('[data-delete]')) { shut(); return onDelete(); }
      onClick && onClick(e, dlg);
    };
    dlg.onkeydown = (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save(); } };
    if (onInput) { dlg.oninput = () => onInput(dlg); onInput(dlg); }
    const first = $('input:not([type=time])', dlg);
    if (first) first.focus();
    return dlg;
  }
  const segHtml = (id, opts, cur) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${String(cur) === String(v)}">${esc(l)}</button>`).join('')}</div>`;
  function segPick(e, dlg, id) {
    const b = e.target.closest(`#${id} [data-v]`);
    if (!b) return null;
    const already = b.getAttribute('aria-pressed') === 'true';
    $$(`#${id} button`, dlg).forEach((x) => x.setAttribute('aria-pressed', 'false'));
    if (already) return '';
    b.setAttribute('aria-pressed', 'true');
    return b.dataset.v;
  }

  async function waterSheet(date, id) {
    const entry = id ? await db.get('water', id) : null;
    const time = entry ? hhmm(entry.timestamp) : date === dateKey() ? hhmm(Date.now()) : '12:00';
    formSheet({
      title: entry ? 'Edit Water' : 'Add Water',
      body: `<label class="field"><span>Amount (${waterUnit()})</span><input class="input" id="f-amt" inputmode="decimal" value="${entry ? esc(waterToDisplay(entry.amountOz)) : ''}"></label>
        <label class="field"><span>Time</span><input class="input" type="time" id="f-time" value="${time}"></label>`,
      onSave: async (dlg, fail) => {
        const v = num($('#f-amt', dlg).value);
        const oz = v == null ? null : waterToOz(v);
        if (!oz || oz <= 0 || oz > 300) return fail('Enter an amount greater than 0.');
        const t = $('#f-time', dlg).value || time;
        const ts = parseKey(date).getTime() + mins(t) * 60000;
        const rec = entry ? { ...entry, amountOz: oz, timestamp: ts } : { id: uid(), date, amountOz: oz, timestamp: ts };
        if (!(await persist([['put', 'water', rec]]))) return false;
        render();
      },
      onDelete: entry && (() => removeWithUndo('water', entry)),
    });
  }

  async function sleepSheet(date) {
    const ex = (await db.byIndex('sleep', 'date', date))[0] || null;
    let quality = ex ? ex.quality : null;
    formSheet({
      title: 'Sleep',
      body: `<p class="caption">The night that ended on ${esc(fmtDate(date))}.</p>
        <div class="two"><label class="field"><span>Bedtime</span><input class="input" type="time" id="f-bed" value="${esc(ex ? ex.bedtime : state.settings.targets.bedtime)}"></label>
        <label class="field"><span>Wake time</span><input class="input" type="time" id="f-wake" value="${esc(ex ? ex.wakeTime : '06:30')}"></label></div>
        <p class="big" id="f-hours"></p>
        <div><p class="caption" style="margin-bottom:8px">Quality (optional)</p>${segHtml('f-q', [1, 2, 3, 4, 5].map((n) => [n, n]), quality)}</div>`,
      onInput: (dlg) => {
        const bed = $('#f-bed', dlg).value, wake = $('#f-wake', dlg).value;
        const h = bed && wake ? sleepHours(bed, wake) : null;
        $('#f-hours', dlg).textContent = h == null ? '— h' : `${h} h${h < 7 ? ' · under 7 h' : ''}`;
      },
      onClick: (e, dlg) => { const v = segPick(e, dlg, 'f-q'); if (v !== null) quality = v === '' ? null : Number(v); },
      onSave: async (dlg, fail) => {
        const bed = $('#f-bed', dlg).value, wake = $('#f-wake', dlg).value;
        if (!bed || !wake) return fail('Enter a bedtime and a wake time.');
        const hours = sleepHours(bed, wake);
        if (hours == null) return fail('Bedtime and wake time cannot be the same.');
        const rec = { id: ex ? ex.id : `sleep:${date}`, date, bedtime: bed, wakeTime: wake, hours, quality };
        if (!(await persist([['put', 'sleep', rec]]))) return false;
        render();
      },
      onDelete: ex && (() => removeWithUndo('sleep', ex)),
    });
  }

  async function weightSheet(date) {
    const ex = await db.get('bodyweight', date);
    formSheet({
      title: 'Morning Weight',
      body: `<label class="field"><span>Weight (lb)</span><input class="input" id="f-w" inputmode="decimal" value="${ex ? esc(fmtNum(ex.weightLb)) : ''}"></label>`,
      onSave: async (dlg, fail) => {
        const w = num($('#f-w', dlg).value);
        if (w == null || w < 40 || w > 800) return fail('Enter a weight between 40 and 800 lb.');
        if (!(await persist([['put', 'bodyweight', { date, weightLb: r1(w) }]]))) return false;
        await syncBodyweightBasis();
        render();
      },
      onDelete: ex && (() => removeWithUndo('bodyweight', ex)),
    });
  }

  async function nutritionSheet(date) {
    const ex = await db.get('nutrition', date);
    formSheet({
      title: 'Nutrition',
      body: `<label class="field"><span>Protein today (g)</span><input class="input" id="f-p" inputmode="numeric" value="${ex && ex.proteinG != null ? esc(ex.proteinG) : ''}"></label>
        <div class="chips">${[10, 25, 40].map((n) => `<button type="button" class="chip" data-add="${n}">+${n} g</button>`).join('')}</div>
        <label class="field"><span>Calories today (optional)</span><input class="input" id="f-c" inputmode="numeric" value="${ex && ex.calories != null ? esc(ex.calories) : ''}"></label>`,
      onClick: (e, dlg) => {
        const b = e.target.closest('[data-add]');
        if (b) { const f = $('#f-p', dlg); f.value = Math.round((num(f.value) || 0) + Number(b.dataset.add)); }
      },
      onSave: async (dlg, fail) => {
        const p = num($('#f-p', dlg).value), c = num($('#f-c', dlg).value);
        if (p == null && c == null) return fail('Enter protein, calories or both.');
        if ((p != null && (p < 0 || p > 1000)) || (c != null && (c < 0 || c > 20000))) return fail('Those numbers look too large.');
        if (!(await persist([['put', 'nutrition', { date, proteinG: p == null ? null : Math.round(p), calories: c == null ? null : Math.round(c) }]]))) return false;
        render();
      },
      onDelete: ex && (() => removeWithUndo('nutrition', ex)),
    });
  }

  async function runSheet(date, id) {
    const run = id ? await db.get('runs', id) : null;
    let type = run ? run.type : 'easy';
    const rpeOpts = ['<option value="">—</option>', ...Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}"${run && run.rpe === i + 1 ? ' selected' : ''}>${i + 1}</option>`)].join('');
    formSheet({
      title: run ? 'Edit Run' : 'Log Run',
      body: `<div class="two"><label class="field"><span>Distance (mi)</span><input class="input" id="f-dist" inputmode="decimal" value="${run ? esc(r2(run.distanceMi)) : ''}"></label>
        <label class="field"><span>Time (min)</span><input class="input" id="f-dur" inputmode="decimal" placeholder="45 or 45:30" value="${run ? esc(r1(run.durationMin)) : ''}"></label></div>
        <p class="big" id="f-pace"></p>
        ${segHtml('f-type', [['easy', 'Easy'], ['intervals', 'Intervals'], ['long', 'Long']], type)}
        <label class="field"><span>Effort, RPE 1–10 (optional)</span><select class="input" id="f-rpe">${rpeOpts}</select></label>
        <label class="field"><span>Note (optional)</span><input class="input" id="f-note" maxlength="200" value="${run ? esc(run.note || '') : ''}"></label>`,
      onInput: (dlg) => {
        const d = num($('#f-dist', dlg).value), m = parseDuration($('#f-dur', dlg).value);
        $('#f-pace', dlg).textContent = d > 0 && m > 0 ? `${fmtPace(m, d)} /mi` : 'Pace shows here';
      },
      onClick: (e, dlg) => { const v = segPick(e, dlg, 'f-type'); if (v) type = v; else if (v === '') $(`#f-type [data-v="${type}"]`, dlg).setAttribute('aria-pressed', 'true'); },
      onSave: async (dlg, fail) => {
        const d = num($('#f-dist', dlg).value), m = parseDuration($('#f-dur', dlg).value);
        if (!d || d <= 0 || d > 100) return fail('Enter a distance between 0 and 100 miles.');
        if (!m || m <= 0 || m > 600) return fail('Enter the time in minutes, like 45 or 45:30.');
        const rpe = $('#f-rpe', dlg).value;
        const rec = { id: run ? run.id : uid(), date, distanceMi: r2(d), durationMin: r2(m), paceSecPerMi: Math.round((m * 60) / d), type, rpe: rpe ? Number(rpe) : null, note: $('#f-note', dlg).value.trim().slice(0, 200) };
        if (!(await persist([['put', 'runs', rec]]))) return false;
        render();
      },
      onDelete: run && (() => removeWithUndo('runs', run)),
    });
  }

  // ---------- Render: Today extras ----------
  const meter = (label, value, pct) => `<div class="meter"><div class="meter-top"><span>${label}</span><strong>${value}</strong></div><div class="bar"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div></div>`;
  function quickAddCard(date) {
    const amounts = state.settings.waterQuickAdds;
    const q = (act, ic, label) => `<button class="q-btn" data-act="${act}" data-date="${date}">${icon(ic, 24)}<span>${label}</span></button>`;
    return `<section class="card">${cardHead('drop', 'Quick Add')}
      <div class="quick3">${amounts.map((oz) => `<button class="btn btn-navy btn-small" data-act="water-add" data-oz="${oz}" data-date="${date}">+${esc(fmtWater(oz))}</button>`).join('')}</div>
      <div class="quick4">${q('sheet-weight', 'scale', 'Weigh-In')}${q('sheet-sleep', 'moon', 'Sleep')}${q('sheet-nutrition', 'flame', 'Protein')}${q('sheet-run', 'run', 'Run')}</div></section>`;
  }
  function metersCard(d) {
    const t = state.settings.targets;
    const total = sumOz(d);
    const p = d.nutrition?.proteinG ?? 0;
    const h = d.sleep ? d.sleep.hours : null;
    return `<section class="card">${cardHead('chart', 'Today So Far')}
      ${meter('Water', `${esc(fmtWater(total))} / ${esc(fmtWater(d.waterTarget))}`, (total / d.waterTarget) * 100)}
      ${meter('Protein', `${p} / ${t.protein} g`, (p / t.protein) * 100)}
      ${meter('Sleep last night', `${h == null ? '—' : h} / ${t.sleepHours} h`, h == null ? 0 : (h / t.sleepHours) * 100)}
      ${d.waterTarget > t.waterBaseOz ? `<p class="caption">Water target includes ${esc(fmtWater(d.waterTarget - t.waterBaseOz))} for ${d.trainingMin} min of training.</p>` : ''}</section>`;
  }

  // ---------- Render: Log ----------
  async function historyRows(n = 14) {
    const [water, sleep, bw, nut, runs, ws] = await Promise.all(['water', 'sleep', 'bodyweight', 'nutrition', 'runs', 'workouts'].map((s) => db.all(s)));
    const rows = [];
    for (let i = 0; i < n; i++) {
      const dt = new Date(); dt.setDate(dt.getDate() - i);
      const k = dateKey(dt);
      const parts = [];
      const oz = water.filter((w) => w.date === k).reduce((s, w) => s + w.amountOz, 0);
      if (oz) parts.push(fmtWater(oz));
      const nu = nut.find((x) => x.date === k);
      if (nu && nu.proteinG != null) parts.push(`${nu.proteinG} g protein`);
      const sl = sleep.find((x) => x.date === k);
      if (sl) parts.push(`${sl.hours} h sleep`);
      const lifts = ws.filter((w) => w.date === k && w.status === 'done');
      if (lifts.length) parts.push(lifts.map((w) => shortName(w.sessionName)).join(', '));
      const rn = runs.filter((r) => r.date === k);
      if (rn.length) parts.push(`${r1(rn.reduce((s, r) => s + r.distanceMi, 0))} mi run`);
      const b = bw.find((x) => x.date === k);
      rows.push({ k, text: parts.join(' · ') || 'No entries', weight: b ? b.weightLb : null });
    }
    return rows;
  }

  async function renderLog() {
    const today = dateKey();
    const date = state.logDate || today;
    const d = await dayData(date);
    const t = state.settings.targets;
    const total = sumOz(d);
    const bwAll = await db.all('bodyweight');
    const bwAvg = L.movingAverage(bwAll, date), bwRate = L.weeklyRate(bwAll, date);
    const main = (a, b) => `<div class="main"><p class="t">${a}</p>${b ? `<p class="s">${b}</p>` : ''}</div>`;
    let html = pageHead('log', 'Log', fmtDate(date, { weekday: 'long', month: 'short', day: 'numeric' }));

    html += `<section class="card"><div class="datenav">
      <button class="chip" data-act="log-prev" aria-label="Previous day">${icon('left', 18, false)}</button>
      <input class="input" type="date" data-logdate max="${today}" value="${date}" aria-label="Day">
      <button class="chip" data-act="log-next" aria-label="Next day"${date >= today ? ' disabled' : ''}>${icon('right', 18, false)}</button></div>
      ${date !== today ? '<button class="btn btn-outline btn-small" data-act="log-today">Back to Today</button>' : ''}</section>`;

    html += checklistCard(d, date);

    html += `<section class="card">${cardHead('drop', 'Water', `<span class="pill ${total >= d.waterTarget ? 'good-pill' : 'soft-pill'}">${esc(fmtWater(total))} / ${esc(fmtWater(d.waterTarget))}</span>`)}
      ${d.water.length ? `<div class="rows">${d.water.map((w) => `<button class="list-btn" data-act="edit-water" data-id="${esc(w.id)}" data-date="${date}">${main(esc(fmtTime(w.timestamp)))}<span class="v">${esc(fmtWater(w.amountOz))}</span></button>`).join('')}</div>` : '<p class="caption">No water logged.</p>'}
      <button class="btn btn-outline" data-act="sheet-water" data-date="${date}">Add Water</button></section>`;

    const s = d.sleep;
    html += `<section class="card">${cardHead('moon', 'Sleep')}
      ${s ? `<div class="rows"><button class="list-btn" data-act="sheet-sleep" data-date="${date}">${main(`${esc(fmtHM(s.bedtime))} to ${esc(fmtHM(s.wakeTime))}`, `Quality ${s.quality == null ? '—' : s.quality} of 5`)}${s.hours < 7 ? '<span class="pill warn-pill">Under 7 h</span>' : ''}<span class="v">${s.hours} h</span></button></div>` : '<p class="caption">No sleep logged for the night before.</p>'}
      <button class="btn btn-outline" data-act="sheet-sleep" data-date="${date}">${s ? 'Edit Sleep' : 'Log Sleep'}</button></section>`;

    html += `<section class="card">${cardHead('scale', 'Bodyweight')}
      ${d.weight ? `<p class="big">${esc(fmtNum(d.weight.weightLb))} lb</p>` : '<p class="caption">No weigh-in yet.</p>'}
      ${bwAvg == null ? '<p class="caption">The 7-day average needs 4 weigh-ins in a week.</p>' : `<p class="caption">7-day average ${esc(r1(bwAvg))} lb${bwRate == null ? '' : ` · ${bwRate >= 0 ? '+' : ''}${r2(bwRate)} lb/week (target 0.4–0.8)`}</p>`}
      <button class="btn btn-outline" data-act="sheet-weight" data-date="${date}">${d.weight ? 'Edit Weight' : 'Log Weight'}</button></section>`;

    const n = d.nutrition;
    html += `<section class="card">${cardHead('flame', 'Nutrition')}
      ${n ? `<div class="rows"><button class="list-btn" data-act="sheet-nutrition" data-date="${date}">${main(`${n.proteinG ?? 0} g protein`, n.calories != null ? `${n.calories} calories` : 'Calories not logged')}<span class="v">${n.proteinG ?? 0} / ${t.protein} g</span></button></div>` : '<p class="caption">Nothing logged.</p>'}
      <button class="btn btn-outline" data-act="sheet-nutrition" data-date="${date}">${n ? 'Edit Nutrition' : 'Log Nutrition'}</button></section>`;

    html += `<section class="card">${cardHead('dumbbell', 'Training')}
      ${d.workouts.length || d.runs.length ? `<div class="rows">
        ${d.workouts.map((w) => `<button class="list-btn" data-act="edit-workout" data-id="${esc(w.id)}"><div class="badge">${icon('dumbbell', 18, false)}</div>${main(esc(shortName(w.sessionName)), 'Lifting · tap to edit')}<span class="v">${Math.max(1, Math.round(((w.finishedAt || w.startedAt) - w.startedAt) / 60000))} min</span></button>`).join('')}
        ${d.runs.map((r) => `<button class="list-btn" data-act="edit-run" data-id="${esc(r.id)}" data-date="${date}"><div class="badge">${icon('run', 18, false)}</div>${main(`${esc(r2(r.distanceMi))} mi · ${esc(r.type)}`, `${esc(fmtPace(r.durationMin, r.distanceMi))} /mi${r.rpe ? ` · RPE ${r.rpe}` : ''}`)}<span class="v">${esc(fmtDur(r.durationMin))}</span></button>`).join('')}</div>` : '<p class="caption">No training logged.</p>'}
      <button class="btn btn-outline" data-act="sheet-run" data-date="${date}">Log Run</button></section>`;

    const hist = await historyRows();
    html += `<section class="card">${cardHead('today', 'Recent Days')}<div class="rows">${hist.map((h) => `<button class="list-btn" data-act="pick-day" data-date="${h.k}">${main(esc(fmtDate(h.k)) + (h.k === date ? ' · viewing' : ''), esc(h.text))}${h.weight != null ? `<span class="v">${esc(fmtNum(h.weight))} lb</span>` : ''}</button>`).join('')}</div></section>`;
    return html;
  }

  // ---------- Settings: daily logging ----------
  function renderLoggingSettings() {
    const s = state.settings, t = s.targets;
    const seg = (k, opts, cur) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="unit" data-k="${k}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
    return `<section class="card">${cardHead('gear', 'Units')}
        <div class="field"><span>Water</span>${seg('water', [['oz', 'Ounces'], ['L', 'Liters']], s.units.water)}</div>
        <div class="field"><span>Time</span>${seg('time', [['12h', '12-Hour'], ['24h', '24-Hour']], s.units.time)}</div></section>
      <section class="card">${cardHead('chart', 'Daily Targets')}
        <label class="field"><span>Protein (g)</span><input class="input" inputmode="numeric" data-target="protein" value="${esc(t.protein)}"></label>
        ${s.bodyweightLb ? `<p class="caption">For ${esc(fmtNum(s.bodyweightLb))} lb, the target is ${L.proteinTarget(s.bodyweightLb)} g (range ${L.proteinRange(s.bodyweightLb).join('–')} g). It updates when your 7-day average moves 5 lb.</p>` : ''}
        <label class="field"><span>Calories (optional)</span><input class="input" inputmode="numeric" data-target="calories" value="${esc(t.calories)}"></label>
        <label class="field"><span>Water (oz)</span><input class="input" inputmode="numeric" data-target="waterBaseOz" value="${esc(t.waterBaseOz)}"></label>
        <label class="field"><span>Sleep (hours)</span><input class="input" inputmode="decimal" data-target="sleepHours" value="${esc(t.sleepHours)}"></label>
        <label class="field"><span>Bedtime target</span><input class="input" type="time" data-target="bedtime" value="${esc(t.bedtime)}"></label></section>
      <section class="card">${cardHead('drop', 'Water Quick-Add Buttons')}
        <div class="quick3">${s.waterQuickAdds.map((oz, i) => `<input class="input" inputmode="decimal" data-qa="${i}" value="${esc(oz)}" aria-label="Button ${i + 1} in ounces">`).join('')}</div>
        <p class="caption">Amounts in ounces. 34 oz is about 1 L.</p></section>
      <section class="card">${cardHead('check', 'Checklist Items')}
        <p class="caption">Creatine and the automatic items are built in. Add your own, like a vitamin or stretching.</p>
        ${s.customItems.length ? `<div class="rows">${s.customItems.map((it) => `<div class="row"><div class="main"><p class="t">${esc(it.label)}</p></div><button class="chip" data-act="rm-item" data-id="${esc(it.id)}">Remove</button></div>`).join('')}</div>` : ''}
        <div class="two"><input class="input" id="new-item" maxlength="30" placeholder="New item" aria-label="New checklist item"><button class="btn btn-outline" data-act="add-item">Add</button></div></section>`;
  }

  // ---------- History and suggestions ----------
  async function loadHistory() {
    const [ws, sets] = await Promise.all([db.all('workouts'), db.all('sets')]);
    return { workouts: ws.filter((w) => w.status === 'done'), sets: sets.filter((s) => s.done) };
  }
  // Finished sessions that included this exercise, newest first.
  function sessionsFor(hist, name, excludeId, n = 3) {
    const byW = new Map();
    for (const s of hist.sets) {
      if (s.exerciseName !== name || s.workoutId === excludeId) continue;
      if (!byW.has(s.workoutId)) byW.set(s.workoutId, []);
      byW.get(s.workoutId).push(s);
    }
    const out = [];
    for (const w of hist.workouts) {
      const sets = byW.get(w.id);
      if (sets) out.push({ t: w.finishedAt || w.startedAt, date: w.date, sets: sets.sort((a, b) => a.setNumber - b.setNumber) });
    }
    return out.sort((a, b) => b.t - a.t).slice(0, n);
  }
  function exerciseInfo(hist, ex, excludeId, week) {
    const sessions = sessionsFor(hist, ex.name, excludeId);
    return { last: sessions[0] || null, sugg: L.suggest(sessions, ex, week) };
  }
  const exerciseDefs = () => state.program.sessions.flatMap((s) => s.exercises);
  const isMainLift = (e) => e.type === 'compound' && e.restSec >= 150;
  // Exercises whose latest finished session was within sinceDays and that have stalled.
  function stalledLifts(hist, today, sinceDays) {
    const week = programWeek(today), since = L.addDays(today, -(sinceDays - 1)), seen = new Set(), out = [];
    for (const ex of exerciseDefs()) {
      if (seen.has(ex.name)) continue;
      seen.add(ex.name);
      const sessions = sessionsFor(hist, ex.name, null);
      if (sessions.length && sessions[0].date >= since && L.suggest(sessions, ex, week).kind === 'stalled') out.push(ex);
    }
    return out;
  }
  const effortLine = (ex, week) => {
    const e = L.effort(week);
    const rir = e.minRir === e.maxRir ? `${e.maxRir}` : `${e.minRir}–${e.maxRir}`;
    return `Target RIR ${rir}${week >= 3 && ex.type === 'isolation' ? ', last set to failure (RIR 0)' : ''}`;
  };

  // ---------- Bodyweight basis for targets ----------
  // Protein follows bodyweight. Set it from the first weigh-in, then again when the 7-day average moves 5 lb or more.
  async function syncBodyweightBasis() {
    const s = state.settings;
    const entries = await db.all('bodyweight');
    if (!entries.length) return;
    const latest = entries.sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const avg = L.movingAverage(entries, dateKey());
    let next = null;
    if (s.bodyweightLb == null) next = latest.weightLb;
    else if (avg != null && Math.abs(avg - s.bodyweightLb) >= 5) next = r1(avg);
    if (next == null) return;
    s.bodyweightLb = next;
    s.targets.protein = L.proteinTarget(next);
    await saveSettings();
    toast(`Protein target set to ${s.targets.protein} g for ${fmtNum(next)} lb`, { duration: 5000 });
  }

  // ---------- Insights: set prompt, deload, weekly review ----------
  async function insightCards(done, today, hist) {
    const s = state.settings;
    const week = programWeek(today);
    let html = '';

    if (week >= 6 && week <= 8 && !s.setsPromptDone && state.program.sessions.length) {
      html += `<section class="card">${cardHead('plus', 'Add a Set?')}
        <p class="caption">Recovering well? Add 1 set to the first two exercises of each session.</p>
        <button class="btn btn-primary" data-act="sets-apply">Add the Sets</button>
        <button class="btn btn-outline" data-act="sets-skip">Not Now</button></section>`;
    }

    const dismissed = s.deloadDismissedOn && daysBetween(s.deloadDismissedOn, today) < 7;
    if (!dismissed && state.program.sessions.length) {
      const stalledMain = stalledLifts(hist, today, 7).filter(isMainLift);
      const reasons = [];
      if (stalledMain.length >= 2) reasons.push(`${stalledMain.map((e) => shortName(e.name)).join(' and ')} have stalled this week`);
      if (L.lowEnergyStreak(done.map((w) => w.energy))) reasons.push('you rated energy 1–2 for three sessions in a row');
      if (reasons.length) {
        html += `<section class="card">${cardHead('flame', 'Consider a Deload', '<span class="pill warn-pill">Suggested</span>')}
          <p class="caption">${esc(reasons.join(', and ').replace(/^./, (c) => c.toUpperCase()))}. Try a deload week: half the sets at about 10% lighter weights.</p>
          <button class="btn btn-outline" data-act="deload-dismiss">Not Now</button></section>`;
      }
    }

    if (parseKey(today).getDay() === 0) html += await weeklyReviewCard(hist, today);
    return html;
  }

  async function weeklyReviewCard(hist, today) {
    const s = state.settings, t = s.targets;
    const [bw, water, sleep, nut, runs] = await Promise.all(['bodyweight', 'water', 'sleep', 'nutrition', 'runs'].map((n) => db.all(n)));
    const start = L.addDays(today, -6);
    const inWin = (x) => x.date >= start && x.date <= today;
    const gain = L.twoWeekGain(bw, today);
    const review = gain == null ? null : L.reviewMessage(gain);

    const planned = Object.values(s.dayMapping).filter((v) => sessionById(v)).length;
    const completed = hist.workouts.filter(inWin).length;

    const names = [...new Set(hist.sets.filter((x) => hist.workouts.some((w) => w.id === x.workoutId && inWin(w))).map((x) => x.exerciseName))];
    const defs = new Map(exerciseDefs().map((e) => [e.name, e]));
    const up = [];
    for (const name of names) {
      const two = sessionsFor(hist, name, null, 2);
      const timed = defs.get(name)?.type === 'timed';
      if (two.length === 2 && two[0].date >= start && L.progressed(L.sessionPerf(two[1].sets, timed), L.sessionPerf(two[0].sets, timed))) up.push(shortName(name));
    }
    const stalled = stalledLifts(hist, today, 14).map((e) => shortName(e.name));

    const sl = sleep.filter(inWin);
    const avgSleep = sl.length ? r1(sl.reduce((n, x) => n + x.hours, 0) / sl.length) : null;
    const byDay = new Map();
    water.filter(inWin).forEach((w) => byDay.set(w.date, (byDay.get(w.date) || 0) + w.amountOz));
    const avgWater = byDay.size ? [...byDay.values()].reduce((n, v) => n + v, 0) / byDay.size : null;
    const proteinDays = nut.filter(inWin).filter((n) => n.proteinG != null && n.proteinG >= t.protein).length;
    const runMin = Math.round(runs.filter(inWin).reduce((n, r) => n + r.durationMin, 0));
    const row = (a, b) => `<div class="row"><div class="main"><p class="t">${esc(a)}</p></div><span class="v">${esc(b)}</span></div>`;
    const list = (a) => (a.length ? a.join(', ') : 'None');

    return `<section class="card">${cardHead('chart', 'Weekly Review', '<span class="pill soft-pill">Sunday</span>')}
      ${review ? `<p class="big" style="font-size:20px">${esc(review.text)}</p><p class="caption">Average gain over the last 2 weeks: ${gain >= 0 ? '+' : ''}${r2(gain)} lb/week (target 0.4–0.8).</p>
        ${review.delta && s.reviewAppliedOn !== today ? `<button class="btn btn-primary" data-act="review-apply" data-delta="${review.delta}">${review.delta > 0 ? 'Raise' : 'Lower'} Calorie Target by 200</button>` : ''}`
        : '<p class="caption">Calorie advice needs at least 4 weigh-ins in each of the last 3 weeks.</p>'}
      <div class="rows">
        ${row('Workouts done', `${completed} of ${planned}`)}
        ${row('Lifts that went up', list(up))}
        ${row('Stalled lifts', list(stalled))}
        ${row('Average sleep', avgSleep == null ? '—' : `${avgSleep} h`)}
        ${row('Average water', avgWater == null ? '—' : fmtWater(avgWater))}
        ${row('Protein target hit', `${proteinDays} of 7 days`)}
        ${row('Running', `${runMin} min (goal 60–120)`)}
      </div></section>`;
  }

  // ---------- Edit a finished workout ----------
  async function editWorkoutSheet(id) {
    const w = await db.get('workouts', id);
    if (!w) return;
    const rows = (await db.byIndex('sets', 'workoutId', id)).sort(setOrder);
    const original = structuredClone(rows);
    const removed = new Set();
    let energy = w.energy;
    const field = (f, s, ph, mode) => `<input class="input" data-f="${f}" inputmode="${mode}" placeholder="${ph}" value="${s[f] == null ? '' : esc(fmtNum(s[f]))}">`;
    const setHtml = (s, ex) => {
      const timed = ex.type === 'timed';
      const rirOpts = ['<option value="">—</option>', ...[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}"${s.rir === n ? ' selected' : ''}>${n}</option>`)].join('');
      return `<div class="set${timed ? ' timed' : ''}" data-eset="${esc(s.id)}"><span class="sn">${s.setNumber}</span>
        ${timed ? field('seconds', s, 'sec', 'numeric') : field('weightLb', s, 'lb', 'decimal') + field('reps', s, 'reps', 'numeric')}
        <select class="input" data-f="rir" aria-label="Reps in reserve">${rirOpts}</select>
        <button type="button" class="check" data-rm aria-label="Remove set">${icon('minus', 22, false)}</button></div>`;
    };
    const bodyHtml = () => w.plan.map((ex, i) => {
      const sets = rows.filter((s) => s.exIndex === i);
      return `<div class="stack" style="gap:8px"><h3 class="eh">${esc(ex.name)}</h3>${sets.map((s) => setHtml(s, ex)).join('') || '<p class="caption">No sets.</p>'}<div><button type="button" class="chip" data-addset="${i}">${icon('plus', 16, false)}Set</button></div></div>`;
    }).join('');
    const collect = (dlg) => $$('[data-eset]', dlg).forEach((row) => { const s = rows.find((x) => x.id === row.dataset.eset); if (s) readRow(row, s); });

    formSheet({
      title: `${shortName(w.sessionName)} · ${fmtDate(w.date, { month: 'short', day: 'numeric' })}`,
      body: `<div class="stack" id="ew-body">${bodyHtml()}</div>
        <div><p class="caption" style="margin-bottom:8px">Energy (1 low, 5 high)</p>${segHtml('f-energy', [1, 2, 3, 4, 5].map((n) => [n, n]), energy)}</div>
        <label class="field"><span>Note (optional)</span><textarea class="input" id="f-note" maxlength="500">${esc(w.note || '')}</textarea></label>`,
      onClick: (e, dlg) => {
        const rm = e.target.closest('[data-rm]');
        const add = e.target.closest('[data-addset]');
        const en = segPick(e, dlg, 'f-energy');
        if (en !== null) { energy = en === '' ? null : Number(en); return; }
        if (!rm && !add) return;
        collect(dlg);
        if (rm) {
          const sid = rm.closest('[data-eset]').dataset.eset;
          removed.add(sid);
          rows.splice(rows.findIndex((x) => x.id === sid), 1);
        } else {
          const i = Number(add.dataset.addset);
          const mine = rows.filter((x) => x.exIndex === i);
          const prev = mine[mine.length - 1];
          const n = (prev ? prev.setNumber : 0) + 1;
          rows.push({ ...blankSet(w, i, n, w.plan[i], prev ? prev.weightLb : null), done: true });
          rows.sort(setOrder);
        }
        $('#ew-body', dlg).innerHTML = bodyHtml();
      },
      onSave: async (dlg, fail) => {
        collect(dlg);
        if (!rows.length) return fail('Keep at least one set, or delete the workout.');
        const next = { ...w, energy, note: $('#f-note', dlg).value.trim().slice(0, 500) };
        const ops = [...[...removed].map((sid) => ['delete', 'sets', sid]), ['put', 'workouts', next], ...rows.map((s) => ['put', 'sets', { ...s, done: true }])];
        if (!(await persist(ops))) return false;
        toast('Workout updated');
        render();
      },
      onDelete: async () => {
        const c = await ask({ title: 'Delete Workout?', message: 'This removes the workout and all of its sets.', buttons: [{ label: 'Delete Workout', value: true, style: 'btn-danger' }, { label: 'Cancel', value: false }] });
        if (!c) return;
        if (!(await persist([['delete', 'workouts', w.id], ...original.map((s) => ['delete', 'sets', s.id])]))) return;
        toast('Workout deleted', { action: 'Undo', duration: 6000, onAction: async () => { if (await persist([['put', 'workouts', w], ...original.map((s) => ['put', 'sets', s])])) render(); } });
        render();
      },
    });
  }

  // ---------- Edit program ----------
  async function saveProgram(sessions) {
    let result;
    try { result = normalizeProgram({ ...state.program, sessions }); }
    catch (e) { toast(e.message, { duration: 5000 }); return false; }
    if (!(await persist([['put', 'program', result.program]]))) return false;
    state.program = result.program;
    return true;
  }
  function programSheet() {
    const sessions = state.program.sessions;
    const dlg = openSheet('Edit Program', `<div class="stack"><div class="rows">${sessions.map((s) => `<button class="list-btn" data-s="${esc(s.id)}"><div class="main"><p class="t">${esc(s.name)}</p><p class="s">${s.exercises.length} exercises</p></div>${icon('right', 18, false)}</button>`).join('')}</div>
      <p class="caption">Changes apply to future workouts. Workouts you already logged are not changed.</p>
      <button class="btn btn-outline" data-close>Done</button></div>`);
    dlg.onclick = (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) { dlg.close(); return render(); }
      const b = e.target.closest('[data-s]');
      if (b) sessionEditor(b.dataset.s);
    };
    dlg.onclose = () => render();
  }
  function sessionEditor(sid) {
    const s = sessionById(sid);
    if (!s) return programSheet();
    const dlg = openSheet('Edit Session', `<div class="stack">
      <label class="field"><span>Session name</span><input class="input" id="s-name" maxlength="80" value="${esc(s.name)}"></label>
      <div class="rows">${s.exercises.map((ex, i) => `<div class="row"><div class="main"><p class="t">${esc(ex.name)}</p><p class="s">${esc(targetText(ex))}</p></div>
        <button class="chip" data-up="${i}" aria-label="Move up"${i === 0 ? ' disabled' : ''}>↑</button><button class="chip" data-down="${i}" aria-label="Move down"${i === s.exercises.length - 1 ? ' disabled' : ''}>↓</button><button class="chip" data-edit="${i}">Edit</button></div>`).join('')}</div>
      <button class="btn btn-outline" data-add>Add Exercise</button>
      <button class="btn btn-primary" data-back>Back</button></div>`);
    dlg.onchange = async (e) => {
      if (e.target.id !== 's-name') return;
      const name = e.target.value.trim();
      if (name) await saveProgram(state.program.sessions.map((x) => (x.id === sid ? { ...x, name } : x)));
    };
    dlg.onclick = async (e) => {
      if (e.target === dlg) { dlg.close(); return render(); }
      if (e.target.closest('[data-back]')) return programSheet();
      if (e.target.closest('[data-add]')) return exerciseSheet(sid, null);
      const ed = e.target.closest('[data-edit]');
      if (ed) return exerciseSheet(sid, Number(ed.dataset.edit));
      const mv = e.target.closest('[data-up],[data-down]');
      if (mv) {
        const i = Number(mv.dataset.up ?? mv.dataset.down), j = mv.dataset.up !== undefined ? i - 1 : i + 1;
        const ex = [...s.exercises];
        [ex[i], ex[j]] = [ex[j], ex[i]];
        if (await saveProgram(state.program.sessions.map((x) => (x.id === sid ? { ...x, exercises: ex } : x)))) sessionEditor(sid);
      }
    };
    dlg.onclose = () => render();
  }
  function exerciseSheet(sid, idx) {
    const s = sessionById(sid);
    const old = idx == null ? { name: '', type: 'compound', sets: 3, reps: [8, 10], restSec: 90, alt: '', increment: 5 } : s.exercises[idx];
    const typeOpts = ['compound', 'isolation', 'bodyweight', 'timed'].map((t) => `<option value="${t}"${old.type === t ? ' selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('');
    const pair = (id, v, label) => `<div class="two"><label class="field"><span>${label} low</span><input class="input" id="${id}-lo" inputmode="numeric" value="${v ? v[0] : ''}"></label><label class="field"><span>${label} high</span><input class="input" id="${id}-hi" inputmode="numeric" value="${v ? v[1] : ''}"></label></div>`;
    const sheet = formSheet({
      title: idx == null ? 'Add Exercise' : 'Edit Exercise',
      body: `<label class="field"><span>Name</span><input class="input" id="x-name" maxlength="80" value="${esc(old.name)}"></label>
        <label class="field"><span>Type</span><select class="input" id="x-type">${typeOpts}</select></label>
        <label class="field"><span>Sets</span><input class="input" id="x-sets" inputmode="numeric" value="${old.sets}"></label>
        ${pair('x-reps', old.reps, 'Reps')}
        <div id="x-secs">${pair('x-sec', old.seconds, 'Seconds')}</div>
        <div class="two"><label class="field"><span>Rest (sec)</span><input class="input" id="x-rest" inputmode="numeric" value="${old.restSec}"></label>
        <label class="field"><span>Weight step (lb)</span><input class="input" id="x-inc" inputmode="decimal" placeholder="None" value="${old.increment ?? ''}"></label></div>
        <label class="field"><span>Swap alternative</span><input class="input" id="x-alt" maxlength="80" value="${esc(old.alt || '')}"></label>
        <label class="field"><span>Done on each side?</span><select class="input" id="x-side"><option value="no">No</option><option value="yes"${old.perSide ? ' selected' : ''}>Yes, per side</option></select></label>
        <label class="field"><span>Main muscles (comma separated)</span><input class="input" id="x-pri" maxlength="80" value="${esc((old.primary || []).join(', '))}"></label>
        <label class="field"><span>Helper muscles (optional)</span><input class="input" id="x-sec" maxlength="80" value="${esc((old.secondary || []).join(', '))}"></label>
        <p class="caption">Renaming an exercise starts a new history for it. Use Swap during a workout for one-off changes.</p>`,
      onInput: (dlg) => { $('#x-secs', dlg).hidden = $('#x-type', dlg).value !== 'timed'; $('#x-reps-lo', dlg).closest('.two').hidden = $('#x-type', dlg).value === 'timed'; },
      onSave: async (dlg, fail) => {
        const g = (id) => $(`#${id}`, dlg).value;
        const type = g('x-type');
        const list = (v) => v.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 6);
        const ex = { ...old, name: g('x-name').trim(), type, sets: num(g('x-sets')), restSec: num(g('x-rest')) ?? 90, alt: g('x-alt').trim(), perSide: g('x-side') === 'yes', primary: list(g('x-pri')), secondary: list(g('x-sec')) };
        const inc = num(g('x-inc'));
        if (inc) ex.increment = inc; else delete ex.increment;
        if (!ex.perSide) delete ex.perSide;
        if (!ex.secondary.length) delete ex.secondary;
        if (type === 'timed') { ex.seconds = [num(g('x-sec-lo')), num(g('x-sec-hi'))]; delete ex.reps; }
        else { ex.reps = [num(g('x-reps-lo')), num(g('x-reps-hi'))]; delete ex.seconds; }
        if (!ex.name) return fail('Enter a name.');
        const exercises = [...s.exercises];
        if (idx == null) exercises.push(ex); else exercises[idx] = ex;
        try { normalizeProgram({ sessions: state.program.sessions.map((x) => (x.id === sid ? { ...x, exercises } : x)) }); }
        catch (e) { return fail(e.message); }
        if (!(await saveProgram(state.program.sessions.map((x) => (x.id === sid ? { ...x, exercises } : x))))) return false;
      },
      onDelete: idx == null ? null : async () => {
        const exercises = s.exercises.filter((_, i) => i !== idx);
        if (await saveProgram(state.program.sessions.map((x) => (x.id === sid ? { ...x, exercises } : x)))) sessionEditor(sid);
      },
      onClose: () => sessionEditor(sid),
    });
    return sheet;
  }

  // ---------- Render: Today ----------
  async function renderToday() {
    const today = dateKey();
    const week = programWeek(today);
    const plan = plannedFor(today);
    const done = await doneWorkouts();
    const due = nextInRotation(done);
    const a = state.active;
    const doneToday = done.find((w) => w.date === today);
    const weekText = week < 1 ? `Program starts in ${-daysBetween(today, state.settings.programStartDate)} days` : `Week ${week}`;
    let html = pageHead('today', 'Today', `${fmtDate(today)} · ${weekText}`);

    const lastB = state.settings.lastBackupAt;
    const stale = done.length > 0 && (!lastB || (Date.now() - lastB) / 864e5 > BACKUP_STALE_DAYS);
    if (stale) {
      html += `<section class="card">${cardHead('shield', 'Back Up Your Data', '<span class="pill warn-pill">Needed</span>')}
        <p class="caption">${lastB ? `Last backup was ${fmtDate(dateKey(new Date(lastB)))}.` : 'You have not backed up yet.'} Your data only lives on this phone.</p>
        <button class="btn btn-outline" data-act="backup">Back Up Now</button></section>`;
    }

    if (!state.program.sessions.length) {
      html += noProgramCard();
    } else if (a) {
      const sets = a.sets.filter((s) => s.done).length;
      html += `<section class="hero"><div><p class="caption">Workout in progress</p><p class="big">${esc(shortName(a.w.sessionName))}</p>
        <p class="caption">${sets} of ${a.sets.length} sets done · <span data-elapsed>${Math.floor((Date.now() - a.w.startedAt) / 60000)} min</span></p></div>
        <button class="btn btn-primary" data-act="go-train">Resume Workout</button></section>`;
    } else {
      let body = '';
      if (plan.kind === 'lift') {
        const ex = plan.session.exercises;
        body = `<div><p class="caption">Today's plan</p><p class="big">${esc(plan.label)}</p><p class="caption">${ex.length} exercises · ${ex.reduce((n, e) => n + e.sets, 0)} sets</p></div>
          ${doneToday ? `<p class="caption">${icon('check', 16, false)} Finished ${esc(shortName(doneToday.sessionName))} today.</p>` : ''}
          <button class="btn btn-primary" data-act="start" data-session="${esc(plan.session.id)}">${doneToday ? 'Start Another Workout' : 'Start Workout'}</button>`;
      } else if (plan.kind === 'run') {
        body = `<div><p class="caption">Today's plan</p><p class="big">${esc(plan.label)}</p><p class="caption">${esc(plan.note || '')}</p></div>
          <button class="btn btn-primary" data-act="sheet-run" data-date="${today}">Log Run</button>`;
      } else {
        body = `<div><p class="caption">Today's plan</p><p class="big">Rest Day</p><p class="caption">Recover, eat, hydrate and sleep well.</p></div>`;
      }
      html += `<section class="card">${body}</section>`;

      // Missed-session rotation offer
      if (due && !(plan.kind === 'lift' && plan.session.id === due.id)) {
        const lastDone = done[0];
        html += `<section class="card">${cardHead('swap', 'Next in Rotation')}
          <p class="caption">${lastDone ? `Last session was ${esc(shortName(lastDone.sessionName))} on ${esc(fmtDate(lastDone.date))}. ` : ''}Next up is ${esc(shortName(due.name))}.</p>
          <button class="btn btn-outline" data-act="start" data-session="${esc(due.id)}">Start ${esc(shortName(due.name))}</button></section>`;
      }
    }

    html += await insightCards(done, today, await loadHistory());

    const dd = await dayData(today);
    html += quickAddCard(today) + metersCard(dd) + checklistCard(dd, today);

    if (done.length) {
      const recent = done.slice(0, 3);
      const counts = await Promise.all(recent.map((w) => db.byIndex('sets', 'workoutId', w.id)));
      html += `<section class="card">${cardHead('dumbbell', 'Recent Workouts')}<div class="rows">${recent.map((w, i) => {
        const mins = Math.max(1, Math.round(((w.finishedAt || w.startedAt) - w.startedAt) / 60000));
        return `<div class="row"><div class="badge">${icon('check', 18, false)}</div><div class="main"><p class="t">${esc(shortName(w.sessionName))}</p><p class="s">${esc(fmtDate(w.date))} · ${counts[i].filter((s) => s.done).length} sets</p></div><span class="v">${mins} min</span></div>`;
      }).join('')}</div></section>`;
    }
    return html;
  }

  // ---------- Render: Train ----------
  function targetText(ex) {
    const r = ex.type === 'timed' ? `${range(ex.seconds)} sec` : range(ex.reps);
    return `${ex.sets} × ${r}${ex.perSide ? ' per side' : ''} · rest ${fmtClock(ex.restSec)}`;
  }
  function setRow(s, ex) {
    const timed = ex.type === 'timed';
    const rirOpts = ['<option value="">—</option>', ...[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}"${s.rir === n ? ' selected' : ''}>${n}</option>`)].join('');
    const val = (v) => (v == null ? '' : esc(fmtNum(v)));
    return `<div class="set${timed ? ' timed' : ''}${s.done ? ' done' : ''}" data-set="${esc(s.id)}">
      <span class="sn">${s.setNumber}</span>
      ${timed
        ? `<input class="input" data-f="seconds" inputmode="numeric" placeholder="${range(ex.seconds)}" value="${val(s.seconds)}" aria-label="Seconds">`
        : `<input class="input" data-f="weightLb" inputmode="decimal" placeholder="lb" value="${val(s.weightLb)}" aria-label="Weight in pounds">
           <input class="input" data-f="reps" inputmode="numeric" placeholder="${range(ex.reps)}" value="${val(s.reps)}" aria-label="Reps">`}
      <select class="input" data-f="rir" aria-label="Reps in reserve">${rirOpts}</select>
      <button class="check" data-act="done" aria-label="${s.done ? 'Mark set not done' : 'Mark set done'}" aria-pressed="${s.done}">${icon('check', 26, false)}</button>
    </div>`;
  }
  function exerciseCard(ex, i) {
    const a = state.active;
    const sets = a.sets.filter((s) => s.exIndex === i);
    const last = a.last[i];
    const sg = a.sugg[i];
    const timed = ex.type === 'timed';
    const lastText = last ? `Last (${fmtDate(last.date, { month: 'short', day: 'numeric' })}): ${last.sets.map((s) => fmtSet(s, ex)).join(' · ')}` : '';
    return `<section class="card" data-ex="${i}">
      <div class="ex-head"><div class="tt"><h2>${esc(ex.name)}</h2>
        <p class="sub">${esc(targetText(ex))}</p>
        ${ex.swappedFrom ? `<p class="sub swapped">Swapped from ${esc(ex.swappedFrom)}</p>` : `<p class="sub">Swap: ${esc(ex.alt)}</p>`}</div>
        <button class="chip" data-act="swap">${icon('swap', 16, false)}Swap</button></div>
      ${lastText ? `<p class="last">${esc(lastText)}</p>` : ''}
      <p class="sugg ${sg.kind}">${esc(sg.text)}</p>
      <p class="hint">${esc(effortLine(ex, programWeek(a.w.date)))}</p>
      <div class="stack" style="gap:8px">
        <div class="set-head${timed ? ' timed' : ''}"><span>Set</span>${timed ? '<span>Sec</span>' : '<span>Lb</span><span>Reps</span>'}<span>RIR</span><span></span></div>
        ${sets.map((s) => setRow(s, ex)).join('')}
      </div>
      <div class="ex-foot"><button class="chip" data-act="add-set">${icon('plus', 16, false)}Set</button>${sets.length > 1 ? `<button class="chip" data-act="rm-set">${icon('minus', 16, false)}Set</button>` : ''}</div>
    </section>`;
  }
  function renderTrain() {
    const a = state.active;
    if (!a && !state.program.sessions.length) return pageHead('dumbbell', 'Train', 'No program yet') + noProgramCard();
    if (!a) {
      const today = plannedFor(dateKey());
      return pageHead('dumbbell', 'Train', 'Pick a session to start') +
        `<section class="card"><div class="rows">${state.program.sessions.map((s) => {
          const isToday = today.kind === 'lift' && today.session.id === s.id;
          return `<button class="list-btn" data-act="start" data-session="${esc(s.id)}"><div class="main" style="flex:1;min-width:0"><p class="t" style="font-weight:600">${esc(s.name)}</p><p class="caption">${s.exercises.length} exercises · ${s.exercises.reduce((n, e) => n + e.sets, 0)} sets</p></div>${isToday ? '<span class="pill soft-pill">Today</span>' : ''}<span class="chip">Start</span></button>`;
        }).join('')}</div></section>
        <p class="caption" style="text-align:center">Your sets save as you go, so closing the app mid-workout is safe.</p>`;
    }
    const w = a.w;
    return pageHead('dumbbell', shortName(w.sessionName), `Week ${programWeek(w.date)} · started ${esc(fmtTime(w.startedAt))} · <span data-elapsed>${Math.floor((Date.now() - w.startedAt) / 60000)} min</span>`, true) +
      `<section class="card"><div class="warmup"><span class="ico">${icon('flame', 20)}</span><span><strong>Warm-up.</strong> ${esc(state.program.warmup)}</span></div></section>` +
      `<section class="card"><div class="warmup"><span class="ico">${icon('shield', 20)}</span><span><strong>Week ${programWeek(w.date)}.</strong> ${esc(L.effort(programWeek(w.date)).text)}</span></div></section>` +
      w.plan.map(exerciseCard).join('') +
      `<button class="btn btn-primary" data-act="finish">Finish Workout</button>
       <button class="btn btn-danger" data-act="discard">Discard Workout</button>`;
  }

  // ---------- Render: Progress (later phase) ----------
  const renderProgress = () => pageHead('chart', 'Progress', 'Trends over time') +
    `<section class="card"><div class="empty">Charts, personal records and streaks arrive in Phase 4. Your workouts are already being saved for them.</div></section>`;

  // ---------- Render: Settings ----------
  function renderSettings() {
    const s = state.settings;
    let mode = 'dark';
    try { mode = localStorage.getItem(MODE_KEY) || 'dark'; } catch { /* ignore */ }
    const lastB = s.lastBackupAt;
    const stale = !lastB || (Date.now() - lastB) / 864e5 > BACKUP_STALE_DAYS;
    const dayOpts = (cur) => [...state.program.sessions.map((x) => [x.id, shortName(x.name)]), ['run', 'Run'], ['rest', 'Rest']]
      .map(([v, l]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('');
    return pageHead('gear', 'Settings', `Version ${VERSION}`) +
      `<section class="card">${cardHead('gear', 'Appearance')}
        <div class="seg" role="group" aria-label="Appearance">${[['dark', 'Dark'], ['light', 'Light'], ['system', 'Match Phone']].map(([v, l]) => `<button data-act="mode" data-mode="${v}" aria-pressed="${mode === v}">${l}</button>`).join('')}</div></section>
      ${renderLoggingSettings()}
      <section class="card">${cardHead('dumbbell', 'Program')}
        <p class="caption">${state.program.sessions.length ? `${state.program.sessions.length} sessions loaded: ${esc(state.program.sessions.map((x) => shortName(x.name)).join(', '))}.` : 'No program loaded.'}</p>
        ${state.program.sessions.length ? '<button class="btn btn-primary" data-act="edit-program">Edit Program</button>' : ''}
        <button class="btn btn-outline" data-act="import-program">${icon('download', 20, false)}Import Program File</button>
        <p class="caption">A JSON file with your sessions and exercises. It replaces the current program but keeps your logged workouts.</p></section>
      <section class="card">${cardHead('today', 'Profile')}
        <label class="field"><span>Bodyweight (lb)</span><input class="input" data-setting="bodyweightLb" inputmode="decimal" placeholder="Not set" value="${s.bodyweightLb == null ? '' : esc(fmtNum(s.bodyweightLb))}"></label>
        <label class="field"><span>Program start date</span><input class="input" type="date" data-setting="programStartDate" value="${esc(s.programStartDate)}"></label>
        <p class="caption">Today is week ${programWeek()} of the program.</p></section>
      <section class="card">${cardHead('dumbbell', 'Weekly Schedule')}
        ${DAY_ORDER.map((d) => `<label class="field"><span>${DAY_NAMES[d]}</span><select class="input" data-day="${d}">${dayOpts(s.dayMapping[d])}</select></label>`).join('')}</section>
      <section class="card">${cardHead('shield', 'Backup', stale ? '<span class="pill warn-pill">Back up</span>' : '')}
        <p class="caption">Last backup: ${lastB ? esc(new Date(lastB).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })) : 'Never'}.${stale ? ' Back up now so a cleared browser cannot cost you your history.' : ''}</p>
        <button class="btn btn-primary" data-act="backup">${icon('upload', 20, false)}Back Up Now</button>
        <button class="btn btn-outline" data-act="restore">${icon('download', 20, false)}Restore From Backup</button>
        <p class="caption">The backup is one plain JSON file with everything in this app. Save it to Files or iCloud Drive.</p></section>
      <section class="card">${cardHead('trash', 'Danger Zone')}
        <button class="btn btn-danger" data-act="reset">Reset All Data</button></section>
      <p class="footer">Training Tracker ${VERSION} · Data is stored unencrypted in this browser. Backups are plain files.</p>`;
  }

  // ---------- Render core ----------
  async function render() {
    const token = ++renderToken;
    const v = state.view;
    $$('.tabbar button').forEach((b) => (b.dataset.view === v ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    let html = '';
    if (v === 'today') html = await renderToday();
    else if (v === 'train') html = renderTrain();
    else if (v === 'log') html = await renderLog();
    else if (v === 'progress') html = renderProgress();
    else html = renderSettings();
    if (token !== renderToken) return; // a newer render replaced this one
    $('#view').innerHTML = html;
    if (v === 'train' && state.active) acquireWake();
  }
  function go(view) { state.view = view; render(); window.scrollTo(0, 0); }

  // ---------- Dialogs and toast ----------
  let toastTimer = null;
  function toast(msg, { action, onAction, duration = 3500 } = {}) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
    el.hidden = false;
    if (action) $('button', el).onclick = () => { el.hidden = true; onAction && onAction(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, duration);
  }
  function ask({ title, message, buttons }) {
    return new Promise((resolve) => {
      const dlg = $('#ask');
      dlg.innerHTML = `<h2>${esc(title)}</h2><p>${esc(message)}</p><div class="btns">${buttons.map((b, i) => `<button class="btn ${b.style || 'btn-outline'}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>`;
      dlg.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) { dlg.close(); resolve(buttons[b.dataset.i].value); } };
      dlg.oncancel = () => resolve(null);
      dlg.showModal();
    });
  }
  function openSheet(title, html) {
    const dlg = $('#sheet');
    dlg.innerHTML = `<div class="handle"></div><h2>${esc(title)}</h2>${html}`;
    dlg.oninput = null;
    dlg.onkeydown = null;
    dlg.onchange = null;
    dlg.onclose = null;
    dlg.onclick = (e) => { if (e.target === dlg) dlg.close(); };
    if (!dlg.open) dlg.showModal();
    return dlg;
  }

  function swapSheet(exIndex) {
    const ex = state.active.w.plan[exIndex];
    const dlg = openSheet('Swap Exercise', `<div class="stack">
      <p class="caption">Replaces ${esc(ex.name)} for today only.</p>
      ${ex.swappedFrom ? `<button class="btn btn-outline" data-name="${esc(ex.origName)}">Back to ${esc(ex.origName)}</button>` : `<button class="btn btn-navy" data-name="${esc(ex.alt)}">Use ${esc(ex.alt)}</button>`}
      <label class="field"><span>Or type your own</span><input class="input" id="swap-custom" maxlength="80" placeholder="Exercise name"></label>
      <button class="btn btn-primary" data-custom>Use Custom Exercise</button></div>`);
    dlg.onclick = (e) => {
      if (e.target === dlg) return dlg.close();
      const named = e.target.closest('[data-name]');
      const custom = e.target.closest('[data-custom]');
      const name = named ? named.dataset.name : custom ? $('#swap-custom', dlg).value : null;
      if (name == null) return;
      dlg.close();
      swapExercise(exIndex, name);
    };
  }

  function finishSheet() {
    let energy = 3;
    const dlg = openSheet('Finish Workout', `<div class="stack">
      <div><p class="caption" style="margin-bottom:8px">Energy (1 low, 5 high)</p>
        <div class="seg" id="energy">${[1, 2, 3, 4, 5].map((n) => `<button data-e="${n}" aria-pressed="${n === 3}">${n}</button>`).join('')}</div></div>
      <label class="field"><span>Note (optional)</span><textarea class="input" id="fin-note" maxlength="500" placeholder="How did it go?"></textarea></label>
      <button class="btn btn-primary" data-save>Save Workout</button>
      <button class="btn btn-outline" data-keep>Keep Going</button></div>`);
    dlg.onclick = (e) => {
      if (e.target === dlg) return dlg.close();
      const eb = e.target.closest('[data-e]');
      if (eb) { energy = Number(eb.dataset.e); $$('#energy button', dlg).forEach((b) => b.setAttribute('aria-pressed', String(b === eb))); return; }
      if (e.target.closest('[data-keep]')) return dlg.close();
      if (e.target.closest('[data-save]')) { const note = $('#fin-note', dlg).value; dlg.close(); finishWorkout(energy, note); }
    };
  }

  // ---------- Backup and restore ----------
  async function buildBackup() {
    const out = { app: 'training-tracker', schemaVersion: SCHEMA, appVersion: VERSION, exportedAt: new Date().toISOString() };
    for (const s of STORE_NAMES) out[s] = await db.all(s);
    return out;
  }
  async function backupNow() {
    let json;
    try { json = JSON.stringify(await buildBackup(), null, 2); } catch { toast('Could not read your data to back it up.'); return; }
    const file = new File([json], BACKUP_FILE, { type: 'application/json' });
    let saved = false;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Training Tracker Backup' }); saved = true; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    if (!saved) {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = BACKUP_FILE; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    state.settings.lastBackupAt = Date.now();
    await saveSettings();
    toast('Backup saved');
    render();
  }

  function validateBackup(o) {
    if (!o || typeof o !== 'object' || o.app !== 'training-tracker') throw new Error('This file is not a Training Tracker backup.');
    if (o.schemaVersion !== SCHEMA) throw new Error(`This backup uses version ${o.schemaVersion}, and this app reads version ${SCHEMA}.`);
    const data = {};
    let skipped = 0;
    for (const s of STORE_NAMES) {
      if (o[s] !== undefined && !Array.isArray(o[s])) throw new Error(`The "${s}" section of the backup is damaged.`);
      const key = STORES[s].keyPath;
      data[s] = (o[s] || []).filter((r) => { const ok = r && typeof r === 'object' && r[key] != null; if (!ok) skipped++; return ok; });
    }
    return { data, skipped };
  }

  async function restoreFromFile(file) {
    let parsed;
    try { parsed = validateBackup(JSON.parse(await file.text())); }
    catch (e) { await ask({ title: 'Cannot Restore', message: e instanceof SyntaxError ? 'That file is not valid JSON.' : e.message, buttons: [{ label: 'OK', value: true, style: 'btn-primary' }] }); return; }
    const { data, skipped } = parsed;
    const doneCount = data.workouts.filter((w) => w.status === 'done').length;
    const choice = await ask({
      title: 'Replace All Data?',
      message: `This erases everything on this phone and uses the backup instead: ${doneCount} workouts, ${data.sets.length} sets.${skipped ? ` ${skipped} damaged records will be skipped.` : ''}`,
      buttons: [{ label: 'Replace All Data', value: 'go', style: 'btn-danger' }, { label: 'Cancel', value: null }],
    });
    if (choice !== 'go') return;
    try { await db.replaceAll(data); } catch { toast('Restore failed. Your existing data was not changed.'); return; }
    clearRest();
    await loadState();
    toast('Backup restored');
    go('today');
  }

  // ---------- Program import ----------
  function normalizeProgram(o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.sessions) || !o.sessions.length) throw new Error('The file needs a "sessions" list with at least one session.');
    const pair = (v) => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isFinite(n) && n > 0);
    const ids = new Set();
    const sessions = o.sessions.map((s, si) => {
      if (!s || typeof s.id !== 'string' || !s.id || typeof s.name !== 'string' || !Array.isArray(s.exercises) || !s.exercises.length) throw new Error(`Session ${si + 1} needs an id, a name and exercises.`);
      if (ids.has(s.id) || s.id === 'rest' || s.id === 'run') throw new Error(`Session id "${s.id}" is repeated or reserved.`);
      ids.add(s.id);
      const exercises = s.exercises.map((e, ei) => {
        const where = `${s.name}, exercise ${ei + 1}`;
        if (!e || typeof e.name !== 'string' || !e.name) throw new Error(`${where} needs a name.`);
        if (!Number.isInteger(e.sets) || e.sets < 1 || e.sets > 20) throw new Error(`${where} needs "sets" between 1 and 20.`);
        if (!(e.type === 'timed' ? pair(e.seconds) : pair(e.reps))) throw new Error(`${where} needs ${e.type === 'timed' ? '"seconds"' : '"reps"'} as [low, high].`);
        return { ...e, name: e.name.slice(0, 80), alt: String(e.alt || '').slice(0, 80), restSec: Number.isFinite(e.restSec) && e.restSec >= 0 ? e.restSec : 90, type: e.type || 'compound' };
      });
      return { ...s, name: s.name.slice(0, 80), exercises };
    });
    const strs = (m) => Object.fromEntries(Object.entries(m && typeof m === 'object' ? m : {}).map(([k, v]) => [k, String(v).slice(0, 200)]));
    let dayMapping = null;
    if (o.dayMapping && typeof o.dayMapping === 'object') {
      dayMapping = {};
      for (let d = 0; d < 7; d++) { const v = o.dayMapping[d]; dayMapping[d] = v === 'run' || (typeof v === 'string' && ids.has(v)) ? v : 'rest'; }
    }
    return { program: { id: 'main', version: 1, warmup: String(o.warmup || '').slice(0, 500), notes: strs(o.notes), sessions }, dayMapping };
  }

  async function importProgram(file) {
    let result;
    try { result = normalizeProgram(JSON.parse(await file.text())); }
    catch (e) { await ask({ title: 'Cannot Import', message: e instanceof SyntaxError ? 'That file is not valid JSON.' : e.message, buttons: [{ label: 'OK', value: true, style: 'btn-primary' }] }); return; }
    if (state.program.sessions.length) {
      const c = await ask({ title: 'Replace Program?', message: 'This replaces your current program. Logged workouts are kept.', buttons: [{ label: 'Replace Program', value: true, style: 'btn-primary' }, { label: 'Cancel', value: false }] });
      if (!c) return;
    }
    try { await db.put('program', result.program); } catch { toast('Could not save the program.'); return; }
    state.program = result.program;
    if (result.dayMapping) { state.settings.dayMapping = result.dayMapping; await saveSettings(); }
    toast(`Program imported · ${result.program.sessions.length} sessions`);
    go('today');
  }

  async function resetAll() {
    const first = await ask({ title: 'Reset All Data?', message: 'This deletes every workout, log and setting on this phone. A backup is the only way to get it back.', buttons: [{ label: 'Continue', value: true, style: 'btn-danger' }, { label: 'Cancel', value: false }] });
    if (!first) return;
    const second = await ask({ title: 'Really Delete Everything?', message: 'This cannot be undone.', buttons: [{ label: 'Delete Everything', value: true, style: 'btn-danger' }, { label: 'Cancel', value: false }] });
    if (!second) return;
    await db.replaceAll({});
    clearRest();
    await loadState();
    toast('All data erased');
    go('today');
  }

  // ---------- Event wiring ----------
  function wire() {
    $('.tabbar').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) go(b.dataset.view); });

    const view = $('#view');
    view.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      const exEl = btn.closest('[data-ex]');
      const i = exEl ? Number(exEl.dataset.ex) : -1;

      if (act === 'start') return startWorkout(btn.dataset.session);
      if (act === 'go-train') return go('train');
      if (act === 'backup') return backupNow();
      if (act === 'restore') return $('#restore-file').click();
      if (act === 'import-program') return $('#program-file').click();
      if (act === 'reset') return resetAll();
      if (act === 'mode') {
        try { localStorage.setItem(MODE_KEY, btn.dataset.mode); } catch { /* ignore */ }
        applyMode(); return render();
      }

      const date = btn.dataset.date || (state.view === 'log' ? state.logDate || dateKey() : dateKey());
      if (act === 'water-add') return addWater(date, Number(btn.dataset.oz));
      if (act === 'sheet-water') return waterSheet(date);
      if (act === 'edit-water') return waterSheet(date, btn.dataset.id);
      if (act === 'sheet-sleep') return sleepSheet(date);
      if (act === 'sheet-weight') return weightSheet(date);
      if (act === 'sheet-nutrition') return nutritionSheet(date);
      if (act === 'sheet-run') return runSheet(date);
      if (act === 'edit-run') return runSheet(date, btn.dataset.id);
      if (act === 'toggle') return toggleItem(date, btn.dataset.key);
      if (act === 'edit-workout') return editWorkoutSheet(btn.dataset.id);
      if (act === 'edit-program') return programSheet();
      if (act === 'deload-dismiss') { state.settings.deloadDismissedOn = dateKey(); await saveSettings(); return render(); }
      if (act === 'sets-skip') { state.settings.setsPromptDone = true; await saveSettings(); return render(); }
      if (act === 'sets-apply') {
        const next = state.program.sessions.map((s) => ({ ...s, exercises: s.exercises.map((e, i) => (i < 2 ? { ...e, sets: Math.min(20, e.sets + 1) } : e)) }));
        if (await saveProgram(next)) { state.settings.setsPromptDone = true; await saveSettings(); toast('Added 1 set to the first two exercises of each session'); render(); }
        return;
      }
      if (act === 'review-apply') {
        const delta = Number(btn.dataset.delta);
        state.settings.targets.calories = Math.max(1000, state.settings.targets.calories + delta);
        state.settings.reviewAppliedOn = dateKey();
        await saveSettings();
        toast(`Calorie target is now ${state.settings.targets.calories}`);
        return render();
      }
      if (act === 'log-prev' || act === 'log-next') {
        const d = parseKey(state.logDate || dateKey());
        d.setDate(d.getDate() + (act === 'log-next' ? 1 : -1));
        if (dateKey(d) > dateKey()) return;
        state.logDate = dateKey(d); return render();
      }
      if (act === 'log-today') { state.logDate = null; return render(); }
      if (act === 'pick-day') { state.logDate = btn.dataset.date; render(); return window.scrollTo(0, 0); }
      if (act === 'unit') { state.settings.units[btn.dataset.k] = btn.dataset.v; await saveSettings(); return render(); }
      if (act === 'add-item') {
        const label = $('#new-item').value.trim().slice(0, 30);
        if (!label) return;
        if (state.settings.customItems.length >= 10) return toast('That is the maximum of 10 items.');
        state.settings.customItems.push({ id: uid(), label });
        await saveSettings(); return render();
      }
      if (act === 'rm-item') {
        state.settings.customItems = state.settings.customItems.filter((x) => x.id !== btn.dataset.id);
        await saveSettings(); return render();
      }

      const a = state.active;
      if (!a) return;
      if (act === 'swap') return swapSheet(i);
      if (act === 'add-set') {
        const mine = a.sets.filter((s) => s.exIndex === i);
        const prev = mine[mine.length - 1];
        const s = blankSet(a.w, i, (prev ? prev.setNumber : 0) + 1, a.w.plan[i], prev ? prev.weightLb : null);
        a.sets.push(s); a.sets.sort(setOrder);
        await saveSet(s); return render();
      }
      if (act === 'rm-set') {
        const mine = a.sets.filter((s) => s.exIndex === i);
        if (mine.length < 2) return;
        const s = mine[mine.length - 1];
        a.sets = a.sets.filter((x) => x !== s);
        await db.del('sets', s.id).catch(() => {}); return render();
      }
      if (act === 'done') {
        const row = btn.closest('[data-set]');
        const s = a.sets.find((x) => x.id === row.dataset.set);
        if (!s) return;
        readRow(row, s); // pick up values typed but not yet committed
        s.done = !s.done;
        s.timestamp = Date.now();
        await saveSet(s);
        if (s.done) startRest(a.w.plan[i].restSec || 90); else if (rest) clearRest();
        return render();
      }
      if (act === 'finish') {
        if (!a.sets.some((s) => s.done)) {
          const c = await ask({ title: 'No Sets Done', message: 'No sets are marked done yet. Discard this workout, or keep going?', buttons: [{ label: 'Keep Going', value: 'keep', style: 'btn-primary' }, { label: 'Discard Workout', value: 'discard', style: 'btn-danger' }] });
          if (c === 'discard') return discardWorkout();
          return;
        }
        return finishSheet();
      }
      if (act === 'discard') {
        const c = await ask({ title: 'Discard Workout?', message: 'All sets from this workout will be deleted.', buttons: [{ label: 'Discard Workout', value: true, style: 'btn-danger' }, { label: 'Cancel', value: false }] });
        if (c) discardWorkout();
      }
    });

    // Commit set fields as soon as they change; no re-render, so the keypad stays open.
    view.addEventListener('change', async (e) => {
      const t = e.target;
      const row = t.closest('[data-set]');
      if (row && state.active) {
        const s = state.active.sets.find((x) => x.id === row.dataset.set);
        if (s) { readRow(row, s); await saveSet(s); }
        return;
      }
      if (t.dataset.target) {
        const k = t.dataset.target, tg = state.settings.targets;
        if (k === 'bedtime') { if (t.value) tg.bedtime = t.value; else t.value = tg.bedtime; }
        else { const v = num(t.value); if (v != null && v > 0) tg[k] = v; else t.value = tg[k]; }
        await saveSettings(); return;
      }
      if (t.dataset.qa !== undefined) {
        const i = Number(t.dataset.qa), v = num(t.value);
        if (v != null && v > 0 && v <= 300) state.settings.waterQuickAdds[i] = v; else t.value = state.settings.waterQuickAdds[i];
        await saveSettings(); return;
      }
      if (t.dataset.logdate !== undefined) { if (t.value && t.value <= dateKey()) { state.logDate = t.value; render(); } return; }
      if (t.dataset.day !== undefined) { state.settings.dayMapping[t.dataset.day] = t.value; await saveSettings(); toast('Schedule updated'); return; }
      if (t.dataset.setting === 'bodyweightLb') {
        const v = num(t.value);
        state.settings.bodyweightLb = v;
        if (v) { state.settings.targets.protein = L.proteinTarget(v); toast(`Protein target set to ${state.settings.targets.protein} g`); }
        await saveSettings(); render(); return;
      }
      if (t.dataset.setting === 'programStartDate' && t.value) { state.settings.programStartDate = t.value; await saveSettings(); render(); }
    });

    $('#restbar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-rest]');
      if (!b || !rest) return;
      if (b.dataset.rest === 'skip') clearRest();
      else if (!rest.over) rest.endsAt += 15000;
    });

    $('#program-file').addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f) importProgram(f);
    });

    $('#restore-file').addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f) restoreFromFile(f);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        tick();
        if (state.active && state.view === 'train') acquireWake();
        if (state.view === 'today') render(); // a new day may have started
      }
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyMode);
    setInterval(tick, 500);
  }

  function readRow(row, s) {
    $$('[data-f]', row).forEach((el) => {
      const f = el.dataset.f;
      if (f === 'rir') s.rir = el.value === '' ? null : parseInt(el.value, 10);
      else if (f === 'reps' || f === 'seconds') { const n = num(el.value); s[f] = n == null ? null : Math.round(n); }
      else s[f] = num(el.value);
    });
  }

  // ---------- Service worker ----------
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    const banner = $('#update-banner');
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) banner.hidden = false; });
    banner.addEventListener('click', () => location.reload());
    navigator.serviceWorker.register('sw.js').then((reg) => {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
  }

  // ---------- Init ----------
  async function init() {
    applyMode();
    wire();
    $$('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 20); });
    try {
      handle = await openDb();
      await loadState();
    } catch {
      $('#view').innerHTML = `<section class="card"><h2>Storage Unavailable</h2><p class="caption">This browser blocked on-device storage, so the app cannot save anything. Private browsing often causes this. Open the app in a normal window.</p></section>`;
      return;
    }
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { /* request only */ }
    state.view = state.active ? 'train' : 'today';
    if (new URLSearchParams(location.search).has('dev')) {
      // Dev only: ?dev=1 loads dev/sample-data.js, which is not part of the upload folder.
      window.__tt = { db, state, STORES, uid, dateKey, loadState, render, L };
      const sc = document.createElement('script');
      sc.src = 'dev/sample-data.js';
      document.head.appendChild(sc);
    }
    render();
    registerSW();
  }
  init();
})();
