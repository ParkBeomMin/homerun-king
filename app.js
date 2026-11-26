// 홈런왕 키우기: 웹 하단 배너(AdSense), 안드로이드 앱(Capacitor) 보상형 광고(AdMob), 앱 설치 안내
// 앱 빌드는 동기화 스크립트가 window.HRK_APP=true, HRK_AD_UNIT, HRK_AD_TEST 를 넣는다. 웹 빌드에는 영향 없음
(function () {
  'use strict';
  const APP = window.HRK_APP === true;
  // 플레이 스토어 주소: 앱이 출시되면 여기에 넣는다. 비어 있으면 웹의 앱 설치 안내가 보이지 않는다
  const STORE_URL = '';
  const PROD = location.hostname === 'parkbeommin.github.io';
  const PREVIEW = /[?&]adpreview=1/.test(location.search);
  const BANNER = { client: 'ca-pub-7426857657290789', slot: '6688013371', on: !APP && (PROD || PREVIEW) && !/[?&]noads=1/.test(location.search), filled: false };

  // ---------- 웹 하단 배너 ----------
  function banner() {
    if (!BANNER.on) return;
    const app = document.getElementById('app'); if (!app) return;
    let bar = document.getElementById('adbar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'adbar'; app.appendChild(bar); }
    document.body.classList.add('ad-on');
    if (BANNER.filled) return; BANNER.filled = true;
    if (PROD) {
      const sc = document.createElement('script'); sc.async = true; sc.crossOrigin = 'anonymous';
      sc.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + BANNER.client;
      document.head.appendChild(sc);
      const ins = document.createElement('ins'); ins.className = 'adsbygoogle';
      ins.style.cssText = 'display:inline-block;width:320px;height:50px';
      ins.setAttribute('data-ad-client', BANNER.client); ins.setAttribute('data-ad-slot', BANNER.slot);
      bar.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* noop */ }
    } else bar.innerHTML = '<div class="ad-ph">하단 배너 광고 자리 (320x50)</div>';
  }

  // ---------- 앱: Capacitor 플러그인 ----------
  function plug(name) {
    const P = window.__hrkPlugs || (window.__hrkPlugs = {});
    if (name in P) return P[name];
    let p = null;
    try { p = window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() && Capacitor.registerPlugin ? Capacitor.registerPlugin(name) : null; } catch (e) { p = null; }
    return (P[name] = p);
  }

  // ---------- 앱: AdMob 보상형 광고 ----------
  // 보상은 '보상 이벤트를 받았고 + 광고가 닫힌 뒤'에만 준다. 광고가 없으면 보상 없이 안내만 하고 다시 불러온다
  const AD = { ready: false, loading: false, fails: 0, busy: false, unit: window.HRK_AD_UNIT || '', test: window.HRK_AD_TEST !== false, plug: null };
  function adLoad() {
    const A = AD.plug; if (!A || AD.loading || AD.ready) return;
    AD.loading = true;
    A.prepareRewardVideoAd({ adId: AD.unit, isTesting: AD.test })
      .then(() => { AD.ready = true; AD.loading = false; AD.fails = 0; })
      .catch(() => { AD.loading = false; AD.fails++; setTimeout(adLoad, Math.min(120000, 15000 * AD.fails)); });
  }
  async function adInit() {
    if (!APP || !AD.unit) return;
    const A = plug('AdMob'); if (!A) return; AD.plug = A;
    try {
      await A.initialize({ initializeForTesting: AD.test });
      try { const ci = await A.requestConsentInfo(); if (ci && ci.isConsentFormAvailable && ci.status === 'REQUIRED') await A.showConsentForm(); } catch (e) { /* noop */ }
      adLoad(); appBanner();
    } catch (e) { /* noop */ }
  }
  // onReward(): 보상 지급, say(text): 안내 문구 표시. 결과는 Promise<boolean>
  async function showReward(name, onReward, say) {
    if (!APP) return false;
    const A = AD.plug;
    if (!A || !AD.ready || AD.busy) { if (say) say('지금은 보여줄 광고가 없어요. 잠시 후 다시 눌러주세요'); adLoad(); return false; }
    AD.ready = false; AD.busy = true;
    let got = false, closed = false, onClose = null;
    const hs = [];
    try {
      hs.push(await A.addListener('onRewardedVideoAdReward', () => { got = true; }));
      hs.push(await A.addListener('onRewardedVideoAdDismissed', () => { closed = true; if (onClose) onClose(); }));
      hs.push(await A.addListener('onRewardedVideoAdFailedToShow', () => { closed = true; if (onClose) onClose(); }));
    } catch (e) { /* noop */ }
    try { await A.showRewardVideoAd(); got = true; } catch (e) { closed = true; }
    if (!closed) await new Promise((r) => { onClose = r; setTimeout(r, 120000); });
    hs.forEach((h) => { try { h.remove(); } catch (e) { /* noop */ } });
    AD.busy = false;
    if (got) onReward(); else if (say) say('광고를 끝까지 보면 보상을 받아요');
    try { if (window.gtag) gtag('event', 'app_reward', { name, got: got ? 1 : 0 }); } catch (e) { /* noop */ }
    adLoad();
    return got;
  }

  // ---------- 앱: AdMob 하단 배너 ----------
  // 웹 배너와 같은 자리(#adbar, 50px + 시스템 바)를 비워 두고, 그 위에 네이티브 배너를 띄운다. 더비·보스전에서는 숨긴다
  const BN = { unit: window.HRK_AD_BANNER || '', shown: false, hidden: false, want: true };
  function safeBottom() {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;bottom:0;height:0;padding-bottom:max(env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px))';
    document.body.appendChild(d); const v = parseFloat(getComputedStyle(d).paddingBottom) || 0; d.remove(); return Math.round(v);
  }
  async function appBanner() {
    if (!APP || !BN.unit) return;
    const A = AD.plug || plug('AdMob'); if (!A) return;
    const app = document.getElementById('app'); if (!app) return;
    let bar = document.getElementById('adbar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'adbar'; app.appendChild(bar); }
    document.body.classList.add('ad-on');
    if (BN.shown) return; BN.shown = true;
    // margin 0: 플러그인이 시스템 내비게이션 바 높이를 스스로 더한다(우리가 더하면 두 번 올라가 탭과 겹침, 0.16~0.18 버그)
    try { await A.showBanner({ adId: BN.unit, adSize: 'BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: AD.test }); } catch (e) { BN.shown = false; }
    if (!BN.want) bannerShow(false);
  }
  // 집중 화면(더비·보스)에서는 false 로 숨기고, 끝나면 true 로 다시 보인다
  function bannerShow(on) {
    BN.want = on; const A = AD.plug; if (!APP || !A || !BN.shown) return;
    if (on && BN.hidden) { BN.hidden = false; A.resumeBanner().catch(() => {}); }
    else if (!on && !BN.hidden) { BN.hidden = true; A.hideBanner().catch(() => {}); }
  }

  // ---------- 앱: Play 인앱 업데이트 확인 (Play에서 설치한 앱만, 실패하면 조용히 무시) ----------
  async function updateInfo() {
    if (!APP) return null;
    const P = plug('AppUpdate'); if (!P) return null;
    try { const info = await P.getAppUpdateInfo(); return info && info.updateAvailability === 2 ? info : null; } catch (e) { return null; }
  }
  async function doUpdate(info) {
    const P = plug('AppUpdate'); if (!P) return;
    try { if (info && info.immediateUpdateAllowed) { const r = await P.performImmediateUpdate(); if (r && r.code === 0) return; } } catch (e) { /* noop */ }
    try { await P.openAppStore(); } catch (e) { /* noop */ }
  }

  // ---------- 앱: 뒤로 가기 ----------
  let backHandler = null;
  function initBack() {
    const A = plug('App'); if (!A) return;
    A.addListener('backButton', () => { if (AD.busy) return; if (backHandler && backHandler()) return; A.exitApp(); });
  }

  window.HRKAPP = {
    app: APP,
    beta: APP && window.HRK_BETA === true,
    storeUrl: STORE_URL,
    promoOn: () => !APP && !!STORE_URL,
    adOn: () => APP && !!AD.unit,
    adReady: () => AD.ready,
    showReward,
    banner,
    bannerShow,
    updateInfo,
    doUpdate,
    setBack: (fn) => { backHandler = fn; },
  };
  if (APP) {
    document.documentElement.classList.add('in-app');
    window.addEventListener('load', () => { adInit(); initBack(); });
  }
})();
