(() => {
  'use strict';

  // ---------- Constants ----------
  const VERSION = '0.1.0'; // keep equal to CACHE in sw.js
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
  const fmtTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
      targets: { protein: 140, calories: 3100, waterBaseOz: 100, sleepHours: 8, runMinutesWeek: [60, 120] },
      lastBackupAt: null,
    };
  }

  async function loadState() {
    let settings = await db.get('settings', 'main');
    if (!settings) { settings = defaultSettings(); await db.put('settings', settings); }
    const base = defaultSettings();
    state.settings = { ...base, ...settings, units: { ...base.units, ...settings.units }, targets: { ...base.targets, ...settings.targets }, dayMapping: { ...base.dayMapping, ...settings.dayMapping } };
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
    const last = {};
    for (let i = 0; i < w.plan.length; i++) last[i] = await lastSets(w.plan[i].name, w.id);
    state.active = { w, sets, last };
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

  // Most recent finished session that included this exercise.
  async function lastSets(name, excludeWorkoutId) {
    const rows = (await db.byIndex('sets', 'exerciseName', name)).filter((s) => s.done && s.workoutId !== excludeWorkoutId);
    if (!rows.length) return null;
    const byW = new Map();
    for (const s of rows) (byW.get(s.workoutId) || byW.set(s.workoutId, []).get(s.workoutId)).push(s);
    let best = null;
    for (const [wid, sets] of byW) {
      const w = await db.get('workouts', wid);
      if (!w || w.status !== 'done') continue;
      const t = w.finishedAt || w.startedAt;
      if (!best || t > best.t) best = { t, date: w.date, sets: sets.sort((a, b) => a.setNumber - b.setNumber) };
    }
    return best;
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
  const prefillWeight = (last, i) => (last ? (last.sets[i] ?? last.sets[last.sets.length - 1])?.weightLb ?? null : null);

  async function startWorkout(sessionId) {
    if (state.active) { go('train'); return; }
    const session = sessionById(sessionId);
    if (!session) return;
    const plan = session.exercises.map((e) => ({ ...structuredClone(e), origName: e.name, swappedFrom: null }));
    const w = { id: uid(), date: dateKey(), sessionId, sessionName: session.name, startedAt: Date.now(), finishedAt: null, energy: null, note: '', status: 'in-progress', plan };
    const last = {};
    const sets = [];
    for (let i = 0; i < plan.length; i++) {
      last[i] = await lastSets(plan[i].name, w.id);
      for (let n = 1; n <= plan[i].sets; n++) sets.push(blankSet(w, i, n, plan[i], prefillWeight(last[i], n - 1)));
    }
    try {
      await db.write([['put', 'workouts', w], ...sets.map((s) => ['put', 'sets', s])]);
    } catch { toast('Could not start the workout. Browser storage is full or blocked.'); return; }
    state.active = { w, sets, last };
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
    a.last[exIndex] = await lastSets(newName, a.w.id);
    const mine = a.sets.filter((s) => s.exIndex === exIndex);
    mine.forEach((s) => {
      s.exerciseName = newName; s.swappedFrom = ex.swappedFrom;
      if (!s.done) s.weightLb = prefillWeight(a.last[exIndex], s.setNumber - 1);
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
          <p class="caption">Run logging arrives in Phase 2.</p>`;
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
    const timed = ex.type === 'timed';
    let lastText;
    if (last) lastText = `Last (${fmtDate(last.date, { month: 'short', day: 'numeric' })}): ${last.sets.map((s) => fmtSet(s, ex)).join(' · ')}`;
    else if (ex.type === 'compound' || ex.type === 'isolation') lastText = 'First time: pick a weight you can do for the top of the range with about 3 reps left.';
    else lastText = 'First time logging this one.';
    return `<section class="card" data-ex="${i}">
      <div class="ex-head"><div class="tt"><h2>${esc(ex.name)}</h2>
        <p class="sub">${esc(targetText(ex))}</p>
        ${ex.swappedFrom ? `<p class="sub swapped">Swapped from ${esc(ex.swappedFrom)}</p>` : `<p class="sub">Swap: ${esc(ex.alt)}</p>`}</div>
        <button class="chip" data-act="swap">${icon('swap', 16, false)}Swap</button></div>
      <p class="last">${esc(lastText)}</p>
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
      w.plan.map(exerciseCard).join('') +
      `<button class="btn btn-primary" data-act="finish">Finish Workout</button>
       <button class="btn btn-danger" data-act="discard">Discard Workout</button>`;
  }

  // ---------- Render: Log, Progress (later phases) ----------
  const renderLog = () => pageHead('log', 'Log', 'Daily entries') +
    `<section class="card"><div class="empty">Water, sleep, bodyweight, nutrition, creatine and run logging arrive in Phase 2.</div></section>`;
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
      <section class="card">${cardHead('dumbbell', 'Program')}
        <p class="caption">${state.program.sessions.length ? `${state.program.sessions.length} sessions loaded: ${esc(state.program.sessions.map((x) => shortName(x.name)).join(', '))}.` : 'No program loaded.'}</p>
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
    else if (v === 'log') html = renderLog();
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
    dlg.onclick = (e) => { if (e.target === dlg) dlg.close(); };
    dlg.showModal();
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
      if (t.dataset.day !== undefined) { state.settings.dayMapping[t.dataset.day] = t.value; await saveSettings(); toast('Schedule updated'); return; }
      if (t.dataset.setting === 'bodyweightLb') { state.settings.bodyweightLb = num(t.value); await saveSettings(); return; }
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
    render();
    registerSW();
  }
  init();
})();
