// 홈런왕 core: 순수 로직 (브라우저와 node 시뮬 공용)
(function (G) {
  'use strict';

  const GRADES = [
    { id: 0, name: '일반', mat: '나무', color: '#c9a46a', dark: '#7a5a2e', base: 1.0, enhBase: 60, sell: 20 },
    { id: 1, name: '고급', mat: '알루미늄', color: '#9fdcff', dark: '#3c7fa8', base: 1.6, enhBase: 400, sell: 150 },
    { id: 2, name: '희귀', mat: '카본', color: '#b98cff', dark: '#5b2fa8', base: 2.5, enhBase: 3000, sell: 1200 },
    { id: 3, name: '영웅', mat: '티타늄', color: '#ff9f55', dark: '#a8501a', base: 4.0, enhBase: 25000, sell: 9000 },
    { id: 4, name: '전설', mat: '전설', color: '#ffe066', dark: '#b38600', base: 6.5, enhBase: 200000, sell: 70000 },
  ];

  const TRAITS = {
    power: { name: '파워형', short: '파워', desc: '비거리 +20%' },
    contact: { name: '컨택형', short: '컨택', desc: '퍼펙트 판정 +35%, 자동 퍼펙트 +6%' },
    luck: { name: '행운형', short: '행운', desc: '특대 홈런 +5%, 코인 +15%' },
  };

  const BAT_NAMES = [
    { power: '통나무 배트', contact: '물푸레 배트', luck: '네잎 나무배트' },
    { power: '묵직한 알루 배트', contact: '경량 알루 배트', luck: '반짝 알루 배트' },
    { power: '카본 해머', contact: '카본 레이저', luck: '카본 클로버' },
    { power: '티타늄 버스터', contact: '티타늄 스나이퍼', luck: '티타늄 잭팟' },
    { power: '유성 배트', contact: '번개 깃털 배트', luck: '황금 왕관 배트' },
  ];

  // 강화 성공률 (현재 단계 -> 다음 단계)
  const ENH_RATE = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 12, 10];
  const ENH_MAX = 20;
  const DESTROY_CHANCE = 0.3; // +10 이상 실패 시 파괴 확률

  const STADIUMS = [
    { name: '동네 공터', fence: 45, sky: ['#7cc6ff', '#d8f0ff'], grass: '#5fae4a', night: false },
    { name: '학교 운동장', fence: 60, sky: ['#6fb8f5', '#cfeaff'], grass: '#4fa24a', night: false },
    { name: '사회인 리그 구장', fence: 80, sky: ['#ffb36b', '#ffe2b8'], grass: '#4b9b45', night: false },
    { name: '고교 야구장', fence: 95, sky: ['#5aa7ea', '#c4e4ff'], grass: '#3f9443', night: false },
    { name: '대학 야구장', fence: 105, sky: ['#ff8e6b', '#ffd2a8'], grass: '#3a8d40', night: false },
    { name: '2군 구장', fence: 115, sky: ['#2c3e75', '#6a7fc0'], grass: '#2f8a3f', night: true },
    { name: '프로 구장', fence: 122, sky: ['#141d45', '#3b4f9a'], grass: '#2c8a3c', night: true },
    { name: '돔 구장', fence: 130, sky: ['#3a3f4f', '#7d8496'], grass: '#2f9443', night: true, dome: true },
    { name: '바다 건너 빅리그', fence: 138, sky: ['#0d1438', '#33407f'], grass: '#2a8a3a', night: true },
    { name: '달 기지 구장', fence: 160, sky: ['#05060f', '#1d2140'], grass: '#8a8f9e', night: true, moon: true },
    // 장외 홈런 단계: 타석은 빅리그 구장, 목표 거리는 구장 밖
    { name: '구장 밖 주차장', fence: 500, sky: ['#6fb8f5', '#cfeaff'], grass: '#3f9443', night: false, out: 'parking' },
    { name: '도심 빌딩 숲', fence: 2000, sky: ['#ff9a6b', '#ffdcb5'], grass: '#3a8d40', night: false, out: 'city' },
    { name: '산 넘어 바다', fence: 10000, sky: ['#4f9fe6', '#c3e8ff'], grass: '#3f9443', night: false, out: 'sea' },
    { name: '구름 위 성층권', fence: 100000, sky: ['#123378', '#6fa4f5'], grass: '#3a8d40', night: false, out: 'sky' },
    { name: '대기권 돌파', fence: 1000000, sky: ['#020414', '#141a3a'], grass: '#2a8a3a', night: true, out: 'space' },
  ];
  const OUT_START = 10;
  const HR_TO_CLEAR = 10;
  const RESIST = 2.3; // 구장마다 투수 저항 배율
  const COIN_STEP = 3.3; // 구장마다 코인 배율

  const STATS = {
    power: { name: '힘', icon: '💪', base: 15, growth: 1.21, max: 999, desc: (lv) => '비거리 x' + fmt(powerMult(lv), 2) },
    contact: { name: '정확', icon: '🎯', base: 30, growth: 1.3, max: 50, desc: (lv) => '자동 퍼펙트 ' + Math.round(autoPerfectBase(lv) * 100) + '%' },
    speed: { name: '스윙 속도', icon: '⚡', base: 60, growth: 1.35, max: 30, desc: (lv) => '경기 속도 x' + fmt(speedMult(lv), 2) },
    fame: { name: '인기', icon: '⭐', base: 40, growth: 1.24, max: 999, desc: (lv) => '코인 x' + fmt(fameMult(lv), 2) },
    eye: { name: '선구안', icon: '👁', base: 25, growth: 1.27, max: 30, desc: (lv) => '자동 볼 판단 ' + Math.round(eyeRate(lv) * 100) + '%' },
  };
  function eyeRate(lv) { return Math.min(0.96, 0.66 + lv * 0.01); }

  function powerMult(lv) { return Math.pow(1.05, lv); }
  function autoPerfectBase(lv) { return Math.min(0.6, 0.08 + lv * 0.01); }
  function speedMult(lv) { return 1 + lv * 0.05; }
  function fameMult(lv) { return 1 + lv * 0.1; }

  function statCost(key, lv) { const s = STATS[key]; return Math.ceil(s.base * Math.pow(s.growth, lv)); }

  function batPower(b) {
    const g = GRADES[b.g];
    let p = g.base * (1 + 0.1 * b.e + 0.01 * b.e * b.e);
    if (b.t === 'power') p *= 1.2;
    return p;
  }
  function batName(b) { return BAT_NAMES[b.g][b.t]; }
  // 강화 비용: 등급 기본값 x 1.6^단계 x (6구장부터) 구장 코인 배율 x 명예 배율. 은퇴하면 구장 배율은 다시 낮아짐
  function enhCost(b, st) { return Math.ceil(GRADES[b.g].enhBase * Math.pow(1.6, b.e) * (st ? coinMultOf(Math.max(0, (st.maxStadium || 0) - 5)) * honorMult(st) : 1)); }
  function enhRate(b) { return b.e >= ENH_MAX ? 0 : ENH_RATE[b.e]; }
  function failText(e) {
    if (e < 5) return '실패해도 단계 유지';
    if (e < 10) return '실패 시 1단계 하락';
    return '실패 시 1단계 하락, ' + Math.round(DESTROY_CHANCE * 100) + '% 확률로 파괴';
  }

  let _uid = 1;
  function newBat(g, t, rng) {
    rng = rng || Math.random;
    if (!t) { const k = ['power', 'contact', 'luck']; t = k[Math.floor(rng() * 3)]; }
    return { id: Date.now().toString(36) + (_uid++).toString(36) + Math.floor(rng() * 1e4).toString(36), g, t, e: 0 };
  }

  function newState() {
    const b = newBat(0, 'power');
    return {
      v: 1, coins: 0, gems: 60, tickets: 0,
      stats: { power: 0, contact: 0, speed: 0, fame: 0, eye: 0 },
      count: { b: 0, s: 0 }, eyeCombo: 0, meatball: false, walks: 0, strikeouts: 0, takes: 0,
      honor: 0, retires: 0, runBest: 0, vibe: true, bgm: true,
      att: { last: '', n: 0 }, daily: null, ach: {}, maxEnh: 0, gotLegend: false, maxEver: 0, clearedLast: false,
      dex: { '0_power': true }, bossWin: {}, derby: null, derbyBest: 0, tut: 0, codes: {}, devId: Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4), nick: '', voice: true,
      bats: [b], equip: b.id,
      stadium: 0, maxStadium: 0, stadiumHR: [0], cleared: [],
      totalHR: 0, totalHits: 0, best: 0, streak: 0, bestStreak: 0,
      cps: 0, lastSave: Date.now(), created: Date.now(), tutorial: true, sound: true, auto: true,
      manualHits: 0, specials: 0, enhTries: 0, destroyed: 0,
    };
  }

  function equipped(st) { return st.bats.find((b) => b.id === st.equip) || st.bats[0]; }

  function fenceOf(st) { return STADIUMS[st.stadium].fence; }
  function resistOf(s) { return Math.pow(RESIST, Math.min(s, OUT_START - 1)); }
  function coinMultOf(s) { return Math.pow(COIN_STEP, Math.min(s, OUT_START - 1)) * Math.pow(1.6, Math.max(0, s - OUT_START + 1)); }
  // 은퇴(명예) 보너스
  const HONOR_PCT = 0.03;
  function honorMult(st) { return 1 + HONOR_PCT * (st.honor || 0); }
  const RETIRE_AT = 5; // 6구장이 열리면 은퇴 가능
  function canRetire(st) { return st.maxStadium >= RETIRE_AT; }
  // 도달한 구장으로 명예 결정 (6구장 3점, 한 구장 오를 때마다 1.8배, 마지막 단계 클리어 시 2배)
  function honorGain(st) { if (!canRetire(st)) return 0; let g = Math.round(3 * Math.pow(1.8, st.maxStadium - RETIRE_AT)); if (st.cleared.includes(STADIUMS.length - 1)) g *= 2; return g; }
  function retire(st) {
    const g = honorGain(st); if (!g) return 0;
    st.honor = (st.honor || 0) + g; st.retires = (st.retires || 0) + 1;
    st.coins = 0; st.stats = { power: 0, contact: 0, speed: 0, fame: 0, eye: 0 };
    st.stadium = 0; st.maxStadium = 0; st.stadiumHR = [0]; st.cleared = [];
    st.streak = 0; st.count = { b: 0, s: 0 }; st.eyeCombo = 0; st.meatball = false; st.runBest = 0;
    return g;
  }

  function perfectWindow(st) {
    const b = equipped(st);
    let w = 0.05 + st.stats.contact * 0.0016;
    if (b && b.t === 'contact') w *= 1.35;
    return w;
  }
  function goodWindow(st) { return perfectWindow(st) + 0.08; }
  function weakWindow(st) { return goodWindow(st) + 0.08; }

  function autoPerfect(st) {
    const b = equipped(st);
    return Math.min(0.75, autoPerfectBase(st.stats.contact) + (b && b.t === 'contact' ? 0.06 : 0));
  }

  function rollAutoQuality(st, rng) {
    const r = rng();
    const p = autoPerfect(st);
    if (r < p) return 'perfect';
    if (r < p + 0.5) return 'good';
    return 'weak';
  }

  const QMULT = { perfect: 1.5, good: 1.0, weak: 0.42 };

  function specialChance(st) {
    const b = equipped(st);
    return 0.04 + (b && b.t === 'luck' ? 0.05 : 0);
  }

  // 타격 결과 계산
  function hitResult(st, quality, manual, fever, rng, bonus) {
    rng = rng || Math.random;
    if (quality === 'miss') return { quality, d: 0, hr: false, coins: 0, special: false };
    const b = equipped(st);
    let d = 32 * powerMult(st.stats.power) * batPower(b) * QMULT[quality] * (0.9 + rng() * 0.2) / resistOf(st.stadium);
    if (manual && quality === 'perfect') d *= 1.15;
    if (bonus) d *= bonus;
    let special = false;
    if (quality === 'perfect' && rng() < specialChance(st)) { special = true; d *= 2; }
    d *= honorMult(st) * dexMult(st);
    d = Math.max(3, d);
    const hr = quality !== 'weak' && d >= fenceOf(st);
    let coins = d * 0.25 * coinMultOf(st.stadium) * fameMult(st.stats.fame) * (hr ? 3 : 1);
    if (b && b.t === 'luck') coins *= 1.15;
    if (manual) coins *= 1.2;
    if (fever) coins *= 2;
    coins *= honorMult(st) * dexCoin(st) * (isWeekend() ? 2 : 1);
    return { quality, d, hr, coins: Math.max(1, Math.round(coins)), special };
  }

  // 자동 타격 1회당 걸리는 시간(초)
  function cycleTime(st, d) {
    const sp = speedMult(st.stats.speed);
    const flight = 1.0 + Math.min(1.4, (d || 40) / 160);
    return (0.75 + 0.55 + flight + 0.6) / sp;
  }

  // ---------- 투구와 볼카운트 ----------
  const PITCH_T = 0.62;
  function ballChance(st) { return Math.min(0.46, 0.3 + st.stadium * 0.018); }
  const PITCH_TYPES = {
    fast: { name: '직구', t: 1.0, kmh: 0 },
    curve: { name: '커브', t: 1.13, kmh: -22 },
    slider: { name: '슬라이더', t: 1.05, kmh: -10 },
    change: { name: '체인지업', t: 1.22, kmh: -18 },
  };
  function pitchTypesFor(s) { const t = ['fast']; if (s >= 2) t.push('curve'); if (s >= 4) t.push('slider'); if (s >= 6) t.push('change'); return t; }
  // opts: { strikeOnly, boss }
  function genPitch(st, rng, opts) {
    rng = rng || Math.random; opts = opts || {};
    const lvl = Math.min(st.stadium, 12);
    if (st.meatball && !opts.boss) {
      st.meatball = false;
      return { x: (rng() - 0.5) * 0.5, y: (rng() - 0.5) * 0.5, strike: true, meat: true, t: PITCH_T * 1.1, bx: 0, by: 0, type: 'fast', kmh: 118 };
    }
    let x, y;
    const bc = opts.strikeOnly ? 0 : Math.min(0.52, ballChance(st) + (opts.boss ? 0.06 : 0));
    if (rng() < bc) {
      const out = 1.1 + rng() * 0.7;
      if (rng() < 0.5) { x = (rng() < 0.5 ? -1 : 1) * out; y = (rng() * 2 - 1) * 1.15; }
      else { y = (rng() < 0.5 ? -1 : 1) * out; x = (rng() * 2 - 1) * 1.15; }
    } else {
      x = rng() * 2 - 1; y = rng() * 2 - 1;
      const edge = opts.strikeOnly ? 0.15 : Math.min(0.6, lvl * 0.06 + (opts.boss ? 0.15 : 0));
      if (rng() < edge) { if (rng() < 0.5) x = (x < 0 ? -1 : 1) * (0.72 + rng() * 0.28); else y = (y < 0 ? -1 : 1) * (0.72 + rng() * 0.28); }
    }
    const strike = Math.abs(x) <= 1 && Math.abs(y) <= 1;
    const types = pitchTypesFor(opts.boss ? Math.max(st.stadium, 4) : st.stadium);
    let type = types[Math.floor(rng() * types.length)];
    if (!opts.boss && rng() < 0.45) type = 'fast';
    const PT = PITCH_TYPES[type];
    const speed = (1 + Math.min(0.2, lvl * 0.022)) * (opts.boss ? 1.1 : 1);
    const brk = Math.min(1.4, 0.35 + lvl * 0.12) * (opts.boss ? 1.25 : 1);
    let bx, by;
    if (type === 'curve') { bx = (rng() - 0.5) * 0.4; by = 1.1 + brk * 0.8; }
    else if (type === 'slider') { bx = (rng() < 0.5 ? -1 : 1) * (0.9 + brk * 0.8); by = 0.2; }
    else if (type === 'change') { const a = rng() * Math.PI * 2; bx = Math.cos(a) * brk * 0.4; by = 0.5 + Math.abs(Math.sin(a)) * 0.4; }
    else { const a = rng() * Math.PI * 2; bx = Math.cos(a) * brk * 0.55; by = Math.sin(a) * brk * 0.55; }
    const kmh = Math.round(125 + lvl * 3 + rng() * 8 + PT.kmh + (opts.boss ? 8 : 0));
    return { x, y, strike, meat: false, t: PITCH_T / speed * PT.t * (0.95 + rng() * 0.1), bx, by, type, kmh };
  }
  function edgeDist(p) { return Math.max(Math.abs(p.x), Math.abs(p.y)) - 1; }
  const DOWN = { perfect: 'good', good: 'weak', weak: 'miss', miss: 'miss' };
  // 타이밍 판정 + 공 위치 -> 최종 타구 품질
  function swingOutcome(st, p, q, rng) {
    rng = rng || Math.random;
    if (q === 'miss') return 'miss';
    if (p.strike) return q;
    const e = edgeDist(p);
    if (e < 0.2) return DOWN[q];
    return rng() < 0.35 ? 'weak' : 'miss';
  }
  function eyeOf(st) { return eyeRate(st.stats.eye || 0); }
  function autoDecide(st, p, rng) {
    rng = rng || Math.random;
    const ok = rng() < eyeOf(st);
    return p.strike ? ok : !ok; // true = 스윙
  }
  function hitBonus(st, p) { return (1 + 0.1 * (st.eyeCombo || 0)) * (p && p.meat ? 1.1 : 1); }
  function resetCount(st) { st.count = { b: 0, s: 0 }; }
  // 스윙하지 않았을 때 또는 헛스윙
  function callPitch(st, p, swung, fever) {
    if (!st.count) resetCount(st);
    if (swung) { // 헛스윙
      st.eyeCombo = 0; st.count.s++;
      if (st.count.s >= 3) { st.strikeouts++; st.streak = 0; resetCount(st); return { ev: 'strikeout' }; }
      return { ev: 'swingmiss' };
    }
    st.takes++;
    if (!p.strike) {
      st.eyeCombo = Math.min(5, (st.eyeCombo || 0) + 1); st.count.b++; bump(st, 'eye');
      if (st.count.b >= 4) {
        st.walks++; resetCount(st); st.meatball = true;
        const coins = hitResult(st, 'good', false, fever).coins;
        st.coins += coins;
        return { ev: 'walk', coins };
      }
      return { ev: 'ball' };
    }
    st.count.s++;
    if (st.count.s >= 3) { st.strikeouts++; st.streak = 0; resetCount(st); return { ev: 'strikeout', looking: true }; }
    return { ev: 'strike' };
  }

  // 자동 타격 1회당 걸리는 시간(초)
  function cycleTime(st, d) {
    const sp = speedMult(st.stats.speed);
    const flight = 1.0 + Math.min(1.4, (d || 40) / 160);
    return (0.8 + 0.6 + 0.35 + flight + 0.75 + 0.35) / sp;
  }
  function takeTime(st) { return (0.8 + 0.6 + 0.75) / speedMult(st.stats.speed); }

  // 자동 플레이 몬테카를로 (볼카운트 포함). 원본 상태는 건드리지 않음
  function simAuto(st, n, seed) {
    let sd = seed || 12345;
    const rng = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
    const c = { count: { b: 0, s: 0 }, eyeCombo: 0, meatball: false, streak: 0, walks: 0, strikeouts: 0, takes: 0, coins: 0, _sim: true };
    const t = Object.assign({}, st, c);
    let coins = 0, time = 0, hr = 0, contacts = 0;
    for (let i = 0; i < n; i++) {
      const p = genPitch(t, rng);
      if (autoDecide(t, p, rng)) {
        const q = swingOutcome(t, p, rollAutoQuality(t, rng), rng);
        if (q === 'miss') { callPitch(t, p, true); time += takeTime(t); continue; }
        const r = hitResult(t, q, false, false, rng, hitBonus(t, p));
        t.eyeCombo = 0; t.count = { b: 0, s: 0 };
        coins += r.coins; time += cycleTime(t, r.d); contacts++; if (r.hr) hr++;
      } else {
        const before = t.coins; const e = callPitch(t, p, false);
        if (e.ev === 'walk') coins += t.coins - before;
        time += takeTime(t);
      }
    }
    return { cps: coins / time, hrRate: contacts ? hr / contacts : 0 };
  }
  function expectedCPS(st, n) { return simAuto(st, n || 400, 12345).cps; }
  function homerunRate(st, n) { return simAuto(st, n || 400, 777).hrRate; }

  // 강화 시도
  function tryEnhance(st, b, useTicket, rng) {
    rng = rng || Math.random;
    const cost = enhCost(b, st);
    if (b.e >= ENH_MAX) return { ok: false, reason: 'max' };
    if (st.coins < cost) return { ok: false, reason: 'coins' };
    st.coins -= cost; st.enhTries++; bump(st, 'enh');
    const rate = enhRate(b);
    if (rng() * 100 < rate) { b.e++; st.maxEnh = Math.max(st.maxEnh || 0, b.e); return { ok: true, result: 'success', e: b.e }; }
    if (b.e < 5) return { ok: true, result: 'keep', e: b.e };
    if (b.e < 10) { b.e--; return { ok: true, result: 'down', e: b.e }; }
    if (rng() < DESTROY_CHANCE) {
      if (useTicket && st.tickets > 0) { st.tickets--; b.e--; return { ok: true, result: 'saved', e: b.e }; }
      removeBat(st, b.id); st.destroyed++;
      return { ok: true, result: 'destroy', e: b.e };
    }
    b.e--; return { ok: true, result: 'down', e: b.e };
  }

  function removeBat(st, id) {
    st.bats = st.bats.filter((x) => x.id !== id);
    if (!st.bats.length) st.bats.push(newBat(0, 'power'));
    if (!st.bats.find((x) => x.id === st.equip)) st.equip = bestBat(st).id;
  }

  function bestBat(st) { return st.bats.slice().sort((a, b) => batPower(b) - batPower(a))[0]; }

  // 상점
  const BOX = {
    normal: { name: '일반 상자', odds: [70, 25, 5, 0, 0] },
    premium: { name: '고급 상자', odds: [0, 55, 33, 10, 2] },
  };
  const INV_MAX = 30;
  function woodPrice(st) { return Math.ceil(120 * coinMultOf(st.maxStadium)); }
  function normalBoxPrice(st) { return Math.ceil(800 * coinMultOf(st.maxStadium)); }
  const PREMIUM_GEMS = 60, TICKET_GEMS = 30;

  function rollGrade(odds, rng) {
    let r = rng() * 100;
    for (let i = 0; i < odds.length; i++) { if (r < odds[i]) return i; r -= odds[i]; }
    return 0;
  }

  function buy(st, kind, rng) {
    rng = rng || Math.random;
    if (st.bats.length >= INV_MAX && kind !== 'ticket') return { ok: false, reason: 'full' };
    if (kind === 'wood') {
      const p = woodPrice(st); if (st.coins < p) return { ok: false, reason: 'coins' };
      st.coins -= p; const b = newBat(0, null, rng); st.bats.push(b); markDex(st, b); return { ok: true, bat: b };
    }
    if (kind === 'normal') {
      const p = normalBoxPrice(st); if (st.coins < p) return { ok: false, reason: 'coins' };
      st.coins -= p; const b = newBat(rollGrade(BOX.normal.odds, rng), null, rng); st.bats.push(b); markDex(st, b); if (b.g >= 4) st.gotLegend = true; return { ok: true, bat: b };
    }
    if (kind === 'premium') {
      if (st.gems < PREMIUM_GEMS) return { ok: false, reason: 'gems' };
      st.gems -= PREMIUM_GEMS; const b = newBat(rollGrade(BOX.premium.odds, rng), null, rng); st.bats.push(b); markDex(st, b); if (b.g >= 4) st.gotLegend = true; return { ok: true, bat: b };
    }
    if (kind === 'ticket') {
      if (st.gems < TICKET_GEMS) return { ok: false, reason: 'gems' };
      st.gems -= TICKET_GEMS; st.tickets++; return { ok: true };
    }
    return { ok: false };
  }

  // 합성: 장착 안 한 같은 등급 3개 -> 다음 등급 1개
  function mergeCandidates(st, g) {
    return st.bats.filter((b) => b.g === g && b.id !== st.equip).sort((a, b) => a.e - b.e);
  }
  function merge(st, g, rng) {
    rng = rng || Math.random;
    if (g >= GRADES.length - 1) return { ok: false, reason: 'max' };
    const c = mergeCandidates(st, g);
    if (c.length < 3) return { ok: false, reason: 'count' };
    const use = c.slice(0, 3).map((b) => b.id);
    st.bats = st.bats.filter((b) => !use.includes(b.id));
    const nb = newBat(g + 1, null, rng); st.bats.push(nb); markDex(st, nb); if (nb.g >= 4) st.gotLegend = true;
    return { ok: true, bat: nb };
  }

  function sell(st, id) {
    if (id === st.equip) return { ok: false, reason: 'equipped' };
    const b = st.bats.find((x) => x.id === id); if (!b) return { ok: false };
    const price = Math.ceil(GRADES[b.g].sell * (1 + b.e * 0.5));
    st.coins += price; st.bats = st.bats.filter((x) => x.id !== id);
    return { ok: true, price };
  }

  // 홈런 기록 및 구장 진행
  function applyHit(st, r) {
    st.totalHits++; st.count = { b: 0, s: 0 }; st.eyeCombo = 0;
    const ev = { gems: 0, cleared: false };
    if (r.d > st.best) st.best = r.d;
    if (r.d > (st.runBest || 0)) st.runBest = r.d;
    if (r.special) { st.specials++; st.gems += 1; ev.gems += 1; }
    if (r.hr) {
      st.totalHR++; st.streak++; bump(st, 'hr'); st.bestStreak = Math.max(st.bestStreak, st.streak);
      st.stadiumHR[st.stadium] = (st.stadiumHR[st.stadium] || 0) + 1;
      if (st.totalHR % 25 === 0) { st.gems += 2; ev.gems += 2; }
      if (st.stadiumHR[st.stadium] >= HR_TO_CLEAR && !st.cleared.includes(st.stadium)) {
        st.cleared.push(st.stadium); const g = 15 + st.stadium * 5; st.gems += g; ev.gems += g; ev.cleared = true;
        if (st.stadium + 1 < STADIUMS.length) st.maxStadium = Math.max(st.maxStadium, st.stadium + 1);
        if (st.stadium === STADIUMS.length - 1) st.clearedLast = true;
      }
    } else st.streak = 0;
    st.coins += r.coins;
    st.maxEver = Math.max(st.maxEver || 0, st.maxStadium);
    return ev;
  }

  function moveStadium(st, s) {
    if (s < 0 || s > st.maxStadium || s >= STADIUMS.length) return false;
    st.stadium = s; if (st.stadiumHR[s] == null) st.stadiumHR[s] = 0; st.streak = 0; st.count = { b: 0, s: 0 }; st.eyeCombo = 0; st.meatball = false; return true;
  }

  const OFFLINE_MAX = 8 * 3600, OFFLINE_RATE = 0.5;
  function offlineReward(st, now) {
    const sec = Math.min(OFFLINE_MAX, Math.max(0, (now - st.lastSave) / 1000));
    if (sec < 60) return { sec, coins: 0 };
    return { sec, coins: Math.floor(expectedCPS(st, 200) * sec * OFFLINE_RATE) };
  }

  function fmtDist(m) {
    if (m < 1000) return (Number.isInteger(m) || m >= 100 ? Math.round(m) : m.toFixed(1)) + 'm';
    const k = m / 1000;
    if (k >= 1e6) return fmt(k) + 'km';
    return (k < 10 ? parseFloat(k.toFixed(2)) : k < 100 ? parseFloat(k.toFixed(1)) : Math.round(k).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')) + 'km';
  }
  // K, M, B, T 다음은 aa, ab ... zz (방치형 표기)
  // ---------- 방망이 도감 ----------
  function markDex(st, b) { st.dex = st.dex || {}; st.dex[b.g + '_' + b.t] = true; }
  function dexRows(st) { const d = st.dex || {}; let n = 0; for (let g = 0; g < 5; g++) if (['power', 'contact', 'luck'].every((t) => d[g + '_' + t])) n++; return n; }
  function dexCount(st) { return Object.keys(st.dex || {}).length; }
  function dexMult(st) { return 1 + 0.05 * dexRows(st); }
  function dexCoin(st) { return dexCount(st) >= 15 ? 1.2 : 1; }

  // ---------- 주말 이벤트 (한국 시간 토·일 코인 2배) ----------
  function isWeekend(now) { const d = new Date((now || Date.now()) + 9 * 3600e3).getUTCDay(); return d === 0 || d === 6; }

  // ---------- 보스 투수 ----------
  const BOSSES = [
    { name: '골목대장 강철수', spr: 0 }, { name: '체육쌤 박호루라기', spr: 1 }, { name: '사회인 에이스 김부장', spr: 1 },
    { name: '고교 괴물 윤강속', spr: 2 }, { name: '대학 리그 MVP 한커브', spr: 2 }, { name: '2군 마무리 오슬라', spr: 2 },
    { name: '프로 에이스 최강철', spr: 3 }, { name: '돔의 지배자 서체인지', spr: 3 }, { name: '빅리그 썬더 리', spr: 3 },
    { name: '달의 투수 루나 K', spr: 4 }, { name: '주차장 전설 맥스', spr: 0 }, { name: '빌딩숲 스카이 에이스', spr: 3 },
    { name: '바다사나이 파도', spr: 2 }, { name: '구름 위 제트', spr: 3 }, { name: '우주의 끝 오메가', spr: 4 },
  ];
  const BOSS_HR = 3, BOSS_OUTS = 3;
  function bossOpen(st, i) { return (st.cleared || []).includes(i) || (st.bossWin || {})[i]; }
  function bossReward(st, i) { const first = !(st.bossWin || {})[i]; return first ? { gems: 30 + 10 * i, sec: 1800, first } : { gems: 5, sec: 300, first }; }
  function winBoss(st, i) {
    const r = bossReward(st, i); st.bossWin = st.bossWin || {}; st.bossWin[i] = true;
    st.gems += r.gems; const c = Math.max(100, Math.floor(expectedCPS(st, 150) * r.sec)); st.coins += c;
    return { gems: r.gems, coins: c, first: r.first };
  }

  // ---------- 홈런 더비 ----------
  const DERBY_N = 10;
  function weekKey(now) {
    const d = new Date((now || Date.now()) + 9 * 3600e3); // KST
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const wk = Math.ceil(((t - y0) / 864e5 + 1) / 7);
    return t.getUTCFullYear() + '-W' + String(wk).padStart(2, '0');
  }
  function derbyCanRank(st, now) { return !st.derby || st.derby.date !== todayKey(now); }
  function derbyScore(hr, distm) { return hr * 1e9 + Math.min(999999999, Math.max(0, Math.round(distm))); }
  function derbyReward(st, hr) { const gems = hr * 3; const c = Math.max(50, Math.floor(expectedCPS(st, 150) * hr * 60)); st.gems += gems; st.coins += c; return { gems, coins: c }; }

  // ---------- 출석, 일일 미션, 업적 ----------
  function todayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  const ATT = [
    { t: 'gems', n: 20 }, { t: 'coins', sec: 600 }, { t: 'gems', n: 30 }, { t: 'tickets', n: 1 },
    { t: 'gems', n: 50 }, { t: 'coins', sec: 1800 }, { t: 'box', n: 1, gems: 50 },
  ];
  const DAILY = [
    { id: 'hr', name: '홈런 20개 치기', goal: 20, rew: { t: 'gems', n: 10 } },
    { id: 'perfect', name: '직접 쳐서 PERFECT 5번', goal: 5, rew: { t: 'gems', n: 15 } },
    { id: 'eye', name: '볼 10개 골라내기', goal: 10, rew: { t: 'coins', sec: 900 } },
    { id: 'enh', name: '방망이 강화 3번 시도', goal: 3, rew: { t: 'tickets', n: 1 } },
  ];
  const DAILY_ALL = { t: 'gems', n: 30 };
  const ACH = [
    { id: 'hr1', name: '첫 홈런', test: (s) => s.totalHR >= 1, gems: 10 },
    { id: 'hr100', name: '홈런 100개', test: (s) => s.totalHR >= 100, gems: 30 },
    { id: 'hr1000', name: '홈런 1,000개', test: (s) => s.totalHR >= 1000, gems: 100 },
    { id: 'hr10000', name: '홈런 10,000개', test: (s) => s.totalHR >= 10000, gems: 300 },
    { id: 'd100', name: '비거리 100m', test: (s) => s.best >= 100, gems: 20 },
    { id: 'd1k', name: '비거리 1km', test: (s) => s.best >= 1000, gems: 50 },
    { id: 'd100k', name: '비거리 100km', test: (s) => s.best >= 1e5, gems: 150 },
    { id: 'd1000k', name: '비거리 1,000km', test: (s) => s.best >= 1e6, gems: 500 },
    { id: 'e10', name: '+10 강화 성공', test: (s) => (s.maxEnh || 0) >= 10, gems: 50 },
    { id: 'e15', name: '+15 강화 성공', test: (s) => (s.maxEnh || 0) >= 15, gems: 100 },
    { id: 'e20', name: '+20 강화 성공', test: (s) => (s.maxEnh || 0) >= 20, gems: 300 },
    { id: 'legend', name: '전설 방망이 획득', test: (s) => s.gotLegend || s.bats.some((b) => b.g >= 4), gems: 100 },
    { id: 'sp10', name: '특대 홈런 10번', test: (s) => s.specials >= 10, gems: 50 },
    { id: 'walk50', name: '볼넷 50번', test: (s) => s.walks >= 50, gems: 50 },
    { id: 's10', name: '달 기지 구장 도착', test: (s) => Math.max(s.maxEver || 0, s.maxStadium) >= 9, gems: 200 },
    { id: 'ret1', name: '첫 은퇴', test: (s) => (s.retires || 0) >= 1, gems: 100 },
    { id: 'ret5', name: '은퇴 5번', test: (s) => (s.retires || 0) >= 5, gems: 300 },
    { id: 's15', name: '대기권 돌파 클리어', test: (s) => !!s.clearedLast, gems: 1000 },
    { id: 'boss1', name: '첫 보스 격파', test: (s) => Object.keys(s.bossWin || {}).length >= 1, gems: 50 },
    { id: 'boss10', name: '보스 10명 격파', test: (s) => Object.keys(s.bossWin || {}).length >= 10, gems: 300 },
    { id: 'derby5', name: '홈런 더비 5개 이상', test: (s) => (s.derbyBest || 0) >= 5, gems: 50 },
    { id: 'derby10', name: '홈런 더비 퍼펙트 (10개)', test: (s) => (s.derbyBest || 0) >= 10, gems: 300 },
    { id: 'dex15', name: '방망이 도감 완성', test: (s) => Object.keys(s.dex || {}).length >= 15, gems: 500 },
  ];
  function daily(st, now) {
    const k = todayKey(now);
    if (!st.daily || st.daily.date !== k) st.daily = { date: k, c: {}, got: {}, all: false };
    return st.daily;
  }
  function bump(st, id, n) { if (st._sim) return; const d = daily(st); d.c[id] = (d.c[id] || 0) + (n || 1); }
  function rewardText(r) {
    if (r.t === 'gems') return '◆ ' + r.n;
    if (r.t === 'tickets') return '보호권 ' + r.n;
    if (r.t === 'coins') return '코인 ' + Math.round(r.sec / 60) + '분치';
    if (r.t === 'box') return '고급 상자 + ◆ ' + r.gems;
    return '';
  }
  function grant(st, r) {
    if (r.t === 'gems') { st.gems += r.n; return { text: '◆ 젬 +' + r.n }; }
    if (r.t === 'tickets') { st.tickets += r.n; return { text: '강화 보호권 +' + r.n }; }
    if (r.t === 'coins') { const c = Math.max(100, Math.floor(expectedCPS(st, 150) * r.sec)); st.coins += c; return { text: '₩ ' + fmt(c), coins: c }; }
    if (r.t === 'box') {
      st.gems += r.gems || 0;
      if (st.bats.length >= INV_MAX) { st.gems += PREMIUM_GEMS; return { text: '가방이 가득 차서 ◆ ' + (PREMIUM_GEMS + (r.gems || 0)) }; }
      const b = newBat(rollGrade(BOX.premium.odds, Math.random), null, Math.random); st.bats.push(b); markDex(st, b); if (b.g >= 4) st.gotLegend = true;
      return { text: '고급 상자 + ◆ ' + r.gems, bat: b };
    }
    return { text: '' };
  }
  function attCan(st, now) { st.att = st.att || { last: '', n: 0 }; return st.att.last !== todayKey(now); }
  function attDay(st) { return ((st.att && st.att.n) || 0) % 7; }
  function claimAtt(st, now) {
    if (!attCan(st, now)) return null;
    const r = grant(st, ATT[attDay(st)]);
    st.att.last = todayKey(now); st.att.n++;
    return r;
  }
  function dailyDone(st, m) { return (daily(st).c[m.id] || 0) >= m.goal; }
  function claimDaily(st, id) {
    const d = daily(st), m = DAILY.find((x) => x.id === id);
    if (!m || d.got[id] || !dailyDone(st, m)) return null;
    d.got[id] = true; return grant(st, m.rew);
  }
  function claimDailyAll(st) {
    const d = daily(st);
    if (d.all || !DAILY.every((m) => d.got[m.id])) return null;
    d.all = true; return grant(st, DAILY_ALL);
  }
  function achReady(st, a) { return !(st.ach && st.ach[a.id]) && a.test(st); }
  function claimAch(st, id) {
    const a = ACH.find((x) => x.id === id); st.ach = st.ach || {};
    if (!a || !achReady(st, a)) return null;
    st.ach[id] = true; st.gems += a.gems; return { text: '◆ 젬 +' + a.gems };
  }
  function claimableCount(st, now) {
    const d = daily(st, now);
    let n = attCan(st, now) ? 1 : 0;
    n += DAILY.filter((m) => !d.got[m.id] && (d.c[m.id] || 0) >= m.goal).length;
    if (!d.all && DAILY.every((m) => d.got[m.id])) n++;
    n += ACH.filter((a) => achReady(st, a)).length;
    return n;
  }

  const UNITS = ['', 'K', 'M', 'B', 'T'];
  for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) UNITS.push(String.fromCharCode(97 + i) + String.fromCharCode(97 + j));
  function fmt(n, dp) {
    if (n == null || !isFinite(n)) return '0';
    if (dp != null && n < 1000) return (Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp)).toString();
    if (n < 1000) return Math.floor(n).toString();
    let u = 0; while (n >= 1000 && u < UNITS.length - 1) { n /= 1000; u++; }
    return (n >= 100 ? Math.floor(n) : n >= 10 ? Math.floor(n * 10) / 10 : Math.floor(n * 100) / 100) + UNITS[u];
  }

  G.HR = {
    GRADES, TRAITS, BAT_NAMES, ENH_RATE, ENH_MAX, DESTROY_CHANCE, STADIUMS, HR_TO_CLEAR, STATS, BOX, INV_MAX,
    PREMIUM_GEMS, TICKET_GEMS, OFFLINE_MAX, OFFLINE_RATE, QMULT,
    powerMult, speedMult, fameMult, statCost, batPower, batName, enhCost, enhRate, failText, newBat, newState,
    equipped, fenceOf, coinMultOf, resistOf, honorMult, canRetire, honorGain, retire, fmtDist, OUT_START, RETIRE_AT, HONOR_PCT, perfectWindow, goodWindow, weakWindow, autoPerfect, rollAutoQuality, specialChance,
    hitResult, cycleTime, takeTime, expectedCPS, simAuto, genPitch, swingOutcome, autoDecide, hitBonus, callPitch, resetCount, eyeOf, eyeRate, ballChance, edgeDist, PITCH_T, homerunRate, tryEnhance, removeBat, bestBat, woodPrice, normalBoxPrice, buy,
    mergeCandidates, merge, sell, applyHit, moveStadium, offlineReward, fmt,
    PITCH_TYPES, pitchTypesFor, markDex, dexRows, dexCount, dexMult, dexCoin, isWeekend, BOSSES, BOSS_HR, BOSS_OUTS, bossOpen, bossReward, winBoss, DERBY_N, weekKey, derbyCanRank, derbyScore, derbyReward,
    todayKey, ATT, DAILY, DAILY_ALL, ACH, daily, bump, rewardText, grant, attCan, attDay, claimAtt, dailyDone, claimDaily, claimDailyAll, achReady, claimAch, claimableCount,
  };
})(typeof window !== 'undefined' ? window : globalThis);
