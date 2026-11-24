/* SONA Read — Flow 1 prototype
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
    tone: { title: 'Change how it’s said', keeps: (who) => `${who}’s voice · your intonation` },
    voice: { title: 'Change who says it', keeps: (who) => `${who}’s intonation · another voice` },
  };
  // SONA voices, as listed in the client's screenshots (full panel › SONA voices; Mini › Settings › Voice)
  const LIBRARY = [
    { name: 'Ava', tag: 'Default', fav: true }, { name: 'Mara', who: 'M. Sorell', tag: 'Artist', fav: true },
    { name: 'Noah', tag: 'Default' }, { name: 'Elias', tag: 'Designed' }, { name: 'Calm narrator, warm and low', tag: 'Designed' },
    { name: 'Lena', tag: 'Clone' }, { name: 'Jonas', who: 'J. Halden', tag: 'Artist' },
  ];
  const VOICE_RATES = [1.0, 0.98, 1.02]; // a new voice keeps the clip's timing: takes differ only slightly
  const ICON = {
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
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    sona: $('sona'), clip: $('clip'), clipWho: $('clipWho'), clipMeta: $('clipMeta'), clipText: $('clipText'),
    playOriginal: $('playOriginal'), work: $('work'), status: $('status'), takesRow: $('takesRow'),
    takeChips: $('takeChips'), actionsLeft: $('actionsLeft'), primary: $('primary'),
    lanes: $('lanes'), ruler: $('ruler'), timeline: $('timeline'), hostHint: $('hostHint'), hostPlay: $('hostPlay'),
    hostPlayhead: $('hostPlayhead'), hostTc: $('hostTc'), plugWindow: $('plugWindow'), plugChrome: $('plugChrome'),
    optDemoRead: $('optDemoRead'), optFailNext: $('optFailNext'), optDenyMic: $('optDenyMic'), optReset: $('optReset'),
    helpBtn: $('helpBtn'), trackHeads: $('trackHeads'), hostProject: $('hostProject'), substatus: $('substatus'),
    optHost: $('optHost'), dropNew: $('dropNew'), fileInput: $('fileInput'), optSample: $('optSample'),
    dirRow: $('dirRow'), dropText: $('dropText'),
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
  const player = { audio: new Audio(), kind: null, id: null, raf: 0 };
  function play(url, kind, id, rate = 1) {
    stopPlayback();
    player.audio.src = url;
    player.audio.playbackRate = rate;
    player.audio.preservesPitch = true; // tempo follows the read, the voice keeps its pitch
    player.kind = kind; player.id = id;
    player.audio.play().catch(() => {});
    const tick = () => {
      drawAllStrips();
      if (!player.audio.paused) player.raf = requestAnimationFrame(tick);
    };
    player.raf = requestAnimationFrame(tick);
    render();
  }
  function stopPlayback() {
    cancelAnimationFrame(player.raf);
    player.audio.pause();
    player.kind = null; player.id = null;
    drawAllStrips();
  }
  player.audio.addEventListener('ended', () => { player.kind = null; player.id = null; render(); });
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
      const played = progress === null ? true : c / cols <= progress;
      const isHead = progress !== null && Math.floor(progress * cols) === c && progress > 0;
      g.fillStyle = isHead ? col('--sona-offwhite') : played ? color : unplayed;
      g.globalAlpha = isHead || played ? 1 : 0.35;
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
        const r = S.reads[id]; if (r) drawDots(cv, r.peaks, col('--you'), progressOf('read', id));
      } else if (kind === 'take') {
        const t = S.takes.find((x) => x.n === id);
        if (t && t.status === 'rendering') {
          const cols = Math.floor(cv.clientWidth / 6) || 1;
          // the ghost shows where the delivery comes from: your read (Tone) or the original clip (Voice)
          const src = t.dir === 'voice' ? S.clip?._peaks : S.reads[t.read]?.peaks;
          drawDots(cv, src, col('--sona-sky'), null, { ghost: { band: (t.phase || 0) % (cols + 8) - 4 } });
        } else if (t && t.peaks) {
          const rv = t.revealAt ? Math.min(1, Math.floor(((performance.now() - t.revealAt) / 320) * 8) / 8) : 1;
          drawDots(cv, t.peaks, col('--sona-sky'), progressOf('take', id), rv < 1 ? { reveal: rv } : {});
        }
      } else if (kind === 'live' && S.rec) {
        const cols = Math.max(1, Math.floor(cv.clientWidth / 6));
        const f = S.rec.frames;
        const m = Math.max(0.15, ...f);                       // normalise like the final strip, ignore pure noise
        let shown;
        if (f.length <= cols) shown = f.map((v) => v / m).concat(Array(cols - f.length).fill(-1));
        else shown = Array.from({ length: cols }, (_, c) => {  // compress: loudest value per column
          const a = Math.floor((c / cols) * f.length), b = Math.max(a + 1, Math.floor(((c + 1) / cols) * f.length));
          return Math.max(...f.slice(a, b)) / m;
        });
        drawDots(cv, shown, col('--you'));
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
      live() {
        const r = S.rec; if (!r || !r.analyser) return;
        const now = performance.now();
        if (now - lastStep < 50) return; // stepped, like an LED meter
        lastStep = now;
        freq = freq && freq.length === r.analyser.frequencyBinCount ? freq : new Uint8Array(r.analyser.frequencyBinCount);
        r.analyser.getByteFrequencyData(freq);
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
    S.voiceMenu = false;
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
    S.reads = saved.reads; S.takes = saved.takes.filter((t) => t.status === 'ready'); S.selected = saved.selected; S.error = null;
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
  function stateFor(c) {
    return c.dur > MAX_SECONDS ? 'toolong'
      : S.takes.length ? (appliedHere(c) ? 'applied' : 'takes')
      : S.reads.length ? 'review' : 'ready';
  }
  function setDir(d) {
    if (d === S.dir || !S.clip || busy()) return;
    stopPlayback(); hostStop();
    park(); S.dir = d; restore(S.clip, d); S.voiceMenu = false;
    S.state = stateFor(S.clip);
    render();
  }
  // What a take is, in words: the result, not the engine
  const voiceOf = (t) => { const r = S.reads[t.read]; return r && r.source === 'library' ? r.name : 'another voice'; };
  const takeWhat = (t) => (t.dir === 'voice' ? `${S.clip.who}’s intonation, ${voiceOf(t)}` : `${S.clip.who}’s voice`);

  async function startRecording() {
    if (!S.clip || S.dir !== 'tone') return; // Voice takes a recording of the new voice (file), not your read
    stopPlayback(); hostStop();
    ctx().resume();
    S.error = null;
    const demo = el.optDemoRead.checked;
    if (el.optDenyMic.checked && !demo) { S.error = { type: 'mic' }; S.state = 'micdenied'; return render(); }

    let stream = null;
    if (!demo) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
      } catch (e) {
        S.error = { type: 'mic' }; S.state = 'micdenied'; return render();
      }
    }
    S.rec = { demo, stream, frames: [], start: 0, chunks: [], recorder: null, timer: 0, silenceSince: 0, heard: false,
      device: stream ? (stream.getAudioTracks()[0]?.label || 'Microphone') : 'Demo read (prototype)' };

    // Count-in: 3 · 2 · 1
    S.state = 'countin'; S.countdown = 3; render();
    for (let i = 3; i >= 1; i--) {
      S.countdown = i; render();
      await wait(600);
      if (!S.rec) return;
      if (!S.rec) return; // cancelled
    }
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
      // auto-stop on silence after speech, or at 60 s
      if (peak > 0.03) { r.heard = true; r.silenceSince = 0; }
      else if (r.heard && !r.demo) { r.silenceSince ||= performance.now(); if (performance.now() - r.silenceSince > 1400) return stopRecording(); }
      if (t >= MAX_SECONDS) return stopRecording();
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
    S.state = 'review';
    render();
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
      S.state = 'review';
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
    if (r.recorder && r.recorder.state !== 'inactive') r.recorder.stop();
    if (r.stream) r.stream.getTracks().forEach((t) => t.stop());
    try { r.src && r.src.disconnect(); } catch (e) {}
    S.rec = null;
    S.state = S.reads.length && S.takes.length ? 'takes' : (S.reads.length ? 'review' : 'ready');
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
    const thr = Math.max(0.006, ref * 0.2);
    const loud = rms.map((v) => v > thr);
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

  async function renderTake() {
    const readIdx = S.reads.length - 1;
    const read = S.reads[readIdx];
    stopPlayback();
    const n = S.takes.length + 1;
    const c = S.clip, voice = S.dir === 'voice';
    const variant = voice ? c.voiceTake : c.takes[(n - 1) % c.takes.length];
    const rate = voice ? VOICE_RATES[(n - 1) % VOICE_RATES.length]
      : c.takeRates ? c.takeRates[(n - 1) % c.takeRates.length] : 1;
    const take = { n, read: readIdx, url: variant, rate, peaks: null, dur: 0, status: 'rendering', step: 0, dir: S.dir };
    S.takes.push(take);
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
    S.state = 'takes';
    render();
    const rvTimer = setInterval(drawAllStrips, 40);
    await wait(360); clearInterval(rvTimer); take.revealAt = 0; drawAllStrips();
    if (S.selected === n && S.state === 'takes') play(take.url, 'take', n, take.rate); // then audition
  }
  function stopRender() {
    const t = S.takes.find((x) => x.status === 'rendering');
    if (t) { clearInterval(t.anim); t.status = 'stopped'; S.takes = S.takes.filter((x) => x !== t); }
    S.selected = S.takes.filter((x) => x.status === 'ready').slice(-1)[0]?.n ?? null;
    S.state = S.takes.length ? 'takes' : 'review';
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

    // Clip chip
    el.clip.hidden = !c;
    if (c) {
      const tooLong = c.dur > MAX_SECONDS;
      el.clip.dataset.warn = String(tooLong);
      el.clipWho.textContent = c.who.toUpperCase();
      el.clipMeta.textContent = tooLong ? `${c.name} · 1:12 of max 1:00` : `${c.name} · ${c.tc} · ${c.dur.toFixed(1)} s`;
      el.clipText.textContent = c.text ? `“${c.text}”` : 'Not transcribed: the clip is too long';
      el.playOriginal.hidden = !c.audio;
      el.playOriginal.dataset.playing = String(player.kind === 'orig');
      el.playOriginal.innerHTML = player.kind === 'orig' ? ICON.pause : ICON.play;
    }

    // Direction: chosen up front, described by its result. Locked while recording / rendering.
    const showDir = !!c && S.state !== 'toolong';
    el.dirRow.hidden = !showDir;
    if (showDir) {
      el.dirRow.innerHTML = Object.entries(DIRS).map(([d, v]) =>
        `<button type="button" class="s-dir__opt" role="radio" data-dir="${d}" aria-checked="${S.dir === d}" ${busy() && S.dir !== d ? 'disabled' : ''}
          title="${d === 'tone' ? `The take is ${c.who}’s voice saying the line the way you say it.` : `The take is another voice saying the line the way ${c.who} said it: same intonation, timing and emphasis.`}">
          <b>${v.title}</b><span>${v.keeps(c.who)}</span></button>`).join('');
      el.dirRow.querySelectorAll('[data-dir]').forEach((b) => { b.onclick = () => setDir(b.dataset.dir); });
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
    requestAnimationFrame(drawAllStrips);
    // Ring: drawn right away (reading layout forces it), not in rAF — rAF pauses in background tabs
    (() => {
      if (S.state === 'ready') {
        Ring.reset(); Ring.idle();
        const b = el.work.querySelector('.rec-btn[data-act="record"]');
        if (b && !b.disabled) { b.onmouseenter = () => Ring.hover(true); b.onmouseleave = () => Ring.hover(false); b.onfocus = b.onmouseenter; b.onblur = b.onmouseleave; }
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
        return `<div class="err">${ICON.alert}<div><p>This clip is 1:12. SONA works with lines of up to 1:00.</p>
          <p class="muted">Split it in ${H().app} (${H().split}) and select one part.</p></div></div>`;
      case 'micdenied':
        return `<div class="err">${ICON.alert}<div><p>SONA can’t hear your microphone.</p>
          <p class="muted">Allow microphone access for ${H().app} in System Settings › Privacy &amp; Security › Microphone, then try again.</p></div></div>
          <div><button class="link" data-act="retry-mic">Try again</button> <button class="link" data-act="use-demo">Use a demo read (prototype)</button></div>`;
      case 'importing':
        return `<div class="work-empty"><p class="work-empty__title">Reading “${S.importName}”…</p><span class="progress-dots">${'<i class="on"></i>'.repeat(3)}${'<i></i>'.repeat(5)}</span></div>`;
      case 'ready': {
        const ok = true; // voice-rights step removed (open question in brief.md)
        const fileErr = S.error?.type === 'file' ? `<div class="err">${ICON.alert}<div><p>${S.error.text}</p></div></div>` : '';
        if (S.dir === 'voice') {
          // Voice: the input is a recording of the new voice (a file / clip), so the drop target is the main action
          return `${fileErr}
            <button class="voice-drop" data-act="pick-file" title="Any clean recording of the voice you want. You can also drop a file here.">
              <span class="voice-drop__icon">${ICON.file}</span>
              <span class="rec__title">Add the new voice</span>
              <span class="rec__sub">Choose or drop a recording of it · up to 60 s</span>
            </button>
            <div class="voice-lib">
              <span class="rec__or">or</span>
              <button class="btn btn--secondary btn--sm voice-lib__btn" data-act="voice-menu" aria-expanded="${S.voiceMenu}" aria-haspopup="listbox">${ICON.person}Choose a SONA voice${ICON.chevron}</button>
              ${S.voiceMenu ? voiceMenuHTML() : ''}
            </div>`;
        }
        return `${fileErr}
          <div class="rec rec--stack${ok ? '' : ' rec--locked'}">
            <div class="rec-stage">
              <canvas class="rec-ring" id="recRing" aria-hidden="true"></canvas>
              <button class="rec-btn" data-act="record" ${ok ? '' : 'disabled'} title="Record your read (R)" aria-label="Record your read"></button>
            </div>
            <span class="rec__title">Record your read</span>
            <span class="rec__sub">Say the line the way it should sound · up to 60 s</span>
            <span class="rec__or">or</span>
            <button class="btn btn--secondary btn--file" data-act="pick-file" ${ok ? '' : 'disabled'} title="A pickup the actor recorded, or someone else’s read. You can also drop a file here.">${ICON.file}Use an existing recording</button>
          </div>`;
      }
      case 'countin':
        return `<div class="rec rec--stack"><span class="rec__bigcount num" aria-live="assertive">${S.countdown}</span></div>`;
      case 'recording':
        return `<div class="rec rec--row">
            <button class="rec-btn" data-mode="recording" data-act="stop" title="Stop (R)" aria-label="Stop recording"></button>
            <span class="rec__time num"><span class="lamp"></span><span id="recTime">0:00</span> <small>/ 1:00</small></span>
          </div>
          <div class="strip strip--read strip--live">
            <span class="strip__label">${ICON.mic}<b>Your read ${S.reads.length + 1}</b><span class="num" id="liveDur">0.0 s</span></span>
            <canvas data-strip="live" data-id="0"></canvas>
            <span class="strip__tools"><button class="icon-btn" disabled aria-hidden="true" tabindex="-1">${ICON.play}</button></span>
          </div>`;
      case 'review':
      case 'rendering':
      case 'takes':
      case 'applied': {
        const lastRead = S.reads.length - 1;
        const sel = S.takes.find((t) => t.n === S.selected);
        // In review the newest read is the one about to be rendered; otherwise show the read behind the selected take
        const readIdx = S.state === 'review' || S.state === 'rendering' ? lastRead : (sel ? sel.read : lastRead);
        const r = S.reads[readIdx];
        let html = r ? readStrip(readIdx, r) : '';
        if (S.state === 'review') return html;
        if (sel) html += takeStrip(sel);
        return html;
      }
    }
    return '';
  }

  function voiceMenuHTML() {
    const row = (v, i) => `<button class="voice-menu__item" role="option" data-act="pick-voice" data-id="${i}">
      <span class="voice-menu__name">${v.name}${v.who ? ` <small>${v.who}</small>` : ''}</span><span class="tag">${v.tag}</span></button>`;
    const favs = LIBRARY.map((v, i) => [v, i]).filter(([v]) => v.fav);
    return `<div class="voice-menu" role="listbox" aria-label="SONA voices">
      <span class="voice-menu__group">Bookmarks</span>${favs.map(([v, i]) => row(v, i)).join('')}
      <span class="voice-menu__group">Library</span>${LIBRARY.map(row).join('')}</div>`;
  }
  function readStrip(i, r) {
    if (r.source === 'library') {
      return `<div class="strip strip--read strip--lib">
        <span class="strip__label" title="A voice from your SONA library">${ICON.person}<b>New voice ${i + 1}</b></span>
        <span class="voice-pick"><b>${r.name}</b>${r.who ? `<span class="muted">${r.who}</span>` : ''}<span class="tag">${r.tag}</span></span>
        <span class="strip__tools"></span></div>`;
    }
    const playing = player.kind === 'read' && player.id === i;
    const name = r.dir === 'voice' ? 'New voice' : r.source === 'file' ? 'Read' : 'Your read';
    return `<div class="strip strip--read">
      <span class="strip__label" title="${r.source === 'file' ? `File: ${r.name}` : r.device}">${r.source === 'file' ? ICON.file : ICON.mic}<b>${name} ${i + 1}</b>${readDurHTML(r)}</span>
      <canvas data-strip="read" data-id="${i}"></canvas>
      <span class="strip__tools"><button class="icon-btn" data-act="play-read" data-id="${i}" aria-label="Play ${name.toLowerCase()} ${i + 1}" title="Play ${name.toLowerCase()}">${playing ? ICON.pause : ICON.play}</button></span>
    </div>`;
  }
  function takeStrip(t) {
    const who = S.clip.who, voice = t.dir === 'voice';
    const from = S.reads.length > 1 ? ` · from ${voice ? 'voice' : 'read'} ${t.read + 1}` : '';
    if (t.status === 'rendering') {
      return `<div class="strip strip--take is-rendering">
        <span class="strip__label"><span class="voice-dot"></span><span class="strip__lines"><span><b>Take ${t.n}</b></span><span class="strip__sub">${voice ? `Rendering ${who}’s intonation in ${voiceOf(t) === 'another voice' ? 'the new voice' : `${voiceOf(t)}’s voice`}… ~4 s` : `Rendering in ${who}’s voice… ~4 s`}</span></span></span>
        <canvas data-strip="take" data-id="${t.n}"></canvas><span class="strip__tools"></span></div>`;
    }
    if (t.status === 'failed') {
      return `<div class="err">${ICON.alert}<div><p>Take ${t.n} didn’t render: ${S.error?.reason || 'unknown error'}. Nothing was charged.</p>
        <p class="muted"><button class="link" data-act="retry-render">Try again</button> or <button class="link" data-act="new-read">${voice ? 'choose another voice' : 'record a new read'}</button></p></div></div>`;
    }
    const playing = player.kind === 'take' && player.id === t.n;
    return `<div class="strip strip--take">
      <span class="strip__label"><span class="voice-dot"></span><span class="strip__lines">
        <span><b>Take ${t.n}</b> <span class="num">${t.dur.toFixed(1)} s</span> <span class="verify" title="Watermarked with SONA Verify">✓</span></span>
        <span class="strip__sub">${voice ? `${who}’s intonation · ${voiceOf(t) === 'another voice' ? 'new voice' : voiceOf(t)}` : `${who}’s voice`}${from}</span></span></span>
      <canvas data-strip="take" data-id="${t.n}"></canvas>
      <span class="strip__tools"><button class="icon-btn" data-act="play-take" data-id="${t.n}" aria-label="Play take ${t.n}" title="Play take (Space)">${playing ? ICON.pause : ICON.play}</button></span>
    </div>`;
  }

  function statusHTML() {
    const c = S.clip, who = c?.who;
    const sel = S.takes.find((t) => t.n === S.selected);
    switch (S.state) {
      case 'noclip': return '';
      case 'toolong': return '<span class="err-text">Too long to work with. Select a shorter clip.</span>';
      case 'micdenied': return `<span class="err-text">Microphone access is off for ${H().app}.</span>`;
      case 'ready': return '';
      case 'importing': return 'Trimming silence and checking the length…';
      case 'countin': return 'Recording starts in a moment · Esc cancels';
      case 'recording': return S.rec?.demo ? 'Recording the demo read…' : 'Recording your read · stops on silence · Esc cancels';
      case 'review': return '';
      case 'rendering': return '';
      case 'takes': {
        // The clip already plays a take made in the other direction: say so, Apply here replaces it
        const other = S.applied[c.id] && !appliedHere();
        if (other) return `Clip plays take ${S.applied[c.id]} from “${DIRS[S.appliedDir[c.id]].title}” · Apply here replaces it`;
        return sel ? '' : 'Pick a take';
      }
      case 'applied': {
        const n = S.applied[c.id];
        const undo = '<button class="link" data-act="undo">Undo</button>';
        return {
          nuendo: `<span class="ok">Clip plays take ${n}</span> · original kept · not printed yet ${undo}`,
          reaper: `<span class="ok">Take ${n} added as an item take</span> · earlier takes kept ${undo}`,
          protools: `<span class="ok">Take ${n} rendered into the clip</span> · original in the Clips List ${undo}`,
          premiere: `<span class="ok">Take ${n} placed on A4 at ${c.tc}</span> · original untouched ${undo}`,
        }[S.host];
      }
    }
    return '';
  }

  // Second line: host-specific follow-up after Apply (print, take length, file location)
  function substatusHTML() {
    if (S.state === 'review' || S.state === 'takes') return readNoteHTML();
    if (S.state !== 'applied') return '';
    const c = S.clip, n = S.applied[c.id], t = S.takes.find((x) => x.n === n);
    const longer = t && H().tier === 'T1' && t.dur - c.dur > 0.1
      ? `<span class="warn">Take ${n} is ${(t.dur - c.dur).toFixed(1)} s longer than the clip: trim the clip end open in Nuendo.</span>` : '';
    if (longer) return longer; // more urgent than the print hint
    return {
      nuendo: `Print it when you’re happy: ${H().print}`,
      reaper: 'Switch takes in REAPER (T) or here · the item keeps every take',
      protools: 'Undo puts the original clip back',
      premiere: 'Mute A1 to hear only the take',
    }[S.host];
  }

  // Note about the read behind the current take: length vs the original, trimmed silence
  function readNoteHTML() {
    const c = S.clip; if (!c) return '';
    const sel = S.takes.find((t) => t.n === S.selected);
    const r = S.reads[S.state === 'review' || !sel ? S.reads.length - 1 : sel.read];
    if (!r || !r.silent) return '';
    return r.source === 'file' ? '<span class="warn">No speech found in this file. Choose another recording.</span>' : '<span class="warn">No speech found in your read. Check the mic level and record again.</span>';
  }
  // Read length vs the original: amber duration + tooltip instead of a sentence
  function readDurHTML(r) {
    const c = S.clip, ratio = r.dur / c.dur;
    // Voice keeps the clip's timing, so the length of the voice recording doesn't matter
    const off = r.dir !== 'voice' && !r.silent && (ratio > 1.4 || ratio < 0.6);
    const tips = [];
    if (off) tips.push(`Original is ${c.dur.toFixed(1)} s — the take will follow your timing${ratio < 0.6 ? ' and may sound rushed' : ' and may not fit the clip'}`);
    if (r.trimmed > 0.3) tips.push(`${r.trimmed.toFixed(1)} s of silence trimmed`);
    return `<span class="num${off ? ' warn' : ''}"${tips.length ? ` title="${tips.join(' · ')}"` : ''}>${r.dur.toFixed(1)} s</span>`;
  }

  function renderTakes() {
    const show = S.takes.length > 0 && ['rendering', 'takes', 'applied', 'review'].includes(S.state);
    el.takesRow.hidden = !show;
    if (!show) return;
    const applied = appliedHere();
    const voice = S.dir === 'voice';
    el.takeChips.innerHTML = S.takes.map((t) => {
      const lbl = t.status === 'failed' ? `${t.n} !` : t.n;
      return `<button class="chip" data-act="select-take" data-id="${t.n}" data-status="${t.status}" aria-pressed="${S.selected === t.n}"
        title="Take ${t.n} · ${takeWhat(t)}${S.reads[t.read]?.source === 'library' ? '' : ` · ${readName(t.read)}`}${applied === t.n ? ' · applied' : ''}">
        <span class="chip__dot"></span>${lbl}${applied === t.n ? ICON.tick : ''}</button>`;
    }).join('') + (['takes', 'applied'].includes(S.state)
      ? (voice
        ? `<button class="btn btn--secondary btn--file btn--sm" data-act="new-read" title="Add a recording of another voice. It becomes the next record.">${ICON.file}New voice</button>`
        : `<button class="btn btn--secondary btn--file btn--sm" data-act="new-read" title="Record another read with a different intonation. It becomes the next record.">${ICON.mic}New record</button>`)
      : '');
    el.takeChips.querySelectorAll('[data-act]').forEach(bindAct);
  }

  function renderActions() {
    const p = el.primary, st = S.state;
    const sel = S.takes.find((t) => t.n === S.selected);
    let left = '';
    p.disabled = false; p.title = ''; p.hidden = false;
    p.className = 'btn btn--primary';
    switch (st) {
      case 'noclip': case 'toolong': case 'micdenied': case 'importing':
        p.hidden = true; break; // no disabled “Render take” before there is a read
      case 'ready':
        p.hidden = true;
        if (S.takes.length) left = '<button class="btn btn--secondary" data-act="back-to-takes">Back to takes</button>';
        break;
      case 'countin': case 'recording':
        p.textContent = 'Stop';
        left = '<button class="link" data-act="cancel">Cancel</button>';
        break;
      case 'review':
        p.textContent = 'Render take';
        left = S.dir === 'voice'
          ? '<button class="btn btn--secondary" data-act="new-read">Choose another</button>'
          : '<button class="btn btn--secondary" data-act="new-read">Re-record</button>';
        break;
      case 'rendering': {
        const t = S.takes.find((x) => x.status === 'rendering');
        p.innerHTML = renderBtnHTML(t ? t.step / 16 : 0);
        p.classList.add('btn--busy'); p.title = 'Rendering the take';
        left = '<button class="link" data-act="stop-render">Stop</button>';
        break;
      }
      case 'takes': {
        const ok = sel && sel.status === 'ready';
        p.textContent = ok ? `Apply take ${sel.n}` : 'Apply';
        p.disabled = !ok;
        left = '';
        break;
      }
      case 'applied': {
        const n = appliedHere();
        if (S.selected === n) {
          p.textContent = 'Next clip →'; p.title = 'Open the next dialogue clip';
        } else {
          p.textContent = `Apply take ${S.selected}`;
        }
        left = '';
        break;
      }
    }
    el.actionsLeft.innerHTML = left;
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
    if (tm) tm.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    const ld = document.getElementById('liveDur'); if (ld) ld.textContent = `${t.toFixed(1)} s`;
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
  function bindAct(node) { node.onclick = (e) => { e.preventDefault(); act(node.dataset.act, node.dataset.id); }; }

  function act(a, id) {
    switch (a) {
      case 'record': startRecording(); break;
      case 'stop': stopRecording(); break;
      case 'cancel': cancelRecording(); break;
      case 'new-read': newRead(); break;
      case 'back-to-takes': S.state = appliedHere() ? 'applied' : 'takes'; render(); break;
      case 'retry-mic': S.state = 'ready'; render(); break;
      case 'use-demo': el.optDemoRead.checked = true; el.optDenyMic.checked = false; S.state = 'ready'; render(); break;
      case 'pick-file': S.voiceMenu = false; el.fileInput.click(); break;
      case 'voice-menu': S.voiceMenu = !S.voiceMenu; render(); break;
      case 'pick-voice': {
        const v = LIBRARY[Number(id)];
        stopPlayback();
        S.reads.push({ source: 'library', name: v.name, who: v.who, tag: v.tag, dur: 0, peaks: null, dir: 'voice', device: 'SONA voices' });
        S.voiceMenu = false; S.error = null; S.state = 'review';
        render(); break;
      }
      case 'retry-render':
        S.takes = S.takes.filter((t) => t.status !== 'failed');
        S.reads[S.reads.length - 1].silent = false;
        renderTake(); break;
      case 'play-read': {
        const i = Number(id), r = S.reads[i];
        if (player.kind === 'read' && player.id === i) { stopPlayback(); render(); } else play(r.url, 'read', i);
        break;
      }
      case 'play-take': {
        const n = Number(id), t = S.takes.find((x) => x.n === n);
        if (player.kind === 'take' && player.id === n) { stopPlayback(); render(); } else play(t.url, 'take', n, t.rate);
        break;
      }
      case 'select-take': {
        const n = Number(id), t = S.takes.find((x) => x.n === n);
        S.selected = n;
        if (S.state === 'review' || S.state === 'ready') S.state = appliedHere() ? 'applied' : 'takes';
        if (t.status === 'failed') S.error = S.error || { type: 'render', n, reason: 'the render server didn’t respond' };
        render();
        if (t.status === 'ready') play(t.url, 'take', n, t.rate);
        break;
      }
      case 'undo': undoApply(); break;
      case 'stop-render': stopRender(); break;
      case 'apply-next': applyTake(true); break;
    }
  }

  el.primary.addEventListener('click', () => {
    switch (S.state) {
      case 'countin': cancelRecording(); break;
      case 'recording': stopRecording(); break;
      case 'review': renderTake(); break;
      case 'rendering': break; // busy — Stop is next to it
      case 'takes': applyTake(); break;
      case 'applied': if (S.selected === appliedHere()) nextClip(); else applyTake(); break;
    }
  });
  el.playOriginal.addEventListener('click', () => {
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
  let zeroHeld = false;
  document.addEventListener('click', (e) => {
    if (S.voiceMenu && !e.target.closest('.voice-lib')) { S.voiceMenu = false; render(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'Escape' && S.voiceMenu) { S.voiceMenu = false; return render(); }
    if (e.key === 'Escape' && (S.state === 'recording' || S.state === 'countin')) return cancelRecording();
    if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) {
      if (S.state === 'ready' && S.clip) return startRecording();
      if (S.state === 'recording') return stopRecording();
    }
    if (e.key === '0' && !zeroHeld && S.clip?.audio) { zeroHeld = true; play(S.clip.audio, 'orig', 0); }
    if (e.key === ' ' && !e.target.closest('button')) {
      e.preventDefault();
      const t = S.takes.find((x) => x.n === S.selected && x.status === 'ready');
      if (t) act('play-take', t.n);
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.shiftKey) { if (S.state === 'takes' || S.state === 'applied') applyTake(true); return; }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !el.primary.disabled) el.primary.click();
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === '0' && zeroHeld) { zeroHeld = false; stopPlayback(); render(); }
  });

  // Prototype controls
  el.optReset.addEventListener('click', () => {
    if (S.rec) cancelRecording();
    stopPlayback(); hostStop();
    Object.assign(S, { state: 'noclip', dir: 'tone', clip: null, reads: [], takes: [], selected: null, sessions: {}, applied: {}, appliedDir: {}, itemTakes: {}, extra: [], error: null });
    el.optDemoRead.checked = false; el.optFailNext.checked = false; el.optDenyMic.checked = false;
    el.optHost.value = 'nuendo'; S.host = 'nuendo';
    el.hostHint.textContent = 'Click a dialogue clip to start';
    buildHost(); render();
  });
  el.optDemoRead.addEventListener('change', () => S.state === 'ready' && render());
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
