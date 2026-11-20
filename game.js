// 홈런왕 키우기 v0.1 - 화면, 입력, 연출
(function () {
  'use strict';
  const H = window.HR;
  const VERSION = 'v0.1 베타';
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
      const v = q === 'perfect' ? 0.55 : q === 'good' ? 0.4 : 0.25;
      noise(0.07, v, 'highpass', 1800);
      tone(q === 'perfect' ? 2400 : 1700, 0.09, 'triangle', v * 0.5);
      if (q === 'perfect') tone(900, 0.18, 'sine', 0.25);
    },
    whiff() { noise(0.25, 0.15, 'bandpass', 900, 0, 0.05); },
    mitt() { noise(0.06, 0.3, 'lowpass', 500); tone(120, 0.08, 'sine', 0.3); },
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

  const PITCH_T = 0.62; // 투구 비행 시간 (고정)
  const G = {
    phase: 'windup', t: 0, sp: 1,
    camMin: -4, camMax: 21, camFrom: null,
    result: null, manual: false, swingT: -1, swingQ: null,
    ballX: 0, ballY: 0, ballVis: false, trail: [],
    fx: [], texts: [], shake: 0, manualUntil: 0, fever: 0, flight: 1.4, clouds: [], crowdSeed: Math.random() * 1000,
  };
  for (let i = 0; i < 6; i++) G.clouds.push({ x: Math.random(), y: 0.08 + Math.random() * 0.25, s: 0.6 + Math.random() * 0.8 });

  function startPitch() {
    G.phase = 'windup'; G.t = 0; G.result = null; G.swingT = -1; G.swingQ = null; G.manual = false;
    G.ballVis = false; G.trail = []; G.sp = H.speedMult(st.stats.speed);
  }

  function nowS() { return performance.now() / 1000; }

  function onTap() {
    audio();
    G.manualUntil = nowS() + 4;
    if (G.phase !== 'pitch' && G.phase !== 'windup') return;
    if (G.swingT >= 0) return;
    const delta = G.phase === 'windup' ? -9 : G.t - PITCH_T;
    G.swingT = G.phase === 'pitch' ? G.t : 0;
    G.manual = true;
    const pw = H.perfectWindow(st), gw = H.goodWindow(st), ww = H.weakWindow(st);
    const ad = Math.abs(delta);
    let q = 'miss';
    if (ad <= pw) q = 'perfect'; else if (ad <= gw) q = 'good'; else if (ad <= ww) q = 'weak';
    G.swingQ = q;
    if (q === 'miss') { SFX.whiff(); popText(delta < 0 ? '너무 빨라요!' : '너무 늦어요!', '#ff9a9a'); }
    else contact(q, true);
  }

  function contact(q, manual) {
    const fever = G.fever > nowS();
    const r = H.hitResult(st, q, manual, fever);
    G.result = r;
    SFX.crack(q);
    const lbl = { perfect: 'PERFECT!', good: 'GOOD', weak: '빗맞음' }[q];
    popText(lbl, q === 'perfect' ? '#ffe14d' : q === 'good' ? '#9fe8ff' : '#d0d0d0', q === 'perfect' ? 30 : 24);
    burst(plateX(), groundY() - 0.9 * yScale(), q === 'perfect' ? 22 : 12, q === 'perfect' ? '#fff3a0' : '#ffffff');
    if (q === 'perfect') G.shake = 0.18;
    G.phase = 'flight'; G.t = 0;
    G.flight = (1.0 + Math.min(1.4, r.d / 160)) / Math.sqrt(G.sp);
    G.camFrom = [G.camMin, G.camMax];
    if (manual) { st.manualHits++; if (st.tutorial && st.manualHits >= 3) { st.tutorial = false; $('tapHint').style.display = 'none'; } }
  }

  function landed() {
    const r = G.result;
    const ev = H.applyHit(st, r);
    track('hit', { q: r.quality, hr: r.hr ? 1 : 0, manual: G.manual ? 1 : 0 });
    if (r.hr) {
      SFX.cheer(); G.shake = 0.35;
      popText(r.special ? '특대 홈런!!' : 'HOMERUN!', r.special ? '#ffcc00' : '#fff', r.special ? 42 : 38, true);
      confetti();
      if (st.streak === 5 || (st.streak > 5 && st.streak % 5 === 0)) {
        G.fever = nowS() + 15; toast('🔥 5연속 홈런! 15초 동안 코인 2배');
      }
    } else if (r.quality === 'weak') { /* 빗맞음 표시는 타격 순간에 이미 나옴 */ }
    else popText(r.d.toFixed(1) + 'm', '#fff');
    floatCoin('+' + fmt(r.coins));
    SFX.coin();
    if (ev.gems) toast('◆ 젬 +' + ev.gems + (r.special ? ' (특대 홈런 보너스)' : ''));
    if (ev.cleared) { track('stadium_clear', { s: st.stadium + 1 }); setTimeout(() => clearModal(), 700); }
    updateHUD(); markDirty();
  }

  function popText(s, color, size, big) { G.texts.push({ s, color, size: size || 24, t: 0, life: big ? 1.6 : 0.9, big }); }
  function burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
      G.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.3, t: 0, c: color, r: 2 + Math.random() * 2 });
    }
  }
  function confetti() {
    const cols = ['#ff5a5a', '#ffd84a', '#4cd97b', '#5bb8ff', '#ff8ce0', '#fff'];
    for (let i = 0; i < 70; i++) {
      G.fx.push({ x: Math.random() * W, y: -10 - Math.random() * 60, vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 120, life: 1.8 + Math.random(), t: 0, c: cols[i % cols.length], r: 3 + Math.random() * 2, conf: true, rot: Math.random() * 6 });
    }
  }

  // 좌표 변환
  function scale() { return W / (G.camMax - G.camMin); }
  function yScale() { return Math.min(scale(), 26); }
  function sx(m) { return (m - G.camMin) * scale(); }
  function groundY() { return Hh * 0.74; }
  function plateX() { return sx(0.2); }

  function update(dt) {
    const now = nowS();
    G.t += dt;
    const auto = st.auto && now > G.manualUntil;
    if (G.phase === 'windup') {
      if (G.t >= 0.8 / G.sp) { G.phase = 'pitch'; G.t = 0; G.ballVis = true; }
    } else if (G.phase === 'pitch') {
      const u = Math.min(1, G.t / PITCH_T);
      G.ballX = 18.0 + (0.2 - 18.0) * u;
      G.ballY = 1.9 + (0.9 - 1.9) * u - Math.sin(u * Math.PI) * 0.15;
      if (auto && G.swingT < 0 && G.t >= PITCH_T) {
        G.swingT = G.t; G.manual = false;
        contact(H.rollAutoQuality(st, Math.random), false);
      } else if (G.swingT < 0 && G.t >= PITCH_T + H.weakWindow(st) + 0.02) {
        G.phase = 'strike'; G.t = 0; SFX.mitt(); popText('스트라이크', '#ff9a9a'); st.streak = 0;
      } else if (G.swingQ === 'miss' && G.t >= PITCH_T + 0.05) {
        G.phase = 'strike'; G.t = 0; SFX.mitt(); st.streak = 0;
      }
    } else if (G.phase === 'flight') {
      const r = G.result;
      const u = Math.min(1, G.t / G.flight);
      const target = Math.max(H.fenceOf(st) + 14, r.d + 10);
      const cu = Math.min(1, u / 0.45), e = 1 - Math.pow(1 - cu, 3);
      G.camMin = G.camFrom[0] + (-4 - G.camFrom[0]) * e;
      G.camMax = G.camFrom[1] + (target - G.camFrom[1]) * e;
      if (r.quality === 'weak') {
        G.ballX = 0.2 + r.d * (1 - Math.pow(1 - u, 2));
        G.ballY = Math.abs(Math.sin(u * Math.PI * 3)) * (1 - u) * 1.6;
      } else {
        G.ballX = 0.2 + r.d * u;
        const apex = Math.max(6, r.d * (r.hr ? 0.3 : 0.22));
        G.ballY = 0.9 * (1 - u) + 4 * apex * u * (1 - u);
      }
      if (u >= 1) { G.phase = 'result'; G.t = 0; landed(); }
    } else if (G.phase === 'result') {
      if (G.t >= 0.75 / G.sp) { G.phase = 'reset'; G.t = 0; G.camFrom = [G.camMin, G.camMax]; G.ballVis = false; }
    } else if (G.phase === 'reset') {
      const u = Math.min(1, G.t / (0.35 / G.sp)), e = u * u * (3 - 2 * u);
      G.camMin = G.camFrom[0] + (-4 - G.camFrom[0]) * e;
      G.camMax = G.camFrom[1] + (21 - G.camFrom[1]) * e;
      if (u >= 1) startPitch();
    } else if (G.phase === 'strike') {
      if (G.t < 0.2) { const u = G.t / 0.2; G.ballX = 0.2 + (-1.2 - 0.2) * u; G.ballY = 0.9 - 0.2 * u; }
      if (G.t >= 0.7 / G.sp) startPitch();
    }
    if (G.ballVis && (G.phase === 'flight' || G.phase === 'pitch')) {
      G.trail.push([G.ballX, G.ballY]); if (G.trail.length > 14) G.trail.shift();
    }
    for (const p of G.fx) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.conf) p.vy += 300 * dt; else p.rot += dt * 6; }
    G.fx = G.fx.filter((p) => p.t < p.life);
    for (const t of G.texts) t.t += dt;
    G.texts = G.texts.filter((t) => t.t < t.life);
    if (G.shake > 0) G.shake -= dt;
  }

  // ---------- 그리기 ----------
  function draw() {
    const S = H.STADIUMS[st.stadium];
    const sc = scale(), ys = yScale(), gy = groundY();
    ctx.save();
    if (G.shake > 0) ctx.translate((Math.random() - 0.5) * 8 * G.shake / 0.35, (Math.random() - 0.5) * 8 * G.shake / 0.35);
    const fever = G.fever > nowS();
    // 하늘
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
      // 조명탑
      for (const fx of [0.15, 0.85]) {
        const x = W * fx; ctx.fillStyle = '#20263a'; ctx.fillRect(x - 2, gy * 0.15, 4, gy * 0.5);
        ctx.fillStyle = '#fffbe0'; ctx.fillRect(x - 14, gy * 0.12, 28, 10);
        const lg = ctx.createRadialGradient(x, gy * 0.14, 2, x, gy * 0.14, 90); lg.addColorStop(0, 'rgba(255,250,200,.45)'); lg.addColorStop(1, 'rgba(255,250,200,0)');
        ctx.fillStyle = lg; ctx.fillRect(x - 90, gy * 0.14 - 90, 180, 180);
      }
    }
    if (S.dome) { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.ellipse(W / 2, gy * 1.2, W * 0.9, gy * (0.2 * i), 0, Math.PI, 0); ctx.stroke(); } }

    // 먼 언덕
    if (!S.dome) {
      ctx.fillStyle = S.moon ? '#3a3d4a' : S.night ? '#16224a' : 'rgba(80,150,90,.55)';
      for (let i = 0; i < 5; i++) {
        const x = ((i * 0.27 + 0.1) * W * 1.4 - G.camMin * 0.6) % (W * 1.4) - W * 0.2;
        ctx.beginPath(); ctx.ellipse(x, gy, W * 0.28, gy * 0.16 + (i % 2) * 12, 0, Math.PI, 0); ctx.fill();
      }
    }
    // 관중석 (펜스 뒤)
    const fence = H.fenceOf(st), fxp = sx(fence);
    if (fxp < W + 40) {
      const standTop = gy - Math.max(44, Math.min(gy * 0.32, 14 * ys));
      ctx.fillStyle = S.moon ? '#2b2f3e' : '#30405e';
      ctx.beginPath(); ctx.moveTo(fxp, gy); ctx.lineTo(fxp + 20, standTop); ctx.lineTo(W + 50, standTop - 10); ctx.lineTo(W + 50, gy); ctx.fill();
      // 관중
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
      // 펜스
      const fh = Math.max(16, 3.2 * ys);
      ctx.fillStyle = S.moon ? '#5a5f70' : '#1f6b3a'; ctx.fillRect(fxp - 3, gy - fh, 7, fh);
      ctx.fillStyle = '#ffd84a'; ctx.fillRect(fxp - 3, gy - fh, 7, 3);
      ctx.fillStyle = '#fff'; ctx.font = '13px Jua'; ctx.textAlign = 'center';
      ctx.fillText(fence + 'm', fxp, gy - fh - 6);
    }
    // 잔디
    const gg = ctx.createLinearGradient(0, gy, 0, Hh);
    gg.addColorStop(0, S.grass); gg.addColorStop(1, shade(S.grass, -30));
    ctx.fillStyle = gg; ctx.fillRect(-10, gy, W + 20, Hh - gy + 10);
    // 잔디 줄무늬
    const stripe = 10;
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    for (let m = Math.floor(G.camMin / stripe) * stripe; m < G.camMax; m += stripe * 2) ctx.fillRect(sx(m), gy, stripe * sc, Hh - gy);
    // 내야 흙
    ctx.fillStyle = S.moon ? '#6d6f78' : '#c58b55';
    ctx.beginPath(); ctx.ellipse(sx(0.5), gy + 4, 3.2 * sc, 10, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx(18.4), gy + 3, 2.6 * sc, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(sx(0.2) - 6, gy + 2, 12, 3);
    // 거리 표시
    const range = G.camMax - G.camMin;
    const step = range < 40 ? 5 : range < 120 ? 10 : range < 300 ? 25 : range < 700 ? 50 : range < 1500 ? 100 : range < 4000 ? 250 : 1000;
    ctx.font = '11px Jua'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (let m = step; m < G.camMax; m += step) {
      if (m < G.camMin) continue;
      const x = sx(m); ctx.fillRect(x - 0.5, gy + 6, 1, 6); ctx.fillText(m + 'm', x, gy + 24);
    }
    // 최고 기록 깃발
    if (st.best > 0 && st.best > G.camMin && st.best < G.camMax && range > 30) {
      const x = sx(st.best); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy - 26); ctx.stroke();
      ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.moveTo(x, gy - 26); ctx.lineTo(x + 14, gy - 21); ctx.lineTo(x, gy - 16); ctx.fill();
      ctx.font = '10px Jua'; ctx.fillText('최고', x + 2, gy - 30);
    }

    // 사람들
    const ph = Math.max(18, 1.9 * sc * 2.1);
    drawPitcher(sx(18.4), gy, ph);
    drawCatcher(sx(-1.3), gy, ph * 0.8);
    drawBatter(sx(-0.55), gy, ph);

    // 타이밍 원
    if (G.phase === 'pitch' && G.swingT < 0) {
      const left = Math.max(0, PITCH_T - G.t) / PITCH_T;
      const px = plateX(), py = gy - 0.9 * ys;
      const pw = H.perfectWindow(st) / PITCH_T;
      ctx.lineWidth = 3;
      ctx.strokeStyle = left <= pw ? '#ffe14d' : 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(px, py, 7 + left * 46, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,225,77,.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 9, 0, 7); ctx.stroke();
    }
    // 공
    if (G.ballVis) {
      const bs = Math.max(3, Math.min(6, 0.12 * sc * 2));
      for (let i = 0; i < G.trail.length; i++) {
        const [tx, ty] = G.trail[i];
        ctx.fillStyle = `rgba(255,255,255,${(i / G.trail.length) * 0.35})`;
        ctx.beginPath(); ctx.arc(sx(tx), gy - ty * flightYS(), bs * (i / G.trail.length), 0, 7); ctx.fill();
      }
      const bx = sx(G.ballX), by = gy - G.ballY * flightYS();
      if (G.result && G.result.special && G.phase === 'flight') {
        ctx.fillStyle = 'rgba(255,200,0,.5)'; ctx.beginPath(); ctx.arc(bx, by, bs * 3, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#c33'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(bx, Math.max(bs, by), bs, 0, 7); ctx.fill(); ctx.stroke();
      // 공 그림자
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(bx, gy + 2, bs, bs * 0.4, 0, 0, 7); ctx.fill();
      // 비거리 카운터
      if (G.phase === 'flight' && G.result && G.result.quality !== 'weak') {
        ctx.font = '16px Jua'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3;
        const txt = Math.max(0, G.ballX).toFixed(1) + 'm';
        const ty = Math.max(18, by - 14);
        ctx.strokeText(txt, Math.min(W - 30, Math.max(30, bx)), ty); ctx.fillText(txt, Math.min(W - 30, Math.max(30, bx)), ty);
      }
    }
    // 파티클
    for (const p of G.fx) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c;
      if (p.conf) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    // 텍스트
    for (const t of G.texts) {
      const u = t.t / t.life;
      const s = t.big ? (u < 0.15 ? 0.5 + u / 0.15 * 0.7 : 1.2 - Math.min(0.2, (u - 0.15))) : 1;
      ctx.save(); ctx.translate(W / 2, (t.big ? Hh * 0.35 : Hh * 0.22) - u * 20); ctx.scale(s, s);
      ctx.globalAlpha = u > 0.75 ? (1 - u) / 0.25 : 1;
      ctx.font = t.size + 'px Jua'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText(t.s, 0, 0); ctx.fillStyle = t.color; ctx.fillText(t.s, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }
  let flightYSv = 1;
  function flightYS() {
    // 높은 타구도 화면에 들어오게 세로 배율 제한
    if (G.phase === 'flight' || G.phase === 'result') {
      const r = G.result; if (!r) return yScale();
      const apex = Math.max(6, r.d * (r.hr ? 0.3 : 0.22));
      flightYSv = Math.min(yScale(), (groundY() - 26) / apex);
      return flightYSv;
    }
    return yScale();
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt)), b = Math.max(0, Math.min(255, (n & 255) + amt));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  function body(x, gy, h, dir, jersey, pants, legSpread) {
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
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function head(x, y, h, dir, hat) {
    const r = h * 0.17;
    ctx.fillStyle = '#ffd7b0'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x + dir * r * 0.45, y - r * 0.05, Math.max(1, r * 0.12), 0, 7); ctx.fill();
    ctx.fillStyle = hat;
    ctx.beginPath(); ctx.arc(x, y - r * 0.1, r * 1.05, Math.PI, 0); ctx.fill();
    ctx.fillRect(x + (dir > 0 ? 0 : -r * 1.6), y - r * 0.2, r * 1.6, r * 0.28);
  }

  function drawBatter(x, gy, h) {
    const P = body(x, gy, h, 1, '#e8eef8', '#e8eef8', 0.17);
    ctx.fillStyle = '#1d4f91'; ctx.font = Math.max(7, h * 0.14) + 'px Jua'; ctx.textAlign = 'center'; ctx.fillText('7', x, P.chestY + h * 0.08);
    head(x + h * 0.02, P.headY, h, 1, '#1d4f91');
    // 헬멧 귀덮개
    ctx.fillStyle = '#1d4f91'; ctx.beginPath(); ctx.arc(x - h * 0.06, P.headY + h * 0.02, h * 0.07, 0, 7); ctx.fill();
    // 스윙 각도
    let ang = -2.35; // 뒤로 세운 자세
    if (G.swingT >= 0) {
      const el = (G.phase === 'pitch' ? G.t - G.swingT : 0.5);
      const u = Math.min(1, el / 0.14);
      ang = -2.35 + (2.35 + 1.0) * (1 - Math.pow(1 - u, 2));
      if (G.phase !== 'pitch') ang = 1.0;
    } else if (G.phase === 'pitch') ang = -2.35 - Math.sin(G.t * 10) * 0.05;
    if (G.phase === 'result' || G.phase === 'reset' || G.phase === 'flight') ang = 1.0;
    if (G.phase === 'strike' && G.swingQ === 'miss') ang = 1.0;
    const hx = x + h * 0.12, hy = P.chestY + h * 0.02;
    // 팔
    ctx.strokeStyle = '#ffd7b0'; ctx.lineWidth = Math.max(2, h * 0.07);
    ctx.beginPath(); ctx.moveTo(x - h * 0.08, P.chestY - h * 0.04); ctx.lineTo(hx, hy); ctx.stroke();
    // 방망이
    const b = H.equipped(st), g = H.GRADES[b.g];
    const len = h * 0.62;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
    const bg = ctx.createLinearGradient(0, -3, 0, 3); bg.addColorStop(0, '#fff'); bg.addColorStop(0.3, g.color); bg.addColorStop(1, g.dark);
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(-len * 0.08, -h * 0.02); ctx.lineTo(len * 0.4, -h * 0.022); ctx.lineTo(len, -h * 0.05); ctx.lineTo(len, h * 0.05); ctx.lineTo(len * 0.4, h * 0.022); ctx.lineTo(-len * 0.08, h * 0.02); ctx.closePath(); ctx.fill();
    if (b.e >= 10) { ctx.shadowColor = g.color; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0; }
    ctx.restore();
    ctx.fillStyle = '#ffd7b0'; ctx.beginPath(); ctx.arc(hx, hy, Math.max(2, h * 0.05), 0, 7); ctx.fill();
  }

  function drawPitcher(x, gy, h) {
    const P = body(x, gy - 4, h, -1, '#f2f2f2', '#d8d8d8', 0.12);
    head(x, P.headY, h, -1, '#c0392b');
    let a;
    if (G.phase === 'windup') { const u = G.t / (0.8 / G.sp); a = -0.5 - u * 2.4; }
    else if (G.phase === 'pitch') { const u = Math.min(1, G.t / 0.15); a = -2.9 + u * 4.2; }
    else a = 0.6;
    ctx.strokeStyle = '#ffd7b0'; ctx.lineWidth = Math.max(2, h * 0.07);
    const sx0 = x, sy0 = P.chestY - h * 0.05, L = h * 0.3;
    ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx0 - Math.cos(a) * L, sy0 + Math.sin(a) * L); ctx.stroke();
    if (G.phase === 'windup') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx0 - Math.cos(a) * L, sy0 + Math.sin(a) * L, Math.max(2, h * 0.04), 0, 7); ctx.fill(); }
    ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); ctx.arc(x - h * 0.15, P.chestY + h * 0.06, h * 0.07, 0, 7); ctx.fill();
  }
  function drawCatcher(x, gy, h) {
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
