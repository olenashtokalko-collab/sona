/* SONA Read — prototype v2 (UX pass for dialogue editors: record → take, variations in place, length guide, A/B, Apply & next)
   States: noclip → (toolong) → ready → countin → recording → review → rendering → takes → applied
   Errors: mic denied, render failed. Render is simulated with placeholder audio. */
(() => {
  'use strict';

  // ---------- Data ----------
  const CLIPS = [
    { id: 'anna-t3', track: 0, name: 'SC12_harbour_T3', who: 'Anna', start: 9.0, dur: 2.7, tc: '01:02:14:08',
      text: 'We have to leave before the storm reaches the coast.', audio: 'assets/audio/anna-original.wav',
      takes: ['assets/audio/anna-take-1.wav', 'assets/audio/anna-take-2.wav', 'assets/audio/anna-take-3.wav'],
      voiceTake: 'assets/audio/voice-anna.wav' },
    { id: 'ben-t2', track: 1, name: 'SC12_harbour_T2', who: 'Ben', start: 5.4, dur: 1.6, tc: '01:02:10:14',
      text: 'How long until it gets here?', audio: 'assets/audio/ben-original.wav',
      takes: ['assets/audio/ben-original.wav'], takeRates: [0.94, 1.06, 1.0], voiceTake: 'assets/audio/voice-ben.wav' },
    { id: 'ben-t4', track: 1, name: 'SC12_harbour_T4', who: 'Ben', start: 12.6, dur: 1.6, tc: '01:02:17:15',
      text: 'How long until it gets here?', audio: 'assets/audio/ben-original.wav',
      takes: ['assets/audio/ben-original.wav'], takeRates: [1.06, 0.94, 1.0], voiceTake: 'assets/audio/voice-ben.wav' },
    { id: 'anna-mono', track: 0, name: 'SC12_monologue_T1', who: 'Anna', start: 15.0, dur: 72, tc: '01:02:20:00',
      text: '', audio: null, takes: [] },
    { id: 'atmo', track: 2, name: 'SC12_harbour_atmo', who: null, start: 0, dur: 30, tc: '', audio: null, takes: [], inert: true },
  ];
  /* Apply tiers (research doc 07 §4.1 / doc 10 §5):
     T0 drag-out file (every host, chip always visible) · T1 plays in place via ARA · T2 written into the timeline.
     One Apply button everywhere; the status line says what happened in this host. Menu names: verify with SONA devs. */
  const HOSTS = {
    nuendo: { app: 'Nuendo', slot: 'ARA Extension', tier: 'T1', tracks: ['DIA Anna', 'DIA Ben', 'ATMO'], newTrack: 'SONA takes',
      split: 'Edit › Split at Cursor', print: 'Audio › Make Extension Permanent' },
    reaper: { app: 'REAPER', slot: 'Take FX · ARA', tier: 'T2', mode: 'itemtake', tracks: ['DIA Anna', 'DIA Ben', 'ATMO'], newTrack: 'SONA takes',
      split: 'Item › Split items at cursor (S)' },
    protools: { app: 'Pro Tools', slot: 'AudioSuite', tier: 'T2', mode: 'render', tracks: ['DIA_Anna', 'DIA_Ben', 'ATMO'], newTrack: 'SONA_takes',
      split: 'Edit › Separate Clip (B)' },
    premiere: { app: 'Premiere Pro', slot: 'Extensions panel', tier: 'T2', mode: 'newtrack', tracks: ['A1 · Anna', 'A2 · Ben', 'A3 · Atmo'], newTrack: 'A4 · SONA',
      split: 'Razor tool (C)' },
  };
  const H = () => HOSTS[S.host];
  const VIEW_SECONDS = 26;
  const MAX_SECONDS = 60;
  // Two directions of the same engine. Chosen up front; each keeps its own records and takes per clip.
  const DIRS = {
    // Title = what changes, in plain words. Sub = what the take will be made of.
    tone: { title: 'Change how it’s said', keeps: () => 'Your intonation' },
    voice: { title: 'Change who says it', keeps: () => 'Another voice' },
  };
  // SONA voices, as listed in the client's screenshots (full panel › SONA voices; Mini › Settings › Voice)
  const LIBRARY = [
    // sample: a short preview (prototype placeholders made with macOS `say`; real samples come from SONA)
    { name: 'Ava', tag: 'Default', fav: true, sample: 'assets/audio/voices/ava.wav' },
    { name: 'Mara', who: 'M. Sorell', tag: 'Artist', fav: true, sample: 'assets/audio/voices/mara.wav' },
    { name: 'Noah', tag: 'Default', sample: 'assets/audio/voices/noah.wav' },
    { name: 'Elias', tag: 'Designed', sample: 'assets/audio/voices/elias.wav' },
    { name: 'Calm narrator, warm and low', tag: 'Designed', sample: 'assets/audio/voices/narrator.wav' },
    { name: 'Lena', tag: 'Clone', sample: 'assets/audio/voices/lena.wav' },
    { name: 'Jonas', who: 'J. Halden', tag: 'Artist', sample: 'assets/audio/voices/jonas.wav' },
  ];
  const VOICE_RATES = [1.0, 0.98, 1.02]; // a new voice keeps the clip's timing: takes differ only slightly
  const ICON = {
    swap: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 6.5A5 5 0 0 0 3.6 4.8M3 2.5v2.75h2.75M3 9.5a5 5 0 0 0 9.4 1.7M13 13.5v-2.75h-2.75"/></svg>',
    mic: '<svg class="mic-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="1.75" width="5" height="8" rx="2.5"/><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.25"/></svg>',
    play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7-4.5z"/></svg>',
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3.5h2.5v9H4.5zM9 3.5h2.5v9H9z"/></svg>',
    alert: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><path d="M8 4.75v4M8 10.75v.5"/></svg>',
    drag: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.75 7.25 8 10.5l3.25-3.25M3 13.5h10"/></svg>',
    file: '<svg class="mic-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.75h5.25L12.5 5v9.25H4z"/><path d="M9 1.75V5.25h3.5M6.25 9.5v2M8.25 8v3.5M10.25 9v1.5"/></svg>',
    chevron: '<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5"/></svg>',
    person: '<svg class="mic-ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.5" r="2.75"/><path d="M3 13.75c.6-2.6 2.6-4 5-4s4.4 1.4 5 4"/></svg>',
    tick: '<svg class="chip__tick" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.5 5 9l4.5-6"/></svg>',
  };

  // ---------- State ----------
  const S = {
    host: 'nuendo',
    extra: [],                // clips created by Apply (Premiere) or by dragging a take chip
    state: 'noclip',
    dir: 'tone',              // 'tone' = change delivery, keep the voice · 'voice' = change voice, keep the delivery
    appliedDir: {},           // clipId -> direction of the applied take
    clip: null,
    reads: [],                // {url, peaks, dur, demo}
    takes: [],                // {n, read, url, rate, peaks, dur, status}
    selected: null,           // take number
    sessions: {},             // `${clipId}:${dir}` -> {reads, takes, selected}
    itemTakes: {},            // REAPER: extra SONA takes stacked in an item
    applied: {},              // clipId -> take number
    error: null,
    countdown: 3,
    rec: null,                // live recording session
    voiceMenu: false,         // Voice: SONA voices list open
    newVoiceMenu: false,      // Voice, takes row: false | 'choose' | 'voices'
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    sona: $('sona'), clip: $('clip'), clipWho: $('clipWho'), clipMeta: $('clipMeta'), clipText: $('clipText'),
    playOriginal: $('playOriginal'), work: $('work'), status: $('status'), takesRow: $('takesRow'),
    takeChips: $('takeChips'), actionsLeft: $('actionsLeft'), primary: $('primary'),
    lanes: $('lanes'), ruler: $('ruler'), timeline: $('timeline'), hostHint: $('hostHint'), hostPlay: $('hostPlay'),
    hostPlayhead: $('hostPlayhead'), hostTc: $('hostTc'), plugWindow: $('plugWindow'), plugChrome: $('plugChrome'),
    optDemoRead: { checked: false } /* demo read removed: the flow shows you recording yourself */, optFailNext: $('optFailNext'), optDenyMic: $('optDenyMic'), optReset: $('optReset'),
    helpBtn: $('helpBtn'), trackHeads: $('trackHeads'), hostProject: $('hostProject'), substatus: $('substatus'),
    optHost: $('optHost'), primaryNext: $('primaryNext'), dropNew: $('dropNew'), fileInput: $('fileInput'), optSample: $('optSample'),
    dirRow: $('dirRow'), dropText: $('dropText'), clipFull: $('clipFull'),
  };

  // ---------- Audio helpers ----------
  let actx = null;
  const ctx = () => (actx ||= new (window.AudioContext || window.webkitAudioContext)());
  const peakCache = new Map();

  async function decodePeaks(url, bins = 400) {
    if (peakCache.has(url)) return peakCache.get(url);
    const buf = await fetch(url).then((r) => r.arrayBuffer());
    const audio = await ctx().decodeAudioData(buf);
    const res = { peaks: bufferPeaks(audio, bins), dur: audio.duration };
    peakCache.set(url, res);
    return res;
  }
  function bufferPeaks(audio, bins) {
    const data = audio.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / bins));
    const out = [];
    for (let i = 0; i < bins; i++) {
      let max = 0;
      for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j++) max = Math.max(max, Math.abs(data[j]));
      out.push(max);
    }
    const m = Math.max(...out, 0.0001);
    return out.map((v) => v / m);
  }

  // One shared player for everything inside the plugin
  const player = { audio: new Audio(), kind: null, id: null, raf: 0, paused: false, an: null, lv: [0, 0, 0, 0, 0], lvAt: 0 };
  function ensureAnalyser() { // route the shared player through an analyser once, so the original's mini dots follow the voice
    if (player.an) return;
    try { const ac = ctx(), src = ac.createMediaElementSource(player.audio), an = ac.createAnalyser(); an.fftSize = 256; src.connect(an); an.connect(ac.destination); player.an = an; } catch (e) {}
  }
  function playTick() { drawAllStrips(); readingFill(); miniDots(); }
  function startTick() { clearInterval(player.raf); player.raf = setInterval(playTick, 30); } // a timer, not rAF: steady in a background window
  function pausePlayback() { player.audio.pause(); player.paused = true; clearInterval(player.raf); render(); }
  function resumePlayback() { player.audio.play().catch(() => {}); player.paused = false; startTick(); render(); }
  // The original's line reads itself: dim, and what has been said turns bright white
  function readingFill(reset = false) {
    const on = !reset && player.kind === 'orig' && player.audio.duration;
    el.clip.classList.toggle('is-reading', !!on);
    const p = on ? `${((player.audio.currentTime / player.audio.duration) * 100).toFixed(1)}%` : '0%';
    el.clip.querySelectorAll('[data-fill]').forEach((n) => n.style.setProperty('--p', p));
  }
  // Mini dot waveform inside the original's play button (5 columns, calm steps, one dot up or down per step)
  function miniDots() {
    if (player.kind !== 'orig' && player.kind !== 'voice') return;
    const now = performance.now(); if (now - player.lvAt < 140) return; player.lvAt = now;
    let target = [0, 0, 0, 0, 0];
    if (player.an) {
      const td = new Uint8Array(player.an.fftSize); player.an.getByteTimeDomainData(td);
      let sum = 0; for (const v of td) sum += ((v - 128) / 128) ** 2;
      const L = Math.min(1, Math.sqrt(sum / td.length) * 5), j = () => (Math.random() - 0.5) * 0.3;
      const lv = (k) => Math.max(0, Math.min(2, Math.round(L * k + j())));
      target = [lv(0.9), lv(1.8), lv(2.6), lv(1.8), lv(0.9)];
    } else target = player.lv.map(() => Math.floor(Math.random() * 3));
    player.lv = player.lv.map((v, i) => v + Math.sign(target[i] - v));
    const small = player.kind === 'voice';
    const cv = small ? el.sona.querySelector('.vprev.is-playing .vprev__wave') : el.playOriginal.querySelector('.pbtn__wave'); if (!cv) return;
    const dpr = window.devicePixelRatio || 1, w = small ? 14 : 20, h = small ? 12 : 16, px = small ? 2.8 : 4, py = small ? 2.6 : 3.5, rd = small ? 0.8 : 1;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); g.fillStyle = col('--sona-sky');
    player.lv.forEach((lv, c) => { for (let r = -lv; r <= lv; r++) { g.beginPath(); g.arc(px / 2 + c * px, h / 2 + r * py, rd, 0, Math.PI * 2); g.fill(); } });
  }
  function play(url, kind, id, rate = 1, startFrac = 0) {
    stopPlayback();
    ensureAnalyser(); ctx().resume();
    player.paused = false;
    player.audio.src = url;
    if (startFrac > 0) player.audio.addEventListener('loadedmetadata', () => { player.audio.currentTime = startFrac * player.audio.duration; }, { once: true });
    player.audio.playbackRate = rate;
    player.audio.preservesPitch = true; // tempo follows the read, the voice keeps its pitch
    player.kind = kind; player.id = id;
    player.audio.play().catch(() => {});
    startTick();
    render();
  }
  function stopPlayback() {
    clearInterval(player.raf);
    player.audio.pause();
    player.kind = null; player.id = null; player.paused = false; player.lv = [0, 0, 0, 0, 0];
    readingFill(true);
    drawAllStrips();
  }
  player.audio.addEventListener('ended', () => { clearInterval(player.raf); player.kind = null; player.id = null; player.paused = false; readingFill(true); render(); });
  const progressOf = (kind, id) =>
    player.kind === kind && player.id === id && player.audio.duration ? player.audio.currentTime / player.audio.duration : null;

  // ---------- Dot waveform (brand dot system: 3px dots, pitch 6, 7 rows) ----------
  const CSSV = getComputedStyle(document.documentElement);
  const col = (name) => CSSV.getPropertyValue(name).trim();
  // opts.ghost: {band} → faint dots with a bright band sweeping (rendering) · opts.reveal: 0..1 → print-in from the left
  function drawDots(canvas, peaks, color, progress = null, opts = {}) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const d = 3, pitch = 6, rows = 7, half = 3;
    const cols = Math.floor(w / pitch);
    const cy = h / 2;
    const unplayed = col('--sona-diaslide');
    for (let c = 0; c < cols; c++) {
      const p = peaks && peaks.length ? peaks[Math.min(peaks.length - 1, Math.floor((c / cols) * peaks.length))] : 0;
      if (p < 0) continue;                               // not recorded yet (live strip)
      if (opts.reveal !== undefined && c / cols > opts.reveal) continue;
      const level = Math.round(Math.min(1, p) * half);   // 0..3, snapped to whole dots
      const x = c * pitch + pitch / 2;
      const dim = opts.dimRest;
      // neutralRest (brand: two-tone dots): at rest the whole line is Diaslide; only what has played takes the colour
      const played = progress === null ? dim === undefined && !opts.neutralRest : c / cols <= progress;
      const isHead = dim === undefined && progress !== null && Math.floor(progress * cols) === c && progress > 0;
      g.fillStyle = isHead ? col('--sona-offwhite') : played || dim !== undefined ? color : unplayed;
      g.globalAlpha = isHead || played ? 1 : dim !== undefined ? dim : 0.35;
      if (opts.ghost) { const dist = Math.abs(c - opts.ghost.band); g.globalAlpha = dist < 2 ? 0.9 : dist < 4 ? 0.5 : 0.18; }
      for (let r = -level; r <= level; r++) {
        g.beginPath(); g.arc(x, cy + r * pitch, d / 2, 0, Math.PI * 2); g.fill();
      }
      if (isHead) for (let r = -half; r <= half; r++) { g.beginPath(); g.arc(x, cy + r * pitch, d / 2, 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1;
    void rows;
  }
  function drawAllStrips() {
    el.work.querySelectorAll('canvas[data-strip]').forEach((cv) => {
      const kind = cv.dataset.strip, id = Number(cv.dataset.id);
      if (kind === 'read') {
        const r = S.reads[id]; if (r) drawDots(cv, r.peaks, col('--sona-diaslide'), progressOf('read', id), { dimRest: 0.45 });
      } else if (kind === 'take') {
        const t = S.takes.find((x) => x.n === id);
        if (t && t.status === 'rendering') {
          const cols = Math.floor(cv.clientWidth / 6) || 1;
          // the ghost shows where the delivery comes from: your read (Tone) or the original clip (Voice)
          const src = t.dir === 'voice' ? S.clip?._peaks : S.reads[t.read]?.peaks;
          drawDots(cv, src, col('--sona-sky'), null, { ghost: { band: (t.phase || 0) % (cols + 8) - 4 } });
        } else if (t && t.peaks) {
          const rv = t.revealAt ? Math.min(1, Math.floor(((performance.now() - t.revealAt) / 320) * 8) / 8) : 1;
          drawDots(cv, t.peaks, col('--sona-sky'), progressOf('take', id), rv < 1 ? { reveal: rv, dimRest: 0.4 } : { neutralRest: true });
        }
      } else if (kind === 'readmini') {
        const r = S.reads[id]; if (r && r.peaks) drawMiniDots(cv, r.peaks, col('--you'), progressOf('read', id));
      } else if (kind === 'live' && S.rec) {
        const cols = Math.max(1, Math.floor(cv.clientWidth / 6));
        const f = S.rec.frames;
        const m = Math.max(0.15, ...f);                       // normalise like the final strip, ignore pure noise
        // Time scale: the strip spans 1.5× the original, so the editor sees where the original ends while speaking
        const orig = S.clip?.dur || 3, span = Math.max(orig * 1.5, f.length / 12), perCol = (span * 12) / cols;
        const shown = Array.from({ length: cols }, (_, c) => {
          const a = Math.floor(c * perCol), b = Math.max(a + 1, Math.floor((c + 1) * perCol));
          return a >= f.length ? -1 : Math.max(...f.slice(a, Math.min(b, f.length))) / m;
        });
        drawDots(cv, shown, col('--you'));
        const g = cv.getContext('2d'), x = Math.round((orig / span) * cv.clientWidth) + 0.5;
        g.save(); g.strokeStyle = col('--sona-sky'); g.globalAlpha = 0.9; g.setLineDash([2, 3]);
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, cv.clientHeight); g.stroke(); g.restore();
      }
    });
    // Host clip mini-waves
    document.querySelectorAll('.clip canvas').forEach((cv) => {
      if (cv.dataset.extra) {
        const x = S.extra.find((e) => e.id === cv.dataset.extra);
        if (x && x.peaks) drawHostWave(cv, x.peaks);
        return;
      }
      const c = CLIPS.find((x) => x.id === cv.dataset.clip);
      if (!c) return;
      // A clip that now plays (or contains) a SONA take shows the take's waveform — except Premiere, where the original is untouched
      const t = S.host !== 'premiere' ? appliedTake(c) : null;
      if (t && t.peaks) drawHostWave(cv, t.peaks);
      else if (c._peaks) drawHostWave(cv, c._peaks);
    });
  }
  // Tiny grey strip for "from your read" under a take (2 px dots, 4 px pitch, up to 3 rows)
  function drawMiniDots(cv, peaks, color, progress) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); g.fillStyle = color;
    const cols = Math.floor(w / 4);
    for (let c = 0; c < cols; c++) {
      const p = peaks[Math.min(peaks.length - 1, Math.floor((c / cols) * peaks.length))] || 0, lv = Math.round(Math.min(1, p) * 1.4);
      g.globalAlpha = progress !== null && c / cols <= progress ? 1 : 0.7;
      for (let r = -lv; r <= lv; r++) { g.beginPath(); g.arc(c * 4 + 2, h / 2 + r * 4, 1, 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1;
  }
  function liveWindow(frames) {
    const n = 60; // ~5 s visible, grows left-to-right, then scrolls
    return frames.length > n ? frames.slice(-n) : frames.concat(Array(n - frames.length).fill(0));
  }
  function drawHostWave(cv, peaks) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (!w) return;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = '#e8eeea'; g.lineWidth = 1; g.beginPath();
    for (let x = 0; x < w; x++) {
      const p = peaks[Math.floor((x / w) * peaks.length)] || 0;
      g.moveTo(x + .5, h / 2 - p * h / 2); g.lineTo(x + .5, h / 2 + p * h / 2);
    }
    g.stroke();
  }

  // ---------- Record ring (brand dot system: 3 px dots, 6 px pitch, stepped motion) ----------
  // Idle: one faint ring. Hover: rings arm outward in steps. Count-in: the ring fills like a clock.
  // Recording: 40 spokes of dots react to the voice (speech bands, mirrored), updated in 50 ms steps.
  const Ring = (() => {
    const SPOKES = 36, RADII = [30, 36, 42, 48], DOT = 3;
    let levels = new Array(SPOKES).fill(0), lastStep = 0, hoverStep = 0, hoverTimer = 0, freq = null;
    function canvas() {
      const cv = document.getElementById('recRing'); if (!cv) return null;
      const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      return { g, cx: w / 2, cy: h / 2 };
    }
    function dot(g, cx, cy, i, r, color, alpha) {
      const a = (i / SPOKES) * Math.PI * 2 - Math.PI / 2;
      g.globalAlpha = alpha; g.fillStyle = color;
      g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, DOT / 2, 0, Math.PI * 2); g.fill();
    }
    function draw(fn) {
      const c = canvas(); if (!c) return;
      for (let i = 0; i < SPOKES; i++) for (let k = 0; k < RADII.length; k++) fn(c.g, c.cx, c.cy, i, k);
      c.g.globalAlpha = 1;
    }
    const neutral = () => col('--sona-diaslide'), white = () => col('--sona-offwhite');
    return {
      idle() {
        draw((g, cx, cy, i, k) => {
          if (k === 0) dot(g, cx, cy, i, RADII[0], neutral(), 0.35);
          else if (k <= hoverStep) dot(g, cx, cy, i, RADII[k], neutral(), 0.5 - k * 0.1);
        });
      },
      hover(on) {
        clearInterval(hoverTimer);
        hoverTimer = setInterval(() => {
          hoverStep = on ? Math.min(3, hoverStep + 1) : Math.max(0, hoverStep - 1);
          this.idle();
          if (hoverStep === (on ? 3 : 0)) clearInterval(hoverTimer);
        }, 70);
      },
      count(progress) { // 0..1 around the ring
        const lit = Math.floor(progress * SPOKES);
        draw((g, cx, cy, i, k) => { if (k === 0) dot(g, cx, cy, i, RADII[0], i < lit ? white() : neutral(), i < lit ? 1 : 0.35); });
      },
      live(an) {
        an = an || S.rec?.analyser; if (!an) return;
        const now = performance.now();
        if (now - lastStep < 50) return; // stepped, like an LED meter
        lastStep = now;
        freq = freq && freq.length === an.frequencyBinCount ? freq : new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(freq);
        const half = SPOKES / 2, lo = 3, hi = 120; // ~130 Hz – 5 kHz at 44.1 kHz / 1024 fft
        for (let i = 0; i < SPOKES; i++) {
          const band = i < half ? i : SPOKES - 1 - i; // mirrored left / right
          const b0 = Math.floor(lo + (band / half) * (hi - lo)), b1 = Math.floor(lo + ((band + 1) / half) * (hi - lo));
          let m = 0; for (let b = b0; b < b1; b++) m = Math.max(m, freq[b]);
          const target = Math.round(Math.min(1, (m / 255) * 1.25) * RADII.length);
          levels[i] = target >= levels[i] ? target : levels[i] - 1; // rise fast, fall one dot per step
        }
        draw((g, cx, cy, i, k) => {
          const on = k < levels[i];
          dot(g, cx, cy, i, RADII[k], on ? white() : neutral(), on ? 1 - k * 0.12 : 0.12);
        });
      },
      reset() { levels = new Array(SPOKES).fill(0); hoverStep = 0; clearInterval(hoverTimer); },
    };
  })();

  // Input check without words: hovering the record button shows the mic level on the dot ring
  // (only when mic access is already granted — never prompts on hover)
  const Probe = { wanted: false, stream: null, an: null, timer: 0, label: '' };
  async function probeInput(on) {
    Probe.wanted = on;
    if (!on) {
      clearInterval(Probe.timer); Probe.stream?.getTracks().forEach((t) => t.stop());
      Probe.stream = null; Probe.an = null;
      el.work.querySelector('.ready__main[data-act="record"]')?.style.setProperty('--lvl', '0');
      if (S.state === 'ready' && S.dir === 'tone') { Ring.reset(); Ring.idle(); }
      return;
    }
    if (Probe.stream || el.optDemoRead.checked || el.optDenyMic.checked) return;
    try { const st = await navigator.permissions?.query({ name: 'microphone' }); if (!st || st.state !== 'granted') return; } catch (e) { return; }
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return; }
    if (!Probe.wanted) { stream.getTracks().forEach((t) => t.stop()); return; }
    const an = ctx().createAnalyser(); an.fftSize = 1024;
    ctx().createMediaStreamSource(stream).connect(an);
    Object.assign(Probe, { stream, an, label: stream.getAudioTracks()[0]?.label || '' });
    const b = el.work.querySelector('.ready__main[data-act="record"]');
    if (b && Probe.label) b.title = `Record your read (R) · input: ${Probe.label}`;
    const td = new Uint8Array(an.fftSize);
    Probe.timer = setInterval(() => {
      an.getByteTimeDomainData(td); let sum = 0; for (const v of td) sum += ((v - 128) / 128) ** 2;
      b?.style.setProperty('--lvl', Math.min(1, Math.sqrt(sum / td.length) * 6).toFixed(2));
    }, 80);
  }
  // ADR-style guide: 3 short beeps before the read
  function beep(freq = 1000) {
    const ac = ctx(), o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = freq; g.gain.value = 0.12; o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.09);
  }

  // ---------- Host (fake DAW) ----------
  const clipName = (c) => {
    const n = S.applied[c.id];
    if (n && S.host === 'protools') return `${c.name}-SONA_T${n}`; // AudioSuite renames the rendered clip
    return c.name;
  };
  function trackCount() {
    return Math.max(3, ...S.extra.map((x) => x.track + 1));
  }
  function buildHost() {
    const h = H();
    el.hostProject.textContent = `Harbour Night – Ep. 2 · ${h.app}`;
    const tw = el.timeline.clientWidth;
    const pps = tw / VIEW_SECONDS;
    el.ruler.innerHTML = '';
    for (let s = 0; s <= VIEW_SECONDS; s += 2) {
      const sp = document.createElement('span');
      sp.style.left = `${s * pps}px`;
      sp.textContent = `02:${String(5 + s).padStart(2, '0')}`;
      el.ruler.appendChild(sp);
    }
    const n = trackCount();
    el.trackHeads.innerHTML = Array.from({ length: n }, (_, i) =>
      `<div class="track-head">${h.tracks[i] || h.newTrack}</div>`).join('');
    el.lanes.innerHTML = Array.from({ length: n }, (_, i) => `<div class="lane" data-track="${i}"></div>`).join('');

    CLIPS.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'clip';
      b.dataset.track = c.track; b.dataset.id = c.id;
      b.style.left = `${c.start * pps}px`;
      b.style.width = `${Math.min(c.dur, VIEW_SECONDS - c.start + 4) * pps}px`;
      b.setAttribute('aria-selected', String(S.clip?.id === c.id));
      const ap = S.applied[c.id];
      let tag = '';
      if (ap && S.host === 'nuendo') tag = `<span class="clip__tag clip__tag--virtual" title="Clip plays SONA take ${ap} via ARA. Not printed yet.">SONA T${ap}</span>`;
      if (ap && S.host === 'reaper') tag = `<span class="clip__take" title="Active item take. Earlier takes are kept in the item.">take ${(S.itemTakes[c.id] || 0) + 2}/${(S.itemTakes[c.id] || 0) + 2} · SONA T${ap}</span>`;
      b.innerHTML = `<span class="clip__name">${clipName(c)}${c.dur > MAX_SECONDS ? ' · 1:12' : ''}</span>` +
        (c.audio ? `<canvas class="clip__wave" data-clip="${c.id}"></canvas>` : '<span class="clip__wave"></span>') + tag;
      if (c.inert) b.tabIndex = -1;
      b.addEventListener('click', () => !c.inert && selectClip(c));
      el.lanes.querySelector(`.lane[data-track="${c.track}"]`).appendChild(b);
    });
    // Clips created from SONA takes (Premiere placement or a dragged take chip)
    S.extra.forEach((x) => {
      const b = document.createElement('div');
      b.className = 'clip clip--sona';
      b.style.left = `${x.start * pps}px`;
      b.style.width = `${x.dur * pps}px`;
      b.title = x.title;
      b.innerHTML = `<span class="clip__name">${x.name}</span><canvas class="clip__wave" data-extra="${x.id}"></canvas>`;
      el.lanes.querySelector(`.lane[data-track="${x.track}"]`).appendChild(b);
    });
    // fake waveform for clips without audio
    el.lanes.querySelectorAll('span.clip__wave').forEach((s) => {
      s.style.background = 'repeating-linear-gradient(90deg, rgba(255,255,255,.35) 0 1px, transparent 1px 3px)';
      s.style.height = '18px'; s.style.bottom = '12px';
    });
    bindDrops();
    drawAllStrips();
  }

  // Drag a take chip onto a lane (T0: works in every host) or below the tracks to create a new track
  function bindDrops() {
    const targets = [...el.lanes.querySelectorAll('.lane'), el.dropNew];
    targets.forEach((t) => {
      t.ondragover = (e) => { if (e.dataTransfer.types.includes('text/sona-take')) { e.preventDefault(); t.classList.add('is-drop'); } };
      t.ondragleave = () => t.classList.remove('is-drop');
      t.ondrop = (e) => {
        e.preventDefault(); t.classList.remove('is-drop');
        const n = Number(e.dataTransfer.getData('text/sona-take'));
        const take = S.takes.find((x) => x.n === n);
        if (!take || !S.clip) return;
        const pps = el.timeline.clientWidth / VIEW_SECONDS;
        const rect = el.lanes.getBoundingClientRect();
        let start = (e.clientX - rect.left) / pps;
        // snap to the original clip's start if dropped close to it (BWF timestamp / spot)
        if (Math.abs(start - S.clip.start) < 1) start = S.clip.start;
        const track = t === el.dropNew ? trackCount() : Number(t.dataset.track);
        addExtra(take, track, start, `Dragged take ${n}`);
        el.hostHint.textContent = `Take ${n} dropped as a file · saved to …/SONA Takes`;
      };
    });
  }
  function addExtra(take, track, start, why) {
    S.extra.push({
      id: `x${S.extra.length + 1}`, track, start, dur: take.dur, url: take.url, rate: take.rate, peaks: take.peaks,
      name: `${S.clip.name}_SONA_T${take.n}.wav`, title: `${why} · ${takeWhat(take)} · ${readName(take.read)}`,
    });
    buildHost();
  }

  async function loadHostPeaks() {
    for (const c of CLIPS) if (c.audio) c._peaks = (await decodePeaks(c.audio, 300)).peaks;
    drawAllStrips();
  }

  // Host transport: plays the selected clip as the timeline would (incl. an applied take)
  let hostAudio = null, hostRaf = 0;
  function hostPlay() {
    const c = S.clip;
    if (hostAudio) { hostStop(); return; }
    if (!c || !c.audio) { el.hostHint.textContent = 'Select a dialogue clip, then press play'; return; }
    stopPlayback();
    const appliedN = S.applied[c.id];
    const t = appliedTake(c);
    hostAudio = new Audio(t ? t.url : c.audio);
    if (t) { hostAudio.playbackRate = t.rate || 1; hostAudio.preservesPitch = true; }
    hostAudio.play().catch(() => {});
    el.hostPlay.setAttribute('aria-pressed', 'true');
    el.hostPlayhead.hidden = false;
    const hint = {
      nuendo: `Clip plays SONA take ${appliedN} in place of the original (not printed)`,
      reaper: `Item plays its active take: SONA take ${appliedN}`,
      protools: `Rendered clip plays SONA take ${appliedN}`,
      premiere: `A4 plays SONA take ${appliedN} · mute A1 to hear only the take`,
    }[S.host];
    el.hostHint.textContent = t ? hint : 'Timeline plays the original clip';
    const pps = el.timeline.clientWidth / VIEW_SECONDS;
    const len = t ? t.dur : c.dur;
    const tick = () => {
      if (!hostAudio) return;
      const pos = c.start + Math.min(hostAudio.currentTime / (hostAudio.playbackRate || 1), len);
      el.hostPlayhead.style.left = `${pos * pps}px`;
      el.hostTc.textContent = `01:02:${String(Math.floor(5 + pos)).padStart(2, '0')}:${String(Math.floor((pos % 1) * 25)).padStart(2, '0')}`;
      if (hostAudio.ended) return hostStop();
      hostRaf = requestAnimationFrame(tick);
    };
    tick();
  }
  function hostStop() {
    cancelAnimationFrame(hostRaf);
    if (hostAudio) hostAudio.pause();
    hostAudio = null;
    el.hostPlay.setAttribute('aria-pressed', 'false');
    el.hostPlayhead.hidden = true;
  }

  // ---------- Flow actions ----------
  function selectClip(c) {
    if (S.rec) cancelRecording();
    stopPlayback(); hostStop();
    // Takes collect per clip (as in SONA): park the current clip's work, restore the new clip's (same direction)
    if (S.clip?.id !== c.id) { park(); restore(c, S.dir); }
    S.voiceMenu = false; S.dirOpen = false;
    S.clip = c;
    S.state = stateFor(c);
    el.hostHint.textContent = c.dur > MAX_SECONDS ? 'This clip is longer than 60 s' : `${c.name} is open in SONA Read`;
    buildHost();
    render();
  }

  // ---------- Direction + per-clip sessions ----------
  const key = (clipId, dir = S.dir) => `${clipId}:${dir}`;
  const busy = () => ['countin', 'recording', 'rendering', 'importing'].includes(S.state);
  function park() { if (S.clip) S.sessions[key(S.clip.id)] = { reads: S.reads, takes: S.takes, selected: S.selected }; }
  function restore(c, dir) {
    const saved = S.sessions[key(c.id, dir)] || { reads: [], takes: [], selected: null };
    S.reads = saved.reads; S.takes = saved.takes.filter((t) => t.status === 'ready' || t.status === 'review'); S.selected = saved.selected; S.error = null;
    if (!S.takes.some((t) => t.n === S.selected)) S.selected = S.takes.slice(-1)[0]?.n ?? null;
  }
  // The applied take of this clip, if it was made in the direction that is open now
  const appliedHere = (c = S.clip) => (c && S.appliedDir[c.id] === S.dir ? S.applied[c.id] || null : null);
  function appliedTake(c) {
    const n = S.applied[c.id], d = S.appliedDir[c.id];
    if (!n) return null;
    const list = S.clip?.id === c.id && S.dir === d ? S.takes : (S.sessions[key(c.id, d)]?.takes || []);
    return list.find((x) => x.n === n) || null;
  }
  // A read that stopped for review (no speech, length far off) is held as a take of its own (status 'review'):
  // it keeps its number, so "Record another" makes the next one, and it stays until Render or Delete.
  const nextN = () => S.takes.reduce((m, t) => Math.max(m, t.n), 0) + 1;
  function stateFor(c) {
    const sel = S.takes.find((t) => t.n === S.selected);
    if (c.dur > MAX_SECONDS) return 'toolong';
    if (sel?.status === 'review') return 'review';
    if (S.takes.some((t) => t.status === 'ready')) return appliedHere(c) ? 'applied' : 'takes';
    const held = S.takes.filter((t) => t.status === 'review').slice(-1)[0];
    if (held) { S.selected = held.n; return 'review'; }
    return 'ready';
  }
  function setDir(d) {
    if (d === S.dir) { S.dirOpen = false; return render(); }
    if (!S.clip || busy()) return;
    S.dirOpen = false;
    stopPlayback(); hostStop();
    park(); S.dir = d; restore(S.clip, d); S.voiceMenu = false; S.newVoiceMenu = false;
    S.state = stateFor(S.clip);
    render();
  }
  // What a take is, in words: the result, not the engine
  const voiceOf = (t) => { const r = S.reads[t.read]; return r && r.source === 'library' ? r.name : 'another voice'; };
  const takeWhat = (t) => (t.dir === 'voice' ? `${S.clip.who}’s intonation, ${voiceOf(t)}` : `${S.clip.who}’s voice`);

  async function startRecording() {
    if (!S.clip || S.dir !== 'tone' || S.rec) return; // Voice takes a recording of the new voice (file), not your read
    probeInput(false);
    stopPlayback(); hostStop();
    ctx().resume();
    S.error = null;
    const demo = el.optDemoRead.checked;
    if (el.optDenyMic.checked && !demo) { S.error = { type: 'mic' }; S.state = 'micdenied'; return render(); }

    let stream = null;
    if (!demo) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } catch (e) {
        S.error = { type: 'mic' }; S.state = 'micdenied'; return render();
      }
    }
    S.rec = { demo, stream, frames: [], start: 0, chunks: [], recorder: null, timer: 0, silenceSince: 0, heard: false,
      device: stream ? (stream.getAudioTracks()[0]?.label || 'Microphone') : 'Demo read (prototype)' };

    // Optional guide (ADR habit): hear the original line, then 3 beeps, then speak
    S.state = 'countin'; S.countdown = 3; S.guidePhase = false; render();
    if (S.guide && S.clip.audio) {
      S.guidePhase = true; render();
      const a = new Audio(S.clip.audio); S.rec.guideAudio = a;
      await new Promise((res) => { a.onended = res; a.onerror = res; a.play().catch(res); });
      S.guidePhase = false;
      if (!S.rec) return; // cancelled
      await wait(300);
    }
    // Count-in: 3 · 2 · 1 (with beeps when the guide is on)
    for (let i = 3; i >= 1; i--) {
      if (!S.rec) return; // cancelled
      S.countdown = i; render();
      if (S.guide) beep();
      await wait(600);
    }
    if (!S.rec) return;
    beginCapture();
  }

  function beginCapture() {
    const r = S.rec;
    const ac = ctx();
    const analyser = ac.createAnalyser(); analyser.fftSize = 1024;
    let src;
    if (r.demo) {
      r.demoAudio = new Audio('assets/audio/demo-read.wav');
      src = ac.createMediaElementSource(r.demoAudio);
      src.connect(analyser); analyser.connect(ac.destination);
      r.demoAudio.addEventListener('ended', () => stopRecording());
      r.demoAudio.play().catch(() => {});
    } else {
      src = ac.createMediaStreamSource(r.stream);
      src.connect(analyser);
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      r.recorder = new MediaRecorder(r.stream, mime ? { mimeType: mime } : undefined);
      r.recorder.ondataavailable = (e) => e.data.size && r.chunks.push(e.data);
      r.recorder.start();
    }
    r.analyser = analyser; r.src = src;
    r.start = performance.now();
    S.state = 'recording'; render();
    const buf = new Float32Array(analyser.fftSize);
    const loop = () => {
      if (!S.rec || S.state !== 'recording') return;
      analyser.getFloatTimeDomainData(buf);
      let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v));
      r.level = Math.min(1, peak * 1.6);
      const t = (performance.now() - r.start) / 1000;
      // one live column per 1/12 s, keeping the loudest value in that slot
      const slot = Math.floor(t * 12);
      while (r.frames.length <= slot) r.frames.push(0);
      r.frames[slot] = Math.max(r.frames[slot], Math.min(1, peak * 1.8));
      // auto-stop: 2.5 s of silence after speech (a dramatic pause is part of the read)
      // speech = clearly above the room: the floor follows the quietest level and creeps up slowly
      if (peak > 0.001) r.floor = r.floor == null || peak < r.floor ? peak : r.floor + (peak - r.floor) * 0.002;
      if (r.floor != null && peak > Math.max(0.02, r.floor * 4)) { r.heard = true; r.silenceSince = 0; }
      else if (r.heard && !r.demo) { r.silenceSince ||= performance.now(); if (performance.now() - r.silenceSince > 2500) return stopRecording(); }
      // nothing said for 5 s: stop — the read then shows "no speech found" instead of running on
      if (!r.heard && !r.demo && t > 5) return stopRecording();
      // a read is about as long as the line: stop at 3× the original (at least 10 s, never more than 60 s)
      if (t >= Math.min(MAX_SECONDS, Math.max(10, (S.clip?.dur || 3) * 3))) return stopRecording();
      updateRecordingUI(t);
      r.timer = requestAnimationFrame(loop);
    };
    r.timer = requestAnimationFrame(loop);
  }

  async function stopRecording() {
    const r = S.rec; if (!r || S.state !== 'recording') return;
    cancelAnimationFrame(r.timer);
    let url, peaks, dur, trimmed = 0, silent = false;
    let raw;
    if (r.demo) {
      r.demoAudio.pause();
      try { r.src.disconnect(); r.analyser.disconnect(); } catch (e) {}
      raw = await fetch('assets/audio/demo-read.wav').then((x) => x.arrayBuffer());
    } else {
      await new Promise((res) => { r.recorder.onstop = res; r.recorder.stop(); });
      r.stream.getTracks().forEach((t) => t.stop());
      try { r.src.disconnect(); } catch (e) {}
      const blob = new Blob(r.chunks, { type: r.recorder.mimeType || 'audio/webm' });
      url = URL.createObjectURL(blob);
      raw = await blob.arrayBuffer();
    }
    let read;
    try {
      read = await processRead(raw);
    } catch (e) {
      read = { url: url || 'assets/audio/demo-read.wav', peaks: normalise(r.frames), dur: (performance.now() - r.start) / 1000, trimmed: 0, silent: false };
    }
    // "no speech" is decided by the trim analysis (robust to clicks), not by the live peak
    S.reads.push(Object.assign(read, { source: 'mic', demo: r.demo, device: r.device, dir: S.dir }));
    S.rec = null;
    afterInput();
  }
  // v2: a good read goes straight to a take. Only a read with a problem (no speech, length far off) stops for review.
  function needsReview(r) {
    if (r.silent) return true;
    if (r.dir === 'voice') return false;            // a new voice keeps the clip's timing
    const k = r.dur / S.clip.dur; return k > 1.4 || k < 0.6;
  }
  function afterInput() {
    const r = S.reads[S.reads.length - 1];
    const slot = S.rerecord != null ? S.takes.find((t) => t.n === S.rerecord) : null;
    S.rerecord = null;
    if (slot) {
      // Re-record: the new read takes the same number; the old one is dropped
      if (S.reads[slot.read]) S.reads[slot.read].discarded = true;
      Object.assign(slot, { read: S.reads.length - 1, status: 'review' });
      S.selected = slot.n;
      if (r && needsReview(r)) { S.state = 'review'; render(); } else renderTake(slot);
      return;
    }
    if (r && needsReview(r)) {
      const n = nextN();
      S.takes.push({ n, read: S.reads.length - 1, status: 'review', peaks: null, dur: 0, dir: S.dir });
      S.selected = n; S.state = 'review'; render();
    } else renderTake();
  }
  // Decode, trim silence (so the read — and the take — matches the line), make a playable WAV
  async function processRead(raw) {
    const audio = await ctx().decodeAudioData(raw);
    const cut = trimSilence(audio);
    if (!cut) return { url: URL.createObjectURL(encodeWav(audio)), peaks: bufferPeaks(audio, 400), dur: audio.duration, trimmed: 0, silent: true };
    return { url: URL.createObjectURL(encodeWav(cut)), peaks: bufferPeaks(cut, 400), dur: cut.duration, trimmed: audio.duration - cut.duration, silent: false, rawDur: audio.duration };
  }

  // "Use an existing recording": a pickup the actor recorded, or someone else's read, as a file
  async function importRecording(file) {
    if (!S.clip || !['ready', 'review', 'takes', 'applied'].includes(S.state)) return;
    stopPlayback(); hostStop();
    S.error = null; S.state = 'importing'; S.importName = file.name; render();
    try {
      const read = await processRead(await file.arrayBuffer());
      if ((read.rawDur || read.dur) > MAX_SECONDS) throw Object.assign(new Error('long'), { kind: 'long', dur: read.rawDur || read.dur });
      S.reads.push(Object.assign(read, { source: 'file', name: file.name, device: file.name, dir: S.dir }));
      return afterInput();
    } catch (e) {
      S.error = e.kind === 'long'
        ? { type: 'file', text: `“${file.name}” is ${fmtTime(e.dur)}. A recording can be up to 1:00.` }
        : { type: 'file', text: `Couldn’t read “${file.name}”. Use WAV, AIFF, MP3 or M4A.` };
      S.state = 'ready';
    }
    render();
  }
  const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
  // How a read is named in the UI: your own read vs a file someone else recorded
  const readName = (i) => {
    const r = S.reads[i];
    if (r && r.source === 'library') return `SONA voice ${r.name}`;
    if (r && r.dir === 'voice') return `voice ${i + 1} (${r.name})`;
    return r && r.source === 'file' ? `read ${i + 1} (${r.name})` : `your read ${i + 1}`;
  };
  function cancelRecording() {
    const r = S.rec; if (!r) return;
    cancelAnimationFrame(r.timer);
    if (r.demoAudio) r.demoAudio.pause();
    if (r.guideAudio) r.guideAudio.pause();
    if (r.recorder && r.recorder.state !== 'inactive') r.recorder.stop();
    if (r.stream) r.stream.getTracks().forEach((t) => t.stop());
    try { r.src && r.src.disconnect(); } catch (e) {}
    S.rec = null; S.guidePhase = false; S.rerecord = null;
    S.state = stateFor(S.clip);
    render();
  }
  // Silence trim, robust to clicks: 20 ms RMS windows, threshold from the loud part of the recording,
  // speech = at least 3 loud windows in a row (60 ms). Under 0.4 s of speech counts as "no speech".
  function trimSilence(audio) {
    const d = audio.getChannelData(0), sr = audio.sampleRate, win = Math.floor(sr * 0.02);
    const rms = [];
    for (let i = 0; i + win <= d.length; i += win) {
      let sum = 0; for (let j = i; j < i + win; j++) sum += d[j] * d[j];
      rms.push(Math.sqrt(sum / win));
    }
    if (!rms.length) return null;
    const sorted = [...rms].sort((a, b) => a - b);
    const ref = sorted[Math.floor(sorted.length * 0.9)];
    const floor = sorted[Math.floor(sorted.length * 0.1)];          // the room when nobody speaks
    const peak = sorted[Math.floor(sorted.length * 0.98)];
    // speech is at least ~12 dB above the room and not whisper-quiet; otherwise it is silence or noise
    if (peak < Math.max(0.015, floor * 4)) return null;
    const thr = Math.max(0.008, floor * 3, ref * 0.2);
    const loud = rms.map((v) => v > thr);
    if (loud.filter(Boolean).length * 0.02 < 0.3) return null;     // clicks and breaths are not a read
    const run = (i) => loud[i] && loud[i + 1] && loud[i + 2];
    let a = 0; while (a < rms.length - 2 && !run(a)) a++;
    let b = rms.length - 3; while (b > a && !run(b)) b--;
    if (a >= rms.length - 2 || (b + 3 - a) * 0.02 < 0.4) return null;
    const pad = Math.floor(sr * 0.12);
    const s0 = Math.max(0, a * win - pad), s1 = Math.min(d.length, (b + 3) * win + pad);
    const out = ctx().createBuffer(1, s1 - s0, sr);
    out.copyToChannel(d.slice(s0, s1), 0);
    return out;
  }
  // 16-bit mono WAV, so the trimmed read can be played back like any file
  function encodeWav(buf) {
    const d = buf.getChannelData(0), sr = buf.sampleRate, n = d.length;
    const v = new DataView(new ArrayBuffer(44 + n * 2));
    const str = (o, t) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 0x7fff, true);
    return new Blob([v], { type: 'audio/wav' });
  }
  const normalise = (a) => { const m = Math.max(...a, 0.0001); return a.map((v) => v / m); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // held: a take that waited for review (Render, Try again, Re-record) keeps its number; otherwise a new take
  async function renderTake(held = null) {
    const readIdx = held ? held.read : S.reads.length - 1;
    const read = S.reads[readIdx];
    stopPlayback();
    const n = held ? held.n : nextN();
    const c = S.clip, voice = S.dir === 'voice';
    // Voice: a SONA voice renders in that voice (assets/audio/voices/takes/<voice>-<line>.wav); a recording of a voice uses c.voiceTake
    const slug = voice && read.source === 'library' ? (LIBRARY.find((v) => v.name === read.name)?.sample || '').replace(/^.*\/|\.wav$/g, '') : '';
    const variant = voice ? (slug ? `assets/audio/voices/takes/${slug}-${c.id.split('-')[0]}.wav` : c.voiceTake) : c.takes[(n - 1) % c.takes.length];
    const rate = voice ? VOICE_RATES[(n - 1) % VOICE_RATES.length]
      : c.takeRates ? c.takeRates[(n - 1) % c.takeRates.length] : 1;
    const take = held || {};
    Object.assign(take, { n, read: readIdx, url: variant, rate, peaks: null, dur: 0, status: 'rendering', step: 0, dir: S.dir });
    if (!held) S.takes.push(take);
    S.selected = n;
    S.state = 'rendering'; S.error = null;
    render();
    take.phase = 0;
    take.anim = setInterval(() => { take.phase += 1; drawAllStrips(); }, 70); // stepped sweep, LED-like
    const fail = el.optFailNext.checked || read.silent;
    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      await wait(fail && i > 9 ? 80 : 240);
      if (take.status !== 'rendering') { clearInterval(take.anim); return; } // stopped
      take.step = i;
      if (fail && i === 10) break;
      updateRenderingUI(take);
    }
    clearInterval(take.anim);
    if (fail) {
      el.optFailNext.checked = false;
      take.status = 'failed';
      S.error = { type: 'render', n, reason: read.silent ? (voice ? 'no speech found in the voice recording' : 'no speech found in your read') : 'the render server didn’t respond' };
      S.state = 'takes';
      return render();
    }
    const { peaks, dur } = await decodePeaks(variant);
    // Render is simulated with fixed files, so their length has nothing to do with the read. A real render follows
    // your timing (Tone) or the clip's (Voice): stretch the placeholder to that length, with a small spread per take.
    const target = (voice || !read.dur ? c.dur : read.dur) * [1, 0.97, 1.03][(n - 1) % 3];
    take.rate = Math.min(2, Math.max(0.5, dur / target));
    take.peaks = peaks; take.dur = dur / take.rate; take.status = 'ready';
    take.revealAt = performance.now();   // the take "prints in" left to right (~320 ms, 8 steps)
    S.state = appliedHere() ? 'applied' : 'takes'; // the clip may already play an earlier take
    render();
    const rvTimer = setInterval(drawAllStrips, 40);
    await wait(360); clearInterval(rvTimer); take.revealAt = 0; drawAllStrips();
    if (S.selected === n && S.state === 'takes') play(take.url, 'take', n, take.rate); // then audition
  }
  function stopRender() {
    const t = S.takes.find((x) => x.status === 'rendering');
    if (t) { clearInterval(t.anim); t.status = 'stopped'; S.takes = S.takes.filter((x) => x !== t); }
    S.selected = S.takes.filter((x) => x.status === 'ready').slice(-1)[0]?.n ?? null;
    S.state = stateFor(S.clip);
    render();
  }

  // One Apply button; what it does depends on the host (tiers T1 / T2, see HOSTS)
  function applyTake(thenNext = false) {
    const t = S.takes.find((x) => x.n === S.selected && x.status === 'ready');
    if (!t) return;
    stopPlayback(); hostStop();
    const c = S.clip, prev = S.applied[c.id];
    if (S.host === 'reaper' && prev) S.itemTakes[c.id] = (S.itemTakes[c.id] || 0) + 1; // earlier takes stay in the item
    if (S.host === 'premiere') {
      S.extra = S.extra.filter((x) => x.fromApply !== c.id);           // re-apply replaces the placed take
      addExtra(t, 3, c.start, `Placed by Apply on ${H().newTrack}`);
      S.extra[S.extra.length - 1].fromApply = c.id;
    }
    S.applied[c.id] = t.n; S.appliedDir[c.id] = S.dir; // one applied take per clip, whichever direction made it
    S.state = 'applied';
    el.hostHint.textContent = `Press ▶ to hear take ${t.n} on the timeline`;
    buildHost(); render();
    if (thenNext) nextClip();
  }
  function undoApply() {
    const c = S.clip;
    delete S.applied[c.id]; delete S.appliedDir[c.id];
    if (S.host === 'premiere') S.extra = S.extra.filter((x) => x.fromApply !== c.id);
    S.state = 'takes';
    el.hostHint.textContent = `${c.name} plays the original again`;
    buildHost(); render();
  }
  // Next dialogue clip on the timeline (Mini: "Apply, then next clip")
  function nextClip() {
    const order = CLIPS.filter((c) => !c.inert).sort((a, b) => a.start - b.start);
    const i = order.findIndex((c) => c.id === S.clip?.id);
    const next = order[(i + 1) % order.length];
    selectClip(next);
    el.hostHint.textContent = `${next.name} is open in SONA Read · previous line done`;
  }
  function newRead() { stopPlayback(); S.state = 'ready'; S.error = null; S.voiceMenu = false; render(); }

  // ---------- Render (state → UI) ----------
  function render() {
    const st = S.state, c = S.clip;
    el.sona.dataset.state = st;
    const chromeTitle = el.plugChrome.querySelector('.chrome-title');
    if (chromeTitle) chromeTitle.textContent =
      c ? `${H().tracks[c.track]} · ${H().slot} · SONA Read` : `${H().slot} · SONA Read`;

    // The line: small meta, the text larger (cut with … and shown in full on hover), round play without a label
    el.clip.hidden = !c;
    if (c) {
      const tooLong = c.dur > MAX_SECONDS;
      el.clip.dataset.warn = String(tooLong);
      el.clipWho.textContent = c.who.toUpperCase();
      el.clipMeta.innerHTML = tooLong ? ` · <span class="warn" title="SONA works with lines up to 1:00">1:12</span> · ${c.name}` : ` · ${c.dur.toFixed(1)} s · ${c.name}`;
      el.clipMeta.title = c.tc ? `${c.name} · ${c.tc}` : c.name;
      const text = c.text || 'Not transcribed';
      el.clipText.textContent = text;
      el.clipFull.firstElementChild.textContent = `“${text}”`;
      el.clip.dataset.trunc = String(el.clipText.scrollWidth > el.clipText.clientWidth);
      el.playOriginal.hidden = !c.audio;
      const on = player.kind === 'orig';
      el.playOriginal.classList.toggle('is-playing', on);
      el.playOriginal.setAttribute('aria-label', on ? 'Stop' : 'Play the original'); el.playOriginal.title = on ? 'Stop' : 'Play the original';
    }

    // Direction: chosen up front, described by its result. Locked while recording / rendering.
    const showDir = !!c && S.state !== 'toolong';
    el.dirRow.hidden = !showDir;
    // Glass tray with a selection that slides; built once and updated, so the move can animate
    el.dirRow.classList.add('dirx');
    if (showDir) {
      if (!el.dirRow.querySelector('.dirx__glide')) {
        el.dirRow.innerHTML = '<span class="dirx__glide" aria-hidden="true"></span>' + Object.entries(DIRS).map(([d, v]) =>
          `<button type="button" class="dirx__opt" role="radio" data-dir="${d}"><span class="dirx__title"><i class="dirx__dot"></i><b>${v.title}</b></span><small>${v.keeps()}</small></button>`).join('');
        el.dirRow.querySelectorAll('[data-dir]').forEach((b) => { b.onclick = () => setDir(b.dataset.dir); });
      }
      const sel = S.dir === 'voice' ? '1' : '0', glide = el.dirRow.querySelector('.dirx__glide');
      if (el.dirRow.dataset.sel !== undefined && el.dirRow.dataset.sel !== sel) { glide.classList.remove('is-moving'); void glide.offsetWidth; glide.classList.add('is-moving'); }
      el.dirRow.dataset.sel = sel;
      el.dirRow.querySelectorAll('[data-dir]').forEach((b) => {
        b.setAttribute('aria-checked', String(b.dataset.dir === S.dir));
        b.disabled = busy() && b.dataset.dir !== S.dir;
        b.title = b.dataset.dir === 'tone' ? `The take is ${c.who}’s voice saying the line the way you say it.` : `The take is another voice saying the line the way ${c.who} said it: same intonation, timing and emphasis.`;
      });
    }
    if (el.dropText) el.dropText.textContent = S.dir === 'voice' ? 'Drop a recording of the new voice' : 'Drop a recording to use its intonation';

    el.work.innerHTML = workHTML();
    el.status.innerHTML = statusHTML();
    el.status.hidden = !el.status.innerHTML;
    const sub = substatusHTML();
    el.substatus.hidden = !sub; el.substatus.innerHTML = sub;
    renderTakes();
    renderActions();
    bindWork();
    const gt = el.work.querySelector('[data-guide]'); if (gt) gt.onchange = () => { S.guide = gt.checked; };
    requestAnimationFrame(drawAllStrips);
    // Ring: drawn right away (reading layout forces it), not in rAF — rAF pauses in background tabs
    (() => {
      if (S.state === 'ready') {
        Ring.reset(); Ring.idle();
        const b = el.work.querySelector('.ready__main[data-act="record"]');
        if (b && !b.disabled) {
          b.onmouseenter = () => probeInput(true);
          b.onmouseleave = () => probeInput(false);
          b.onfocus = b.onmouseenter; b.onblur = b.onmouseleave;
        }
      }
    })();
  }

  function workHTML() {
    const c = S.clip, who = c?.who;
    switch (S.state) {
      case 'noclip':
        return `<div class="work-empty">
          <p class="work-empty__title">No clip selected</p>
          <p class="work-empty__text">Select a dialogue clip in ${H().app}. Then change how the line is said, or whose voice says it.</p>
          </div>`;
      case 'toolong':
        return `<div class="work-empty work-empty--warn">
          <span class="recbtn recbtn--note" aria-hidden="true">${ICON.alert}</span>
          <p class="work-empty__title">This clip is too long</p>
          <p class="work-empty__text">SONA works with lines up to 1 minute. Split it into shorter parts.</p>
          </div>`;
      case 'micdenied':
        return `<div class="work-empty work-empty--warn">
          <span class="recbtn recbtn--note" aria-hidden="true">${ICON.alert}</span>
          <p class="work-empty__title">SONA can’t hear your microphone</p>
          <p class="work-empty__text">Allow microphone access for ${H().app} in System Settings.</p>
          </div>`;
      case 'importing':
        return `<div class="work-empty"><p class="work-empty__title">Reading “${S.importName}”…</p><span class="progress-dots">${'<i class="on"></i>'.repeat(3)}${'<i></i>'.repeat(5)}</span></div>`;
      case 'ready': {
        const ok = true; // voice-rights step removed (open question in brief.md)
        const fileErr = S.error?.type === 'file' ? `<div class="err">${ICON.alert}<div><p>${S.error.text}</p></div></div>` : '';
        if (S.dir === 'voice') {
          // Voice: the input is a recording of the new voice (a file / clip), so the drop target is the main action
          // Same layout as "Change how it's said": one round main control, a title, "or", and the file as a link.
          // A SONA voice is the default here; a recording of the voice is the other way.
          return `${fileErr}
            <div class="ready">
              <div class="voice-lib">
                <button class="ready__main" data-act="voice-menu" aria-expanded="${S.voiceMenu}" aria-haspopup="listbox" title="Choose a voice from your SONA library">
                  <span class="recbtn recbtn--voice" aria-hidden="true">${ICON.person}</span><span class="ready__t">Choose a SONA voice</span></button>
                ${S.voiceMenu ? voiceMenuHTML() : ''}
              </div>
              <p class="ready__alt"><span class="ready__or">or</span> <button class="ready__file" data-act="pick-file" title="Any clean recording of the voice you want, up to 60 s. You can also drop a file anywhere on the plugin.">use a voice sample</button></p>
            </div>`;
        }
        void ok; void who;
        return `${fileErr}
          <div class="ready">
            <button class="ready__main" data-act="record" title="Record your read (R) · say the line the way it should sound, up to 60 s">
              <span class="recbtn" aria-hidden="true"></span><span class="ready__t">Record your read</span></button>
            <p class="ready__alt"><span class="ready__or">or</span> <button class="ready__file" data-act="pick-file" title="A pickup the actor recorded, or someone else’s read. You can also drop a file here.">use a recorded read</button></p>
          </div>`;
      }
      case 'countin':
        if (S.guidePhase) return `<div class="rec rec--stack rec--guide"><span class="rec__guide"><span class="voice-dot"></span>Listen to ${who}</span><span class="rec__sub">${c.text ? `“${c.text}”` : ''}</span></div>`;
        return `<div class="rec rec--stack"><span class="rec__bigcount num" aria-live="assertive">${S.countdown}</span></div>`;
      case 'recording':
        // Same row as a take: control on the left, dots in the middle, time on the right, label under it
        return `<div class="trow trow--rec">
            <span class="pbtn pbtn--live" aria-hidden="true"></span>
            <canvas data-strip="live" data-id="0" title="The dashed line marks where the original ends"></canvas>
            <span class="trow__dur num" title="Your read so far / length of the original line"><span id="recTime">0.0 s</span><small> / ${c.dur.toFixed(1)} s</small></span>
            <div class="trow__sub" id="recSub">${ICON.mic}<span>Recording your read</span></div>
          </div>`;
      case 'review':
      case 'rendering':
      case 'takes':
      case 'applied': {
        const lastRead = S.reads.length - 1;
        const sel = S.takes.find((t) => t.n === S.selected);
        // In review the newest read is the one about to be rendered; otherwise show the read behind the selected take
        const readIdx = sel ? sel.read : lastRead;
        const r = S.reads[readIdx];
        // v2.1: lighter — the read is only input; it shows only when it needs a look (review)
        if (S.state === 'review') return r ? readStrip(readIdx, r) : '';
        return sel ? takeStrip(sel) : '';
      }
    }
    return '';
  }

  // One list, each voice once: bookmarks (★) first. ▶ previews without choosing; the name chooses.
  function voiceMenuHTML(withFile = false) {
    const order = LIBRARY.map((v, i) => [v, i]).sort((a, b) => (b[0].fav ? 1 : 0) - (a[0].fav ? 1 : 0));
    const row = ([v, i]) => {
      const on = player.kind === 'voice' && player.id === i && !player.paused;
      return `<div class="voice-menu__item" role="option">
        <button class="vprev${on ? ' is-playing' : ''}" data-act="preview-voice" data-id="${i}" aria-label="${on ? 'Stop' : `Hear ${v.name}`}" title="${on ? 'Stop' : `Hear ${v.name}`}">${on ? '<canvas class="vprev__wave" aria-hidden="true"></canvas>' : ICON.play}</button>
        <button class="voice-menu__pick" data-act="pick-voice" data-id="${i}" title="Use ${v.name} · ${v.tag} voice">
          <span class="voice-menu__name">${v.name}${v.who ? ` <small>${v.who}</small>` : ''}${v.fav ? '<span class="voice-menu__star" aria-label="Bookmarked" title="Bookmarked">★</span>' : ''}</span></button></div>`;
    };
    // From the takes row the list also carries "Use a voice sample…", pinned at the bottom so it never needs scrolling
    const foot = withFile ? `<div class="voice-menu__foot"><button class="voice-menu__file" data-act="nv-file">${ICON.file}<span>Use a voice sample…</span></button></div>` : '';
    return `<div class="voice-menu${withFile ? ' has-foot' : ''}" role="listbox" aria-label="SONA voices">${order.map(row).join('')}${foot}</div>`;
  }
  function readStrip(i, r) {
    if (r.source === 'library') {
      return `<div class="trow trow--lib">
        <span class="pbtn pbtn--icon" aria-hidden="true">${RING}${ICON.person}</span>
        <span class="voice-pick"><b>${r.name}</b>${r.who ? `<span class="muted">${r.who}</span>` : ''}<span class="tag">${r.tag}</span></span>
        <span class="trow__dur"></span>
        <div class="trow__sub"><span>New voice ${i + 1} · from your SONA voices</span></div></div>`;
    }
    const on = player.kind === 'read' && player.id === i && !player.paused;
    const name = r.dir === 'voice' ? 'New voice' : r.source === 'file' ? 'Recording' : 'Your read';
    const label = r.source === 'file' ? `${name} · ${r.name}` : name;
    return `<div class="trow trow--read${r.silent ? ' is-silent' : ''}">
      <button class="pbtn pbtn--take${on ? ' is-playing' : ''}" data-act="play-read" data-id="${i}" aria-label="${on ? 'Pause' : `Play ${name.toLowerCase()}`}" title="${on ? 'Pause' : `Play ${name.toLowerCase()}`}">${RING}${PLAY}${PAUSE}</button>
      <canvas data-strip="read" data-id="${i}"></canvas>
      <span class="trow__dur">${readDurHTML(r)}</span>
      <div class="trow__sub${r.silent || lengthOff(r) ? ' trow__sub--warn' : ''}">${r.silent
        ? `<span class="alert-ico">${ICON.alert}</span><span>No speech found${r.source === 'file' ? ' in this recording' : ' · check the mic level'}</span>`
        : lengthOff(r)
        ? `<span class="alert-ico">${ICON.alert}</span><span>${lengthOff(r)}</span>`
        : `${r.source === 'file' ? ICON.file : ICON.mic}<span title="${r.source === 'file' ? `File: ${r.name}` : r.device}">${label}</span>`}</div>
    </div>`;
  }
  const RING = '<svg class="pbtn__ring" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="16"/></svg>';
  const PLAY = '<svg class="pbtn__play" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7-4.5z"/></svg>';
  const PAUSE = '<svg class="pbtn__pause" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3.5h2.5v9H4.5zM9 3.5h2.5v9H9z"/></svg>';
  function takeStrip(t) {
    const who = S.clip.who, voice = t.dir === 'voice';
    if (t.status === 'rendering') {
      return `<div class="trow is-rendering">
        <button class="pbtn pbtn--take" disabled aria-label="Rendering">${RING}${PLAY}</button>
        <canvas data-strip="take" data-id="${t.n}"></canvas><span class="trow__dur num"></span>
        <div class="trow__sub">${voice ? `Rendering ${who}’s intonation in ${voiceOf(t) === 'another voice' ? 'the new voice' : `${voiceOf(t).split(',')[0]}’s voice`}… ~4 s` : `Rendering in ${who}’s voice… ~4 s`}</div></div>`;
    }
    if (t.status === 'failed') {
      // same row as any take: the read's dots (greyed), and the reason under them
      const why = S.error?.n === t.n ? S.error.reason : 'the render server didn’t respond';
      return `<div class="trow is-failed">
        <button class="pbtn pbtn--take" disabled aria-label="Take ${t.n} didn’t render">${RING}${PLAY}</button>
        <canvas data-strip="read" data-id="${t.read}"></canvas><span class="trow__dur num"></span>
        <div class="trow__sub trow__sub--warn"><span class="alert-ico">${ICON.alert}</span><span title="Nothing was charged">Didn’t render: ${why}</span>${/no speech/.test(why) ? '' : '<button class="link" data-act="retry-render">Try again</button>'}</div></div>`;
    }
    const on = player.kind === 'take' && player.id === t.n && !player.paused;
    const r = S.reads[t.read], readOn = player.kind === 'read' && player.id === t.read;
    // Voice: the take cell already names the voice, so a SONA voice needs no caption; a file shows its recording
    const from = voice
      ? (r && r.source !== 'library' ? `from ${r.name} · ${r.dur.toFixed(1)} s` : '')
      : `from ${r?.source === 'file' ? r.name : 'your read'} · ${r ? r.dur.toFixed(1) : '–'} s`;
    const mini = r && r.peaks ? `<canvas data-strip="readmini" data-id="${t.read}"></canvas>
      <button class="trow__readplay" data-act="play-read" data-id="${t.read}" aria-label="Play the recording" title="Play the recording">${readOn ? ICON.pause : ICON.play}</button>` : '';
    // Applied: under the dots, what Apply did in this host (where the take went, the original is safe).
    // No "longer than the clip" warning: a take follows your read, and small overruns are trailing silence.
    if (S.state === 'applied' && appliedHere() === t.n) {
      return `<div class="trow">
      <button class="pbtn pbtn--take${on ? ' is-playing' : ''}" data-act="play-take" data-id="${t.n}" aria-label="${on ? 'Pause' : `Play take ${t.n}`}" title="${on ? 'Pause' : `Play take ${t.n}`}">${RING}${PLAY}${PAUSE}</button>
      <canvas data-strip="take" data-id="${t.n}"></canvas>
      <span class="trow__dur num">${t.dur.toFixed(1)} s</span>
      <div class="trow__sub trow__sub--done"><span>${hostResultLine()}</span></div>
    </div>`;
    }
    return `<div class="trow">
      <button class="pbtn pbtn--take${on ? ' is-playing' : ''}" data-act="play-take" data-id="${t.n}" aria-label="${on ? 'Pause' : `Play take ${t.n}`}" title="${on ? 'Pause' : `Play take ${t.n}`}">${RING}${PLAY}${PAUSE}</button>
      <canvas data-strip="take" data-id="${t.n}"></canvas>
      <span class="trow__dur num">${t.dur.toFixed(1)} s</span>
      <div class="trow__sub">${from || mini ? `<span>${from}</span>${mini}` : ''}</div>
    </div>`;
  }

  function statusHTML() {
    const c = S.clip, who = c?.who;
    const sel = S.takes.find((t) => t.n === S.selected);
    switch (S.state) {
      case 'noclip': return '';
      case 'toolong': return ''; // said once, in the middle
      case 'micdenied': return '';
      case 'ready': return '';
      case 'importing': return 'Trimming silence and checking the length…';
      case 'countin': return S.guidePhase ? 'Playing the original · then 3 beeps' : '';
      case 'recording': return ''; // the timer, the stop button and Cancel say it all; keys are in their tooltips
      case 'review': {
        // v2: review only appears when the read needs a look
        return ''; // the amber duration in the row (with its tooltip) already says the read is much longer / shorter
      }
      case 'rendering': return '';
      case 'takes': {
        // The clip already plays a take made in the other direction: say so, Apply here replaces it
        const other = S.applied[c.id] && !appliedHere();
        if (other) return `Clip plays ${takeName(S.applied[c.id], S.appliedDir[c.id])} from “${DIRS[S.appliedDir[c.id]].title}” · Apply here replaces it`;
        return sel ? '' : 'Pick a take';
      }
      case 'applied': return ''; // what Apply did in this host is under the take's dots
    }
    return '';
  }

  // What Apply did in this host (the client's open problem #2): shown under ⓘ next to "✓ Applied"
  // One line under the applied take's dots: where the take went and that the original is safe
  function hostResultLine() {
    return {
      nuendo: 'The clip plays this take · the original is kept',
      reaper: 'Added as an item take · earlier takes stay',
      protools: 'Rendered into the clip · the original is in the Clips List',
      premiere: `Placed on ${H().newTrack.split(' ')[0]} · the original is untouched`,
    }[S.host];
  }
  // ⓘ next to "✓ Applied": only the next step in this host (the result itself is the line above)
  function hostDetailsHTML() {
    const next = {
      nuendo: `Not printed yet. To print it: <b>${H().print}</b>`,
      reaper: 'Switch takes in REAPER (T) or here.',
      protools: 'Undo in Pro Tools puts the original back.',
      premiere: 'Mute A1 to hear only the take.',
    }[S.host];
    return `<span class="applied-info"><span class="info" tabindex="0" aria-label="Next step in ${H().app}">i</span><span class="pop pop--up">${next}</span></span>`;
  }
  // Second line: host-specific follow-up after Apply (print, take length, file location)
  function substatusHTML() {
    if (S.state === 'review' || S.state === 'takes') return readNoteHTML();
    if (S.state !== 'applied') return '';
    const c = S.clip, n = S.applied[c.id], t = S.takes.find((x) => x.n === n);
    void c; void n; void t;
    return ''; // what happened sits under the take's dots (takeStrip); host details live under ⓘ
  }

  // Note about the read behind the current take: length vs the original, trimmed silence
  function readNoteHTML() {
    const c = S.clip; if (!c) return '';
    const sel = S.takes.find((t) => t.n === S.selected);
    const r = S.reads[S.state === 'review' || !sel ? S.reads.length - 1 : sel.read];
    void r; return ''; // "no speech" now sits on the read's own row
  }
  // Read length vs the original: amber duration + tooltip instead of a sentence
  // Why a read with speech stops before rendering: its length is far from the line (Tone only)
  function lengthOff(r) {
    const c = S.clip; if (!c || r.silent || r.dir === 'voice') return '';
    const k = r.dur / c.dur;
    return k < 0.6 ? `Much shorter than the line (${c.dur.toFixed(1)} s) · may sound rushed`
      : k > 1.4 ? `Much longer than the line (${c.dur.toFixed(1)} s) · may not fit the clip` : '';
  }
  function readDurHTML(r) {
    const c = S.clip, ratio = r.dur / c.dur;
    // Voice keeps the clip's timing, so the length of the voice recording doesn't matter
    const off = r.dir !== 'voice' && !r.silent && (ratio > 1.4 || ratio < 0.6);
    const tips = [];
    if (off) tips.push(`Original is ${c.dur.toFixed(1)} s — the take will follow your timing${ratio < 0.6 ? ' and may sound rushed' : ' and may not fit the clip'}`);
    if (r.trimmed > 0.3) tips.push(`${r.trimmed.toFixed(1)} s of silence trimmed`);
    return `<span class="num${off ? ' warn' : ''}"${tips.length ? ` title="${tips.join(' · ')}"` : ''}>${r.dur.toFixed(1)} s</span>`;
  }

  // "Ava", "Mara", "Mara 2" for SONA voices; a short file name for a recording of the voice
  function takeVoiceLabel(t, reads = S.reads, takes = S.takes) {
    const nameOf = (x) => {
      const r = reads[x.read];
      if (!r) return `Voice ${x.n}`;
      if (r.source === 'library') return r.name.length > 14 ? `${r.name.slice(0, 12)}…` : r.name;
      const f = (r.name || 'Recording').replace(/\.[a-z0-9]+$/i, '');
      return f.length > 12 ? `${f.slice(0, 10)}…` : f;
    };
    const name = nameOf(t);
    const same = takes.filter((x) => x.n <= t.n && x.dir === 'voice' && nameOf(x) === name).length;
    return same > 1 ? `${name} ${same}` : name;
  }
  const takeName = (n, dir = S.dir) => {
    // the session of that direction (the open one is live in S, the other is parked)
    const ses = dir === S.dir ? { reads: S.reads, takes: S.takes } : (S.sessions[key(S.clip?.id, dir)] || { reads: [], takes: [] });
    const t = ses.takes.find((x) => x.n === n);
    return dir === 'voice' && t ? takeVoiceLabel(t, ses.reads, ses.takes) : `take ${n}`;
  };
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  function renderTakes() {
    // while you record, the take you are recording already has its cell: selected and pulsing
    const upcoming = ['countin', 'recording'].includes(S.state);
    const show = (S.takes.length > 0 || upcoming) && ['rendering', 'takes', 'applied', 'review', 'countin', 'recording'].includes(S.state);
    el.takesRow.hidden = !show;
    if (!show) return;
    const applied = appliedHere();
    const voice = S.dir === 'voice';
    const redo = upcoming && S.rerecord != null ? S.rerecord : null;
    el.takeChips.innerHTML = S.takes.map((t) => {
      if (t.n === redo) return `<span class="chip chip--next" aria-pressed="true" title="Take ${t.n} · recording again">${t.n}</span>`;
      // Voice: the cells name the voice (that's what is being compared); Tone: numbers (same voice, different reads)
      const base = voice ? takeVoiceLabel(t) : String(t.n);
      const held = t.status === 'review';
      const lbl = t.status === 'failed' || held ? `${ICON.alert}${voice && held ? t.n : base}` : base;
      return `<button class="chip${held ? ' chip--pending' : ''}" data-act="select-take" data-id="${t.n}" data-status="${t.status}" aria-pressed="${!upcoming && S.selected === t.n}" ${busy() ? 'disabled' : ''}
        title="Take ${t.n} · ${takeWhat(t)}${S.reads[t.read]?.source === 'library' ? '' : ` · ${readName(t.read)}`}${applied === t.n ? ' · applied' : ''}">
        ${lbl}${applied === t.n ? ICON.tick : ''}</button>`;
    }).join('') + (upcoming
      && redo == null ? `<span class="chip chip--next" aria-pressed="true" title="Take ${nextN()} · recording">${nextN()}</span>` : '') + (['takes', 'applied', 'review'].includes(S.state)
      ? (voice
        ? `<div class="voice-lib nv-wrap"><button class="tk-rec tk-rec--add" data-act="new-voice-menu" aria-haspopup="menu" aria-expanded="${!!S.newVoiceMenu}" title="Add another voice. It becomes the next take.">New voice</button>${
            S.newVoiceMenu === 'choose' ? `<div class="nv-menu" role="menu">
              <button class="nv-menu__item" role="menuitem" data-act="nv-sona">${ICON.person}<span>Choose a SONA voice</span>${ICON.chevron}</button>
              <button class="nv-menu__item" role="menuitem" data-act="nv-file">${ICON.file}<span>Use a voice sample…</span></button></div>`
            : S.newVoiceMenu === 'voices' ? voiceMenuHTML(true) : ''}</div>`
        : `<button class="tk-rec" data-act="record" title="Record another read (R). It renders straight into the next take.">Record another</button>`)
      : '');
    el.takeChips.querySelectorAll('[data-act]').forEach(bindAct);
    placeVoiceMenu();
  }
  // The voices list from "+ New voice" uses the room the window has: it may grow up over the direction toggle,
  // but stays under the line section and 8 px above the window's bottom (and grows when the window is resized)
  function placeVoiceMenu() {
    const m = el.takeChips.querySelector('.nv-wrap .voice-menu'); if (!m) return;
    const wrap = m.parentElement.getBoundingClientRect(), sb = el.sona.getBoundingClientRect(), top0 = el.clip.getBoundingClientRect().bottom + 6;
    m.style.maxHeight = 'none';
    const want = Math.min(m.scrollHeight, sb.bottom - 8 - top0);
    const below = sb.bottom - 8 - (wrap.bottom + 6);                     // room under the button
    const h = Math.max(120, want);
    m.style.maxHeight = `${h}px`;
    m.style.top = h <= below ? `${wrap.height + 6}px` : `${Math.max(top0, sb.bottom - 8 - h) - wrap.top}px`;
  }

  function renderActions() {
    const p = el.primary, st = S.state;
    const sel = S.takes.find((t) => t.n === S.selected);
    let left = '', next = false;
    p.disabled = false; p.title = ''; p.hidden = false; p.removeAttribute('aria-disabled');
    p.className = 'btn btn--primary';
    switch (st) {
      case 'micdenied':
        p.textContent = 'Try again'; p.title = 'Check the microphone again';
        break;
      case 'noclip': case 'toolong': case 'importing':
        p.hidden = true; break; // no disabled “Render take” before there is a read
      case 'ready':
        p.hidden = true;
        if (S.takes.length) left = '<button class="btn btn--secondary" data-act="back-to-takes">Back to takes</button>';
        break;
      case 'countin':
        p.textContent = 'Cancel'; p.className = 'btn btn--secondary'; p.title = 'Cancel (Esc)';
        break;
      case 'recording':
        // you say when the read is done; a long pause also finishes it
        p.textContent = 'Done'; p.title = 'Finish the read (⌘↩)';
        left = '<button class="btn btn--secondary" data-act="cancel-rec" title="Cancel (Esc)">Cancel</button>';
        break;
        break;
      case 'review':
        { const r = S.reads[S.takes.find((t) => t.n === S.selected)?.read ?? S.reads.length - 1];
          p.textContent = 'Render'; p.hidden = !!(r && r.silent); }
        // record again / another voice lives in the takes row; here you only decide about this one
        left = S.dir === 'voice' ? '' : '<button class="btn btn--secondary" data-act="rerecord" title="Record this take again (R)">Re-record</button>';
        break;
      case 'rendering': {
        const t = S.takes.find((x) => x.status === 'rendering');
        p.innerHTML = renderBtnHTML(t ? t.step / 16 : 0);
        p.classList.add('btn--busy'); p.title = 'Rendering the take';
        left = ''; // no Stop: a render takes ~4 s; Esc still stops it
        break;
      }
      case 'takes': {
        const ok = sel && sel.status === 'ready';
        p.textContent = ok ? `Apply ${takeName(sel.n)}` : 'Apply';
        p.disabled = !ok;
        p.hidden = sel?.status === 'failed'; // nothing to apply: the reason and "Try again" are under the dots
        left = sel?.status === 'failed' && S.dir !== 'voice' ? '<button class="btn btn--secondary" data-act="rerecord" title="Record this take again (R)">Re-record</button>' : '';
        break;
      }
      case 'applied': {
        // The job for this line is done: the button confirms it. Picking another take turns it back into Apply.
        const n = appliedHere();
        if (S.selected === n) {
          p.innerHTML = `${hostDetailsHTML()}Applied`; p.className = 'btn btn--done'; p.setAttribute('aria-disabled', 'true'); p.title = '';
          left = (S.dir === 'voice'
            ? `<button class="tk-rec tk-rec--icon" data-act="change-take" title="Put the original back and pick another voice">${ICON.swap}Change voice</button>`
            : `<button class="tk-rec tk-rec--icon" data-act="change-take" title="Put the original back and pick another take">${ICON.swap}Change take</button>`);
        } else {
          p.textContent = `Apply ${takeName(S.selected)}`; p.title = `Replace ${takeName(n)} with ${takeName(S.selected)}`;
          left = '';
        }
        break;
      }
    }
    el.primaryNext.hidden = true; void next; // no "& next": one main action, Apply
    el.primaryNext.disabled = p.disabled;
    el.actionsLeft.innerHTML = left;
    el.primary.parentElement.hidden = p.hidden; // a hidden main button leaves no gap: Delete sits flush right
    el.actionsLeft.parentElement.hidden = p.hidden && !left; // whole row goes when it has nothing to offer
    el.actionsLeft.querySelectorAll('[data-act]').forEach(bindAct);
    el.actionsLeft.querySelectorAll('.drag-chip').forEach((d) => {
      d.ondragstart = (e) => {
        e.dataTransfer.setData('text/sona-take', d.dataset.take);
        e.dataTransfer.effectAllowed = 'copy';
        document.body.classList.add('is-dragging');
      };
      d.ondragend = () => document.body.classList.remove('is-dragging');
    });
  }
  // Drag-out chip removed for now: see brief.md, open question about dragging takes to a separate track.

  // Live updates without full re-render
  function updateRecordingUI(t) {
    const tm = document.getElementById('recTime');
    if (tm) { tm.textContent = `${t.toFixed(1)} s`; tm.classList.toggle('warn', !!S.clip && t > S.clip.dur * 1.4); } // amber once well past the original
    // one short hint under the dots: what SONA hears right now
    const sub = document.getElementById('recSub'), r = S.rec;
    if (sub && r) {
      let hint = `Recording your read`, warn = false;
      if (!r.heard && t > 1.5) { hint = 'Can’t hear you · speak louder or closer to the mic'; warn = true; }
      else if (r.heard && r.silenceSince && performance.now() - r.silenceSince > 600) hint = `Finishing in ${Math.max(0, (2500 - (performance.now() - r.silenceSince)) / 1000).toFixed(1)} s · keep talking to go on`;
      else if (S.clip && t > S.clip.dur * 1.4) hint = 'Longer than the line · press Done when you finish';
      const span = sub.querySelector('span');
      if (span.textContent !== hint) span.textContent = hint;
      sub.classList.toggle('trow__sub--warn', warn);
    }
    drawAllStrips();
  }
  function updateRenderingUI(t) {
    if (S.state === 'rendering') el.primary.innerHTML = renderBtnHTML(t.step / 16);
  }
  // Progress ring + word on the primary button while a take renders
  function renderBtnHTML(pr) {
    const C = 2 * Math.PI * 6;
    return `<svg class="btn-ring" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" class="btn-ring__bg"/><circle cx="8" cy="8" r="6" class="btn-ring__fg" stroke-dasharray="${(pr * C).toFixed(1)} ${C.toFixed(1)}"/></svg>Rendering`;
  }

  // ---------- Events ----------
  function bindWork() { el.work.querySelectorAll('[data-act]').forEach(bindAct); el.status.querySelectorAll('[data-act]').forEach(bindAct); }
  function bindAct(node) { node.onclick = (e) => { e.preventDefault(); act(node.dataset.act, node.dataset.id, node.dataset); }; }

  function act(a, id, ds = {}) {
    switch (a) {
      case 'record': startRecording(); break;
      case 'ab': abSwitch(Number(id), ds.src); break;
      case 'stop': stopRecording(); break;
      case 'cancel-rec': cancelRecording(); break;
      case 'cancel': cancelRecording(); break;
      case 'new-read': newRead(); break;
      case 'rerecord': S.rerecord = S.selected; startRecording(); break;
      case 'discard-failed': {
        S.takes.filter((t) => t.status === 'failed').forEach((t) => { if (S.reads[t.read]) S.reads[t.read].discarded = true; });
        S.takes = S.takes.filter((t) => t.status !== 'failed'); S.error = null;
        S.selected = S.takes.slice(-1)[0]?.n ?? null;
        S.state = S.takes.length ? (appliedHere() ? 'applied' : 'takes') : 'ready';
        render(); break;
      }
      case 'discard-read': {
        const h = S.takes.find((t) => t.n === S.selected && t.status === 'review');
        if (h) { S.reads[h.read].discarded = true; S.takes = S.takes.filter((t) => t !== h); }
        S.selected = S.takes.filter((t) => t.status === 'ready').slice(-1)[0]?.n ?? null;
        stopPlayback(); S.error = null;
        S.state = S.takes.length ? (appliedHere() ? 'applied' : 'takes') : 'ready';
        render(); break;
      }
      case 'back-to-takes': S.state = appliedHere() ? 'applied' : 'takes'; render(); break;
      case 'retry-mic': S.state = 'ready'; render(); break;
      case 'use-demo': el.optDemoRead.checked = true; el.optDenyMic.checked = false; S.state = 'ready'; render(); break;
      case 'pick-file': S.voiceMenu = false; el.fileInput.click(); break;
      case 'voice-menu': S.voiceMenu = !S.voiceMenu; render(); break;
      case 'new-voice-menu': S.newVoiceMenu = S.newVoiceMenu ? false : 'voices'; render(); break; // one click: straight to the voices
      case 'nv-sona': S.newVoiceMenu = 'voices'; render(); break;
      case 'nv-file': S.newVoiceMenu = false; render(); el.fileInput.click(); break; // the system file picker
      case 'preview-voice': { // hear a voice before choosing it; the list stays open
        const i = Number(id), v = LIBRARY[i];
        if (player.kind === 'voice' && player.id === i) { stopPlayback(); render(); } else if (v?.sample) play(v.sample, 'voice', i);
        break;
      }
      case 'pick-voice': {
        const v = LIBRARY[Number(id)];
        stopPlayback();
        S.reads.push({ source: 'library', name: v.name, who: v.who, tag: v.tag, dur: 0, peaks: null, dir: 'voice', device: 'SONA voices' });
        S.voiceMenu = false; S.newVoiceMenu = false; S.error = null;
        afterInput(); break;
      }
      case 'retry-render':
        { const f = S.takes.find((t) => t.status === 'failed' && t.n === S.selected) || S.takes.find((t) => t.status === 'failed');
          if (f) { f.status = 'review'; S.selected = f.n; }
          renderTake(f); break; }
      case 'play-read': {
        const i = Number(id), r = S.reads[i];
        if (player.kind === 'read' && player.id === i) { if (player.paused) resumePlayback(); else pausePlayback(); } else play(r.url, 'read', i);
        break;
      }
      case 'play-take': {
        const n = Number(id), t = S.takes.find((x) => x.n === n);
        if (player.kind === 'take' && player.id === n) { if (player.paused) resumePlayback(); else pausePlayback(); } else play(t.url, 'take', n, t.rate);
        break;
      }
      case 'select-take': {
        const n = Number(id), t = S.takes.find((x) => x.n === n);
        S.selected = n;
        if (t.status === 'review') { stopPlayback(); S.error = null; S.state = 'review'; render(); break; }
        if (['review', 'ready', 'takes', 'applied'].includes(S.state)) S.state = appliedHere() ? 'applied' : 'takes';
        if (t.status === 'failed') S.error = S.error || { type: 'render', n, reason: 'the render server didn’t respond' };
        render();
        if (t.status === 'ready') play(t.url, 'take', n, t.rate);
        break;
      }
      case 'undo': undoApply(); break;
      case 'change-take': undoApply(); break; // original plays again; pick another take
      case 'stop-render': stopRender(); break;
      case 'apply-next': applyTake(true); break;
    }
  }

  // A/B: switch between the original and the take at the same moment
  function abSwitch(n, src) {
    const t = S.takes.find((x) => x.n === n); if (!t) return;
    const playingNow = (player.kind === 'take' && player.id === n) || (player.kind === 'orig' && S.abTake === n);
    const same = (src === 'take' && player.kind === 'take' && player.id === n) || (src === 'orig' && player.kind === 'orig' && S.abTake === n);
    if (same) { stopPlayback(); return render(); }
    const frac = playingNow && player.audio.duration ? player.audio.currentTime / player.audio.duration : 0;
    S.abTake = n;
    if (src === 'orig') play(S.clip.audio, 'orig', 0, 1, frac); else play(t.url, 'take', n, t.rate, frac);
  }
  el.primary.addEventListener('click', () => {
    switch (S.state) {
      case 'countin': cancelRecording(); break;
      case 'recording': stopRecording(); break;
      case 'micdenied': S.state = 'ready'; render(); break;
      case 'review': renderTake(S.takes.find((t) => t.n === S.selected && t.status === 'review')); break; // Render (the read needed a look)
      case 'rendering': break; // busy — Stop is next to it
      case 'takes': applyTake(); break;
      case 'applied': if (S.selected !== appliedHere()) applyTake(); break; // "✓ Applied" itself does nothing
    }
  });
  el.playOriginal.addEventListener('click', () => {
    S.abTake = null;
    if (player.kind === 'orig') { stopPlayback(); render(); } else if (S.clip?.audio) play(S.clip.audio, 'orig', 0);
  });
  el.helpBtn.addEventListener('click', () => {
    el.status.innerHTML = S.dir === 'voice'
      ? `The clip is always the original. You add one thing, a recording of the new voice. The take keeps how <span class="actor">the actor</span> said the line, in that voice.`
      : `The clip is always the original: <span class="actor">the actor’s voice</span>. You add one thing, your read. The take is the actor’s voice saying it your way.`;
  });

  el.hostPlay.addEventListener('click', hostPlay);

  // Existing recording: file picker, or drop an audio file anywhere on the plugin
  el.fileInput.addEventListener('change', () => { const f = el.fileInput.files[0]; el.fileInput.value = ''; if (f) importRecording(f); });
  const canDropFile = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files') && S.clip
    && ['ready', 'review', 'takes', 'applied'].includes(S.state);
  el.sona.addEventListener('dragover', (e) => { if (canDropFile(e)) { e.preventDefault(); el.sona.classList.add('is-file-drop'); } });
  el.sona.addEventListener('dragleave', (e) => { if (!el.sona.contains(e.relatedTarget)) el.sona.classList.remove('is-file-drop'); });
  el.sona.addEventListener('drop', (e) => {
    el.sona.classList.remove('is-file-drop');
    if (!canDropFile(e)) return;
    e.preventDefault();
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('audio/') || /\.(wav|aiff?|mp3|m4a|flac|ogg)$/i.test(x.name));
    if (f) importRecording(f);
  });
  // Prototype only: load a sample pickup file as if the user had chosen it
  el.optSample.addEventListener('click', async () => {
    if (!S.clip) { el.hostHint.textContent = 'Select a dialogue clip first'; return; }
    const voice = S.dir === 'voice';
    const blob = await fetch(voice ? 'assets/audio/voice-sample.wav' : 'assets/audio/sample-pickup.wav').then((r) => r.blob());
    importRecording(new File([blob], voice ? 'Voice_sample_Moira.wav' : 'SC12_T3_pickup_Ben.wav', { type: 'audio/wav' }));
  });

  // Keyboard (only when focus is in the plugin or on the page body, never while typing)
  let pluginActive = false; // like a real plugin window: keys only reach SONA when it has focus
  document.addEventListener('pointerdown', (e) => { pluginActive = !!e.target.closest?.('#plugWindow'); }, true);
  document.addEventListener('click', (e) => {
    if ((S.voiceMenu || S.newVoiceMenu) && e.target.isConnected && !e.target.closest?.('.voice-lib')) { S.voiceMenu = false; S.newVoiceMenu = false; render(); }
    if (S.dirOpen && !e.target.closest?.('#dirRow')) { S.dirOpen = false; render(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (!pluginActive) return;
    if (e.key === 'Escape' && (S.voiceMenu || S.newVoiceMenu)) { S.voiceMenu = false; S.newVoiceMenu = false; return render(); }
    if (e.key === 'Escape' && S.dirOpen) { S.dirOpen = false; return render(); }
    if (e.key === 'Escape' && (S.state === 'recording' || S.state === 'countin')) return cancelRecording();
    if (e.key === 'Escape' && S.state === 'rendering') return stopRender();
    if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) {
      if (['ready', 'takes', 'applied', 'review'].includes(S.state) && S.clip) return startRecording();
      if (S.state === 'recording') return stopRecording();
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && S.state === 'recording') return stopRecording();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !el.primary.disabled) el.primary.click();
  });

  // Prototype controls
  el.optReset.addEventListener('click', () => {
    if (S.rec) cancelRecording();
    stopPlayback(); hostStop();
    Object.assign(S, { state: 'noclip', dir: 'tone', dirOpen: false, guide: false, clip: null, reads: [], takes: [], selected: null, sessions: {}, applied: {}, appliedDir: {}, itemTakes: {}, extra: [], error: null });
    el.optDemoRead.checked = false; el.optFailNext.checked = false; el.optDenyMic.checked = false;
    el.optHost.value = 'nuendo'; S.host = 'nuendo';
    el.hostHint.textContent = 'Click a dialogue clip to start';
    buildHost(); render();
  });
  // Switching host keeps reads and takes, but clears what was applied (it was applied in another host)
  el.optHost.addEventListener('change', () => {
    stopPlayback(); hostStop();
    S.host = el.optHost.value; S.applied = {}; S.appliedDir = {}; S.itemTakes = {}; S.extra = [];
    if (S.state === 'applied') S.state = 'takes';
    el.hostHint.textContent = `Same takes, now in ${H().app}: press Apply to see what happens here`;
    buildHost(); render();
  });

  // Draggable plugin window (by the host title bar)
  (() => {
    let sx, sy, ox, oy, drag = false;
    el.plugChrome.addEventListener('pointerdown', (e) => {
      drag = true; sx = e.clientX; sy = e.clientY;
      const r = el.plugWindow.getBoundingClientRect(), hr = el.plugWindow.offsetParent.getBoundingClientRect();
      ox = r.left - hr.left; oy = r.top - hr.top;
      el.plugWindow.style.right = 'auto'; el.plugWindow.style.bottom = 'auto';
      el.plugWindow.style.left = `${ox}px`; el.plugWindow.style.top = `${oy}px`;
      el.plugChrome.setPointerCapture(e.pointerId);
    });
    el.plugChrome.addEventListener('pointermove', (e) => {
      if (!drag) return;
      el.plugWindow.style.left = `${ox + e.clientX - sx}px`; el.plugWindow.style.top = `${oy + e.clientY - sy}px`;
    });
    el.plugChrome.addEventListener('pointerup', () => (drag = false));
  })();

  // Redraw dots when the plugin window is resized
  new ResizeObserver(() => drawAllStrips()).observe(el.sona);
  window.addEventListener('resize', () => { buildHost(); });

  // ---------- Init ----------
  buildHost();
  render();
  loadHostPeaks();
})();
