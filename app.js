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
      adLoad();
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

  // ---------- 앱: 뒤로 가기 ----------
  let backHandler = null;
  function initBack() {
    const A = plug('App'); if (!A) return;
    A.addListener('backButton', () => { if (AD.busy) return; if (backHandler && backHandler()) return; A.exitApp(); });
  }

  window.HRKAPP = {
    app: APP,
    storeUrl: STORE_URL,
    promoOn: () => !APP && !!STORE_URL,
    adOn: () => APP && !!AD.unit,
    adReady: () => AD.ready,
    showReward,
    banner,
    setBack: (fn) => { backHandler = fn; },
  };
  if (APP) {
    document.documentElement.classList.add('in-app');
    window.addEventListener('load', () => { adInit(); initBack(); });
  }
})();
