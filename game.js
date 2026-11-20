// 홈런왕 키우기 v0.1 - 화면, 입력, 연출
(function () {
  'use strict';
  const H = window.HR;
  const VERSION = 'v0.8.5 베타';
  const SAVE_KEY = 'hrk_save_v1';
  const fmt = H.fmt;
  const $ = (id) => document.getElementById(id);

  // ---------- 분석 (GA 연결 시 사용) ----------
  function track(name, params) {
    try { if (window.gtag && window.HRK_GA) window.gtag('event', name, params || {}); } catch (e) { /* noop */ }
  }

  // ---------- 저장 ----------
  let st;
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        const base = H.newState();
        st = Object.assign(base, o);
        st.stats = Object.assign(base.stats, o.stats || {});
        if (!st.bats || !st.bats.length) { const b = H.newBat(0, 'power'); st.bats = [b]; st.equip = b.id; }
        if (!st.bats.find((b) => b.id === st.equip)) st.equip = st.bats[0].id;
        if (o.tut == null && (st.totalHits || 0) > 30) st.tut = 99;
        st.bats.forEach((b) => H.markDex(st, b));
        return true;
      }
    } catch (e) { /* 손상된 저장은 새로 시작 */ }
    st = H.newState();
    return false;
  }
  function save() {
    st.lastSave = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); } catch (e) { /* noop */ }
  }

  // ---------- 사운드 ----------
  let AC = null;
  function audio() {
    if (!st.sound) return null;
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function noiseBuf(ac, dur) {
    const b = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function tone(freq, dur, type, vol, delay, slide) {
    const ac = audio(); if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, filt, freq, delay, attack) {
    const ac = audio(); if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf(ac, dur);
    const f = ac.createBiquadFilter(); f.type = filt || 'highpass'; f.frequency.value = freq || 1000;
    const g = ac.createGain();
    if (attack) { g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(vol, t + attack); }
    else g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(ac.destination); s.start(t);
  }
  const SFX = {
    crack(q) {
      const v = q === 'perfect' ? 0.6 : q === 'good' ? 0.42 : 0.22;
      noise(0.06, v, 'highpass', q === 'weak' ? 900 : 2200);
      tone(q === 'perfect' ? 2600 : q === 'good' ? 1900 : 700, 0.08, 'triangle', v * 0.5);
      if (q !== 'weak') tone(q === 'perfect' ? 95 : 120, 0.22, 'sine', v * 0.9, 0, 45);
      if (q === 'perfect') { tone(1200, 0.25, 'sine', 0.18); noise(0.9, 0.12, 'bandpass', 1400, 0.08, 0.15); }
    },
    swing() { noise(0.18, 0.22, 'bandpass', 700, 0, 0.06); },
    whiff() { noise(0.25, 0.15, 'bandpass', 900, 0, 0.05); },
    mitt(v) { v = v == null ? 1 : v; noise(0.05, 0.35 * v, 'lowpass', 900); tone(140, 0.09, 'sine', 0.35 * v); },
    out() { tone(392, 0.18, 'triangle', 0.15, 0.1); tone(330, 0.18, 'triangle', 0.15, 0.25); tone(262, 0.35, 'triangle', 0.15, 0.4); },
    cheer() {
      noise(1.8, 0.18, 'bandpass', 1500, 0, 0.25);
      for (let i = 0; i < 10; i++) noise(0.04, 0.12, 'highpass', 2500, 0.2 + Math.random() * 1.2);
    },
    coin() { tone(1320, 0.08, 'square', 0.06); tone(1760, 0.12, 'square', 0.06, 0.06); },
    success() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.2, i * 0.08)); },
    fail() { tone(220, 0.35, 'sawtooth', 0.15, 0, 110); },
    destroy() { noise(0.6, 0.4, 'lowpass', 1200); tone(300, 0.6, 'sawtooth', 0.2, 0, 50); },
    saved() { tone(880, 0.15, 'sine', 0.2); tone(660, 0.25, 'sine', 0.2, 0.12); },
    box() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.15, 'triangle', 0.18, i * 0.06)); },
    click() { tone(600, 0.05, 'sine', 0.08); },
    up() { tone(700, 0.07, 'triangle', 0.12); tone(1050, 0.1, 'triangle', 0.12, 0.05); },
  };

  // ---------- 음성 (심판 콜, 캐스터) : assets/voice/*.mp3 가 있을 때만 ----------
  const VOICE = (() => {
    const NAMES = ['strike', 'ball', 'strikeout', 'walk', 'hr1', 'hr2', 'hr3', 'outhr', 'sphr', 'nice'];
    const buf = {}; let loading = false, lastHR = 0, lastAny = 0, hrIdx = 0;
    function load() {
      if (loading || !AC) return; loading = true;
      NAMES.forEach((n) => fetch('assets/voice/' + n + '.mp3').then((r) => r.ok ? r.arrayBuffer() : null).then((ab) => ab && AC.decodeAudioData(ab)).then((b) => { if (b) buf[n] = b; }).catch(() => {}));
    }
    function play(n, vol) {
      if (!st.sound || st.voice === false) return;
      const ac = audio(); if (!ac) return; load();
      const b = buf[n]; if (!b) return;
      const now = ac.currentTime; if (now - lastAny < 0.25) return; lastAny = now;
      const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = b; g.gain.value = vol == null ? 0.8 : vol;
      src.connect(g).connect(ac.destination); src.start();
    }
    function homer(special, out, manual) {
      const t = performance.now();
      if (!manual && !special && t - lastHR < 6000) return; // 자동 타격 홈런은 6초에 한 번만
      lastHR = t;
      if (special) return play('sphr', 1);
      if (out) return play('outhr', 0.95);
      hrIdx = (hrIdx + 1) % 3; play('hr' + (hrIdx + 1), 0.95);
    }
    return { load, play, homer };
  })();

  // ---------- 방망이 SVG ----------
  function batSVGRaw(b, glow) {
    const g = H.GRADES[b.g];
    const id = 'bg' + b.g;
    const aura = b.e >= 10 ? `<ellipse cx="66" cy="12" rx="58" ry="12" fill="${g.color}" opacity="${0.12 + (b.e - 10) * 0.025}"/>` : '';
    const star = b.g >= 3 ? `<path d="M96 8 l1.6 3.2 3.5.5-2.5 2.4.6 3.5-3.2-1.7-3.2 1.7.6-3.5-2.5-2.4 3.5-.5z" fill="#fff" opacity=".85"/>` : '';
    return `<svg viewBox="0 0 124 24" xmlns="http://www.w3.org/2000/svg" class="${glow ? 'glow' : ''}">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".25" stop-color="${g.color}"/><stop offset="1" stop-color="${g.dark}"/></linearGradient></defs>
${aura}
<path d="M9 10.3 L48 10.6 C68 8.2 86 5 110 5 Q118 5 118 12 Q118 19 110 19 C86 19 68 15.8 48 13.4 L9 13.7 Z" fill="url(#${id})" stroke="${g.dark}" stroke-width=".8"/>
<rect x="11" y="9.9" width="22" height="4.2" rx="1.5" fill="#222" opacity=".75"/>
<ellipse cx="7" cy="12" rx="3.2" ry="4.6" fill="${g.dark}"/>
${star}
${b.e > 0 ? `<text x="78" y="15.5" font-size="8" font-family="Jua,sans-serif" fill="#fff" stroke="#000" stroke-width=".6" paint-order="stroke">+${b.e}</text>` : ''}
</svg>`;
  }
  // 에셋 (있으면 그림, 없으면 코드 그림)
  let BAT_ART = false, UI_ART = false;
  function batSVG(b, glow) {
    if (!BAT_ART) return batSVGRaw(b, glow);
    const g = H.GRADES[b.g];
    return `<span class="bart${glow ? ' glow' : ''}${b.e >= 10 ? ' aura' : ''}" style="--gc:${g.color}"><img src="assets/bats/g${b.g}_${b.t}.webp" alt="" draggable="false">${b.e > 0 ? `<i>+${b.e}</i>` : ''}</span>`;
  }
  function uiIcon(name, emoji) { return UI_ART ? `<img src="assets/ui/${name}.webp" alt="" draggable="false">` : emoji; }
  function preloadArt() {
    const a = new Image(); a.onload = () => { BAT_ART = true; lastHTML = ''; markDirty(); setTabIcon(); }; a.src = 'assets/bats/g0_power.webp';
    const u = new Image(); u.onload = () => { UI_ART = true; lastHTML = ''; markDirty(); }; u.src = 'assets/ui/shop_wood.webp';
  }
  // 스프라이트·배경 (assets/sprites.json 이 있으면 사용, 없으면 코드 그림)
  const ART = { bg: {}, out: {}, req: {}, pitcher: null, batter: null, cal: null };
  function lazyImg(key, src, slot, idx) {
    if (ART.req[key]) return; ART.req[key] = 1;
    const im = new Image(); im.onload = () => { slot[idx] = im; }; im.src = src;
  }
  function getBg(i) { const n = Math.min(i, 8) + (i >= 10 ? 0 : 0); const k = i >= 10 ? 8 : i; lazyImg('bg' + k, 'assets/bg/bg_s' + (k + 1) + '.webp', ART.bg, k); return ART.bg[k]; }
  function getOut(t) { lazyImg('out' + t, 'assets/bg/out_' + t + '.webp', ART.out, t); return ART.out[t]; }
  function preloadSprites() {
    fetch('assets/sprites.json?v=' + VERSION).then((r) => r.ok ? r.json() : null).then((cal) => {
      if (!cal) return; ART.cal = cal;
      for (const who of ['pitcher', 'batter', 'side', 'boss', 'hold']) {
        const c = cal[who]; if (!c) continue;
        const frames = []; let left = c.n;
        for (let i = 0; i < c.n; i++) { const im = new Image(); im.onload = () => { frames[i] = im; if (--left === 0) ART[who] = frames; }; im.src = 'assets/sprites/' + who + '_' + i + '.webp'; }
      }
    }).catch(() => {});
  }
  function setTabIcon() { document.querySelector('#tabs [data-t="bats"] b').innerHTML = '<span style="display:inline-block;width:34px">' + batSVG({ g: 4, t: 'power', e: 0 }) + '</span>'; }
  function gradeTag(g) { const G = H.GRADES[g]; return `<span class="grade" style="background:${G.color}">${G.name}</span>`; }

  // ---------- 필드 ----------
  const cv = $('field'), ctx = cv.getContext('2d');
  let W = 0, Hh = 0, DPR = 1;
  function resize() {
    const r = cv.parentElement.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; Hh = r.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(Hh * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);

  // 스트라이크 존 (미터)
  const ZW = 0.25, ZC = 0.78, ZH = 0.3;
  const REL = { x: 0.35, y: 1.85, z: 17.6 };
  const SWING_LEAD = 0.07;
  const G = {
    view: '1p', phase: 'windup', t: 0, sp: 1, pitch: null,
    swingT: -1, swingQ: null, manual: false, autoTake: false,
    result: null, call: null, hitP: null,
    freeze: 0, slow: 0, flash: 0, flashC: '#fff', shake: 0, cut: 0, zoom: 0,
    camMin: -4, camMax: 21, camFrom: null, flight: 1.4,
    ballX: 0, ballY: 0, ballVis: false, trail: [], trail1: [], batTrail: [], impact: null, launch: null,
    fx: [], texts: [], manualUntil: 0, fever: 0, clouds: [], crowdSeed: Math.random() * 1000,
    mode: 'normal', derby: null, boss: null, intro: null,
  };
  for (let i = 0; i < 6; i++) G.clouds.push({ x: Math.random(), y: 0.08 + Math.random() * 0.25, s: 0.6 + Math.random() * 0.8 });

  function nowS() { return performance.now() / 1000; }
  function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, x)))), n = x / p; return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p; }
  function vib(pattern) { if (st.vibe === false) return; try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* noop */ } }

  function startPitch() {
    G.view = '1p'; G.phase = 'windup'; G.t = 0;
    G.pitch = H.genPitch(st, Math.random, { strikeOnly: G.mode === 'derby', boss: G.mode === 'boss' });
    G.swingT = -1; G.swingQ = null; G.manual = false; G.autoTake = false; G.pendingQ = null;
    G.result = null; G.call = null; G.ballVis = false; G.trail = []; G.trail1 = []; G.batTrail = []; G.impact = null; G.launch = null;
    G.sp = H.speedMult(st.stats.speed); G.zoom = 0;
  }

  // 관중 점 패턴 (한 번 그려서 재사용)
  const PAT = {};
  function crowdPattern(sx2, sy2, sz) {
    const k = sx2 + '_' + sy2; if (PAT[k]) return PAT[k];
    const c = document.createElement('canvas'); c.width = sx2 * 12; c.height = sy2 * 6; const x2 = c.getContext('2d');
    const cols = ['#ff6b6b', '#ffd84a', '#5bb8ff', '#ffffff', '#4cd97b', '#ff9f55']; let n = 0;
    for (let y = 0; y < 6; y++) for (let x = 0; x < 12; x++) { x2.fillStyle = cols[(n++ * 7 + y * 3) % cols.length]; x2.fillRect(x * sx2 + (y % 2) * (sx2 >> 1), y * sy2, sz, sz + 1); }
    PAT[k] = ctx.createPattern(c, 'repeat'); return PAT[k];
  }

  // ---------- 모드: 홈런 더비 / 보스전 ----------
  function startDerby() {
    const ranked = H.derbyCanRank(st);
    G.mode = 'derby'; G.derby = { n: 0, hr: 0, best: 0, ranked };
    st.count = { b: 0, s: 0 }; st.eyeCombo = 0;
    closeModal(); afterMove(); G.manualUntil = nowS() + 999;
    toast(ranked ? '오늘의 랭킹 도전! 스트라이크만 와요. 10구 안에 최대한 많이!' : '연습 모드 (랭킹 반영은 하루 1번)');
    track('derby_start', { ranked: ranked ? 1 : 0 });
  }
  function startBoss(i) {
    if (st.stadium !== i) H.moveStadium(st, i);
    G.mode = 'boss'; G.boss = { i, hr: 0, outs: 0 };
    st.count = { b: 0, s: 0 }; st.eyeCombo = 0;
    closeModal(); afterMove();
    popText('VS ' + H.BOSSES[i].name, '#ffd0d0', 26, true);
    toast('보스전! 아웃 3개 전에 홈런 ' + H.BOSS_HR + '개를 쳐라');
    track('boss_start', { i });
  }
  function pitchDone(o) {
    if (G.mode === 'derby') {
      const D = G.derby; D.n++;
      if (o.hit) { if (o.hit.hr) D.hr++; if (o.hit.d > D.best) D.best = o.hit.d; }
      if (D.n >= H.DERBY_N) { const fin = Object.assign({}, D); G.mode = 'normal'; G.derby = null; setTimeout(() => queueModal(() => derbyEndModal(fin)), 900); }
    } else if (G.mode === 'boss') {
      const B = G.boss;
      if (o.hit) { if (o.hit.hr) B.hr++; else { B.outs++; popText(o.hit.quality === 'weak' ? '땅볼 아웃' : '뜬공 아웃', '#ffb0b0', 26, false, 0.6); } }
      if (o.call === 'strikeout') B.outs++;
      if (B.hr >= H.BOSS_HR || B.outs >= H.BOSS_OUTS) {
        const win = B.hr >= H.BOSS_HR, i = B.i; G.mode = 'normal'; G.boss = null;
        setTimeout(() => queueModal(() => bossEndModal(win, i)), 900);
      }
    }
  }

  // ---------- 1인칭 투영 ----------
  const CAM = { y: 1.6, z: -3.0 };
  function hy1() { return Hh * 0.25; }
  function focal() { return Math.min(W * 1.6, (Hh * 0.99 - hy1()) * (-CAM.z) / CAM.y); }
  function proj(x, y, z) {
    const d = Math.max(0.3, z - CAM.z), f = focal();
    return [W / 2 + f * x / d, hy1() - f * (y - CAM.y) / d, f / d];
  }
  function pitchTarget(p) { return { x: p.x * ZW, y: ZC + p.y * ZH }; }
  function ball3(p, t) {
    const u = t / p.t, tg = pitchTarget(p);
    const ax = tg.x + p.bx * ZW, ay = tg.y + p.by * ZH;
    const x = REL.x + (ax - REL.x) * u - p.bx * ZW * u * u * u;
    const y = REL.y + (ay - REL.y) * u - p.by * ZH * u * u * u;
    const z = REL.z * (1 - u);
    return { x, y, z };
  }

  // ---------- 입력 ----------
  function onTap() {
    audio();
    G.manualUntil = nowS() + 6;
    if (st.tutorial && G.phase === 'windup') return;
    if (G.phase !== 'pitch' || G.swingT >= 0 || G.autoTake) return;
    const p = G.pitch;
    const delta = G.t - p.t;
    G.swingT = G.t; G.manual = true;
    const pw = H.perfectWindow(st), gw = H.goodWindow(st), ww = H.weakWindow(st);
    const ad = Math.abs(delta);
    let q = 'miss';
    if (ad <= pw) q = 'perfect'; else if (ad <= gw) q = 'good'; else if (ad <= ww) q = 'weak';
    const fq = H.swingOutcome(st, p, q);
    G.swingQ = fq;
    SFX.swing();
    if (fq === 'miss') {
      if (q === 'miss') popText(delta < 0 ? '너무 빨라요!' : '너무 늦어요!', '#ff9a9a', 22);
      else popText('볼에 헛스윙!', '#ff9a9a', 22);
    } else { G.pendingQ = fq; G.pendingManual = true; }
  }

  function contact(q, manual) {
    const p = G.pitch, fever = G.fever > nowS();
    const r = H.hitResult(st, q, manual, fever, Math.random, H.hitBonus(st, p));
    G.result = r; G.hitP = p;
    const b = ball3(p, Math.min(G.t, p.t * 1.05));
    const [ix, iy] = proj(b.x, b.y, Math.max(0, b.z));
    // 타격감: 히트스톱, 슬로모션, 플래시, 흔들림, 진동
    const big = q === 'perfect';
    G.freeze = big ? 0.12 : q === 'good' ? 0.075 : 0.04;
    G.slow = big && (r.hr || r.special) ? 0.32 : 0;
    G.flash = big ? 0.6 : q === 'good' ? 0.3 : 0.1; G.flashC = r.special ? '#fff3b0' : '#ffffff';
    G.shake = big ? 0.3 : q === 'good' ? 0.18 : 0.08;
    G.impact = { x: ix, y: iy, t: 0, q };
    G.zoom = big ? 1 : 0.5;
    burst(ix, iy, big ? 26 : 14, big ? '#fff3a0' : '#ffffff');
    SFX.crack(q);
    vib(big ? 45 : 20);
    const lbl = { perfect: 'PERFECT!', good: 'GOOD', weak: '빗맞음' }[q];
    if (manual && q === 'perfect') VOICE.play('nice', 0.8);
    popText(lbl, q === 'perfect' ? '#ffe14d' : q === 'good' ? '#9fe8ff' : '#d0d0d0', q === 'perfect' ? 34 : 26, false, 0.3);
    if ((st.eyeCombo || 0) > 0 && q !== 'weak') popText('선구안 보너스 +' + st.eyeCombo * 10 + '%', '#7fffd4', 16, false, 0.42);
    if (p.meat && q !== 'weak') popText('실투를 놓치지 않았다!', '#ffcf6b', 16, false, 0.42);
    // 1인칭 발사 연출 준비
    const dir = r.quality === 'weak' ? 0.3 : 1;
    G.launch = { x0: b.x, y0: b.y, z0: Math.max(0, b.z), vx: (p.x * 0.6 + (Math.random() - 0.5)) * 3, h: r.hr ? 14 : r.quality === 'weak' ? 0.6 : 6 * dir, far: r.quality === 'weak' ? 9 : 45 };
    G.phase = 'launch'; G.t = 0; G.trail1 = [];
    if (manual && q === 'perfect') H.bump(st, 'perfect');
    if (manual) { st.manualHits++; if (st.tutorial && st.manualHits >= 3) { st.tutorial = false; $('tapHint').style.display = 'none'; } }
  }

  function doCall(swung) {
    const p = G.pitch, fever = G.fever > nowS();
    const res = H.callPitch(st, p, swung, fever);
    G.call = { p, ev: res.ev, swung };
    G.phase = 'call'; G.t = 0;
    if (res.ev === 'ball') { SFX.mitt(0.6); VOICE.play('ball', 0.75); popText('볼', '#9fe8ff', 30); if (st.eyeCombo) popText('선구안 콤보 ' + st.eyeCombo + ' (+' + st.eyeCombo * 10 + '%)', '#7fffd4', 16, false, 0.4); }
    else if (res.ev === 'strike') { SFX.mitt(1); VOICE.play('strike', 0.75); popText('스트라이크!', '#ffb0b0', 30); }
    else if (res.ev === 'swingmiss') { SFX.mitt(1); VOICE.play('strike', 0.75); popText('헛스윙 스트라이크', '#ffb0b0', 26); }
    else if (res.ev === 'walk') { SFX.mitt(0.6); VOICE.play('walk', 0.85); SFX.coin(); popText('볼넷!', '#7fffd4', 40, true); floatCoin('+' + fmt(res.coins)); toast('볼넷 보너스! 다음 공은 한가운데 실투'); vib(25); track('walk', {}); }
    else if (res.ev === 'strikeout') { SFX.mitt(1); VOICE.play('strikeout', 0.85); SFX.out(); popText(res.looking ? '루킹 삼진' : '삼진 아웃', '#ff7a7a', 36, true); G.shake = 0.12; vib([60, 40, 60]); track('strikeout', {}); }
    pitchDone({ call: res.ev });
    updateHUD(); markDirty();
  }

  function landed() {
    const r = G.result;
    const ev = H.applyHit(st, r);
    if (r.hr || G.manual) track(r.hr ? 'homerun' : 'manual_hit', { q: r.quality, manual: G.manual ? 1 : 0, s: st.stadium + 1 });
    if (r.hr) {
      SFX.cheer(); G.shake = 0.35;
      VOICE.homer(r.special, !!H.STADIUMS[st.stadium].out, G.manual);
      const outS = H.STADIUMS[st.stadium].out;
      popText(r.special ? (outS ? '초대형 장외 홈런!!' : '특대 홈런!!') : (outS ? '장외 홈런!' : 'HOMERUN!'), r.special ? '#ffcc00' : '#fff', r.special ? 40 : 38, true);
      popText(H.fmtDist(r.d), '#ffe9a0', 22, false, 0.25);
      confetti();
      vib(r.special ? [40, 40, 40, 40, 90] : [30, 40, 60]);
      if (st.streak === 5 || (st.streak > 5 && st.streak % 5 === 0)) {
        G.fever = nowS() + 15; toast('5연속 홈런! 15초 동안 코인 2배');
      }
    } else if (r.quality !== 'weak') popText(H.fmtDist(r.d), '#fff');
    else popText('땅볼 ' + H.fmtDist(r.d), '#d0d0d0', 22);
    floatCoin('+' + fmt(r.coins));
    SFX.coin();
    if (ev.gems) toast('◆ 젬 +' + ev.gems + (r.special ? ' (특대 홈런 보너스)' : ''));
    if (ev.cleared && G.mode === 'normal') { track('stadium_clear', { s: st.stadium + 1 }); setTimeout(() => clearModal(), 700); }
    pitchDone({ hit: r });
    updateHUD(); markDirty();
  }

  function popText(s, color, size, big, delay) { G.texts.push({ s, color, size: size || 24, t: -(delay || 0), life: big ? 1.6 : 0.9, big }); }
  function burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 220;
      G.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.3, t: 0, c: color, r: 1.5 + Math.random() * 2.5 });
    }
  }
  function confetti() {
    const cols = ['#ff5a5a', '#ffd84a', '#4cd97b', '#5bb8ff', '#ff8ce0', '#fff'];
    for (let i = 0; i < 70; i++) {
      G.fx.push({ x: Math.random() * W, y: -10 - Math.random() * 60, vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 120, life: 1.8 + Math.random(), t: 0, c: cols[i % cols.length], r: 3 + Math.random() * 2, conf: true, rot: Math.random() * 6 });
    }
  }

  // 옆 시점 좌표
  function scale() { return W / (G.camMax - G.camMin); }
  function yScale() { return Math.min(scale(), 26); }
  function sx(m) { return (m - G.camMin) * scale(); }
  function groundY() { return Hh * 0.74; }

  // ---------- 업데이트 ----------
  function update(rdt) {
    // 이펙트 시간은 실제 시간으로
    if (G.flash > 0) G.flash -= rdt * 2.2;
    if (G.cut > 0) G.cut -= rdt * 3;
    if (G.shake > 0) G.shake -= rdt;
    if (G.impact) G.impact.t += rdt;
    for (const p of G.fx) { p.t += rdt; p.x += p.vx * rdt; p.y += p.vy * rdt; if (!p.conf) p.vy += 300 * rdt; else p.rot += rdt * 6; }
    G.fx = G.fx.filter((p) => p.t < p.life);
    for (const t of G.texts) t.t += rdt;
    G.texts = G.texts.filter((t) => t.t < t.life);
    if (G.freeze > 0) { G.freeze -= rdt; return; }
    let dt = rdt;
    if (G.slow > 0) { G.slow -= rdt; dt = rdt * 0.3; }
    G.t += dt;
    const now = nowS();
    const auto = st.auto && now > G.manualUntil && G.mode !== 'derby';
    const p = G.pitch;
    if (G.zoom > 0) G.zoom = Math.max(0, G.zoom - dt * 1.6);

    if (G.phase === 'windup') {
      if (G.t >= 0.8 / G.sp) { G.phase = 'pitch'; G.t = 0; G.ballVis = true; }
    } else if (G.phase === 'pitch') {
      const b = ball3(p, G.t);
      const s = proj(b.x, b.y, Math.max(-1.2, b.z));
      G.trail1.push(s); if (G.trail1.length > 10) G.trail1.shift();
      if (G.swingT < 0 && !G.autoTake && auto && G.t >= p.t - SWING_LEAD) {
        if (H.autoDecide(st, p)) {
          G.swingT = G.t; G.manual = false; SFX.swing();
          const q = H.swingOutcome(st, p, H.rollAutoQuality(st, Math.random));
          G.swingQ = q;
          if (q !== 'miss') { G.pendingQ = q; G.pendingManual = false; }
        } else G.autoTake = true;
      }
      // 방망이가 공에 닿는 순간 (스윙 시작 후 SWING_LEAD초)
      if (G.pendingQ && G.t - G.swingT >= SWING_LEAD) { const q = G.pendingQ; G.pendingQ = null; contact(q, G.pendingManual); }
      // 공이 포수 미트에 도착
      if (G.phase === 'pitch' && !G.pendingQ && G.t >= p.t + H.weakWindow(st) + 0.12) {
        G.ballVis = false;
        if (G.swingQ === 'miss') doCall(true); else doCall(false);
      }
    } else if (G.phase === 'launch') {
      const L = G.launch, u = Math.min(1, G.t / 0.42);
      const z = L.z0 + L.far * u, y = L.y0 + L.h * Math.sin(u * Math.PI * 0.5) * (G.result.quality === 'weak' ? 0.2 : 1), x = L.x0 + L.vx * u;
      G.trail1.push(proj(x, Math.max(0.05, y), z)); if (G.trail1.length > 12) G.trail1.shift();
      if (u >= 1) {
        G.view = 'side'; G.cut = 0.5; G.phase = 'flight'; G.t = 0; G.trail = [];
        G.camMin = -4; G.camMax = 21; G.camFrom = [G.camMin, G.camMax];
        G.flight = (1.0 + Math.min(1.4, G.result.d / 160)) / Math.sqrt(G.sp);
      }
    } else if (G.phase === 'flight') {
      const r = G.result;
      const u = Math.min(1, 0.08 + G.t / G.flight);
      const fz = H.fenceOf(st);
      const target = H.STADIUMS[st.stadium].out ? Math.max(r.d * 1.2 + 10, Math.min(fz * 1.1, r.d * 4), 190) : Math.max(fz + 14, r.d + 10);
      const cu = Math.min(1, G.t / G.flight / 0.4), e = 1 - Math.pow(1 - cu, 3);
      G.camMin = G.camFrom[0] + (-4 - G.camFrom[0]) * e;
      G.camMax = G.camFrom[1] + (target - G.camFrom[1]) * e;
      G.ballVis = true;
      if (r.quality === 'weak') {
        G.ballX = 0.2 + r.d * (1 - Math.pow(1 - u, 2));
        G.ballY = Math.abs(Math.sin(u * Math.PI * 3)) * (1 - u) * 1.6;
      } else {
        G.ballX = 0.2 + r.d * u;
        const apex = Math.max(6, r.d * (r.hr ? 0.3 : 0.22));
        G.ballY = 0.9 * (1 - u) + 4 * apex * u * (1 - u);
      }
      G.trail.push([G.ballX, G.ballY]); if (G.trail.length > 14) G.trail.shift();
      if (u >= 1) { G.phase = 'result'; G.t = 0; landed(); }
    } else if (G.phase === 'result') {
      if (G.t >= 0.8 / G.sp) { G.phase = 'reset'; G.t = 0; G.camFrom = [G.camMin, G.camMax]; G.ballVis = false; }
    } else if (G.phase === 'reset') {
      const u = Math.min(1, G.t / (0.3 / G.sp)), e = u * u * (3 - 2 * u);
      G.camMin = G.camFrom[0] + (-4 - G.camFrom[0]) * e;
      G.camMax = G.camFrom[1] + (21 - G.camFrom[1]) * e;
      if (u >= 1) { startPitch(); G.cut = 0.4; }
    } else if (G.phase === 'call') {
      if (G.t >= 0.8 / G.sp) startPitch();
    }
  }

  // ---------- 그리기 공통 ----------
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt)), b = Math.max(0, Math.min(255, (n & 255) + amt));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function draw() {
    ctx.save();
    if (G.shake > 0) { const k = Math.min(1, G.shake / 0.3) * 9; ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k); }
    if (G.view === '1p') draw1P(); else drawSide();
    // 파티클
    for (const p of G.fx) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c;
      if (p.conf) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    // 텍스트
    let ny = 0;
    for (const t of G.texts) {
      if (t.t < 0) continue;
      const u = t.t / t.life;
      const s = t.big ? (u < 0.15 ? 0.5 + u / 0.15 * 0.7 : 1.2 - Math.min(0.2, (u - 0.15))) : (u < 0.1 ? 1.4 - u * 4 : 1);
      const baseY = t.big ? Hh * 0.38 : Hh * 0.2 + ny * 28;
      if (!t.big) ny++;
      ctx.save(); ctx.translate(W / 2, baseY - u * 18); ctx.scale(s, s);
      ctx.globalAlpha = u > 0.75 ? (1 - u) / 0.25 : 1;
      ctx.font = t.size + 'px Jua'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText(t.s, 0, 0); ctx.fillStyle = t.color; ctx.fillText(t.s, 0, 0);
      ctx.restore();
    }
    ctx.restore();
    if (G.flash > 0) { ctx.globalAlpha = Math.min(1, G.flash); ctx.fillStyle = G.flashC; ctx.fillRect(0, 0, W, Hh); ctx.globalAlpha = 1; }
    if (G.cut > 0) { ctx.globalAlpha = Math.min(1, G.cut); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, Hh); ctx.globalAlpha = 1; }
  }

  // ---------- 1인칭 ----------
  function draw1P() {
    const S = H.STADIUMS[st.stadium];
    const hy = hy1(), fever = G.fever > nowS();
    ctx.save();
    if (G.zoom > 0) { const z = 1 + G.zoom * 0.06; ctx.translate(W / 2, Hh * 0.55); ctx.scale(z, z); ctx.translate(-W / 2, -Hh * 0.55); }
    // 하늘
    const sk = ctx.createLinearGradient(0, 0, 0, hy);
    sk.addColorStop(0, fever ? '#ff7a2a' : S.sky[0]); sk.addColorStop(1, fever ? '#ffd27a' : S.sky[1]);
    ctx.fillStyle = sk; ctx.fillRect(-20, -20, W + 40, hy + 20);
    if (S.night || S.moon) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 30; i++) { const x = (i * 97.3 + G.crowdSeed) % W, y = (i * 37.7) % (hy * 0.5); ctx.globalAlpha = 0.3 + (i % 3) * 0.2; ctx.fillRect(x, y, 1.5, 1.5); }
      ctx.globalAlpha = 1;
      for (const fx of [0.08, 0.92]) {
        const x = W * fx; ctx.fillStyle = '#fffbe0'; ctx.fillRect(x - 16, hy * 0.12, 32, 9);
        const lg = ctx.createRadialGradient(x, hy * 0.16, 2, x, hy * 0.16, 80); lg.addColorStop(0, 'rgba(255,250,200,.5)'); lg.addColorStop(1, 'rgba(255,250,200,0)');
        ctx.fillStyle = lg; ctx.fillRect(x - 80, hy * 0.16 - 80, 160, 160);
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (const c of G.clouds) {
        const x = ((c.x * W * 1.4 + performance.now() * 0.006) % (W * 1.4)) - W * 0.2, y = c.y * hy * 0.8;
        ctx.beginPath(); ctx.ellipse(x, y, 26 * c.s, 9 * c.s, 0, 0, 7); ctx.ellipse(x + 15 * c.s, y - 6 * c.s, 17 * c.s, 8 * c.s, 0, 0, 7); ctx.fill();
      }
    }
    if (S.moon) { ctx.fillStyle = '#4b8bd6'; ctx.beginPath(); ctx.arc(W * 0.82, hy * 0.3, 18, 0, 7); ctx.fill(); }
    // 외야 배경 그림 (있으면)
    const bgImg = getBg(st.stadium);
    if (bgImg) {
      const sc2 = Math.max(W / bgImg.width, (hy + 2) / bgImg.height);
      const dw = bgImg.width * sc2, dh = bgImg.height * sc2;
      ctx.drawImage(bgImg, (W - dw) / 2, hy + 2 - dh, dw, dh);
      if (fever) { ctx.fillStyle = 'rgba(255,140,40,.25)'; ctx.fillRect(0, 0, W, hy); }
    }
    // 외야 관중석
    const standH = bgImg ? 0 : Math.max(26, hy * 0.42);
    if (standH) { ctx.fillStyle = S.moon ? '#2b2f3e' : '#2c3b58'; ctx.fillRect(-20, hy - standH, W + 40, standH); }
    const cols = ['#ff6b6b', '#ffd84a', '#5bb8ff', '#ffffff', '#4cd97b', '#ff9f55'];
    let k = 0;
    void cols; void k;
    if (standH) { ctx.globalAlpha = 0.75; ctx.fillStyle = crowdPattern(5, 6, 3); ctx.fillRect(-4, hy - standH + 4, W + 8, standH - 12); }
    ctx.globalAlpha = 1;
    // 펜스 + 전광판
    if (!bgImg) { ctx.fillStyle = S.moon ? '#5a5f70' : '#1f6b3a'; ctx.fillRect(-20, hy - 7, W + 40, 7); ctx.fillStyle = '#ffd84a'; ctx.fillRect(-20, hy - 7, W + 40, 1.5); }
    else { ctx.fillStyle = 'rgba(0,0,0,.35)'; roundRect(W / 2 - 34, hy - 15, 68, 14, 5); ctx.fill(); }
    ctx.font = '10px Jua'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(S.out ? '목표 ' + H.fmtDist(S.fence) : S.fence + 'm', W / 2, hy - (bgImg ? 4.5 : 0.5));
    // 잔디
    const gg = ctx.createLinearGradient(0, hy, 0, Hh);
    gg.addColorStop(0, shade(S.grass, -10)); gg.addColorStop(1, shade(S.grass, 18));
    ctx.fillStyle = gg; ctx.fillRect(-20, hy, W + 40, Hh - hy + 20);
    // 잔디 줄무늬 (원근)
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = -8; i < 8; i += 2) {
      const a = proj(i * 6, 0, 200), b = proj((i + 1) * 6, 0, 200), c = proj((i + 1) * 6, 0, -1.5), d = proj(i * 6, 0, -1.5);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.fill();
    }
    // 내야 흙 (마운드, 타석)
    const dirt = S.moon ? '#6d6f78' : '#c58b55';
    ctx.fillStyle = dirt;
    const m0 = proj(0, 0, 18.4), mr = proj(2.8, 0, 18.4);
    ctx.beginPath(); ctx.ellipse(m0[0], m0[1], mr[0] - m0[0], (mr[0] - m0[0]) * 0.18, 0, 0, 7); ctx.fill();
    // 홈 주변 흙: 원을 원근으로
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; const q = proj(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2 + 0.2); if (i === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]); }
    ctx.fill();
    // 파울 라인
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
    for (const sgn of [-1, 1]) { const a = proj(0, 0, 0), b = proj(sgn * 80, 0, 80); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    // 타석 박스
    ctx.lineWidth = 1.5;
    for (const sgn of [-1, 1]) {
      const c = [proj(sgn * 0.35, 0, -0.9), proj(sgn * 1.55, 0, -0.9), proj(sgn * 1.55, 0, 0.9), proj(sgn * 0.35, 0, 0.9)];
      ctx.beginPath(); ctx.moveTo(c[0][0], c[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(c[i][0], c[i][1]); ctx.closePath(); ctx.stroke();
    }
    // 홈플레이트
    ctx.fillStyle = '#fff';
    const hp = [proj(-0.215, 0, 0.215), proj(0.215, 0, 0.215), proj(0.215, 0, 0), proj(0, 0, -0.215), proj(-0.215, 0, 0)];
    ctx.beginPath(); ctx.moveTo(hp[0][0], hp[0][1]); for (let i = 1; i < 5; i++) ctx.lineTo(hp[i][0], hp[i][1]); ctx.closePath(); ctx.fill();

    // 투수
    drawPitcherFront();

    // 스트라이크 존
    const p = G.pitch;
    const z0 = proj(-ZW, ZC + ZH, 0), z1 = proj(ZW, ZC - ZH, 0);
    const zx = z0[0], zy = z0[1], zw = z1[0] - z0[0], zh = z1[1] - z0[1];
    const active = G.phase === 'pitch' && G.swingT < 0;
    ctx.fillStyle = active ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.04)';
    ctx.fillRect(zx, zy, zw, zh);
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(zx + zw * i / 3, zy); ctx.lineTo(zx + zw * i / 3, zy + zh); ctx.stroke(); ctx.beginPath(); ctx.moveTo(zx, zy + zh * i / 3); ctx.lineTo(zx + zw, zy + zh * i / 3); ctx.stroke(); }
    ctx.strokeStyle = active ? 'rgba(255,225,77,.95)' : 'rgba(255,255,255,.6)'; ctx.lineWidth = 2;
    ctx.strokeRect(zx, zy, zw, zh);

    // 판정 표시 (콜)
    if (G.phase === 'call' && G.call) {
      const tg = pitchTarget(G.call.p), q = proj(tg.x, tg.y, 0);
      const col = G.call.p.strike ? '#ff6b6b' : '#5bd8ff';
      ctx.fillStyle = col; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(5, 0.037 * q[2] * 2.2), 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
    }

    // 공 (투구 중)
    if (G.ballVis && G.phase === 'pitch') {
      const b = ball3(p, G.t);
      if (b.z > -1.3) {
        const s = proj(b.x, b.y, b.z), br = Math.max(1.6, 0.037 * s[2] * 2.2);
        const sh = proj(b.x, 0, b.z);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(sh[0], sh[1], br, br * 0.35, 0, 0, 7); ctx.fill();
        for (let i = 0; i < G.trail1.length - 1; i++) {
          const [tx, ty, ts] = G.trail1[i];
          ctx.fillStyle = `rgba(255,255,255,${(i / G.trail1.length) * 0.3})`;
          ctx.beginPath(); ctx.arc(tx, ty, Math.max(1, 0.037 * ts * 2.2) * (i / G.trail1.length), 0, 7); ctx.fill();
        }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s[0], s[1], br, 0, 7); ctx.fill();
        ctx.strokeStyle = '#d33'; ctx.lineWidth = Math.max(0.6, br * 0.15);
        ctx.beginPath(); ctx.arc(s[0] - br * 0.5, s[1], br * 0.7, -0.9, 0.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(s[0] + br * 0.5, s[1], br * 0.7, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
        // 타이밍 링
        if (G.swingT < 0 && !G.autoTake) {
          const left = Math.max(0, p.t - G.t) / p.t;
          const perfect = Math.abs(G.t - p.t) <= H.perfectWindow(st);
          ctx.strokeStyle = perfect ? '#ffe14d' : `rgba(255,255,255,${0.35 + (1 - left) * 0.5})`; ctx.lineWidth = perfect ? 3 : 2;
          ctx.beginPath(); ctx.arc(s[0], s[1], br + 4 + left * 44, 0, 7); ctx.stroke();
        }
      }
    }
    // 1인칭 발사 연출
    if (G.phase === 'launch' && G.launch) {
      for (let i = 0; i < G.trail1.length; i++) {
        const [tx, ty, ts] = G.trail1[i], a = i / G.trail1.length;
        ctx.fillStyle = G.result && G.result.special ? `rgba(255,210,60,${a * 0.6})` : `rgba(255,255,255,${a * 0.5})`;
        ctx.beginPath(); ctx.arc(tx, ty, Math.max(1.5, 0.037 * ts * 2.6) * (0.4 + a * 0.6), 0, 7); ctx.fill();
      }
      const last = G.trail1[G.trail1.length - 1];
      if (last) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(last[0], last[1], Math.max(1.5, 0.037 * last[2] * 2.6), 0, 7); ctx.fill(); }
    }
    // 임팩트
    if (G.impact && G.impact.t < 0.35) {
      const I = G.impact, u = I.t / 0.35, big = I.q === 'perfect';
      ctx.strokeStyle = `rgba(255,255,255,${1 - u})`; ctx.lineWidth = big ? 5 * (1 - u) + 1 : 3 * (1 - u) + 1;
      ctx.beginPath(); ctx.arc(I.x, I.y, 6 + u * (big ? 70 : 40), 0, 7); ctx.stroke();
      if (big) {
        ctx.strokeStyle = `rgba(255,236,120,${1 - u})`; ctx.lineWidth = 2.5;
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2 + 0.2, r0 = 10 + u * 30, r1 = r0 + 18 + (i % 2) * 14;
          ctx.beginPath(); ctx.moveTo(I.x + Math.cos(a) * r0, I.y + Math.sin(a) * r0); ctx.lineTo(I.x + Math.cos(a) * r1, I.y + Math.sin(a) * r1); ctx.stroke();
        }
      }
    }
    // 타자 (등 뒤 시점)
    drawBatterBack();
    ctx.restore();
    // 볼카운트
    drawCount();
    drawIntro();
  }

  function drawModeBanner() {
    const p = G.pitch;
    if (p && (G.phase === 'pitch' || G.phase === 'call') && p.type && !p.meat) {
      const lbl = H.PITCH_TYPES[p.type].name + ' ' + p.kmh + 'km/h';
      ctx.font = '13px Jua'; ctx.textAlign = 'center'; const tw = ctx.measureText(lbl).width + 16;
      ctx.fillStyle = 'rgba(5,15,35,.6)'; roundRect(W / 2 - tw / 2, 36, tw, 20, 8); ctx.fill();
      ctx.fillStyle = p.type === 'fast' ? '#ffd0a0' : '#c8b4ff'; ctx.fillText(lbl, W / 2, 50);
    }
    if (G.mode === 'normal') return;
    let txt;
    if (G.mode === 'derby') txt = '⚾ 홈런 더비 ' + Math.min(H.DERBY_N, G.derby.n + 1) + '/' + H.DERBY_N + ' · 홈런 ' + G.derby.hr;
    else txt = 'VS ' + H.BOSSES[G.boss.i].name + ' · 홈런 ' + G.boss.hr + '/' + H.BOSS_HR + ' · 아웃 ' + '●'.repeat(G.boss.outs) + '○'.repeat(H.BOSS_OUTS - G.boss.outs);
    ctx.font = '14px Jua'; ctx.textAlign = 'left'; const w2 = ctx.measureText(txt).width + 18;
    ctx.fillStyle = G.mode === 'boss' ? 'rgba(120,20,30,.85)' : 'rgba(20,70,140,.85)'; roundRect(8, 10, Math.min(w2, W - 112), 24, 9); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(txt, 17, 27, W - 130);
  }
  function drawCount() {
    drawModeBanner();
    const c = st.count || { b: 0, s: 0 };
    const x = W - 96, y = 10;
    ctx.fillStyle = 'rgba(5,15,30,.6)'; roundRect(x, y, 86, 42, 9); ctx.fill();
    ctx.font = '13px Jua'; ctx.textAlign = 'left';
    ctx.fillStyle = '#9fe8ff'; ctx.fillText('B', x + 8, y + 17);
    ctx.fillStyle = '#ffb0b0'; ctx.fillText('S', x + 8, y + 35);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i < c.b ? '#4cd97b' : 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(x + 30 + i * 16, y + 12, 5.5, 0, 7); ctx.fill(); }
    for (let i = 0; i < 2; i++) { ctx.fillStyle = i < c.s ? '#ffcf3a' : 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(x + 30 + i * 16, y + 30, 5.5, 0, 7); ctx.fill(); }
    if (st.eyeCombo > 0) {
      ctx.fillStyle = 'rgba(20,90,80,.75)'; roundRect(x - 18, y + 47, 104, 22, 8); ctx.fill();
      ctx.fillStyle = '#7fffd4'; ctx.font = '12px Jua'; ctx.fillText('선구안 +' + st.eyeCombo * 10 + '% 비거리', x - 10, y + 62);
    }
    if (G.pitch && G.pitch.meat && G.phase !== 'launch') {
      ctx.fillStyle = 'rgba(120,70,0,.75)'; roundRect(W / 2 - 45, y, 90, 22, 8); ctx.fill();
      ctx.fillStyle = '#ffcf6b'; ctx.font = '12px Jua'; ctx.textAlign = 'center'; ctx.fillText('실투 찬스!', W / 2, y + 15);
    }
    const auto = st.auto && nowS() > G.manualUntil;
    ctx.textAlign = 'right'; ctx.font = '11px Jua'; ctx.fillStyle = auto ? 'rgba(180,255,200,.85)' : 'rgba(255,230,150,.9)';
    ctx.fillText(auto ? '자동 타격 중' : '직접 타격 중', W - 10, Hh - 10);
  }

  function drawPitcherFront() {
    const base = proj(0, 0, 18.4), s = base[2] * 1.35;
    const x = base[0], gy = base[1], h = 1.9 * s;
    if (G.mode === 'boss' && ART.boss) {
      const im = ART.boss[H.BOSSES[G.boss.i].spr], dh = h * 1.2, dw = dh * im.width / im.height;
      const bob = G.phase === 'windup' ? Math.sin(G.t * 14) * 2 : 0;
      ctx.drawImage(im, x - dw / 2, gy - dh + bob, dw, dh);
      return;
    }
    if (ART.pitcher) {
      let fi = 0;
      if (G.phase === 'windup') { const u = G.t / (0.8 / G.sp); fi = u < 0.3 ? 0 : u < 0.68 ? 1 : 2; }
      else if (G.phase === 'pitch' || G.phase === 'call' || G.phase === 'launch') fi = G.phase === 'pitch' && G.t < 0.04 ? 2 : 3;
      const tf = teamFrames(H.pitcherOf(st.stadium).color), im = (tf.front || ART.pitcher)[fi], c = ART.cal.pitcher, dh = h * (c.scale || 1.25), dw = dh * im.width / im.height;
      ctx.drawImage(im, x - dw * (c.footX || 0.5), gy - dh * (c.footY || 1), dw, dh);
      return;
    }
    let leg = 0, arm = 0.2;
    if (G.phase === 'windup') { const u = G.t / (0.8 / G.sp); leg = Math.sin(Math.min(1, u * 1.3) * Math.PI) * 1; arm = -0.3 - u * 2.2; }
    else if (G.phase === 'pitch') { const u = Math.min(1, G.t / 0.12); arm = -2.5 + u * 4.2; }
    else arm = 1.4;
    const lw = Math.max(2, h * 0.1);
    ctx.lineCap = 'round';
    // 다리
    ctx.strokeStyle = '#e4e4e4'; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x - h * 0.06, gy - h * 0.4); ctx.lineTo(x - h * 0.1, gy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + h * 0.06, gy - h * 0.4); ctx.lineTo(x + h * 0.1 + leg * h * 0.12, gy - leg * h * 0.28); ctx.stroke();
    // 몸
    ctx.fillStyle = '#f4f4f4'; roundRect(x - h * 0.16, gy - h * 0.74, h * 0.32, h * 0.38, h * 0.07); ctx.fill();
    ctx.fillStyle = '#c0392b'; ctx.fillRect(x - h * 0.16, gy - h * 0.52, h * 0.32, h * 0.03);
    // 글러브 팔
    ctx.strokeStyle = '#ffd7b0'; ctx.lineWidth = lw * 0.7;
    ctx.beginPath(); ctx.moveTo(x - h * 0.14, gy - h * 0.68); ctx.lineTo(x - h * 0.22, gy - h * 0.55); ctx.stroke();
    ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); ctx.arc(x - h * 0.23, gy - h * 0.53, h * 0.07, 0, 7); ctx.fill();
    // 던지는 팔
    const sx0 = x + h * 0.14, sy0 = gy - h * 0.68, L = h * 0.3;
    ctx.strokeStyle = '#ffd7b0';
    ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx0 + Math.cos(arm) * L * 0.6, sy0 + Math.sin(arm) * L); ctx.stroke();
    if (G.phase === 'windup') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx0 + Math.cos(arm) * L * 0.6, sy0 + Math.sin(arm) * L, Math.max(1.5, h * 0.035), 0, 7); ctx.fill(); }
    // 머리
    const hr = h * 0.15, hy = gy - h * 0.86;
    ctx.fillStyle = '#ffd7b0'; ctx.beginPath(); ctx.arc(x, hy, hr, 0, 7); ctx.fill();
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(x, hy - hr * 0.15, hr * 1.05, Math.PI, 0); ctx.fill();
    ctx.fillRect(x - hr * 1.1, hy - hr * 0.2, hr * 2.2, hr * 0.3);
    ctx.fillStyle = '#222'; ctx.fillRect(x - hr * 0.45, hy + hr * 0.1, hr * 0.18, hr * 0.22); ctx.fillRect(x + hr * 0.27, hy + hr * 0.1, hr * 0.18, hr * 0.22);
  }

  // 방망이 방향: 0 = 장전, 1 = 임팩트(공을 향함), 2 = 팔로스루
  function nrm(v) { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; }
  function mix(a, b, t) { return nrm({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }); }
  const COCK = nrm({ x: -0.15, y: 0.92, z: -0.38 });
  const COCK_SPR = nrm({ x: 0.3, y: 0.92, z: -0.25 });
  const FOLLOW = nrm({ x: -0.55, y: 0.62, z: 0.45 });
  function batDir(k, hands) {
    const p = G.pitch, tg = p ? pitchTarget(p) : { x: 0, y: ZC };
    const hit = nrm({ x: tg.x + 0.05 - hands.x, y: tg.y - hands.y, z: 0.05 - hands.z });
    if (k <= 1) return mix(ART.batter ? COCK_SPR : COCK, hit, k * k);
    const e = 1 - Math.pow(1 - Math.min(1, k - 1), 2);
    const mid = nrm({ x: 0.35, y: 0.1, z: 0.9 });
    return e < 0.5 ? mix(hit, mid, e * 2) : mix(mid, FOLLOW, (e - 0.5) * 2);
  }
  // 구장별 투수 팀 색: 빨간 모자·라인 픽셀만 팀 색으로 바꿔 칠한다
  const TEAMC = {};
  function recolorRed(im, hex) {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    const tr = parseInt(hex.slice(1, 3), 16), tg = parseInt(hex.slice(3, 5), 16), tb = parseInt(hex.slice(5, 7), 16);
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], g = p[i + 1], b = p[i + 2];
      if (p[i + 3] === 0 || r < 120 || r - Math.max(g, b) < 55 || g > 120) continue;
      const k = Math.min(1.25, r / 205);
      p[i] = Math.min(255, tr * k); p[i + 1] = Math.min(255, tg * k); p[i + 2] = Math.min(255, tb * k);
    }
    x.putImageData(d, 0, 0); return c;
  }
  function teamFrames(hex) {
    if (TEAMC[hex]) return TEAMC[hex];
    TEAMC[hex] = { front: ART.pitcher ? ART.pitcher.map((im) => recolorRed(im, hex)) : null, side: ART.side ? recolorRed(ART.side[1], hex) : null };
    return TEAMC[hex];
  }
  function startIntro() { if (G.mode === 'normal') G.intro = { t0: nowS(), s: st.stadium }; }
  function drawIntro() {
    const I = G.intro; if (!I) return;
    const u = nowS() - I.t0; if (u > 2.8 || I.s !== st.stadium) { G.intro = null; return; }
    const a = u < 0.25 ? u / 0.25 : u > 2.4 ? (2.8 - u) / 0.4 : 1;
    const P = H.pitcherOf(I.s), types = H.pitchTypesFor(I.s).map((t) => H.PITCH_TYPES[t].name).join(' ');
    const w = Math.min(W - 112, 300), x = 8, y = 8;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(5,15,35,.82)'; roundRect(x, y, w, 64, 12); ctx.fill();
    ctx.fillStyle = P.color; roundRect(x, y, 8, 64, 4); ctx.fill();
    ctx.textAlign = 'left'; ctx.font = '12px Jua'; ctx.fillStyle = '#a9c2e0'; ctx.fillText('상대 투수', x + 18, y + 18);
    ctx.font = '19px Jua'; ctx.fillStyle = '#fff'; ctx.fillText(P.name, x + 18, y + 40);
    ctx.font = '12px Jua'; ctx.fillStyle = '#ffd84a'; ctx.fillText('평균 구속 ' + H.avgKmh(I.s) + 'km/h · ' + types, x + 18, y + 57, w - 24);
    ctx.restore();
  }

  // 방망이를 실제로 쥔 타자 그림(초록 방망이)을 장착 등급 색으로 바꿔 칠한다
  const HOLDC = {};
  function holdFrames(g) {
    if (HOLDC[g]) return HOLDC[g];
    const G2 = H.GRADES[g], hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const lc = hex(G2.color), dc = hex(G2.dark);
    HOLDC[g] = ART.hold.map((im) => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const m = document.createElement('canvas'); m.width = im.width; m.height = im.height; const mx = m.getContext('2d');
      const d = x.getImageData(0, 0, c.width, c.height), md = mx.createImageData(c.width, c.height), p = d.data, q = md.data;
      for (let i = 0; i < p.length; i += 4) {
        const r = p[i], gg = p[i + 1], bb = p[i + 2];
        const t = Math.max(0, Math.min(1, (gg - Math.max(r, bb) - 40) / 140));
        if (t <= 0 || p[i + 3] === 0) continue;
        const k = 0.35 + 0.65 * t; // 가장자리는 어둡게
        const nr = dc[0] + (lc[0] - dc[0]) * k, ng = dc[1] + (lc[1] - dc[1]) * k, nb = dc[2] + (lc[2] - dc[2]) * k;
        p[i] = r + (nr - r) * Math.min(1, t * 1.6); p[i + 1] = gg + (ng - gg) * Math.min(1, t * 1.6); p[i + 2] = bb + (nb - bb) * Math.min(1, t * 1.6);
        q[i] = nr; q[i + 1] = ng; q[i + 2] = nb; q[i + 3] = t > 0.4 ? 255 : 0;
      }
      x.putImageData(d, 0, 0); mx.putImageData(md, 0, 0);
      return { img: c, bat: m };
    });
    return HOLDC[g];
  }
  function drawBatterHold(kk) {
    const bx = -0.95, bz = 0.45;
    const f = proj(bx, 0, bz), s = f[2];
    const fi = kk < 0.35 ? 0 : kk < 0.8 ? 1 : kk < 1.5 ? 2 : 3;
    const b = H.equipped(st), fr = holdFrames(b.g)[fi], c = ART.cal.hold;
    const dh = 1.85 * s * (c.scale || 1), dw = dh * fr.img.width / fr.img.height;
    const x0 = f[0] - dw * c.footX[fi], y0 = f[1] - dh * 0.97;
    // 휘두르는 궤적
    if (kk > 0.25 && kk < 1.7 && (G.phase === 'pitch' || G.phase === 'launch')) {
      const cx = x0 + dw * c.footX[fi], cy = y0 + dh * 0.42, R = dh * 0.55;
      const a0 = Math.PI * 1.05, a1 = Math.PI * (1.05 + Math.min(1, kk / 1.3) * 0.95);
      const gr2 = ctx.createLinearGradient(cx - R, cy, cx + R, cy); gr2.addColorStop(0, 'rgba(255,255,255,0)'); gr2.addColorStop(1, 'rgba(255,255,255,.45)');
      ctx.strokeStyle = gr2; ctx.lineWidth = dh * 0.09; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.45, 0, a0, a1); ctx.stroke();
    }
    ctx.drawImage(fr.img, x0, y0, dw, dh);
    if (b.e >= 10) { ctx.save(); ctx.shadowColor = H.GRADES[b.g].color; ctx.shadowBlur = 16; ctx.drawImage(fr.bat, x0, y0, dw, dh); ctx.restore(); }
  }
  function drawBatterBack() {
    const bx = -0.95, bz = 0.45;
    const f = proj(bx, 0, bz), s = f[2];
    const sh = proj(bx, 1.42, bz), hd = proj(bx, 1.66, bz), wa = proj(bx, 0.95, bz);
    const k = (() => {
      if (G.swingT < 0) return G.phase === 'pitch' ? -Math.sin(G.t * 9) * 0.03 : 0;
      const el = G.phase === 'pitch' ? G.t - G.swingT : 1;
      if (G.phase === 'pitch') return Math.min(2, el / 0.075);
      return 2;
    })();
    const kk = G.phase === 'launch' ? 1 + Math.min(1, G.t / 0.12) : (G.phase === 'call' && G.call && G.call.swung) ? 2 : Math.max(0, k);
    if (ART.hold && ART.cal && ART.cal.hold) { drawBatterHold(kk); return; }
    // 몸통 회전량
    const twist = Math.max(0, Math.min(1, kk)) * 0.35;
    const bw = 0.5 * s;
    const SPR = ART.batter;
    let handScr = null, sprDraw = null;
    if (SPR) {
      const c = ART.cal.batter, fi = kk < 0.55 ? 0 : kk < 1.45 ? 1 : 2, im = SPR[fi];
      const dh = 1.85 * s * (c.scale || 1.1), dw = dh * im.width / im.height;
      const x0 = f[0] - dw * (c.footX || 0.5), y0 = f[1] - dh * (c.footY || 1);
      // 몸은 방망이 다음에 그려서 장갑이 손잡이를 감싸 쥔 것처럼 보이게 한다
      sprDraw = () => ctx.drawImage(im, x0, y0, dw, dh);
      handScr = [x0 + dw * c.hands[fi][0], y0 + dh * c.hands[fi][1]];
    }
    // 다리 (화면 아래로 잘림)
    if (!SPR) {
    ctx.fillStyle = '#d9e2ef';
    roundRect(wa[0] - bw * 0.42, wa[1], bw * 0.36, Hh, bw * 0.1); ctx.fill();
    roundRect(wa[0] + bw * 0.06, wa[1], bw * 0.36, Hh, bw * 0.1); ctx.fill();
    // 몸통 (등)
    ctx.fillStyle = '#eef3fa';
    ctx.beginPath();
    ctx.moveTo(sh[0] - bw * 0.55 + twist * bw * 0.3, sh[1]);
    ctx.lineTo(sh[0] + bw * 0.55 + twist * bw * 0.3, sh[1] + twist * bw * 0.05);
    ctx.lineTo(wa[0] + bw * 0.42, wa[1] + bw * 0.1);
    ctx.lineTo(wa[0] - bw * 0.42, wa[1] + bw * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1d4f91'; ctx.font = Math.round(bw * 0.55) + 'px Jua'; ctx.textAlign = 'center';
    ctx.fillText('7', (sh[0] + wa[0]) / 2 + twist * bw * 0.15, (sh[1] + wa[1]) / 2 + bw * 0.2);
    ctx.fillStyle = '#1d4f91'; ctx.fillRect(wa[0] - bw * 0.42, wa[1] - bw * 0.02, bw * 0.84, bw * 0.08);
    }
    // 방망이
    const hands = { x: bx + 0.22 + twist * 0.2, y: 1.25 - Math.min(1, kk) * 0.28, z: bz - 0.05 + twist * 0.15 };
    const L = SPR ? 0.74 : 0.86;
    const dir = batDir(kk, hands);
    const tip = { x: hands.x + dir.x * L, y: hands.y + dir.y * L, z: hands.z + dir.z * L };
    const kb = SPR ? 0.16 : 0.08; // 그림 타자: 손잡이 끝이 장갑 아래로 살짝 보이게
    const knob = { x: hands.x - dir.x * kb, y: hands.y - dir.y * kb, z: hands.z - dir.z * kb };
    const ph = proj(hands.x, hands.y, hands.z), pt = proj(tip.x, tip.y, tip.z), pk = proj(knob.x, knob.y, knob.z);
    if (handScr) { const ox = handScr[0] - ph[0], oy = handScr[1] - ph[1]; for (const q of [ph, pt, pk]) { q[0] += ox; q[1] += oy; } }
    // 스윙 궤적
    if (G.swingT >= 0 && G.phase === 'pitch') {
      G.batTrail.push([ph[0], ph[1], pt[0], pt[1]]); if (G.batTrail.length > 7) G.batTrail.shift();
    }
    if (G.batTrail.length > 1 && (G.phase === 'pitch' || G.phase === 'launch')) {
      const fade = G.phase === 'launch' ? Math.max(0, 1 - G.t / 0.25) : 1;
      for (let i = 1; i < G.batTrail.length; i++) {
        const a = G.batTrail[i - 1], b = G.batTrail[i];
        ctx.fillStyle = `rgba(255,255,255,${0.08 * i * fade})`;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[2], a[3]); ctx.lineTo(b[2], b[3]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill();
      }
    }
    const b = H.equipped(st), gr = H.GRADES[b.g];
    const wTip = Math.max(SPR ? 5 : 3, (SPR ? 0.085 : 0.07) * pt[2]), wH = Math.max(SPR ? 3 : 2, (SPR ? 0.036 : 0.028) * ph[2]);
    const ang = Math.atan2(pt[1] - pk[1], pt[0] - pk[0]), nx = -Math.sin(ang), ny = Math.cos(ang);
    const grd = ctx.createLinearGradient(pk[0] + nx * wTip, pk[1] + ny * wTip, pk[0] - nx * wTip, pk[1] - ny * wTip);
    grd.addColorStop(0, '#fff'); grd.addColorStop(0.35, gr.color); grd.addColorStop(1, gr.dark);
    ctx.fillStyle = grd;
    if (b.e >= 10) { ctx.shadowColor = gr.color; ctx.shadowBlur = 14; }
    ctx.beginPath();
    ctx.moveTo(pk[0] + nx * wH / 2, pk[1] + ny * wH / 2);
    ctx.lineTo(pt[0] + nx * wTip / 2, pt[1] + ny * wTip / 2);
    ctx.arc(pt[0], pt[1], wTip / 2, ang + Math.PI / 2, ang - Math.PI / 2, true);
    ctx.lineTo(pk[0] - nx * wH / 2, pk[1] - ny * wH / 2);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    if (SPR) {
      // 그립 테이프와 손잡이 끝(노브)
      const gx = pk[0] + (pt[0] - pk[0]) * 0.24, gy2 = pk[1] + (pt[1] - pk[1]) * 0.24;
      ctx.strokeStyle = '#2a2a2a'; ctx.lineCap = 'butt'; ctx.lineWidth = wH * 1.05;
      ctx.beginPath(); ctx.moveTo(pk[0], pk[1]); ctx.lineTo(gx, gy2); ctx.stroke();
      ctx.fillStyle = gr.dark; ctx.beginPath(); ctx.ellipse(pk[0], pk[1], wH * 0.95, wH * 0.75, ang, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.stroke();
      sprDraw();
      return;
    }
    // 팔
    ctx.strokeStyle = '#ffd7b0'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(3, bw * 0.16);
    ctx.beginPath(); ctx.moveTo(sh[0] - bw * 0.4 + twist * bw * 0.3, sh[1] + bw * 0.08); ctx.lineTo(ph[0], ph[1]); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sh[0] + bw * 0.42 + twist * bw * 0.3, sh[1] + bw * 0.08); ctx.lineTo(ph[0], ph[1]); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(ph[0], ph[1], Math.max(3, bw * 0.1), 0, 7); ctx.fill();
    // 헬멧 (뒤통수)
    const hr = 0.135 * s;
    ctx.fillStyle = '#1d4f91'; ctx.beginPath(); ctx.arc(hd[0] + twist * bw * 0.2, hd[1], hr, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(hd[0] - hr * 0.35 + twist * bw * 0.2, hd[1] - hr * 0.35, hr * 0.35, 0, 7); ctx.fill();
    ctx.fillStyle = '#163d70'; ctx.beginPath(); ctx.arc(hd[0] + hr * 0.75 + twist * bw * 0.2, hd[1] + hr * 0.2, hr * 0.45, 0, 7); ctx.fill();
  }

  // ---------- 옆 시점 (타구 비행) ----------
  function drawSide() {
    const S = H.STADIUMS[st.stadium];
    const sc = scale(), ys = yScale(), gy = groundY();
    const fever = G.fever > nowS();
    const sk = ctx.createLinearGradient(0, 0, 0, gy);
    sk.addColorStop(0, fever ? '#ff7a2a' : S.sky[0]); sk.addColorStop(1, fever ? '#ffd27a' : S.sky[1]);
    ctx.fillStyle = sk; ctx.fillRect(-10, -10, W + 20, gy + 10);
    if (S.night || S.moon) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 40; i++) { const x = (i * 97.3 + G.crowdSeed) % W, y = (i * 53.7) % (gy * 0.6); ctx.globalAlpha = 0.3 + (i % 3) * 0.2; ctx.fillRect(x, y, 1.5, 1.5); }
      ctx.globalAlpha = 1;
    }
    if (S.moon) { ctx.fillStyle = '#4b8bd6'; ctx.beginPath(); ctx.arc(W * 0.82, gy * 0.25, 26, 0, 7); ctx.fill(); ctx.fillStyle = '#5fbf6a'; ctx.beginPath(); ctx.arc(W * 0.8, gy * 0.23, 10, 0, 7); ctx.fill(); }
    else if (!S.night) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (const c of G.clouds) {
        const x = ((c.x * W * 1.6 - G.camMin * 2 + performance.now() * 0.004) % (W * 1.6)) - W * 0.3, y = c.y * gy;
        ctx.beginPath(); ctx.ellipse(x, y, 30 * c.s, 11 * c.s, 0, 0, 7); ctx.ellipse(x + 18 * c.s, y - 7 * c.s, 20 * c.s, 10 * c.s, 0, 0, 7); ctx.fill();
      }
    } else if (S.out !== 'space') {
      for (const fx of [0.15, 0.85]) {
        const x = W * fx; ctx.fillStyle = '#20263a'; ctx.fillRect(x - 2, gy * 0.15, 4, gy * 0.5);
        ctx.fillStyle = '#fffbe0'; ctx.fillRect(x - 14, gy * 0.12, 28, 10);
        const lg = ctx.createRadialGradient(x, gy * 0.14, 2, x, gy * 0.14, 90); lg.addColorStop(0, 'rgba(255,250,200,.45)'); lg.addColorStop(1, 'rgba(255,250,200,0)');
        ctx.fillStyle = lg; ctx.fillRect(x - 90, gy * 0.14 - 90, 180, 180);
      }
    }
    if (S.dome) { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.ellipse(W / 2, gy * 1.2, W * 0.9, gy * (0.2 * i), 0, Math.PI, 0); ctx.stroke(); } }
    const outImg = S.out ? getOut(S.out) : null;
    if (outImg) {
      const sc3 = Math.max(W / outImg.width, gy / outImg.height), dw = outImg.width * sc3, dh = outImg.height * sc3;
      ctx.drawImage(outImg, (W - dw) / 2, gy - dh, dw, dh);
    } else if (S.out && S.out !== 'parking') drawOutBack(S, gy);
    else if (!S.dome) {
      ctx.fillStyle = S.moon ? '#3a3d4a' : S.night ? '#16224a' : 'rgba(80,150,90,.55)';
      for (let i = 0; i < 5; i++) {
        const x = ((i * 0.27 + 0.1) * W * 1.4 - G.camMin * 0.6) % (W * 1.4) - W * 0.2;
        ctx.beginPath(); ctx.ellipse(x, gy, W * 0.28, gy * 0.16 + (i % 2) * 12, 0, Math.PI, 0); ctx.fill();
      }
    }
    const fence = H.fenceOf(st), wallM = S.out ? 140 : fence, fxp = sx(wallM);
    if (fxp < W + 40) {
      const standTop = gy - Math.max(44, Math.min(gy * 0.32, 14 * ys));
      ctx.fillStyle = S.moon ? '#2b2f3e' : '#30405e';
      const sEnd = S.out ? Math.max(fxp + 26, sx(wallM + 45)) : W + 50;
      ctx.beginPath(); ctx.moveTo(fxp, gy); ctx.lineTo(fxp + 20, standTop); ctx.lineTo(sEnd, standTop - 10); ctx.lineTo(sEnd, gy); ctx.fill();
      const cols = ['#ff6b6b', '#ffd84a', '#5bb8ff', '#ffffff', '#4cd97b', '#ff9f55'];
      let k = 0;
      const jump = G.phase === 'result' && G.result && G.result.hr ? Math.sin(performance.now() / 60) * 2 : 0;
      void cols; void k;
      ctx.save(); ctx.beginPath(); ctx.moveTo(fxp + 6, gy - 6); ctx.lineTo(fxp + 24, standTop + 8); ctx.lineTo(sEnd - 4, standTop - 2); ctx.lineTo(sEnd - 4, gy - 6); ctx.clip();
      ctx.translate(0, jump); ctx.fillStyle = crowdPattern(8, 9, 4); ctx.fillRect(fxp, standTop - 12, Math.min(W + 20, sEnd) - fxp, gy - standTop + 12); ctx.restore();
      const fh = Math.max(16, 3.2 * ys);
      ctx.fillStyle = S.moon ? '#5a5f70' : '#1f6b3a'; ctx.fillRect(fxp - 3, gy - fh, 7, fh);
      ctx.fillStyle = '#ffd84a'; ctx.fillRect(fxp - 3, gy - fh, 7, 3);
      ctx.fillStyle = '#fff'; ctx.font = '13px Jua'; ctx.textAlign = 'center';
      if (!S.out) ctx.fillText(fence + 'm', fxp, gy - fh - 6);
    }
    const gg = ctx.createLinearGradient(0, gy, 0, Hh);
    gg.addColorStop(0, S.grass); gg.addColorStop(1, shade(S.grass, -30));
    ctx.fillStyle = gg; ctx.fillRect(-10, gy, W + 20, Hh - gy + 10);
    const stripe = 10;
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    for (let m = Math.floor(G.camMin / stripe) * stripe; m < G.camMax; m += stripe * 2) ctx.fillRect(sx(m), gy, stripe * sc, Hh - gy);
    if (S.out) drawOutFront(S, gy, sc, wallM, fence);
    ctx.fillStyle = S.moon ? '#6d6f78' : '#c58b55';
    ctx.beginPath(); ctx.ellipse(sx(0.5), gy + 4, 3.2 * sc, 10, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx(18.4), gy + 3, 2.6 * sc, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(sx(0.2) - 6, gy + 2, 12, 3);
    const range = G.camMax - G.camMin;
    const step = niceStep(range / 6);
    ctx.font = '11px Jua'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (let m = step; m < G.camMax; m += step) {
      if (m < G.camMin) continue;
      const x = sx(m); ctx.fillRect(x - 0.5, gy + 6, 1, 6); ctx.fillText(m < 1000 ? Math.round(m) + 'm' : H.fmtDist(m), x, gy + 24);
    }
    if (st.best > 0 && st.best > G.camMin && st.best < G.camMax && range > 30) {
      const x = sx(st.best); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy - 26); ctx.stroke();
      ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.moveTo(x, gy - 26); ctx.lineTo(x + 14, gy - 21); ctx.lineTo(x, gy - 16); ctx.fill();
      ctx.font = '10px Jua'; ctx.fillText('최고', x + 2, gy - 30);
    }
    const ph = Math.max(18, 1.9 * sc * 2.1);
    if (ART.side) {
      const sd = (im, x, h) => { const w = h * im.width / im.height; ctx.drawImage(im, x - w / 2, gy - h + 2, w, h); };
      if (G.mode === 'boss' && ART.boss) sd(ART.boss[H.BOSSES[G.boss.i].spr], sx(18.4), ph * 1.25); else sd(teamFrames(H.pitcherOf(st.stadium).color).side || ART.side[1], sx(18.4), ph * 1.25);
      sd(ART.side[2], sx(-1.6), ph * 1.25);
      sd(ART.side[0], sx(-0.4), ph * 1.3);
    } else {
      drawPitcherSide(sx(18.4), gy, ph);
      drawCatcherSide(sx(-1.3), gy, ph * 0.8);
      drawBatterSide(sx(-0.55), gy, ph);
    }
    if (G.ballVis) {
      const bs = Math.max(3, Math.min(6, 0.12 * sc * 2));
      const fys = flightYS();
      for (let i = 0; i < G.trail.length; i++) {
        const [tx, ty] = G.trail[i];
        ctx.fillStyle = G.result && G.result.special ? `rgba(255,210,60,${(i / G.trail.length) * 0.5})` : `rgba(255,255,255,${(i / G.trail.length) * 0.35})`;
        ctx.beginPath(); ctx.arc(sx(tx), gy - ty * fys, bs * (i / G.trail.length), 0, 7); ctx.fill();
      }
      const bx = sx(G.ballX), by = gy - G.ballY * fys;
      if (G.result && G.result.special && G.phase === 'flight') {
        ctx.fillStyle = 'rgba(255,200,0,.5)'; ctx.beginPath(); ctx.arc(bx, by, bs * 3, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#c33'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(bx, Math.max(bs, by), bs, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(bx, gy + 2, bs, bs * 0.4, 0, 0, 7); ctx.fill();
      if (G.phase === 'flight' && G.result && G.result.quality !== 'weak') {
        ctx.font = '18px Jua'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3;
        const txt = H.fmtDist(Math.max(0, G.ballX));
        const ty = Math.max(20, by - 14);
        ctx.strokeText(txt, Math.min(W - 34, Math.max(34, bx)), ty); ctx.fillText(txt, Math.min(W - 34, Math.max(34, bx)), ty);
      }
    }
  }
  // 장외 단계 배경 (화면 고정 원경)
  function drawOutBack(S, gy) {
    const par = G.camMin * 0.0;
    if (S.out === 'city') {
      for (let i = 0; i < 26; i++) {
        const w = 16 + ((i * 37) % 22), h = gy * (0.14 + ((i * 53) % 30) / 100);
        const x = ((i * 31.7 + par) % (W + 60)) - 30;
        ctx.fillStyle = i % 3 ? '#56648a' : '#47557a'; ctx.fillRect(x, gy - h, w, h);
        ctx.fillStyle = 'rgba(255,230,140,.55)';
        for (let yy = gy - h + 5; yy < gy - 6; yy += 8) for (let xx = x + 3; xx < x + w - 3; xx += 6) if (((xx * 7 + yy * 3) | 0) % 5 < 2) ctx.fillRect(xx, yy, 2.5, 3);
      }
    } else if (S.out === 'sea') {
      ctx.fillStyle = '#6f8fb5';
      for (let i = 0; i < 6; i++) { const x = (i * 0.2 - 0.05) * W, h = gy * (0.3 + (i % 3) * 0.12); ctx.beginPath(); ctx.moveTo(x - W * 0.18, gy); ctx.lineTo(x, gy - h); ctx.lineTo(x + W * 0.18, gy); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      for (let i = 0; i < 6; i++) { const x = (i * 0.2 - 0.05) * W, h = gy * (0.3 + (i % 3) * 0.12); ctx.beginPath(); ctx.moveTo(x - W * 0.04, gy - h * 0.78); ctx.lineTo(x, gy - h); ctx.lineTo(x + W * 0.04, gy - h * 0.78); ctx.fill(); }
    } else if (S.out === 'sky') {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      for (let i = 0; i < 18; i++) { const x = (i / 17) * W * 1.1 - W * 0.05; ctx.beginPath(); ctx.ellipse(x, gy - 4 - (i % 3) * 6, W * 0.09, 14 + (i % 4) * 4, 0, 0, 7); ctx.fill(); }
    } else if (S.out === 'space') {
      const R = W * 1.6, cy = gy + R * 0.9;
      const eg = ctx.createLinearGradient(0, cy - R, 0, gy);
      eg.addColorStop(0, '#9fe0ff'); eg.addColorStop(0.35, '#3d8ae0'); eg.addColorStop(1, '#174a9e');
      ctx.fillStyle = 'rgba(120,200,255,.25)'; ctx.beginPath(); ctx.arc(W / 2, cy, R + 8, 0, 7); ctx.fill();
      ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(W / 2, cy, R, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(90,190,110,.8)';
      ctx.beginPath(); ctx.ellipse(W * 0.3, gy - 8, W * 0.12, 8, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W * 0.72, gy - 4, W * 0.08, 5, 0, 0, 7); ctx.fill();
    }
  }
  // 장외 단계 지면과 목표 깃발
  function drawOutFront(S, gy, sc, wallM, fence) {
    const x0 = Math.max(-10, sx(wallM + 6));
    if (x0 < W) {
      if (S.out === 'parking' || S.out === 'city') {
        ctx.fillStyle = '#6b6f78'; ctx.fillRect(x0, gy, W - x0 + 10, Hh - gy);
        if (S.out === 'city') { ctx.fillStyle = '#ffd84a'; for (let m = wallM + 10; m < G.camMax; m += Math.max(4, niceStep((G.camMax - G.camMin) / 40))) ctx.fillRect(sx(m), gy + (Hh - gy) * 0.45, Math.max(2, sc * 2), 2); }
        else if (sc * 6 > 5) {
          const carC = ['#ff5a5a', '#5bb8ff', '#ffd84a', '#ffffff', '#4cd97b', '#333'];
          for (let m = wallM + 12, k = 0; m < G.camMax; m += 6, k++) {
            if (m < G.camMin) continue;
            const x = sx(m), w = Math.max(6, sc * 4.4), h = Math.max(4, sc * 1.5);
            ctx.fillStyle = carC[k % carC.length]; roundRect(x, gy - h, w, h, h * 0.3); ctx.fill();
            ctx.fillStyle = 'rgba(160,220,255,.8)'; ctx.fillRect(x + w * 0.25, gy - h * 0.95, w * 0.4, h * 0.35);
          }
        }
      } else if (S.out === 'sea') {
        const sx0 = Math.max(-10, sx(wallM + 400));
        const sg = ctx.createLinearGradient(0, gy - 4, 0, Hh); sg.addColorStop(0, '#3fa2e8'); sg.addColorStop(1, '#1b5fa8');
        ctx.fillStyle = sg; ctx.fillRect(sx0, gy - 3, W - sx0 + 10, Hh - gy + 3);
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) { const y = gy + 6 + i * 10, o = (performance.now() / 30 + i * 20) % 30; ctx.beginPath(); for (let x = sx0 - o; x < W; x += 30) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 7, y - 4, x + 14, y); } ctx.stroke(); }
      } else if (S.out === 'sky') {
        ctx.fillStyle = '#f4f8ff'; ctx.fillRect(x0, gy - 6, W - x0 + 10, Hh - gy + 6);
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 14; i++) { const x = x0 + (i / 13) * (W - x0); ctx.beginPath(); ctx.ellipse(x, gy - 6, 22, 10 + (i % 3) * 3, 0, 0, 7); ctx.fill(); }
      } else if (S.out === 'space') {
        ctx.fillStyle = '#11162e'; ctx.fillRect(x0, gy, W - x0 + 10, Hh - gy);
      }
    }
    // 목표 깃발
    const fx = sx(fence);
    ctx.font = '13px Jua'; ctx.textAlign = 'center';
    if (fx <= W - 4) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, gy); ctx.lineTo(fx, gy - 44); ctx.stroke();
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; ctx.fillRect(fx + i * 5, gy - 44 + j * 5, 5, 5); }
      ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3;
      ctx.strokeText('목표 ' + H.fmtDist(fence), fx, gy - 50); ctx.fillText('목표 ' + H.fmtDist(fence), fx, gy - 50);
    } else {
      ctx.textAlign = 'right'; ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3;
      const tx = '목표 ' + H.fmtDist(fence) + ' ▶'; ctx.strokeText(tx, W - 8, gy - 12); ctx.fillText(tx, W - 8, gy - 12);
    }
  }

  function flightYS() {
    if (G.phase === 'flight' || G.phase === 'result') {
      const r = G.result; if (!r) return yScale();
      const apex = Math.max(6, r.d * (r.hr ? 0.3 : 0.22));
      return Math.min(yScale(), (groundY() - 26) / apex);
    }
    return yScale();
  }
  function body(x, gy, h, jersey, pants, legSpread) {
    const lw = Math.max(2, h * 0.1);
    ctx.strokeStyle = pants; ctx.lineWidth = lw; ctx.lineCap = 'round';
    const hipY = gy - h * 0.36;
    ctx.beginPath(); ctx.moveTo(x - h * 0.05, hipY); ctx.lineTo(x - h * legSpread, gy - lw / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + h * 0.05, hipY); ctx.lineTo(x + h * legSpread, gy - lw / 2); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.fillRect(x - h * legSpread - lw * 0.7, gy - lw * 0.6, lw * 1.6, lw * 0.6); ctx.fillRect(x + h * legSpread - lw * 0.7, gy - lw * 0.6, lw * 1.6, lw * 0.6);
    ctx.fillStyle = jersey;
    roundRect(x - h * 0.16, gy - h * 0.7, h * 0.32, h * 0.38, h * 0.08); ctx.fill();
    return { hipY, chestY: gy - h * 0.6, headY: gy - h * 0.82 };
  }
  function head(x, y, h, dir, hat) {
    const r = h * 0.17;
    ctx.fillStyle = '#ffd7b0'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x + dir * r * 0.45, y - r * 0.05, Math.max(1, r * 0.12), 0, 7); ctx.fill();
    ctx.fillStyle = hat;
    ctx.beginPath(); ctx.arc(x, y - r * 0.1, r * 1.05, Math.PI, 0); ctx.fill();
    ctx.fillRect(x + (dir > 0 ? 0 : -r * 1.6), y - r * 0.2, r * 1.6, r * 0.28);
  }
  function drawBatterSide(x, gy, h) {
    const P = body(x, gy, h, '#e8eef8', '#e8eef8', 0.17);
    ctx.fillStyle = '#1d4f91'; ctx.font = Math.max(7, h * 0.14) + 'px Jua'; ctx.textAlign = 'center'; ctx.fillText('7', x, P.chestY + h * 0.08);
    head(x + h * 0.02, P.headY, h, 1, '#1d4f91');
    ctx.fillStyle = '#1d4f91'; ctx.beginPath(); ctx.arc(x - h * 0.06, P.headY + h * 0.02, h * 0.07, 0, 7); ctx.fill();
    const ang = G.phase === 'flight' || G.phase === 'result' ? 1.0 + Math.min(0.6, G.t * 2) : -2.35;
    const hx = x + h * 0.12, hy = P.chestY + h * 0.02;
    ctx.strokeStyle = '#ffd7b0'; ctx.lineWidth = Math.max(2, h * 0.07);
    ctx.beginPath(); ctx.moveTo(x - h * 0.08, P.chestY - h * 0.04); ctx.lineTo(hx, hy); ctx.stroke();
    const b = H.equipped(st), g = H.GRADES[b.g];
    const len = h * 0.62;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
    const bg = ctx.createLinearGradient(0, -3, 0, 3); bg.addColorStop(0, '#fff'); bg.addColorStop(0.3, g.color); bg.addColorStop(1, g.dark);
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(-len * 0.08, -h * 0.02); ctx.lineTo(len * 0.4, -h * 0.022); ctx.lineTo(len, -h * 0.05); ctx.lineTo(len, h * 0.05); ctx.lineTo(len * 0.4, h * 0.022); ctx.lineTo(-len * 0.08, h * 0.02); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd7b0'; ctx.beginPath(); ctx.arc(hx, hy, Math.max(2, h * 0.05), 0, 7); ctx.fill();
  }
  function drawPitcherSide(x, gy, h) {
    const P = body(x, gy - 4, h, '#f2f2f2', '#d8d8d8', 0.12);
    head(x, P.headY, h, -1, '#c0392b');
    const a = 0.6;
    ctx.strokeStyle = '#ffd7b0'; ctx.lineWidth = Math.max(2, h * 0.07);
    const sx0 = x, sy0 = P.chestY - h * 0.05, L = h * 0.3;
    ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx0 - Math.cos(a) * L, sy0 + Math.sin(a) * L); ctx.stroke();
    ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); ctx.arc(x - h * 0.15, P.chestY + h * 0.06, h * 0.07, 0, 7); ctx.fill();
  }
  function drawCatcherSide(x, gy, h) {
    ctx.fillStyle = '#2b3a55'; roundRect(x - h * 0.2, gy - h * 0.55, h * 0.4, h * 0.42, h * 0.1); ctx.fill();
    ctx.fillStyle = '#2b3a55'; ctx.fillRect(x - h * 0.2, gy - h * 0.16, h * 0.12, h * 0.16); ctx.fillRect(x + h * 0.08, gy - h * 0.16, h * 0.12, h * 0.16);
    ctx.fillStyle = '#ffd7b0'; ctx.beginPath(); ctx.arc(x + h * 0.05, gy - h * 0.66, h * 0.16, 0, 7); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + h * 0.09, gy - h * 0.66, h * 0.15, -1.2, 1.2); ctx.stroke();
    ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); ctx.arc(x + h * 0.24, gy - h * 0.42, h * 0.11, 0, 7); ctx.fill();
  }

  // ---------- HUD ----------
  let lastCPS = 0, cpsAt = -1e9;
  function updateHUD() {
    $('coins').textContent = fmt(st.coins);
    $('gems').textContent = fmt(st.gems);
    $('tix').textContent = st.tickets;
    const S = H.STADIUMS[st.stadium];
    $('stadName').textContent = (st.stadium + 1) + '. ' + S.name;
    $('fenceTxt').textContent = (S.out ? '목표 ' : '펜스 ') + H.fmtDist(S.fence);
    const n = st.stadiumHR[st.stadium] || 0, cleared = st.cleared.includes(st.stadium);
    $('stadProg').style.width = (cleared ? 100 : Math.min(100, n / H.HR_TO_CLEAR * 100)) + '%';
    $('stadHR').textContent = cleared ? '클리어' : '홈런 ' + n + '/' + H.HR_TO_CLEAR;
    const now = performance.now();
    if (now - cpsAt > 3000) { lastCPS = H.expectedCPS(st, 150); cpsAt = now; }
    $('cps').textContent = '자동 초당 ' + fmt(lastCPS) + ' · 직접 치면 +20%';
    $('feverTag').style.display = G.fever > nowS() ? 'inline-block' : 'none';
    $('wkTag').style.display = H.isWeekend() ? 'inline-block' : 'none';
    tutCheck();
    // 탭 알림 점
    const dots = document.querySelectorAll('#tabs .dot');
    const canStat = Object.keys(H.STATS).some((k) => st.stats[k] < H.STATS[k].max && st.coins >= H.statCost(k, st.stats[k]));
    dots[0].style.display = canStat ? 'block' : 'none';
    const eb = H.equipped(st);
    dots[1].style.display = (eb.e < H.ENH_MAX && st.coins >= H.enhCost(eb, st)) || H.bestBat(st).id !== st.equip ? 'block' : 'none';
    dots[2].style.display = st.gems >= H.PREMIUM_GEMS ? 'block' : 'none';
    dots[3].style.display = st.maxStadium > st.stadium ? 'block' : 'none';
    if (dots[4]) dots[4].style.display = H.claimableCount(st) > 0 ? 'block' : 'none';
  }
  let toastT = 0;
  function toast(s) { const t = $('toast'); t.textContent = s; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }
  function floatCoin(s) {
    const el = document.createElement('div');
    el.textContent = s;
    el.style.cssText = 'position:absolute;left:50%;top:40%;transform:translateX(-50%);color:#ffd84a;font-size:20px;text-shadow:0 2px 0 #000;pointer-events:none;transition:all .9s ease-out;z-index:4';
    $('fieldWrap').appendChild(el);
    requestAnimationFrame(() => { el.style.top = '8%'; el.style.opacity = '0'; });
    setTimeout(() => el.remove(), 950);
  }

  // ---------- 패널 ----------
  let tab = 'batter', dirty = true, bulk = 1, lastHTML = '';
  function markDirty() { dirty = true; }
  const panel = $('panel');

  function renderPanel() {
    dirty = false;
    const y = panel.scrollTop;
    const html = tab === 'batter' ? renderBatter() : tab === 'bats' ? renderBats() : tab === 'shop' ? renderShop() : tab === 'mission' ? renderMission() : renderStadium();
    if (html === lastHTML) return;
    lastHTML = html; panel.innerHTML = html;
    panel.scrollTop = y;
  }

  function bulkCost(k) {
    let lv = st.stats[k], c = 0, n = 0;
    const max = H.STATS[k].max;
    const lim = bulk === 'max' ? 1000 : bulk;
    while (n < lim && lv < max) {
      const cc = H.statCost(k, lv);
      if (bulk === 'max' && c + cc > st.coins) break;
      c += cc; lv++; n++;
    }
    if (bulk === 'max' && n === 0) { c = H.statCost(k, st.stats[k]); n = 1; }
    return { c, n };
  }

  function renderBatter() {
    let h = `<div class="h">타자 능력치 <button class="btn sm blue" id="infoBtn" style="margin-left:2px">📊 타격 정보</button><span class="r"><button class="btn sm ${bulk === 1 ? '' : 'gray'}" data-bulk="1">x1</button> <button class="btn sm ${bulk === 10 ? '' : 'gray'}" data-bulk="10">x10</button> <button class="btn sm ${bulk === 'max' ? '' : 'gray'}" data-bulk="max">MAX</button></span></div>`;
    for (const k of Object.keys(H.STATS)) {
      const S = H.STATS[k], lv = st.stats[k], max = lv >= S.max;
      const { c, n } = bulkCost(k);
      h += `<div class="card stat"><div class="si">${uiIcon('stat_' + k, S.icon)}</div><div class="sm"><div class="sn">${S.name} <span class="small">Lv.${lv}${S.max < 999 ? ' / ' + S.max : ''}</span></div>
      <div class="sd">${S.desc(lv)}${max ? '' : ' → ' + S.desc(lv + n).split(' ').pop()}</div></div>
      <button class="btn" data-stat="${k}" ${max || st.coins < c ? 'disabled' : ''}>${max ? 'MAX' : '강화' + (n > 1 ? ' x' + n : '')}<span class="cost">₩ ${max ? '-' : fmt(c)}</span></button></div>`;
    }
    const b = H.equipped(st);
    void b;
    return h;
  }

  function renderBats() {
    const b = H.equipped(st), g = H.GRADES[b.g];
    const rate = H.enhRate(b), cost = H.enhCost(b, st), max = b.e >= H.ENH_MAX;
    let h = `<div class="card"><div class="eq"><div class="bimg">${batSVG(b, b.e >= 10)}</div><div style="min-width:0">
      <div style="font-size:17px">${H.batName(b)} <span style="color:${g.color}">+${b.e}</span></div>
      <div>${gradeTag(b.g)} <span class="small">${H.TRAITS[b.t].name}</span></div>
      <div class="small">파워 x${fmt(H.batPower(b), 2)} · ${H.TRAITS[b.t].desc}</div></div></div>
      <div style="border-top:1px solid var(--line);margin:8px 0 4px"></div>
      ${max ? '<div class="enhRow">최대 강화 단계예요</div>' : `
      <div class="enhRow"><span>+${b.e} → <b style="color:${g.color}">+${b.e + 1}</b></span><span>성공률 <b style="color:${rate >= 70 ? '#4cd97b' : rate >= 40 ? '#ffd84a' : '#ff7a7a'}">${rate}%</b></span></div>
      <div class="enhRow small"><span>파워 x${fmt(H.batPower(b), 2)} → x${fmt(H.batPower({ g: b.g, t: b.t, e: b.e + 1 }), 2)}</span><span>${H.failText(b.e)}</span></div>
      ${b.e >= 10 ? `<label class="chk"><input type="checkbox" id="useTicket" ${st.useTicket !== false ? 'checked' : ''}> 보호권 사용 (보유 ${st.tickets}개, 파괴될 때만 소모)</label>` : ''}
      <button class="btn big" id="enhBtn" ${st.coins < cost ? 'disabled' : ''}>강화하기 · ₩ ${fmt(cost)}</button>`}
    </div>`;
    // 합성
    let mh = '';
    for (let gi = 0; gi < 4; gi++) {
      const n = H.mergeCandidates(st, gi).length;
      if (n >= 1) mh += `<button class="btn sm ${n >= 3 ? 'blue' : 'gray'}" data-merge="${gi}" ${n >= 3 ? '' : 'disabled'} style="margin:3px">${H.GRADES[gi].name} 3개 → ${H.GRADES[gi + 1].name} (${n}/3)</button>`;
    }
    if (mh) h += `<div class="card"><div class="small" style="margin-bottom:4px">합성: 장착하지 않은 같은 등급 방망이 3개로 다음 등급 1개 (특성 랜덤, 강화 단계 낮은 것부터 사용)</div>${mh}</div>`;
    const list = st.bats.slice().sort((a, c) => (c.id === st.equip) - (a.id === st.equip) || H.batPower(c) - H.batPower(a));
    h += `<div class="h">방망이 도감 <span class="r small">${H.dexCount(st)}/15 · 비거리 x${fmt(H.dexMult(st), 2)}${H.dexCount(st) >= 15 ? ' · 코인 x1.2' : ''}</span></div><div class="card"><div class="dex">`;
    for (let g = 0; g < 5; g++) for (const tt of ['power', 'contact', 'luck']) { const got = (st.dex || {})[g + '_' + tt]; h += `<div class="dx ${got ? 'got' : ''}" title="${H.BAT_NAMES[g][tt]}">${batSVG({ g, t: tt, e: 0 })}</div>`; }
    h += `</div><div class="small" style="margin-top:6px">한 등급의 3종을 모두 모으면 비거리 +5% (최대 +25%), 15종을 다 모으면 코인 +20%</div></div>`;
    h += `<div class="h">보유 방망이 <span class="r small">${st.bats.length}/${H.INV_MAX}</span></div><div class="inv">`;
    for (const x of list) {
      const on = x.id === st.equip, G2 = H.GRADES[x.g];
      const sp = Math.ceil(G2.sell * (1 + x.e * 0.5));
      h += `<div class="bc ${on ? 'on' : ''}"><div class="bimg">${batSVG(x)}</div><div class="nm" style="color:${G2.color}">${H.batName(x)} +${x.e}</div>
      <div class="small">${G2.name} · ${H.TRAITS[x.t].short} · x${fmt(H.batPower(x), 2)}</div>
      <div class="act">${on ? '<button class="btn sm gray" disabled>장착 중</button>' : `<button class="btn sm green" data-equip="${x.id}">장착</button><button class="btn sm red" data-sell="${x.id}">판매 ₩${fmt(sp)}</button>`}</div></div>`;
    }
    h += '</div>';
    return h;
  }

  function oddsTxt(o) { return o.map((p, i) => p ? H.GRADES[i].name + ' ' + p + '%' : '').filter(Boolean).join(' · '); }
  function renderShop() {
    const full = st.bats.length >= H.INV_MAX;
    const wp = H.woodPrice(st), np = H.normalBoxPrice(st);
    return `<div class="h">상점 <span class="r small">방망이 ${st.bats.length}/${H.INV_MAX}</span></div>
    <div class="card shopi"><div class="pic">${uiIcon('shop_wood', '🪵')}</div><div style="flex:1"><div>나무 배트</div><div class="small">일반 등급, 특성 랜덤. 합성 재료로 좋아요</div></div>
      <button class="btn" data-buy="wood" ${full || st.coins < wp ? 'disabled' : ''}>구매<span class="cost">₩ ${fmt(wp)}</span></button></div>
    <div class="card shopi"><div class="pic">${uiIcon('shop_box', '📦')}</div><div style="flex:1"><div>일반 상자</div><div class="odds">${oddsTxt(H.BOX.normal.odds)}</div></div>
      <button class="btn" data-buy="normal" ${full || st.coins < np ? 'disabled' : ''}>열기<span class="cost">₩ ${fmt(np)}</span></button></div>
    <div class="card shopi"><div class="pic">${uiIcon('shop_chest', '🎁')}</div><div style="flex:1"><div>고급 상자</div><div class="odds">${oddsTxt(H.BOX.premium.odds)}</div></div>
      <button class="btn blue" data-buy="premium" ${full || st.gems < H.PREMIUM_GEMS ? 'disabled' : ''}>열기<span class="cost">◆ ${H.PREMIUM_GEMS}</span></button></div>
    <div class="card shopi"><div class="pic">${uiIcon('shop_shield', '🛡')}</div><div style="flex:1"><div>강화 보호권</div><div class="small">+10 이상 강화에서 파괴될 때 대신 1단계 하락으로 막아줘요</div></div>
      <button class="btn blue" data-buy="ticket" ${st.gems < H.TICKET_GEMS ? 'disabled' : ''}>구매<span class="cost">◆ ${H.TICKET_GEMS}</span></button></div>
    <div class="card small">◆ 젬은 구장 클리어, 홈런 25개마다, 특대 홈런으로 얻어요. 실제 결제는 없어요.<br>상자 가격은 도달한 구장에 따라 올라가요.</div>`;
  }

  function renderStadium() {
    const can = H.canRetire(st), g = H.honorGain(st);
    let h = `<div class="h">은퇴 <span class="r small">은퇴 ${st.retires || 0}회</span></div><div class="card">
      <div class="row" style="justify-content:space-between"><div><div style="font-size:16px;display:flex;align-items:center;gap:4px"><span class="mini">${uiIcon('stat_honor', '🎖')}</span> 명예 ${fmt(st.honor || 0)}</div>
      <div class="small">명예 1점마다 비거리·코인 +${Math.round(H.HONOR_PCT * 100)}% · 지금 x${fmt(H.honorMult(st), 2)}</div></div>
      <button class="btn ${can ? '' : 'gray'}" id="retireBtn" ${can ? '' : 'disabled'}>은퇴하기<span class="cost">${can ? '명예 +' + fmt(g) : '6구장부터'}</span></button></div>
      <div class="small" style="margin-top:6px">${can ? '더 먼 구장까지 갈수록 받는 명예가 커져요. 방망이·젬·보호권은 그대로 남아요.' : '6구장(2군 구장)이 열리면 은퇴할 수 있어요. 은퇴하면 처음부터 다시 시작하지만 명예 보너스로 훨씬 빨리 올라가요.'}</div></div>
      <div class="h">홈런 더비 <span class="r small">10구 승부 · 주간 랭킹</span></div><div class="card"><div class="small" style="margin-bottom:6px">${H.derbyCanRank(st) ? '오늘의 랭킹 도전이 남아 있어요! 스트라이크만 오는 10구 동안 홈런을 최대한 많이 쳐요.' : '오늘 랭킹 도전은 끝났어요. 연습은 계속 할 수 있어요.'} 최고 기록 ${st.derbyBest || 0}개</div>
      <div style="display:flex;gap:8px"><button class="btn" id="derbyBtn" style="flex:2">${H.derbyCanRank(st) ? '⚾ 랭킹 도전' : '⚾ 연습하기'}</button><button class="btn blue" id="rankBtn" style="flex:1">🏆 랭킹</button></div></div>
      <div class="h">구장</div>`;
    H.STADIUMS.forEach((S, i) => {
      const lock = i > st.maxStadium, cur = i === st.stadium, cl = st.cleared.includes(i);
      const n = st.stadiumHR[i] || 0;
      h += `<div class="card st ${lock ? 'lock' : ''} ${cur ? 'cur' : ''}"><div class="num">${i + 1}</div><div style="flex:1;min-width:0">
      <div>${S.name} ${cl ? '<span class="grade" style="background:#4cd97b">클리어</span>' : ''}</div>
      <div class="small">${S.out ? '목표' : '펜스'} ${H.fmtDist(S.fence)} · 코인 x${fmt(H.coinMultOf(i), 1)} · ${lock ? '이전 구장 홈런 ' + H.HR_TO_CLEAR + '개로 열림' : '홈런 ' + n + '개'}</div></div>
      <div style="display:flex;flex-direction:column;gap:4px">${cur ? '<button class="btn sm gray" disabled>경기 중</button>' : lock ? '<button class="btn sm gray" disabled>잠김</button>' : `<button class="btn sm green" data-go="${i}">이동</button>`}
      ${H.bossOpen(st, i) ? `<button class="btn sm red" data-boss="${i}">${(st.bossWin || {})[i] ? '보스 재대결' : '👑 보스전'}</button>` : ''}</div></div>`;
    });
    h += `<div class="h">기록</div><div class="card small" style="line-height:1.7">
      총 홈런 <b style="color:#fff">${fmt(st.totalHR)}</b> · 총 타격 ${fmt(st.totalHits)}<br>
      최고 비거리 <b style="color:#ffd84a">${H.fmtDist(st.best)}</b> · 최고 연속 홈런 ${st.bestStreak}<br>
      특대 홈런 ${st.specials} · 강화 시도 ${st.enhTries} · 파괴된 방망이 ${st.destroyed}
      <button class="btn big" id="shareBtn" style="margin-top:8px">📸 내 기록 카드 공유하기</button></div>
      <div class="h">기기 이전</div><div class="card"><div class="small" style="margin-bottom:6px">다른 폰이나 브라우저로 옮길 때 8자리 코드를 만들어 새 기기에 입력하세요. 코드는 24시간 동안 1번 쓸 수 있어요.</div>
      <div style="display:flex;gap:8px"><button class="btn sm blue" id="expBtn" style="flex:1">이전 코드 만들기</button><button class="btn sm gray" id="impBtn" style="flex:1">코드로 불러오기</button></div></div>
      <div class="h">설정</div><div class="card" style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn sm ${st.bgm !== false ? 'green' : 'gray'}" id="bgmBtn">배경음 ${st.bgm !== false ? 'ON' : 'OFF'}</button>
      <button class="btn sm ${st.voice !== false ? 'green' : 'gray'}" id="voiceBtn">음성 ${st.voice !== false ? 'ON' : 'OFF'}</button>
      <button class="btn sm ${st.layout === 'bottom' ? 'green' : 'gray'}" id="layBtn">📱 타석 ${st.layout === 'bottom' ? '아래 (켜짐)' : '아래로'}</button>
      <button class="btn sm blue" id="langBtn">🌐 ${window.HRK_LANG === 'en' ? 'KOR' : 'English'}</button>
      <button class="btn sm ${st.sound ? 'green' : 'gray'}" id="sndBtn">사운드 ${st.sound ? 'ON' : 'OFF'}</button>
      <button class="btn sm ${st.vibe !== false ? 'green' : 'gray'}" id="vibBtn">진동 ${st.vibe !== false ? 'ON' : 'OFF'}</button>
      <button class="btn sm red" id="resetBtn">처음부터 하기</button></div>
      <div class="ver">홈런왕 키우기 ${VERSION}</div>`;
    return h;
  }

  function rewardToast(r) { toast(r.text + ' 받았어요'); if (r.bat) setTimeout(() => queueModal(() => revealModal(r.bat, '고급 상자 오픈!')), 200); }
  function renderMission() {
    const d = H.daily(st), can = H.attCan(st), day = H.attDay(st);
    let h = `<div class="h">출석 보상 <span class="r small">누적 ${st.att.n}일</span></div><div class="card"><div class="attrow">`;
    H.ATT.forEach((r, i) => {
      const done = i < day || (!can && i === day && false);
      const cls = i < day ? 'got' : i === day && can ? 'now' : '';
      h += `<div class="attd ${cls}"><b>${i + 1}일</b><span>${H.rewardText(r)}</span>${i < day ? '<i>✓</i>' : ''}</div>`;
      void done;
    });
    h += `</div><button class="btn big" data-att ${can ? '' : 'disabled'}>${can ? (day + 1) + '일차 보상 받기' : '오늘 출석 완료! 내일 또 와요'}</button></div>`;
    h += `<button class="btn big blue" id="codeBtn" style="margin-bottom:8px">🎟 이벤트 코드 입력</button>`;
    h += `<div class="h">일일 미션 <span class="r small">자정에 초기화</span></div>`;
    for (const m of H.DAILY) {
      const c = Math.min(m.goal, d.c[m.id] || 0), got = d.got[m.id], ok = c >= m.goal;
      h += `<div class="card mis"><div style="flex:1;min-width:0"><div>${m.name}</div><div class="bar" style="margin-top:5px"><i style="width:${c / m.goal * 100}%"></i></div>
        <div class="small" style="margin-top:3px">${c}/${m.goal} · 보상 ${H.rewardText(m.rew)}</div></div>
        <button class="btn sm ${got ? 'gray' : ok ? 'green' : 'gray'}" data-daily="${m.id}" ${!got && ok ? '' : 'disabled'}>${got ? '완료' : '받기'}</button></div>`;
    }
    const allGot = H.DAILY.every((m) => d.got[m.id]);
    h += `<div class="card mis"><div style="flex:1">🎁 미션 모두 완료 보너스<div class="small">보상 ${H.rewardText(H.DAILY_ALL)}</div></div>
      <button class="btn sm ${d.all ? 'gray' : allGot ? '' : 'gray'}" data-dall ${!d.all && allGot ? '' : 'disabled'}>${d.all ? '완료' : '받기'}</button></div>`;
    const ready = H.ACH.filter((a) => H.achReady(st, a)), todo = H.ACH.filter((a) => !(st.ach || {})[a.id] && !a.test(st)), done = H.ACH.filter((a) => (st.ach || {})[a.id]);
    h += `<div class="h">업적 <span class="r small">${done.length}/${H.ACH.length}</span></div>`;
    for (const a of ready.concat(todo)) {
      const ok = H.achReady(st, a);
      h += `<div class="card mis"><div style="flex:1">${ok ? '🏆' : '🔒'} ${a.name}<div class="small">보상 ◆ ${a.gems}</div></div>
        <button class="btn sm ${ok ? '' : 'gray'}" data-ach="${a.id}" ${ok ? '' : 'disabled'}>받기</button></div>`;
    }
    if (done.length) h += `<div class="card small">달성한 업적: ${done.map((a) => a.name).join(', ')}</div>`;
    return h;
  }

  // 패널 이벤트
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('button, input'); if (!t) return;
    audio();
    const d = t.dataset;
    if (d.bulk) { bulk = d.bulk === 'max' ? 'max' : +d.bulk; SFX.click(); return renderPanel(); }
    if (d.stat) {
      const { c, n } = bulkCost(d.stat);
      if (st.coins < c) return;
      st.coins -= c; st.stats[d.stat] += n; SFX.up(); track('stat_up', { k: d.stat, lv: st.stats[d.stat] });
      if (d.stat === 'speed') G.sp = H.speedMult(st.stats.speed);
      cpsAt = 0; updateHUD(); return renderPanel();
    }
    if (t.id === 'useTicket') { st.useTicket = t.checked; return; }
    if (t.id === 'enhBtn') return doEnhance();
    if (t.id === 'infoBtn') { SFX.click(); return infoModal(); }
    if (d.merge) {
      const r = H.merge(st, +d.merge);
      if (r.ok) { SFX.box(); track('merge', { g: r.bat.g }); revealModal(r.bat, '합성 성공!'); }
      return renderPanel();
    }
    if (d.equip) { st.equip = d.equip; SFX.click(); cpsAt = 0; updateHUD(); return renderPanel(); }
    if (d.sell) {
      const b = st.bats.find((x) => x.id === d.sell); if (!b) return;
      if (b.g >= 2 || b.e >= 5) {
        return confirmModal(`${H.batName(b)} +${b.e}을(를) 판매할까요?`, () => { const r = H.sell(st, d.sell); if (r.ok) { SFX.coin(); toast('₩ ' + fmt(r.price) + ' 획득'); } updateHUD(); renderPanel(); });
      }
      const r = H.sell(st, d.sell); if (r.ok) { SFX.coin(); toast('₩ ' + fmt(r.price) + ' 획득'); }
      updateHUD(); return renderPanel();
    }
    if (d.buy) {
      const r = H.buy(st, d.buy);
      if (!r.ok) { toast(r.reason === 'full' ? '방망이 가방이 가득 찼어요. 판매나 합성을 해주세요' : '재화가 부족해요'); return; }
      track('buy', { kind: d.buy }); if (d.buy === 'premium' || d.buy === 'normal') st.boxOpens = (st.boxOpens || 0) + 1;
      if (r.bat) { SFX.box(); revealModal(r.bat, d.buy === 'wood' ? '구매 완료' : '상자 오픈!'); }
      else { SFX.up(); toast('강화 보호권 +1'); }
      updateHUD(); return renderPanel();
    }
    if (t.id === 'derbyBtn') { if (G.mode !== 'normal') { toast('지금 진행 중인 경기가 있어요'); return; } return startDerby(); }
    if (t.id === 'rankBtn') return rankModal();
    if (t.id === 'codeBtn') return codeModal();
    if (d.boss) { if (G.mode !== 'normal') { toast('지금 진행 중인 경기가 있어요'); return; } return startBoss(+d.boss); }
    if (d.go) { H.moveStadium(st, +d.go); SFX.click(); track('stadium_move', { s: +d.go + 1 }); afterMove(); return; }
    if (t.id === 'sndBtn') { st.sound = !st.sound; BGM.sync(); return renderPanel(); }
    if (t.id === 'vibBtn') { st.vibe = st.vibe === false; if (st.vibe) vib(30); syncHaptic(); return renderPanel(); }
    if (t.id === 'retireBtn') return retireModal();
    if (t.id === 'layBtn') return toggleLayout('setting');
    if (t.id === 'langBtn') { save(); window.setLang(window.HRK_LANG === 'en' ? 'ko' : 'en'); return; }
    if (t.id === 'voiceBtn') { st.voice = st.voice === false; if (st.voice) VOICE.play('ball', 0.7); return renderPanel(); }
    if (t.id === 'bgmBtn') { st.bgm = st.bgm === false; BGM.sync(); return renderPanel(); }
    if (t.id === 'shareBtn') return shareCard();
    if (t.id === 'expBtn') return exportModal();
    if (t.id === 'impBtn') return importModal();
    if (d.att != null) { const r = H.claimAtt(st); if (r) { SFX.box(); vib(30); track('att_claim', { n: st.att.n }); rewardToast(r); } updateHUD(); return renderPanel(); }
    if (d.daily) { const r = H.claimDaily(st, d.daily); if (r) { SFX.up(); track('mission_claim', { id: d.daily }); rewardToast(r); } updateHUD(); return renderPanel(); }
    if (d.dall != null) { const r = H.claimDailyAll(st); if (r) { SFX.success(); confetti(); track('mission_all', {}); rewardToast(r); } updateHUD(); return renderPanel(); }
    if (d.ach) { const r = H.claimAch(st, d.ach); if (r) { SFX.success(); track('ach_claim', { id: d.ach }); rewardToast(r); } updateHUD(); return renderPanel(); }
    if (t.id === 'resetBtn') {
      return confirmModal('정말 처음부터 할까요? 모든 기록이 지워져요.', () => { localStorage.removeItem(SAVE_KEY); st = H.newState(); save(); afterMove(); toast('새로 시작했어요'); });
    }
  });

  function toggleLayout(src) {
    st.layout = st.layout === 'bottom' ? 'top' : 'bottom'; st.layoutAsked = true;
    applyLayout(); save(); SFX.click();
    toast(st.layout === 'bottom' ? '타석 화면을 아래로 옮겼어요' : '타석 화면을 위로 옮겼어요');
    track('layout', { v: st.layout, src }); markDirty();
  }
  function layoutAsk() {
    st.layoutAsked = true; save();
    openModal(`<h2>📱 한 손으로 치기</h2><p>타석 화면을 아래로 옮기면 엄지로 치기 편해요. 옮겨볼까요?</p>
      <p class="small">자동 타격 옆 ⇅ 버튼으로 언제든 바꿀 수 있어요</p>
      <div class="mbtns"><button class="btn gray" id="layKeep">지금 그대로</button><button class="btn" id="layDown">아래로</button></div>`);
    $('layKeep').onclick = () => { closeModal(); track('layout_ask', { v: 'keep' }); };
    $('layDown').onclick = () => { closeModal(); if (st.layout !== 'bottom') toggleLayout('ask'); track('layout_ask', { v: 'bottom' }); };
  }
  function applyLayout() { $('app').classList.toggle('swap', st.layout === 'bottom'); requestAnimationFrame(resize); }
  function afterMove() { G.camMin = -4; G.camMax = 21; startPitch(); startIntro(); updateHUD(); renderPanel(); }

  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.t; SFX.click();
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
    panel.scrollTop = 0; renderPanel();
  });
  $('swapBtn').addEventListener('click', () => { audio(); toggleLayout('button'); });
  $('autoBtn').addEventListener('click', () => {
    st.auto = !st.auto; audio(); SFX.click(); syncAuto();
  });
  function syncAuto() { const b = $('autoBtn'); b.classList.toggle('on', st.auto); b.textContent = '자동 타격 ' + (st.auto ? 'ON' : 'OFF'); }
  $('fieldWrap').addEventListener('pointerdown', (e) => { if (e.target.closest('#guide')) return; onTap(); });
  $('guideSkip').addEventListener('click', () => { st.tut = 99; $('guide').style.display = 'none'; clearGuideMarks(); toast('튜토리얼을 건너뛰었어요'); });
  // PC: 스페이스바로 스윙
  window.addEventListener('keydown', (e) => { if (e.code === 'Space' && modal.classList.contains('hidden')) { e.preventDefault(); onTap(); } });
  // 아이폰: 웹 진동 API가 없어서 투명 스위치를 탭하게 해 '톡' 햅틱을 낸다
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function syncHaptic() { $('hapLbl').style.display = IOS && st.vibe !== false ? 'block' : 'none'; }

  // ---------- 모달 ----------
  const modal = $('modal');
  function openModal(html) { modal.innerHTML = '<div class="mbox">' + html + '</div>'; modal.classList.remove('hidden'); }
  const mQueue = [];
  function closeModal() { modal.classList.add('hidden'); modal.innerHTML = ''; const next = mQueue.shift(); if (next) setTimeout(next, 180); }
  function queueModal(fn) { if (modal.classList.contains('hidden')) fn(); else mQueue.push(fn); }
  modal.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.close != null) closeModal();
  });

  function confirmModal(msg, yes) {
    openModal(`<h2>확인</h2><p>${msg}</p><div class="mbtns"><button class="btn gray" data-close>취소</button><button class="btn red" id="mYes">확인</button></div>`);
    $('mYes').onclick = () => { closeModal(); yes(); };
  }

  function revealModal(b, title) {
    const g = H.GRADES[b.g];
    const better = H.batPower(b) > H.batPower(H.equipped(st));
    openModal(`<h2>${title}</h2><div class="bimg shake" id="rvImg" style="opacity:.3;filter:brightness(0)">${batSVG(b, b.g >= 3)}</div>
      <div id="rvTxt" style="visibility:hidden"><div class="res" style="color:${g.color}">${g.name} 등급!</div><p>${H.batName(b)} · ${H.TRAITS[b.t].name}</p><p class="small">파워 x${fmt(H.batPower(b), 2)} · ${H.TRAITS[b.t].desc}</p>
      <div class="mbtns">${better ? `<button class="btn green" id="rvEq">바로 장착</button>` : ''}<button class="btn gray" data-close>확인</button></div></div>`);
    setTimeout(() => {
      const im = $('rvImg'); if (!im) return;
      im.classList.remove('shake'); im.style.opacity = 1; im.style.filter = 'none'; im.style.transition = 'all .3s';
      $('rvTxt').style.visibility = 'visible';
      if (b.g >= 3) { SFX.success(); confetti(); vib(b.g >= 4 ? [30, 30, 30, 30, 120] : [30, 40, 60]); }
      const eq = $('rvEq'); if (eq) eq.onclick = () => { st.equip = b.id; cpsAt = 0; closeModal(); updateHUD(); renderPanel(); };
    }, b.g >= 3 ? 1100 : 600);
  }

  function doEnhance() {
    const b = H.equipped(st);
    const before = b.e, name = H.batName(b);
    const useT = st.useTicket !== false;
    const r = H.tryEnhance(st, b, useT);
    if (!r.ok) { toast(r.reason === 'coins' ? '코인이 부족해요' : '최대 단계예요'); return; }
    track('enhance', { g: b.g, from: before, res: r.result });
    openModal(`<h2>강화 중...</h2><div class="bimg shake">${batSVG(Object.assign({}, b, { e: before }))}</div><p>${name} +${before} → +${before + 1}</p>`);
    setTimeout(() => {
      let html;
      const nb = st.bats.find((x) => x.id === b.id);
      if (r.result === 'success') { SFX.success(); vib([20, 30, 40]); html = `<h2>강화 성공!</h2><div class="bimg glow">${batSVG(nb)}</div><div class="res" style="color:#4cd97b">+${r.e} 달성</div>`; if (r.e >= 10) confetti(); }
      else if (r.result === 'keep') { SFX.fail(); html = `<h2>강화 실패</h2><div class="bimg">${batSVG(nb)}</div><div class="res" style="color:#ffd84a">단계 유지 +${r.e}</div>`; }
      else if (r.result === 'down') { SFX.fail(); html = `<h2>강화 실패</h2><div class="bimg">${batSVG(nb)}</div><div class="res" style="color:#ff9a6a">+${before} → +${r.e} 하락</div>`; }
      else if (r.result === 'saved') { SFX.saved(); vib([30, 60, 30]); html = `<h2>휴, 살았다!</h2><div class="bimg">${batSVG(nb)}</div><div class="res" style="color:#6ff0ff">보호권이 파괴를 막았어요</div><p>+${before} → +${r.e}, 남은 보호권 ${st.tickets}개</p>`; }
      else { SFX.destroy(); vib([100, 50, 200]); G.shake = 0.4; html = `<h2>방망이 파괴...</h2><div class="res" style="color:#ff5a5a">${name} +${before} 파괴됨</div><p>보유한 가장 강한 방망이를 장착했어요</p>`; }
      openModal(html + `<div class="mbtns"><button class="btn gray" data-close>닫기</button>${r.result !== 'destroy' && nb && nb.e < H.ENH_MAX ? '<button class="btn" id="again">한 번 더</button>' : ''}</div>`);
      const ag = $('again'); if (ag) ag.onclick = () => { closeModal(); doEnhance(); };
      cpsAt = 0; updateHUD(); renderPanel(); save();
    }, 750);
  }

  function infoModal() {
    const b = H.equipped(st), S = H.STADIUMS[st.stadium];
    const perfD = 32 * H.powerMult(st.stats.power) * H.batPower(b) * 1.5 / H.resistOf(st.stadium) * H.honorMult(st);
    const sim = H.simAuto(st, 500, 777);
    const pct = (v) => Math.round(v * 100) + '%';
    const row = (k, v, hl) => `<div class="ir"><span>${k}</span><b${hl ? ' class="hl"' : ''}>${v}</b></div>`;
    openModal(`<h2>📊 타격 정보</h2>
      <div class="isec">타격</div>
      ${row('퍼펙트 예상 비거리', H.fmtDist(perfD), perfD >= S.fence)}
      ${row(S.out ? '이번 단계 목표' : '지금 구장 펜스', H.fmtDist(S.fence))}
      ${row('방망이 파워', 'x' + fmt(H.batPower(b), 2))}
      ${row('퍼펙트 판정 범위', '±' + Math.round(H.perfectWindow(st) * 1000) + 'ms')}
      ${row('특대 홈런 (퍼펙트 시)', pct(H.specialChance(st)))}
      <div class="isec">자동 타격</div>
      ${row('홈런 확률 (맞힌 타구 중)', pct(sim.hrRate), true)}
      ${row('퍼펙트 확률', pct(H.autoPerfect(st)))}
      ${row('볼 골라내기', pct(H.eyeOf(st)))}
      ${row('초당 코인', fmt(sim.cps))}
      <div class="isec">보너스</div>
      ${row('코인 배율', '인기 x' + fmt(H.fameMult(st.stats.fame), 2) + ' · 구장 x' + fmt(H.coinMultOf(st.stadium), 1))}
      ${row('명예 보너스', st.honor ? '비거리·코인 x' + fmt(H.honorMult(st), 2) + ' (명예 ' + fmt(st.honor) + ')' : '없음')}
      ${row('선구안 콤보', st.eyeCombo ? '+' + st.eyeCombo * 10 + '% 비거리' : '없음')}
      ${row('직접 타격', '퍼펙트 비거리 +15%, 코인 +20%')}
      <div class="isec">팁</div>
      <ul class="itips"><li>공에 붙은 링이 노랗게 바뀔 때 탭하면 PERFECT</li><li>존 밖으로 빠지는 볼은 참으면 선구안 콤보가 쌓여요</li><li>볼넷 다음 공은 한가운데 실투예요</li></ul>
      <div class="mbtns"><button class="btn big" data-close>닫기</button></div>`);
  }

  function attModal() {
    const day = H.attDay(st), r = H.ATT[day];
    openModal(`<h2>📅 출석 ${day + 1}일차</h2><p>매일 들어오면 7일 동안 보상이 커져요. 7일차엔 고급 상자!</p>
      <div class="attrow" style="margin:10px 0">${H.ATT.map((x, i) => `<div class="attd ${i < day ? 'got' : i === day ? 'now' : ''}"><b>${i + 1}일</b><span>${H.rewardText(x)}</span>${i < day ? '<i>✓</i>' : ''}</div>`).join('')}</div>
      <div class="mbtns"><button class="btn big" id="attGet">${H.rewardText(r)} 받기</button></div>`);
    $('attGet').onclick = () => { const g = H.claimAtt(st); closeModal(); if (g) { SFX.box(); vib(30); track('att_claim', { n: st.att.n }); rewardToast(g); } updateHUD(); renderPanel(); };
  }

  // ---------- 기록 공유 카드 ----------
  function loadImgP(src) { return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
  async function makeCard() {
    const Wc = 1080, Hc = 1350, c = document.createElement('canvas'); c.width = Wc; c.height = Hc;
    const x = c.getContext('2d');
    try { await document.fonts.load('80px Jua'); } catch (e) { /* noop */ }
    const b = H.equipped(st);
    const [ka, em, bi] = await Promise.all([loadImgP('assets/ui/key_art.webp'), loadImgP('assets/ui/emblem.webp'), BAT_ART ? loadImgP('assets/bats/g' + b.g + '_' + b.t + '.webp') : null]);
    const g0 = x.createLinearGradient(0, 0, 0, Hc); g0.addColorStop(0, '#123a6b'); g0.addColorStop(1, '#071629'); x.fillStyle = g0; x.fillRect(0, 0, Wc, Hc);
    if (ka) { const sc = Math.max(Wc / ka.width, Hc / ka.height); x.globalAlpha = 0.55; x.drawImage(ka, (Wc - ka.width * sc) / 2, (Hc - ka.height * sc) / 2, ka.width * sc, ka.height * sc); x.globalAlpha = 1; }
    const ov = x.createLinearGradient(0, 0, 0, Hc); ov.addColorStop(0, 'rgba(5,15,35,.75)'); ov.addColorStop(0.45, 'rgba(5,15,35,.35)'); ov.addColorStop(1, 'rgba(5,15,35,.92)'); x.fillStyle = ov; x.fillRect(0, 0, Wc, Hc);
    const txt = (t, X, Y, size, col, stroke, align) => { x.font = size + 'px Jua'; x.textAlign = align || 'center'; x.lineJoin = 'round'; x.lineWidth = Math.max(6, size / 9); x.strokeStyle = stroke || 'rgba(0,0,0,.75)'; x.strokeText(t, X, Y); x.fillStyle = col; x.fillText(t, X, Y); };
    if (em) { x.save(); x.beginPath(); x.roundRect ? x.roundRect(70, 60, 150, 150, 34) : x.rect(70, 60, 150, 150); x.clip(); x.drawImage(em, 70, 60, 150, 150); x.restore(); }
    txt('홈런왕', 250, 132, 78, '#ffd84a', '#4a2400', 'left'); txt('키우기', 250, 205, 62, '#ffffff', '#0b2a55', 'left');
    txt('나의 최고 비거리', Wc / 2, 430, 54, '#cfe4ff');
    txt(H.fmtDist(st.best), Wc / 2, 600, st.best >= 1e5 ? 150 : 180, '#ffd84a', '#3a1a00');
    if (st.best >= 500) txt(st.best >= 1e6 ? '대기권 돌파 장외 홈런!' : '장외 홈런!', Wc / 2, 690, 56, '#ffffff');
    const reach = H.STADIUMS[Math.max(st.maxEver || 0, st.maxStadium)].name;
    const rows = [['총 홈런', fmt(st.totalHR) + '개'], ['도달한 곳', reach], ['명예', fmt(st.honor || 0) + ' (은퇴 ' + (st.retires || 0) + '회)']];
    rows.forEach((r, i) => { const y = 800 + i * 78; x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(150, y - 52, Wc - 300, 66); txt(r[0], 190, y, 40, '#a9c2e0', 'rgba(0,0,0,.4)', 'left'); txt(r[1], Wc - 190, y, 44, '#ffffff', 'rgba(0,0,0,.4)', 'right'); });
    if (bi) { const bw = 640, bh = bw * bi.height / bi.width; x.drawImage(bi, (Wc - bw) / 2, 1065 - bh / 2, bw, bh); }
    txt(H.batName(b) + ' +' + b.e, Wc / 2, 1160, 46, H.GRADES[b.g].color);
    txt('parkbeommin.github.io/homerun-king', Wc / 2, 1290, 36, '#cfe4ff');
    return c;
  }
  async function shareCard() {
    toast('기록 카드 만드는 중...');
    const c = await makeCard();
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    const file = new File([blob], 'homerun-king.jpg', { type: 'image/jpeg' });
    const text = '홈런왕 키우기 최고 비거리 ' + H.fmtDist(st.best) + '! 이거 넘길 수 있어? https://parkbeommin.github.io/homerun-king/';
    track('share_card', { best: Math.round(st.best) });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    openModal(`<h2>📸 내 기록 카드</h2><img src="${url}" style="width:100%;border-radius:12px;margin:6px 0"><p class="small">이미지를 길게 눌러 저장하거나 아래 버튼으로 받아요</p>
      <div class="mbtns"><button class="btn gray" data-close>닫기</button><a class="btn" href="${url}" download="homerun-king.jpg" style="text-decoration:none;display:flex;align-items:center;justify-content:center">저장하기</a></div>`);
  }

  // ---------- 기기 이전 코드 ----------
  function b64u(bytes) { let s2 = ''; for (let i = 0; i < bytes.length; i++) s2 += String.fromCharCode(bytes[i]); return btoa(s2).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; const bin = atob(t); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function hash4(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).slice(-4); }
  async function pipe(bytes, stream) { const r = new Response(new Blob([bytes]).stream().pipeThrough(stream)); return new Uint8Array(await r.arrayBuffer()); }
  async function makeCode() {
    st.lastSave = Date.now();
    const json = new TextEncoder().encode(JSON.stringify(st));
    let body, tag = 'R';
    if (window.CompressionStream) { body = b64u(await pipe(json, new CompressionStream('deflate-raw'))); tag = 'Z'; } else body = b64u(json);
    return 'HRK1' + tag + '.' + hash4(body) + '.' + body;
  }
  async function readCode(code) {
    code = (code || '').replace(/\s+/g, '');
    const m = code.match(/^HRK1([ZR])\.([0-9a-z]{1,4})\.([A-Za-z0-9_-]+)$/);
    if (!m || hash4(m[3]) !== m[2]) throw new Error('bad');
    let bytes = unb64u(m[3]);
    if (m[1] === 'Z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    const o = JSON.parse(new TextDecoder().decode(bytes));
    if (!o || !Array.isArray(o.bats) || o.stats == null) throw new Error('bad');
    return o;
  }
  // 8자리 이전 코드: Firebase(HomerunKing, howlexample01-85afa) Firestore REST, 24시간 1회용
  const FS = 'https://firestore.googleapis.com/v1/projects/howlexample01-85afa/databases/(default)/documents/hrk_transfers';
  const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function shortCode() { const r = crypto.getRandomValues(new Uint8Array(8)); let c = ''; for (let i = 0; i < 8; i++) { c += ABC[r[i] % ABC.length]; if (i === 3) c += '-'; } return c; }
  async function uploadCode(long) {
    const exp = new Date(Date.now() + 24 * 3600e3).toISOString();
    for (let i = 0; i < 4; i++) {
      const code = shortCode();
      const res = await fetch(FS + '?documentId=' + code, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { d: { stringValue: long }, exp: { timestampValue: exp }, v: { integerValue: '1' } } }) });
      if (res.ok) return code;
      if (res.status !== 409) throw new Error('net ' + res.status);
    }
    throw new Error('retry');
  }
  async function exportModal() {
    openModal('<h2>📦 이전 코드</h2><p>코드 만드는 중...</p>');
    const long = await makeCode();
    let code = null;
    try { code = await uploadCode(long); } catch (e) { code = null; }
    if (code) {
      openModal(`<h2>📦 이전 코드</h2><p class="small">새 기기의 [구장 → 코드로 불러오기]에 입력하세요</p>
        <div class="res" style="font-size:40px;letter-spacing:3px;color:#ffd84a;margin:14px 0">${code}</div>
        <p class="small">24시간 동안 1번만 쓸 수 있어요. 지금 기록이 그대로 옮겨져요.</p>
        <div class="mbtns"><button class="btn gray" data-close>닫기</button><button class="btn" id="copyCode">복사하기</button></div>`);
      $('copyCode').onclick = async () => { try { await navigator.clipboard.writeText(code); toast('복사했어요'); } catch (e) { toast(code); } };
      track('save_export', { kind: 'short' });
      return;
    }
    // 서버가 안 되면 긴 코드로 대신
    openModal(`<h2>📦 이전 코드</h2><p class="small">지금은 짧은 코드를 만들 수 없어서 긴 코드를 드려요. 전체를 복사해서 새 기기에 붙여넣으세요.</p>
      <textarea id="codeBox" readonly style="width:100%;height:110px;margin:8px 0;border-radius:10px;border:2px solid #3d74b3;background:#0a1d36;color:#cfe4ff;font-size:11px;padding:8px;word-break:break-all">${long}</textarea>
      <div class="mbtns"><button class="btn gray" data-close>닫기</button><button class="btn" id="copyCode">복사하기</button></div>`);
    $('copyCode').onclick = async () => { try { await navigator.clipboard.writeText(long); toast('복사했어요'); } catch (e) { const tb = $('codeBox'); tb.select(); document.execCommand('copy'); toast('복사했어요'); } };
    track('save_export', { kind: 'long' });
  }
  function applyImported(o) {
    const base = H.newState(); st = Object.assign(base, o); st.stats = Object.assign(base.stats, o.stats || {});
    save(); closeModal(); applyLayout(); afterMove(); syncAuto(); syncHaptic(); toast('기록을 불러왔어요!');
  }
  function importModal() {
    openModal(`<h2>📥 코드로 불러오기</h2><p class="small">다른 기기에서 만든 8자리 이전 코드를 입력하세요. 지금 이 기기의 기록은 덮어써져요.</p>
      <input id="codeIn" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-1234" style="width:100%;margin:10px 0;border-radius:10px;border:2px solid #3d74b3;background:#0a1d36;color:#fff;font-family:inherit;font-size:26px;letter-spacing:3px;text-align:center;padding:10px">
      <div class="mbtns"><button class="btn gray" data-close>취소</button><button class="btn red" id="doImp">불러오기</button></div>`);
    $('doImp').onclick = async () => {
      const raw = ($('codeIn').value || '').trim();
      try {
        if (/^HRK1/.test(raw)) { applyImported(await readCode(raw)); track('save_import', { kind: 'long' }); return; }
        const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (c.length !== 8) { toast('8자리 코드를 입력해 주세요'); return; }
        const code = c.slice(0, 4) + '-' + c.slice(4);
        const res = await fetch(FS + '/' + code);
        if (!res.ok) { toast(res.status === 403 || res.status === 404 ? '없거나 만료된 코드예요' : '연결이 불안정해요. 잠시 후 다시 해주세요'); return; }
        const j = await res.json();
        const o = await readCode(j.fields.d.stringValue);
        fetch(FS + '/' + code, { method: 'DELETE' }).catch(() => {});
        applyImported(o); track('save_import', { kind: 'short' });
      } catch (e) { toast('코드가 올바르지 않아요'); }
    };
  }

  // ---------- 랭킹 (Firestore REST, HomerunKing 프로젝트) ----------
  const FSR = 'https://firestore.googleapis.com/v1/projects/howlexample01-85afa/databases/(default)/documents';
  async function submitRank(hr, best) {
    const wk = H.weekKey(), distm = Math.min(999999999, Math.round(best));
    const body = { fields: { name: { stringValue: st.nick }, hr: { integerValue: String(hr) }, distm: { integerValue: String(distm) }, score: { integerValue: String(H.derbyScore(hr, distm)) }, ts: { timestampValue: new Date().toISOString() } } };
    const res = await fetch(`${FSR}/hrk_rank/${wk}/scores/${st.devId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.ok || res.status === 403; // 403 = 이번 주 기록이 더 높음
  }
  async function loadRank() {
    const wk = H.weekKey();
    const q = { structuredQuery: { from: [{ collectionId: 'scores' }], orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }], limit: 20 } };
    const res = await fetch(`${FSR}/hrk_rank/${wk}:runQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
    if (!res.ok) throw new Error('rank ' + res.status);
    const rows = await res.json();
    return rows.filter((r) => r.document).map((r) => { const f = r.document.fields; return { id: r.document.name.split('/').pop(), name: f.name.stringValue, hr: +f.hr.integerValue, distm: +f.distm.integerValue }; });
  }
  async function rankModal() {
    openModal('<h2>🏆 이번 주 홈런 더비 랭킹</h2><p>불러오는 중...</p>');
    try {
      const rows = await loadRank();
      const list = rows.length ? rows.map((r, i) => `<div class="ir ${r.id === st.devId ? 'me' : ''}"><span>${i + 1}. ${esc(r.name)}</span><b>홈런 ${r.hr} · ${H.fmtDist(r.distm)}</b></div>`).join('') : '<p>아직 기록이 없어요. 첫 1등이 되어보세요!</p>';
      openModal(`<h2>🏆 이번 주 홈런 더비 랭킹</h2><p class="small">${H.weekKey()} · 월요일에 새로 시작해요</p>${list}<div class="mbtns"><button class="btn big" data-close>닫기</button></div>`);
    } catch (e) { openModal('<h2>🏆 랭킹</h2><p>지금은 랭킹을 불러올 수 없어요.</p><div class="mbtns"><button class="btn big" data-close>닫기</button></div>'); }
  }
  function esc(t) { return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function derbyEndModal(D) {
    let rew = null;
    if (D.ranked) { st.derby = { date: H.todayKey(), hr: D.hr }; rew = H.derbyReward(st, D.hr); }
    st.derbyBest = Math.max(st.derbyBest || 0, D.hr);
    SFX.success(); if (D.hr >= 5) confetti();
    track('derby_end', { hr: D.hr, ranked: D.ranked ? 1 : 0 });
    openModal(`<h2>⚾ 홈런 더비 결과</h2><div class="res" style="color:#ffd84a">홈런 ${D.hr} / ${H.DERBY_N}</div><p>가장 멀리: ${H.fmtDist(D.best)}</p>
      ${rew ? `<p>보상 ◆ ${rew.gems} · ₩ ${fmt(rew.coins)}</p>` : '<p class="small">연습 기록은 랭킹에 올라가지 않아요</p>'}
      ${D.ranked ? `<input id="nickIn" maxlength="10" placeholder="랭킹 닉네임 (10자)" value="${esc(st.nick || '')}" style="width:100%;margin:8px 0;border-radius:10px;border:2px solid #3d74b3;background:#0a1d36;color:#fff;font-family:inherit;font-size:18px;text-align:center;padding:8px">` : ''}
      <div class="mbtns"><button class="btn gray" data-close>닫기</button>${D.ranked ? '<button class="btn" id="sendRank">랭킹 등록</button>' : '<button class="btn blue" id="seeRank">랭킹 보기</button>'}</div>`);
    const sr = $('sendRank');
    if (sr) sr.onclick = async () => {
      const nk = ($('nickIn').value || '').trim().slice(0, 10);
      if (!nk) { toast('닉네임을 입력해 주세요'); return; }
      st.nick = nk; save(); sr.disabled = true;
      const ok = await submitRank(D.hr, D.best).catch(() => false);
      toast(ok ? '랭킹에 등록했어요!' : '등록하지 못했어요. 잠시 후 다시 해주세요');
      rankModal();
    };
    const sk = $('seeRank'); if (sk) sk.onclick = () => rankModal();
    updateHUD(); markDirty();
  }
  function bossEndModal(win, i) {
    const B = H.BOSSES[i];
    if (win) {
      const r = H.winBoss(st, i); SFX.success(); confetti(); vib([40, 40, 40, 40, 120]);
      track('boss_win', { i, first: r.first ? 1 : 0 });
      openModal(`<h2>🏆 보스 격파!</h2><p>${B.name}을(를) 무너뜨렸어요!</p><div class="res" style="color:#ffd84a">◆ ${r.gems} · ₩ ${fmt(r.coins)}</div><p class="small">${r.first ? '첫 격파 보상!' : '다시 이기면 작은 보상을 받아요'}</p><div class="mbtns"><button class="btn big" data-close>좋아요</button></div>`);
    } else {
      SFX.fail(); track('boss_lose', { i });
      openModal(`<h2>패배...</h2><p>${B.name}에게 막혔어요. 능력치와 방망이를 키우고 다시 도전해요!</p><div class="mbtns"><button class="btn gray" data-close>닫기</button><button class="btn red" id="retryBoss">다시 도전</button></div>`);
      $('retryBoss').onclick = () => startBoss(i);
    }
    updateHUD(); markDirty();
  }

  // ---------- 이벤트 코드 (assets/codes.json, SHA-256) ----------
  async function sha256(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
  function codeModal() {
    openModal(`<h2>🎟 이벤트 코드</h2><p class="small">홍보 글이나 공지에서 받은 코드를 입력하세요</p>
      <input id="evIn" autocomplete="off" autocapitalize="characters" spellcheck="false" style="width:100%;margin:10px 0;border-radius:10px;border:2px solid #3d74b3;background:#0a1d36;color:#fff;font-family:inherit;font-size:22px;letter-spacing:2px;text-align:center;padding:8px">
      <div class="mbtns"><button class="btn gray" data-close>취소</button><button class="btn" id="evGo">받기</button></div>`);
    $('evGo').onclick = async () => {
      const c = ($('evIn').value || '').trim().toUpperCase(); if (!c) return;
      try {
        const list = await (await fetch('assets/codes.json?x=' + Date.now())).json();
        const h = await sha256('hrk:' + c); const e = list.find((x) => x.h === h);
        if (!e) { toast('없는 코드예요'); track('code_fail', { reason: 'invalid' }); return; }
        st.codes = st.codes || {};
        if (st.codes[h]) { toast('이미 받은 코드예요'); track('code_fail', { reason: 'used' }); return; }
        const today = H.todayKey();
        if (today < e.start) { toast('아직 시작 전인 코드예요'); return; }
        if (today > e.end) { toast('기간이 끝난 코드예요'); track('code_fail', { reason: 'expired' }); return; }
        st.codes[h] = today; st.gems += e.gems; save(); closeModal(); SFX.box(); toast('◆ 젬 +' + e.gems + ' 받았어요!'); track('code_redeem', { id: e.id, gems: e.gems }); updateHUD(); markDirty();
      } catch (er) { toast('지금은 코드를 확인할 수 없어요'); }
    };
  }

  // ---------- 단계 튜토리얼 ----------
  const TUT = [
    { msg: '공이 존에 들어올 때 화면을 탭해서 직접 쳐보세요!', tab: null, sel: null, done: () => st.manualHits >= 1, rew: { t: 'gems', n: 10 } },
    { msg: '타자 탭에서 힘을 강화해보세요', tab: 'batter', sel: '[data-stat="power"]', done: () => st.stats.power >= 1, rew: { t: 'gems', n: 10 } },
    { msg: '방망이 탭에서 강화하기를 눌러보세요', tab: 'bats', sel: '#enhBtn', done: () => st.enhTries >= 1, rew: { t: 'tickets', n: 1 } },
    { msg: '상점에서 상자를 열어보세요 (젬이 있어요)', tab: 'shop', sel: '[data-buy="premium"]', done: () => (st.boxOpens || 0) >= 1, rew: { t: 'gems', n: 20 } },
    { msg: '미션 탭에서 출석 보상을 받아보세요', tab: 'mission', sel: '[data-att]', done: () => (st.att && st.att.n >= 1), rew: { t: 'gems', n: 10 } },
  ];
  function tutCheck() {
    const g = $('guide'); if (!g) return;
    if (st.tut == null) st.tut = 0;
    if (st.tut >= TUT.length || $('title').style.display !== 'none') { g.style.display = 'none'; clearGuideMarks(); return; }
    const T = TUT[st.tut];
    if (T.done()) {
      const r = H.grant(st, T.rew); toast('튜토리얼 ' + (st.tut + 1) + '/' + TUT.length + ' 완료! ' + r.text); SFX.up();
      st.tut++; track('tut_step', { n: st.tut });
      if (st.tut >= TUT.length) { toast('튜토리얼 완료! 이제 홈런왕을 향해!'); if (!st.layoutAsked) setTimeout(() => queueModal(layoutAsk), 1500); }
      markDirty(); return;
    }
    g.style.display = 'flex'; $('tapHint').style.display = 'none';
    $('guideTxt').textContent = (st.tut + 1) + '/' + TUT.length + ' ' + T.msg;
    clearGuideMarks();
    if (T.tab) { const tb = document.querySelector('#tabs [data-t="' + T.tab + '"]'); if (tb && tab !== T.tab) tb.classList.add('gmark'); }
    if (T.sel && tab === T.tab) { const el = panel.querySelector(T.sel); if (el) el.classList.add('gmark'); }
  }
  function clearGuideMarks() { document.querySelectorAll('.gmark').forEach((e) => e.classList.remove('gmark')); }

  function retireModal() {
    const g = H.honorGain(st); if (!g) return;
    openModal(`<h2>🎖 은퇴할까요?</h2><p>명예 <b style="color:#ffd84a">+${fmt(g)}</b> → 총 ${fmt((st.honor || 0) + g)}<br>비거리·코인 x${fmt(H.honorMult(st), 2)} → x${fmt(1 + H.HONOR_PCT * ((st.honor || 0) + g), 2)}</p>
      <div class="ir"><span>초기화</span><b>코인, 타자 능력치, 구장 진행</b></div>
      <div class="ir"><span>그대로 유지</span><b>방망이, 젬, 보호권, 기록</b></div>
      <div class="mbtns"><button class="btn gray" data-close>조금 더 할게요</button><button class="btn" id="doRetire">은퇴식 하기</button></div>`);
    $('doRetire').onclick = () => {
      const got = H.retire(st);
      track('retire', { honor: got, n: st.retires });
      closeModal(); afterMove(); save();
      SFX.success(); confetti(); vib([40, 40, 40, 40, 120]);
      openModal(`<h2>🎉 은퇴식</h2><p>${st.retires}번째 시즌을 마쳤어요.</p><div class="res" style="color:#ffd84a">명예 +${fmt(got)}</div>
        <p>이제 비거리와 코인이 x${fmt(H.honorMult(st), 2)}! 동네 공터부터 다시 시작해요.</p><div class="mbtns"><button class="btn big" data-close>새 시즌 시작</button></div>`);
    };
  }

  function clearModal() {
    const s = st.stadium, next = H.STADIUMS[s + 1];
    SFX.success(); confetti();
    openModal(`<h2>🏆 ${H.STADIUMS[s].name} 클리어!</h2><p>젬 +${15 + s * 5}</p>${next ? `<p>다음 구장 <b style="color:#fff">${next.name}</b>이 열렸어요.<br>${next.out ? '목표 ' + H.fmtDist(next.fence) + '! 구장 밖까지 날려보세요' : '펜스 ' + next.fence + 'm, 투수가 더 강하지만 코인은 ' + fmt(H.coinMultOf(s + 1) / H.coinMultOf(s), 1) + '배!'}</p>
      <div class="mbtns"><button class="btn gray" data-close>조금 더 여기서</button><button class="btn green" id="goNext">이동하기</button></div>` : '<p>마지막 구장까지 정복했어요!</p><div class="mbtns"><button class="btn" data-close>확인</button></div>'}`);
    const g = $('goNext'); if (g) g.onclick = () => { H.moveStadium(st, s + 1); closeModal(); afterMove(); };
  }

  function offlineModal(o) {
    const h = Math.floor(o.sec / 3600), m = Math.floor((o.sec % 3600) / 60);
    openModal(`<h2>다시 오셨네요!</h2><p>자리 비운 ${h ? h + '시간 ' : ''}${m}분 동안 타자가 혼자 연습했어요.</p>
      <div class="res" style="color:#ffd84a">₩ ${fmt(o.coins)}</div><p class="small">최대 8시간, 자동 타격의 50%만큼 쌓여요</p>
      <div class="mbtns"><button class="btn big" id="takeOff">받기</button></div>`);
    $('takeOff').onclick = () => { st.coins += o.coins; SFX.coin(); closeModal(); updateHUD(); renderPanel(); };
  }

  // ---------- 배경음악 (WebAudio 직접 합성, 자작 멜로디) ----------
  const BGM = (() => {
    let timer = null, next = 0, step = 0, master = null, on = false;
    const BPM = 116, S16 = 60 / BPM / 4;
    // C장조 펜타토닉 기반 자작 멜로디 (16분음표 64칸 = 4마디), 0은 쉼표
    const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const mel = [72,0,74,0,76,0,79,0, 76,0,74,72,0,0,69,0, 72,0,74,0,76,0,79,81, 79,0,76,0,74,0,0,0,
                 76,0,79,0,81,0,84,0, 81,0,79,76,0,0,74,0, 72,0,74,76,0,79,0,76, 74,0,72,0,72,0,0,0];
    const chords = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]];
    function voice(freq, t, dur, type, vol, dest) {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.02);
    }
    function drum(t, kind) {
      if (kind === 'k') { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.connect(g).connect(master); o.start(t); o.stop(t + 0.16); return; }
      const src = AC.createBufferSource(); src.buffer = noiseBuf(AC, 0.05); const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kind === 's' ? 1800 : 7000;
      const g = AC.createGain(); g.gain.setValueAtTime(kind === 's' ? 0.25 : 0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 's' ? 0.12 : 0.04));
      src.connect(f).connect(g).connect(master); src.start(t);
    }
    function tick() {
      if (!AC) return;
      while (next < AC.currentTime + 0.15) {
        const i = step % 64, bar = Math.floor(i / 16), ch = chords[bar];
        if (mel[i]) voice(N(mel[i]), next, S16 * 1.8, 'square', 0.05, master);
        if (i % 4 === 0) voice(N(ch[0] - 12), next, S16 * 3.5, 'triangle', 0.22, master);
        if (i % 8 === 4) ch.forEach((n) => voice(N(n), next, S16 * 2.5, 'triangle', 0.035, master));
        if (i % 8 === 0) drum(next, 'k'); if (i % 8 === 4) drum(next, 's'); if (i % 2 === 0) drum(next, 'h');
        next += S16; step++;
      }
    }
    function start() {
      if (st.bgm === false || !st.sound || on) return;
      const ac = audio(); if (!ac) return;
      master = ac.createGain(); master.gain.value = 0.32; master.connect(ac.destination);
      next = ac.currentTime + 0.1; on = true; timer = setInterval(tick, 50);
    }
    function stop() { on = false; if (timer) clearInterval(timer); timer = null; if (master) { try { master.disconnect(); } catch (e) { /* noop */ } master = null; } }
    function sync() { if (st.bgm === false || !st.sound) stop(); else start(); }
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if ($('title').style.display === 'none') sync(); });
    return { start, stop, sync };
  })();

  // ---------- PWA (홈 화면에 추가) ----------
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  // ---------- 루프 ----------
  let last = performance.now(), hudT = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw();
    hudT += dt; if (hudT > 0.25) { hudT = 0; updateHUD(); if (dirty) renderPanel(); }
    requestAnimationFrame(frame);
  }
  // 코인 변화로 버튼 상태를 갱신하기 위해 주기적으로 다시 그림
  setInterval(markDirty, 1000);
  setInterval(save, 5000);
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { save(); hiddenAt = Date.now(); return; }
    if (!hiddenAt) return;
    const o = H.offlineReward(Object.assign({}, st, { lastSave: hiddenAt }), Date.now());
    hiddenAt = 0;
    if (o.coins > 0 && modal.classList.contains('hidden')) offlineModal(o);
  });
  window.addEventListener('pagehide', save);

  // 방망이 탭 아이콘
  setTabIcon(); preloadArt(); preloadSprites();

  // ---------- 시작 ----------
  const had = load();
  applyLayout(); resize(); syncAuto(); syncHaptic(); startPitch();
  if (!st.tutorial) $('tapHint').style.display = 'none';
  updateHUD(); renderPanel();
  const pendingOff = had ? H.offlineReward(st, Date.now()) : null;
  // 타이틀 화면: 탭하면 시작 (사운드도 이때 켜짐)
  const title = $('title');
  $('tVer').textContent = VERSION;
  title.addEventListener('pointerdown', () => {
    if (title.classList.contains('out')) return;
    audio(); SFX.click(); title.classList.add('out');
    setTimeout(() => { title.style.display = 'none'; }, 350);
    if (pendingOff && pendingOff.coins > 0) offlineModal(pendingOff);
    if (H.attCan(st)) queueModal(attModal);
    BGM.start(); VOICE.load(); startIntro();
    if (!st.layoutAsked && (st.tut == null || st.tut >= TUT.length)) queueModal(layoutAsk);
    track('title_start', {});
  });
  track('game_start', { returning: had ? 1 : 0 });
  requestAnimationFrame(frame);
  window.__hrk = { get st() { return st; }, G, save };
})();
