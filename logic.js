// Pure rules from the program's "Logic rules". No DOM and no storage, so they can be unit tested
// (open dev/tests.html through a local server).
(function (root) {
  'use strict';
  const L = {};

  // ---------- Dates ----------
  const pad = (n) => String(n).padStart(2, '0');
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (key, n) => { const d = parseKey(key); d.setDate(d.getDate() + n); return dateKey(d); };
  L.addDays = addDays;

  const round1 = (n) => Math.round(n * 10) / 10;
  const mins = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };

  // ---------- Sleep ----------
  // Hours slept, handling past-midnight bedtimes. Null when bed and wake time are equal.
  L.sleepHours = function (bed, wake) {
    let d = mins(wake) - mins(bed);
    if (d < 0) d += 1440;
    return d === 0 ? null : round1(d / 60);
  };

  // ---------- Bodyweight trend ----------
  // Average of the entries in the 7 days ending on endDate. Needs at least minEntries; missing days are ignored.
  L.movingAverage = function (entries, endDate, windowDays = 7, minEntries = 4) {
    const start = addDays(endDate, -(windowDays - 1));
    const inWin = entries.filter((e) => e.date >= start && e.date <= endDate && Number.isFinite(e.weightLb));
    if (inWin.length < minEntries) return null;
    return inWin.reduce((s, e) => s + e.weightLb, 0) / inWin.length;
  };
  // This week's average minus last week's average (lb per week).
  L.weeklyRate = function (entries, endDate) {
    const a = L.movingAverage(entries, endDate);
    const b = L.movingAverage(entries, addDays(endDate, -7));
    return a == null || b == null ? null : a - b;
  };
  // Average weekly gain over the last two weeks; needs three full windows of data.
  L.twoWeekGain = function (entries, endDate) {
    const a = L.movingAverage(entries, endDate);
    const c = L.movingAverage(entries, addDays(endDate, -14));
    const b = L.movingAverage(entries, addDays(endDate, -7));
    return a == null || b == null || c == null ? null : (a - c) / 2;
  };
  L.reviewMessage = function (gain) {
    if (gain < 0.4) return { kind: 'slow', text: 'Gaining slowly. Add 150–200 calories a day.', delta: 200 };
    if (gain <= 0.8) return { kind: 'ok', text: 'On track. Keep going.', delta: 0 };
    return { kind: 'fast', text: 'Gaining fast. Drop 150–200 calories a day.', delta: -200 };
  };

  // ---------- Effort by program week ----------
  L.effort = function (week) {
    if (week <= 2) return { phase: 'learn', minRir: 3, maxRir: 3, text: 'Learn the movement; stop with about 3 reps left.' };
    return { phase: 'build', minRir: 1, maxRir: 2, text: 'Stop most sets with 1–2 reps left.' };
  };
  // Target for one set. From week 3, the last set of an isolation exercise goes to failure.
  L.setTarget = function (week, ex, setNumber, totalSets) {
    if (week >= 3 && ex.type === 'isolation' && setNumber === totalSets) return { minRir: 0, maxRir: 0 };
    const e = L.effort(week);
    return { minRir: e.minRir, maxRir: e.maxRir };
  };

  // ---------- Double progression ----------
  // A session is an array of done sets. Its performance is the top weight and the total reps (or seconds) at that weight.
  const valueOf = (s, timed) => (timed ? s.seconds : s.reps) || 0;
  L.sessionPerf = function (sets, timed) {
    const w = Math.max(0, ...sets.map((s) => s.weightLb || 0));
    const atTop = sets.filter((s) => (s.weightLb || 0) === w);
    return { weight: w, total: atTop.reduce((n, s) => n + valueOf(s, timed), 0) };
  };
  L.progressed = (older, newer) => newer.weight > older.weight || (newer.weight === older.weight && newer.total > older.total);

  const roundTo = (n, step) => Math.round(n / step) * step;
  const fmt = (n) => (Number.isInteger(n) ? String(n) : String(round1(n)));

  // sessions: newest first, each { sets: [...done sets] }. Returns { kind, weight, text }.
  // kind: first | increase | hold | stalled
  L.suggest = function (sessions, ex, week) {
    const timed = ex.type === 'timed';
    if (!sessions.length) {
      const text = ex.type === 'compound' || ex.type === 'isolation'
        ? 'First time: pick a weight you can do for the top of the range with about 3 reps left.'
        : 'First time logging this one.';
      return { kind: 'first', weight: null, text };
    }
    const last = sessions[0].sets;
    const perf = sessions.map((s) => L.sessionPerf(s.sets, timed));
    const hasWeight = perf[0].weight > 0;
    const w = perf[0].weight;

    if (sessions.length >= 3 && !L.progressed(perf[2], perf[1]) && !L.progressed(perf[1], perf[0])) {
      const lighter = hasWeight ? roundTo(w * 0.9, 5) : null;
      return { kind: 'stalled', weight: lighter, text: hasWeight ? `Stalled: no progress in 3 sessions. Try 10% lighter, ${fmt(lighter)} lb.` : 'Stalled: no progress in 3 sessions. Try an easier variation.' };
    }

    const top = timed ? ex.seconds[1] : ex.reps[1];
    const maxRir = L.effort(week).maxRir;
    const working = last.filter((s) => (s.weightLb || 0) === w);
    // A set with no RIR logged is not held against you.
    const hitTop = working.length > 0 && working.every((s) => valueOf(s, timed) >= top && (s.rir == null || s.rir <= maxRir));
    if (hitTop) {
      if (hasWeight && ex.increment) return { kind: 'increase', weight: w + ex.increment, text: `Add ${ex.increment} lb: ${fmt(w + ex.increment)} lb.` };
      return { kind: 'increase', weight: hasWeight ? w : null, text: 'Hit the top of the range. Add a little load or a harder variation.' };
    }
    return { kind: 'hold', weight: hasWeight ? w : null, text: `${hasWeight ? `Same weight, ${fmt(w)} lb. ` : ''}${timed ? 'Aim for a few more seconds.' : 'Aim for +1 rep.'}` };
  };

  // ---------- Targets ----------
  L.waterTarget = (baseOz, trainingMinutes) => Math.round(baseOz + 24 * (trainingMinutes / 60));
  L.proteinTarget = (lb) => Math.round((lb / 2.20462) * 1.9);
  L.proteinRange = (lb) => [Math.round((lb / 2.20462) * 1.6), Math.round((lb / 2.20462) * 2.2)];

  // ---------- Deload ----------
  // energies: newest first. True when the last 3 sessions were all rated 1–2.
  L.lowEnergyStreak = (energies) => energies.length >= 3 && energies.slice(0, 3).every((e) => e != null && e <= 2);

  root.TTLogic = L;
  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(typeof self !== 'undefined' ? self : this);
