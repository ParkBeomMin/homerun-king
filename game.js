// 홈런왕 키우기 v0.1 - 화면, 입력, 연출
(function () {
  'use strict';
  const H = window.HR;
  const VERSION = 'v0.2 베타';
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

  // ---------- 방망이 SVG ----------
  function batSVG(b, glow) {
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
  };
  for (let i = 0; i < 6; i++) G.clouds.push({ x: Math.random(), y: 0.08 + Math.random() * 0.25, s: 0.6 + Math.random() * 0.8 });

  function nowS() { return performance.now() / 1000; }

  function startPitch() {
    G.view = '1p'; G.phase = 'windup'; G.t = 0;
    G.pitch = H.genPitch(st);
    G.swingT = -1; G.swingQ = null; G.manual = false; G.autoTake = false; G.pendingQ = null;
    G.result = null; G.call = null; G.ballVis = false; G.trail = []; G.trail1 = []; G.batTrail = []; G.impact = null; G.launch = null;
    G.sp = H.speedMult(st.stats.speed); G.zoom = 0;
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
    if (big && navigator.vibrate) navigator.vibrate(45); else if (navigator.vibrate) navigator.vibrate(20);
    const lbl = { perfect: 'PERFECT!', good: 'GOOD', weak: '빗맞음' }[q];
    popText(lbl, q === 'perfect' ? '#ffe14d' : q === 'good' ? '#9fe8ff' : '#d0d0d0', q === 'perfect' ? 34 : 26, false, 0.3);
    if ((st.eyeCombo || 0) > 0 && q !== 'weak') popText('선구안 보너스 +' + st.eyeCombo * 10 + '%', '#7fffd4', 16, false, 0.42);
    if (p.meat && q !== 'weak') popText('실투를 놓치지 않았다!', '#ffcf6b', 16, false, 0.42);
    // 1인칭 발사 연출 준비
    const dir = r.quality === 'weak' ? 0.3 : 1;
    G.launch = { x0: b.x, y0: b.y, z0: Math.max(0, b.z), vx: (p.x * 0.6 + (Math.random() - 0.5)) * 3, h: r.hr ? 14 : r.quality === 'weak' ? 0.6 : 6 * dir, far: r.quality === 'weak' ? 9 : 45 };
    G.phase = 'launch'; G.t = 0; G.trail1 = [];
    if (manual) { st.manualHits++; if (st.tutorial && st.manualHits >= 3) { st.tutorial = false; $('tapHint').style.display = 'none'; } }
  }

  function doCall(swung) {
    const p = G.pitch, fever = G.fever > nowS();
    const res = H.callPitch(st, p, swung, fever);
    G.call = { p, ev: res.ev, swung };
    G.phase = 'call'; G.t = 0;
    if (res.ev === 'ball') { SFX.mitt(0.6); popText('볼', '#9fe8ff', 30); if (st.eyeCombo) popText('선구안 콤보 ' + st.eyeCombo + ' (+' + st.eyeCombo * 10 + '%)', '#7fffd4', 16, false, 0.4); }
    else if (res.ev === 'strike') { SFX.mitt(1); popText('스트라이크!', '#ffb0b0', 30); }
    else if (res.ev === 'swingmiss') { SFX.mitt(1); popText('헛스윙 스트라이크', '#ffb0b0', 26); }
    else if (res.ev === 'walk') { SFX.mitt(0.6); SFX.coin(); popText('볼넷!', '#7fffd4', 40, true); floatCoin('+' + fmt(res.coins)); toast('볼넷 보너스! 다음 공은 한가운데 실투'); track('walk', {}); }
    else if (res.ev === 'strikeout') { SFX.mitt(1); SFX.out(); popText(res.looking ? '루킹 삼진' : '삼진 아웃', '#ff7a7a', 36, true); G.shake = 0.12; track('strikeout', {}); }
    updateHUD(); markDirty();
  }

  function landed() {
    const r = G.result;
    const ev = H.applyHit(st, r);
    track('hit', { q: r.quality, hr: r.hr ? 1 : 0, manual: G.manual ? 1 : 0 });
    if (r.hr) {
      SFX.cheer(); G.shake = 0.35;
      popText(r.special ? '특대 홈런!!' : 'HOMERUN!', r.special ? '#ffcc00' : '#fff', r.special ? 42 : 38, true);
      confetti();
      if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
      if (st.streak === 5 || (st.streak > 5 && st.streak % 5 === 0)) {
        G.fever = nowS() + 15; toast('5연속 홈런! 15초 동안 코인 2배');
      }
    } else if (r.quality !== 'weak') popText(r.d.toFixed(1) + 'm', '#fff');
    else popText('땅볼 ' + r.d.toFixed(0) + 'm', '#d0d0d0', 22);
    floatCoin('+' + fmt(r.coins));
    SFX.coin();
    if (ev.gems) toast('◆ 젬 +' + ev.gems + (r.special ? ' (특대 홈런 보너스)' : ''));
    if (ev.cleared) { track('stadium_clear', { s: st.stadium + 1 }); setTimeout(() => clearModal(), 700); }
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
    const auto = st.auto && now > G.manualUntil;
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
      const target = Math.max(H.fenceOf(st) + 14, r.d + 10);
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
    // 외야 관중석
    const standH = Math.max(26, hy * 0.42);
    ctx.fillStyle = S.moon ? '#2b2f3e' : '#2c3b58';
    ctx.fillRect(-20, hy - standH, W + 40, standH);
    const cols = ['#ff6b6b', '#ffd84a', '#5bb8ff', '#ffffff', '#4cd97b', '#ff9f55'];
    let k = 0;
    for (let y = hy - standH + 4; y < hy - 8; y += 6) for (let x = -4 + ((y | 0) % 2) * 3; x < W + 4; x += 5) { ctx.fillStyle = cols[(k++ * 7 + (y | 0)) % cols.length]; ctx.globalAlpha = 0.75; ctx.fillRect(x, y, 3, 3); }
    ctx.globalAlpha = 1;
    // 펜스 + 전광판
    ctx.fillStyle = S.moon ? '#5a5f70' : '#1f6b3a'; ctx.fillRect(-20, hy - 7, W + 40, 7);
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(-20, hy - 7, W + 40, 1.5);
    ctx.font = '10px Jua'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(S.fence + 'm', W / 2, hy - 0.5);
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
  }

  function drawCount() {
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
  const FOLLOW = nrm({ x: -0.55, y: 0.62, z: 0.45 });
  function batDir(k, hands) {
    const p = G.pitch, tg = p ? pitchTarget(p) : { x: 0, y: ZC };
    const hit = nrm({ x: tg.x + 0.05 - hands.x, y: tg.y - hands.y, z: 0.05 - hands.z });
    if (k <= 1) return mix(COCK, hit, k * k);
    const e = 1 - Math.pow(1 - Math.min(1, k - 1), 2);
    const mid = nrm({ x: 0.35, y: 0.1, z: 0.9 });
    return e < 0.5 ? mix(hit, mid, e * 2) : mix(mid, FOLLOW, (e - 0.5) * 2);
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
    // 몸통 회전량
    const twist = Math.max(0, Math.min(1, kk)) * 0.35;
    const bw = 0.5 * s;
    // 다리 (화면 아래로 잘림)
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
    // 방망이
    const hands = { x: bx + 0.22 + twist * 0.2, y: 1.25 - Math.min(1, kk) * 0.28, z: bz - 0.05 + twist * 0.15 };
    const L = 0.86;
    const dir = batDir(kk, hands);
    const tip = { x: hands.x + dir.x * L, y: hands.y + dir.y * L, z: hands.z + dir.z * L };
    const knob = { x: hands.x - dir.x * 0.08, y: hands.y - dir.y * 0.08, z: hands.z - dir.z * 0.08 };
    const ph = proj(hands.x, hands.y, hands.z), pt = proj(tip.x, tip.y, tip.z), pk = proj(knob.x, knob.y, knob.z);
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
    const wTip = Math.max(3, 0.07 * pt[2]), wH = Math.max(2, 0.028 * ph[2]);
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
    } else {
      for (const fx of [0.15, 0.85]) {
        const x = W * fx; ctx.fillStyle = '#20263a'; ctx.fillRect(x - 2, gy * 0.15, 4, gy * 0.5);
        ctx.fillStyle = '#fffbe0'; ctx.fillRect(x - 14, gy * 0.12, 28, 10);
        const lg = ctx.createRadialGradient(x, gy * 0.14, 2, x, gy * 0.14, 90); lg.addColorStop(0, 'rgba(255,250,200,.45)'); lg.addColorStop(1, 'rgba(255,250,200,0)');
        ctx.fillStyle = lg; ctx.fillRect(x - 90, gy * 0.14 - 90, 180, 180);
      }
    }
    if (S.dome) { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.ellipse(W / 2, gy * 1.2, W * 0.9, gy * (0.2 * i), 0, Math.PI, 0); ctx.stroke(); } }
    if (!S.dome) {
      ctx.fillStyle = S.moon ? '#3a3d4a' : S.night ? '#16224a' : 'rgba(80,150,90,.55)';
      for (let i = 0; i < 5; i++) {
        const x = ((i * 0.27 + 0.1) * W * 1.4 - G.camMin * 0.6) % (W * 1.4) - W * 0.2;
        ctx.beginPath(); ctx.ellipse(x, gy, W * 0.28, gy * 0.16 + (i % 2) * 12, 0, Math.PI, 0); ctx.fill();
      }
    }
    const fence = H.fenceOf(st), fxp = sx(fence);
    if (fxp < W + 40) {
      const standTop = gy - Math.max(44, Math.min(gy * 0.32, 14 * ys));
      ctx.fillStyle = S.moon ? '#2b2f3e' : '#30405e';
      ctx.beginPath(); ctx.moveTo(fxp, gy); ctx.lineTo(fxp + 20, standTop); ctx.lineTo(W + 50, standTop - 10); ctx.lineTo(W + 50, gy); ctx.fill();
      const cols = ['#ff6b6b', '#ffd84a', '#5bb8ff', '#ffffff', '#4cd97b', '#ff9f55'];
      let k = 0;
      const jump = G.phase === 'result' && G.result && G.result.hr ? Math.sin(performance.now() / 60) * 2 : 0;
      for (let y = standTop + 8; y < gy - 6; y += 9) {
        const x0 = fxp + 20 * (1 - (y - standTop) / (gy - standTop)) + 6;
        for (let x = x0; x < W + 10; x += 8) {
          ctx.fillStyle = cols[(k++ * 7 + Math.floor(y)) % cols.length];
          ctx.fillRect(x, y + ((k % 2) ? jump : -jump), 4, 5);
        }
      }
      const fh = Math.max(16, 3.2 * ys);
      ctx.fillStyle = S.moon ? '#5a5f70' : '#1f6b3a'; ctx.fillRect(fxp - 3, gy - fh, 7, fh);
      ctx.fillStyle = '#ffd84a'; ctx.fillRect(fxp - 3, gy - fh, 7, 3);
      ctx.fillStyle = '#fff'; ctx.font = '13px Jua'; ctx.textAlign = 'center';
      ctx.fillText(fence + 'm', fxp, gy - fh - 6);
    }
    const gg = ctx.createLinearGradient(0, gy, 0, Hh);
    gg.addColorStop(0, S.grass); gg.addColorStop(1, shade(S.grass, -30));
    ctx.fillStyle = gg; ctx.fillRect(-10, gy, W + 20, Hh - gy + 10);
    const stripe = 10;
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    for (let m = Math.floor(G.camMin / stripe) * stripe; m < G.camMax; m += stripe * 2) ctx.fillRect(sx(m), gy, stripe * sc, Hh - gy);
    ctx.fillStyle = S.moon ? '#6d6f78' : '#c58b55';
    ctx.beginPath(); ctx.ellipse(sx(0.5), gy + 4, 3.2 * sc, 10, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx(18.4), gy + 3, 2.6 * sc, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(sx(0.2) - 6, gy + 2, 12, 3);
    const range = G.camMax - G.camMin;
    const step = range < 40 ? 5 : range < 120 ? 10 : range < 300 ? 25 : range < 700 ? 50 : range < 1500 ? 100 : range < 4000 ? 250 : 1000;
    ctx.font = '11px Jua'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (let m = step; m < G.camMax; m += step) {
      if (m < G.camMin) continue;
      const x = sx(m); ctx.fillRect(x - 0.5, gy + 6, 1, 6); ctx.fillText(m + 'm', x, gy + 24);
    }
    if (st.best > 0 && st.best > G.camMin && st.best < G.camMax && range > 30) {
      const x = sx(st.best); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy - 26); ctx.stroke();
      ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.moveTo(x, gy - 26); ctx.lineTo(x + 14, gy - 21); ctx.lineTo(x, gy - 16); ctx.fill();
      ctx.font = '10px Jua'; ctx.fillText('최고', x + 2, gy - 30);
    }
    const ph = Math.max(18, 1.9 * sc * 2.1);
    drawPitcherSide(sx(18.4), gy, ph);
    drawCatcherSide(sx(-1.3), gy, ph * 0.8);
    drawBatterSide(sx(-0.55), gy, ph);
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
        const txt = Math.max(0, G.ballX).toFixed(1) + 'm';
        const ty = Math.max(20, by - 14);
        ctx.strokeText(txt, Math.min(W - 34, Math.max(34, bx)), ty); ctx.fillText(txt, Math.min(W - 34, Math.max(34, bx)), ty);
      }
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
    $('fenceTxt').textContent = '펜스 ' + S.fence + 'm';
    const n = st.stadiumHR[st.stadium] || 0, cleared = st.cleared.includes(st.stadium);
    $('stadProg').style.width = (cleared ? 100 : Math.min(100, n / H.HR_TO_CLEAR * 100)) + '%';
    $('stadHR').textContent = cleared ? '클리어' : '홈런 ' + n + '/' + H.HR_TO_CLEAR;
    const now = performance.now();
    if (now - cpsAt > 3000) { lastCPS = H.expectedCPS(st, 150); cpsAt = now; }
    $('cps').textContent = '자동 초당 ' + fmt(lastCPS) + ' · 직접 치면 +20%';
    $('feverTag').style.display = G.fever > nowS() ? 'inline-block' : 'none';
    // 탭 알림 점
    const dots = document.querySelectorAll('#tabs .dot');
    const canStat = Object.keys(H.STATS).some((k) => st.stats[k] < H.STATS[k].max && st.coins >= H.statCost(k, st.stats[k]));
    dots[0].style.display = canStat ? 'block' : 'none';
    const eb = H.equipped(st);
    dots[1].style.display = (eb.e < H.ENH_MAX && st.coins >= H.enhCost(eb)) || H.bestBat(st).id !== st.equip ? 'block' : 'none';
    dots[2].style.display = st.gems >= H.PREMIUM_GEMS ? 'block' : 'none';
    dots[3].style.display = st.maxStadium > st.stadium ? 'block' : 'none';
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
    const html = tab === 'batter' ? renderBatter() : tab === 'bats' ? renderBats() : tab === 'shop' ? renderShop() : renderStadium();
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
    let h = `<div class="h">타자 능력치 <span class="r"><button class="btn sm ${bulk === 1 ? '' : 'gray'}" data-bulk="1">x1</button> <button class="btn sm ${bulk === 10 ? '' : 'gray'}" data-bulk="10">x10</button> <button class="btn sm ${bulk === 'max' ? '' : 'gray'}" data-bulk="max">MAX</button></span></div>`;
    for (const k of Object.keys(H.STATS)) {
      const S = H.STATS[k], lv = st.stats[k], max = lv >= S.max;
      const { c, n } = bulkCost(k);
      h += `<div class="card stat"><div class="si">${S.icon}</div><div class="sm"><div class="sn">${S.name} <span class="small">Lv.${lv}${S.max < 999 ? ' / ' + S.max : ''}</span></div>
      <div class="sd">${S.desc(lv)}${max ? '' : ' → ' + S.desc(lv + n).split(' ').pop()}</div></div>
      <button class="btn" data-stat="${k}" ${max || st.coins < c ? 'disabled' : ''}>${max ? 'MAX' : '강화' + (n > 1 ? ' x' + n : '')}<span class="cost">₩ ${max ? '-' : fmt(c)}</span></button></div>`;
    }
    const b = H.equipped(st);
    h += `<div class="card small">현재 홈런 확률(자동) 약 <b style="color:#fff">${Math.round(H.homerunRate(st, 300) * 100)}%</b> · 방망이 파워 x${fmt(H.batPower(b), 2)} · 퍼펙트 판정 ±${Math.round(H.perfectWindow(st) * 1000)}ms<br>타이밍 원이 작은 원에 겹칠 때 탭하면 PERFECT. 직접 친 퍼펙트는 비거리 +15%, 코인 +20%예요.</div>`;
    return h;
  }

  function renderBats() {
    const b = H.equipped(st), g = H.GRADES[b.g];
    const rate = H.enhRate(b), cost = H.enhCost(b), max = b.e >= H.ENH_MAX;
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
    <div class="card shopi"><div class="pic">🪵</div><div style="flex:1"><div>나무 배트</div><div class="small">일반 등급, 특성 랜덤. 합성 재료로 좋아요</div></div>
      <button class="btn" data-buy="wood" ${full || st.coins < wp ? 'disabled' : ''}>구매<span class="cost">₩ ${fmt(wp)}</span></button></div>
    <div class="card shopi"><div class="pic">📦</div><div style="flex:1"><div>일반 상자</div><div class="odds">${oddsTxt(H.BOX.normal.odds)}</div></div>
      <button class="btn" data-buy="normal" ${full || st.coins < np ? 'disabled' : ''}>열기<span class="cost">₩ ${fmt(np)}</span></button></div>
    <div class="card shopi"><div class="pic">🎁</div><div style="flex:1"><div>고급 상자</div><div class="odds">${oddsTxt(H.BOX.premium.odds)}</div></div>
      <button class="btn blue" data-buy="premium" ${full || st.gems < H.PREMIUM_GEMS ? 'disabled' : ''}>열기<span class="cost">◆ ${H.PREMIUM_GEMS}</span></button></div>
    <div class="card shopi"><div class="pic">🛡</div><div style="flex:1"><div>강화 보호권</div><div class="small">+10 이상 강화에서 파괴될 때 대신 1단계 하락으로 막아줘요</div></div>
      <button class="btn blue" data-buy="ticket" ${st.gems < H.TICKET_GEMS ? 'disabled' : ''}>구매<span class="cost">◆ ${H.TICKET_GEMS}</span></button></div>
    <div class="card small">◆ 젬은 구장 클리어, 홈런 25개마다, 특대 홈런으로 얻어요. 실제 결제는 없어요.<br>상자 가격은 도달한 구장에 따라 올라가요.</div>`;
  }

  function renderStadium() {
    let h = '<div class="h">구장</div>';
    H.STADIUMS.forEach((S, i) => {
      const lock = i > st.maxStadium, cur = i === st.stadium, cl = st.cleared.includes(i);
      const n = st.stadiumHR[i] || 0;
      h += `<div class="card st ${lock ? 'lock' : ''} ${cur ? 'cur' : ''}"><div class="num">${i + 1}</div><div style="flex:1;min-width:0">
      <div>${S.name} ${cl ? '<span class="grade" style="background:#4cd97b">클리어</span>' : ''}</div>
      <div class="small">펜스 ${S.fence}m · 코인 x${fmt(H.coinMultOf(i), 1)} · ${lock ? '이전 구장 홈런 ' + H.HR_TO_CLEAR + '개로 열림' : '홈런 ' + n + '개'}</div></div>
      ${cur ? '<button class="btn sm gray" disabled>경기 중</button>' : lock ? '<button class="btn sm gray" disabled>잠김</button>' : `<button class="btn sm green" data-go="${i}">이동</button>`}</div>`;
    });
    h += `<div class="h">기록</div><div class="card small" style="line-height:1.7">
      총 홈런 <b style="color:#fff">${fmt(st.totalHR)}</b> · 총 타격 ${fmt(st.totalHits)}<br>
      최고 비거리 <b style="color:#ffd84a">${st.best.toFixed(1)}m</b> · 최고 연속 홈런 ${st.bestStreak}<br>
      특대 홈런 ${st.specials} · 강화 시도 ${st.enhTries} · 파괴된 방망이 ${st.destroyed}</div>
      <div class="h">설정</div><div class="card" style="display:flex;gap:8px">
      <button class="btn sm ${st.sound ? 'green' : 'gray'}" id="sndBtn">사운드 ${st.sound ? 'ON' : 'OFF'}</button>
      <button class="btn sm red" id="resetBtn">처음부터 하기</button></div>
      <div class="ver">홈런왕 키우기 ${VERSION}</div>`;
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
      track('buy', { kind: d.buy });
      if (r.bat) { SFX.box(); revealModal(r.bat, d.buy === 'wood' ? '구매 완료' : '상자 오픈!'); }
      else { SFX.up(); toast('강화 보호권 +1'); }
      updateHUD(); return renderPanel();
    }
    if (d.go) { H.moveStadium(st, +d.go); SFX.click(); track('stadium_move', { s: +d.go + 1 }); afterMove(); return; }
    if (t.id === 'sndBtn') { st.sound = !st.sound; return renderPanel(); }
    if (t.id === 'resetBtn') {
      return confirmModal('정말 처음부터 할까요? 모든 기록이 지워져요.', () => { localStorage.removeItem(SAVE_KEY); st = H.newState(); save(); afterMove(); toast('새로 시작했어요'); });
    }
  });

  function afterMove() { G.camMin = -4; G.camMax = 21; startPitch(); updateHUD(); renderPanel(); }

  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.t; SFX.click();
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
    panel.scrollTop = 0; renderPanel();
  });
  $('autoBtn').addEventListener('click', () => {
    st.auto = !st.auto; audio(); SFX.click(); syncAuto();
  });
  function syncAuto() { const b = $('autoBtn'); b.classList.toggle('on', st.auto); b.textContent = '자동 타격 ' + (st.auto ? 'ON' : 'OFF'); }
  $('fieldWrap').addEventListener('pointerdown', (e) => { e.preventDefault(); onTap(); });

  // ---------- 모달 ----------
  const modal = $('modal');
  function openModal(html) { modal.innerHTML = '<div class="mbox">' + html + '</div>'; modal.classList.remove('hidden'); }
  function closeModal() { modal.classList.add('hidden'); modal.innerHTML = ''; }
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
      if (b.g >= 3) { SFX.success(); confetti(); }
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
      if (r.result === 'success') { SFX.success(); html = `<h2>강화 성공!</h2><div class="bimg glow">${batSVG(nb)}</div><div class="res" style="color:#4cd97b">+${r.e} 달성</div>`; if (r.e >= 10) confetti(); }
      else if (r.result === 'keep') { SFX.fail(); html = `<h2>강화 실패</h2><div class="bimg">${batSVG(nb)}</div><div class="res" style="color:#ffd84a">단계 유지 +${r.e}</div>`; }
      else if (r.result === 'down') { SFX.fail(); html = `<h2>강화 실패</h2><div class="bimg">${batSVG(nb)}</div><div class="res" style="color:#ff9a6a">+${before} → +${r.e} 하락</div>`; }
      else if (r.result === 'saved') { SFX.saved(); html = `<h2>휴, 살았다!</h2><div class="bimg">${batSVG(nb)}</div><div class="res" style="color:#6ff0ff">보호권이 파괴를 막았어요</div><p>+${before} → +${r.e}, 남은 보호권 ${st.tickets}개</p>`; }
      else { SFX.destroy(); G.shake = 0.4; html = `<h2>방망이 파괴...</h2><div class="res" style="color:#ff5a5a">${name} +${before} 파괴됨</div><p>보유한 가장 강한 방망이를 장착했어요</p>`; }
      openModal(html + `<div class="mbtns"><button class="btn gray" data-close>닫기</button>${r.result !== 'destroy' && nb && nb.e < H.ENH_MAX ? '<button class="btn" id="again">한 번 더</button>' : ''}</div>`);
      const ag = $('again'); if (ag) ag.onclick = () => { closeModal(); doEnhance(); };
      cpsAt = 0; updateHUD(); renderPanel(); save();
    }, 750);
  }

  function clearModal() {
    const s = st.stadium, next = H.STADIUMS[s + 1];
    SFX.success(); confetti();
    openModal(`<h2>🏆 ${H.STADIUMS[s].name} 클리어!</h2><p>젬 +${15 + s * 5}</p>${next ? `<p>다음 구장 <b style="color:#fff">${next.name}</b>이 열렸어요.<br>펜스 ${next.fence}m, 투수가 더 강하지만 코인은 ${fmt(H.coinMultOf(1), 1)}배!</p>
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
  document.querySelector('#tabs [data-t="bats"] b').innerHTML = '<span style="display:inline-block;width:34px">' + batSVG({ g: 0, t: 'power', e: 0 }) + '</span>';

  // ---------- 시작 ----------
  const had = load();
  resize(); syncAuto(); startPitch();
  if (!st.tutorial) $('tapHint').style.display = 'none';
  updateHUD(); renderPanel();
  if (had) { const o = H.offlineReward(st, Date.now()); if (o.coins > 0) offlineModal(o); }
  track('game_start', { returning: had ? 1 : 0 });
  requestAnimationFrame(frame);
  window.__hrk = { get st() { return st; }, G, save };
})();
