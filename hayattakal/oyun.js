'use strict';
// Hayatta Kal - bağımlılıksız, düşük donanım dostu koşucu + hayatta kalma oyunu.
// Sürüm numarasını elle değiştirme: yayinla.sh yönetir.
var SURUM = '0.2.1';

(function () {
  // ================= TUVAL VE GÖRÜNÜM =================
  var cv = document.getElementById('oyun');
  var ctx = cv.getContext('2d', { alpha: false });
  var W = 1, H = 1, PXR = 1, kalite = 1;
  var focal = 1, ufuk = 0, camH = 1, camZ = 0, camX = 0;
  var gokGrad = null, sisGrad = null;

  var YOL = 3;        // yolun yarı genişliği (dünya birimi)
  var KAMERA = 6;     // kameranın takımın ne kadar arkasında olduğu
  var UZAK = 60;      // görüş mesafesi
  var HIZ = 6;        // ilerleme hızı
  var HUCRE = 72;     // çarpışma ızgarası hücre sayısı (1 birim derinlik)

  // İzdüşüm sonucu (her karede nesne üretmemek için ortak değişkenler)
  var sx = 0, sy = 0, sk = 0;
  function P(x, z) {
    var d = z - camZ;
    if (d < 0.35) d = 0.35;
    sk = focal / d;
    sx = W * 0.5 + (x - camX) * sk;
    sy = ufuk + camH * sk;
  }

  var FONT = [];
  for (var fi = 0; fi <= 120; fi++) FONT.push('bold ' + fi + 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif');
  var sonFont = -1;
  function font(n) {
    n = n | 0; if (n < 7) n = 7; else if (n > 120) n = 120;
    if (n !== sonFont) { ctx.font = FONT[n]; sonFont = n; }
  }

  function boyutla() {
    W = window.innerWidth || 360; H = window.innerHeight || 640;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var px = dpr * kalite;
    var maxPiksel = 1280 * 800;
    if (W * H * px * px > maxPiksel) px = Math.sqrt(maxPiksel / (W * H));
    PXR = px;
    cv.width = Math.round(W * px); cv.height = Math.round(H * px);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ufuk = H * 0.3;
    focal = Math.min(W * 0.9, H * 0.85);
    camH = (H * 0.8 - ufuk) * KAMERA / focal;
    gokGrad = ctx.createLinearGradient(0, 0, 0, ufuk);
    gokGrad.addColorStop(0, '#2a2f7a'); gokGrad.addColorStop(0.6, '#c2457a'); gokGrad.addColorStop(1, '#ffb36b');
    sisGrad = ctx.createLinearGradient(0, ufuk, 0, ufuk + H * 0.09);
    sisGrad.addColorStop(0, 'rgba(201,120,80,0.95)'); sisGrad.addColorStop(1, 'rgba(201,120,80,0)');
    sonFont = -1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (durum !== 1) ciz();
  }

  // ================= KAYIT =================
  var kayit = { bolum: 1, para: 0, up: [0, 0, 0], enIyi: 1 };
  try {
    var k0 = JSON.parse(localStorage.getItem('hayattakal_v1'));
    if (k0 && k0.up && k0.up.length === 3) kayit = k0;
  } catch (e) { /* kayıt yok */ }
  function kaydet() { try { localStorage.setItem('hayattakal_v1', JSON.stringify(kayit)); } catch (e) { /* yok say */ } }

  var YUK = [
    { ad: 'Asker', taban: 15, carpan: 1.4, max: 40 },
    { ad: 'Hasar', taban: 25, carpan: 1.5, max: 40 },
    { ad: 'Atış Hızı', taban: 25, carpan: 1.55, max: 20 }
  ];
  function maliyet(i) { return Math.round(YUK[i].taban * Math.pow(YUK[i].carpan, kayit.up[i])); }
  function baslangicAsker() { return 5 + 2 * kayit.up[0]; }
  function hasarCarpani() { return 1 + 0.2 * kayit.up[1]; }
  function atisHizi() { return 2.2 * (1 + 0.1 * kayit.up[2]); }

  // ================= RASTGELE =================
  function rngYap(s) {
    return function () {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function kes(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ================= ÇİZİMLER (bir kez üretilir) =================
  function tuval(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function beyazlat(src) {
    var c = tuval(src.width, src.height), g = c.getContext('2d');
    g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function daire(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  function golge(g, x, y, rx, ry) {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
  }
  // fw x fh boyutlu, n kareli sprite
  function sprite(fw, fh, n, fn) {
    var c = tuval(fw * n, fh), g = c.getContext('2d');
    for (var i = 0; i < n; i++) { g.save(); g.translate(i * fw, 0); fn(g, i, fw, fh); g.restore(); }
    return { c: c, b: beyazlat(c), w: fw, h: fh };
  }

  // Tek insan modeli: asker ve zombiler aynı iskeleti kullanır (çizim bir kez yapılır, oyunda sadece drawImage).
  function insanCiz(g, f, o) {
    var s = f ? 1 : -1;               // yürüyüş salınımı
    golge(g, 20, 57, 12, 3.5);
    // bacaklar + botlar
    g.fillStyle = o.alt;
    g.fillRect(12, 37, 7, f ? 17 : 19);
    g.fillRect(21, 37, 7, f ? 19 : 17);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(12, 37, 2, 17); g.fillRect(21, 37, 2, 17);
    g.fillStyle = '#1a140f';
    g.fillRect(11, f ? 53 : 55, 8, 4); g.fillRect(21, f ? 55 : 53, 8, 4);
    // gövde
    g.fillStyle = o.ust;
    g.fillRect(10, 20, 20, 19);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(10, 20, 4, 19); g.fillRect(26, 20, 4, 3);
    g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(22, 21, 6, 9);
    if (o.yelek) {
      g.fillStyle = o.yelek; g.fillRect(11, 22, 18, 11);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(11, 22, 3, 11);
      g.fillStyle = '#222'; g.fillRect(19, 22, 2, 11);
    }
    // kemer
    g.fillStyle = '#2b2118'; g.fillRect(10, 36, 20, 3);
    g.fillStyle = '#c9a227'; g.fillRect(18, 36, 4, 3);
    // kollar (yürürken sallanır)
    g.fillStyle = o.ust;
    g.fillRect(5, 21 + s, 6, 14); g.fillRect(29, 21 - s, 6, 14);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(5, 21 + s, 2, 14); g.fillRect(29, 21 - s, 2, 14);
    g.fillStyle = o.ten;
    g.fillRect(5, 34 + s, 6, 5); g.fillRect(29, 34 - s, 6, 5);
    // boyun ve kafa
    g.fillStyle = o.ten;
    g.fillRect(17, 17, 6, 4);
    g.beginPath(); g.ellipse(20, 12, 7, 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(20, 18, 5, 2, 0, 0, Math.PI * 2); g.fill();
    // saç veya kask
    if (o.kask) {
      g.fillStyle = '#4b5a33';
      g.beginPath(); g.arc(20, 11, 8.5, Math.PI, 0); g.fill();
      g.fillRect(11, 11, 18, 2.5);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(15, 5, 6, 2);
    } else {
      g.fillStyle = o.saç;
      g.beginPath(); g.ellipse(20, 8, 7.8, 4.8, 0, Math.PI, 0); g.fill();
      g.fillRect(12, 8, 3, 6); g.fillRect(25, 8, 3, 4);
    }
    // gözler
    if (o.zombi) {
      g.fillStyle = '#120a0a';
      g.beginPath(); g.ellipse(16.5, 13, 2.4, 2, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(23.5, 13, 2.4, 2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = o.goz;
      daire(g, 16.5, 13, 1.1); daire(g, 23.5, 13, 1.1);
    } else {
      g.fillStyle = '#fff';
      g.beginPath(); g.ellipse(16.5, 12.5, 2, 1.3, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(23.5, 12.5, 2, 1.3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#222'; daire(g, 16.8, 12.5, 0.8); daire(g, 23.2, 12.5, 0.8);
      g.fillStyle = '#4a2a18'; g.fillRect(14, 10, 5, 1); g.fillRect(21, 10, 5, 1);
    }
    // burun ve ağız
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(19.3, 14, 1.4, 2.5);
    g.fillStyle = o.zombi ? '#2a0f0f' : '#7a4a3a';
    if (o.zombi) g.fillRect(16, 18, 8, 2); else g.fillRect(17, 18, 6, 1);
    // yara ve yırtıklar
    if (o.yara) {
      g.fillStyle = '#7a0f0f';
      g.fillRect(24, 9, 3, 1.2); g.fillRect(12, 21, 2, 6); g.fillRect(27, 27, 2, 4);
    }
    if (o.yirtik) {
      g.fillStyle = o.ten;
      g.fillRect(24, 26, 4, 3); g.fillRect(13, 31, 3, 2);
    }
    if (o.saç && o.zombi) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(22, 4, 2, 3); }
  }

  var SPR_ASKER = sprite(40, 60, 2, function (g, f) {
    insanCiz(g, f, { ten: '#e8b887', ust: '#2d6cdf', alt: '#1d2b4f', yelek: '#41522c', saç: '#3a2a1a', goz: '#fff', kask: true, zombi: false });
    g.fillStyle = '#222'; g.fillRect(31, 8, 3, 24); g.fillRect(29, 27, 6, 4);
  });

  function zombiCiz(g, f, ten, gomlek, pantolon, gozRenk) {
    insanCiz(g, f, { ten: ten, ust: gomlek, alt: pantolon, goz: gozRenk, saç: '#2a2220', zombi: true, yirtik: true, yara: true });
  }
  var SPR_ZOMBI = sprite(40, 60, 2, function (g, f) { zombiCiz(g, f, '#7fb069', '#6b5b8a', '#3d3426', '#ff2b2b'); });
  var SPR_KOS = sprite(40, 60, 2, function (g, f) { zombiCiz(g, f, '#b7cf6a', '#8a2b2b', '#2c2c2c', '#ffe14d'); });
  var SPR_TANK = sprite(40, 60, 2, function (g, f) {
    zombiCiz(g, f, '#5f7f4c', '#3f3f46', '#26231d', '#ff2b2b');
    g.fillStyle = '#6d6d75'; g.fillRect(9, 20, 22, 9); g.fillRect(8, 19, 24, 3);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(12, 21, 8, 2);
    g.fillStyle = '#4a4a52'; g.fillRect(8, 19, 4, 12); g.fillRect(28, 19, 4, 12);
  });
  var SPR_BOSS = sprite(40, 60, 2, function (g, f) {
    zombiCiz(g, f, '#8d4b3b', '#2b1d2b', '#1a1414', '#ffef5a');
    g.fillStyle = '#e6dcc8';
    g.beginPath(); g.moveTo(12, 9); g.lineTo(9, 0); g.lineTo(16, 6); g.fill();
    g.beginPath(); g.moveTo(28, 9); g.lineTo(31, 0); g.lineTo(24, 6); g.fill();
    g.fillStyle = '#ff7a1a'; g.fillRect(12, 24, 16, 3);
  });
  var SPR_SANDIK = sprite(40, 44, 1, function (g) {
    golge(g, 20, 40, 18, 4);
    g.fillStyle = '#8b5a2b'; g.fillRect(3, 6, 34, 34);
    g.fillStyle = '#a8713a'; g.fillRect(6, 9, 28, 8); g.fillRect(6, 20, 28, 8); g.fillRect(6, 31, 28, 6);
    g.fillStyle = '#5c3a1a'; g.fillRect(3, 6, 34, 3); g.fillRect(3, 6, 3, 34); g.fillRect(34, 6, 3, 34);
    g.fillStyle = '#ffd166'; g.fillRect(16, 14, 8, 16);
  });
  var SPR_AGAC = sprite(40, 70, 1, function (g) {
    golge(g, 20, 66, 12, 3);
    g.strokeStyle = '#4a3527'; g.lineCap = 'round';
    g.lineWidth = 6; g.beginPath(); g.moveTo(20, 66); g.lineTo(20, 26); g.stroke();
    g.lineWidth = 3; g.beginPath();
    g.moveTo(20, 40); g.lineTo(8, 24); g.moveTo(20, 34); g.lineTo(32, 18);
    g.moveTo(20, 28); g.lineTo(14, 8); g.moveTo(26, 24); g.lineTo(34, 10); g.moveTo(12, 28); g.lineTo(4, 22);
    g.stroke();
  });
  var SPR_ARABA = sprite(64, 34, 1, function (g) {
    golge(g, 32, 30, 30, 4);
    g.fillStyle = '#6e3b2a'; g.fillRect(2, 14, 60, 14);
    g.fillStyle = '#8a4a33'; g.fillRect(12, 4, 36, 12);
    g.fillStyle = '#29303a'; g.fillRect(15, 7, 13, 8); g.fillRect(31, 7, 14, 8);
    g.fillStyle = '#1a1a1a'; daire(g, 14, 29, 5); daire(g, 50, 29, 5);
    g.fillStyle = '#4d2a1e'; g.fillRect(20, 18, 10, 4);
  });
  var SPR_VARIL = sprite(24, 32, 1, function (g) {
    golge(g, 12, 29, 10, 3);
    g.fillStyle = '#b3381e'; g.fillRect(3, 3, 18, 26);
    g.fillStyle = '#7d2614'; g.fillRect(3, 9, 18, 3); g.fillRect(3, 20, 18, 3);
    g.fillStyle = '#ffd166'; g.fillRect(9, 13, 6, 6);
  });
  var DEKOR = [SPR_AGAC, SPR_ARABA, SPR_VARIL];
  var DEKOR_W = [1.6, 2.6, 0.6], DEKOR_H = [2.8, 1.4, 0.8];

  // ================= TÜRLER =================
  var K_ZOMBI = 1, K_KOS = 2, K_TANK = 3, K_BOSS = 4, K_KAPI = 5, K_SANDIK = 6;
  var KR = [0, 0.3, 0.27, 0.55, 1.3, 1.38, 0.5];     // çarpışma yarıçapı
  var KW = [0, 0.55, 0.48, 1.05, 2.7, 0, 0.95];      // çizim genişliği
  var KH = [0, 0.82, 0.72, 1.5, 4.0, 1.7, 1.0];      // çizim yüksekliği
  var KSP = [0, 1.5, 3.4, 0.9, 1.0, 0, 0];           // yürüme hızı
  var KGUC = [0, 1, 1, 5, 0, 0, 0];                  // temas edince öldürdüğü asker
  var KPARA = [0, 1, 1, 5, 0, 0, 3];                 // ödül
  var SPR = [null, SPR_ZOMBI, SPR_KOS, SPR_TANK, SPR_BOSS, null, SPR_SANDIK];

  // ================= HAVUZLAR (oyun sırasında bellek ayrılmaz) =================
  var ME = 600;
  var eA = new Uint8Array(ME), eK = new Uint8Array(ME), eOp = new Uint8Array(ME);
  var eX = new Float32Array(ME), eZ = new Float32Array(ME), eHp = new Float32Array(ME), eMax = new Float32Array(ME);
  var eV = new Float32Array(ME), eG = new Float32Array(ME), eFl = new Float32Array(ME), eSeed = new Float32Array(ME);
  var eP = new Int16Array(ME), eTx = new Array(ME), eTxV = new Float32Array(ME);
  var eOrd = new Int16Array(ME), eN = 0;
  var bos = new Int16Array(ME), bosN = 0;
  var izBas = new Int16Array(HUCRE), izSon = new Int16Array(ME);

  function varlikTemizle() {
    eA.fill(0); eN = 0; bosN = 0;
    for (var i = ME - 1; i >= 0; i--) bos[bosN++] = i;
  }
  function vEkle(k, x, z, hp) {
    if (!bosN) return -1;
    var i = bos[--bosN];
    eA[i] = 1; eK[i] = k; eX[i] = x; eZ[i] = z; eHp[i] = hp; eMax[i] = hp;
    eFl[i] = 0; eG[i] = 0; eV[i] = 0; eOp[i] = 0; eP[i] = -1; eTx[i] = ''; eTxV[i] = -1;
    eSeed[i] = Math.random() * 10;
    eOrd[eN++] = i;
    return i;
  }
  // Yer, sıralama listesinden çıkınca (guncelle içinde) boşa döner; aynı karede tekrar kullanılmaz.
  function vSil(i) { eA[i] = 0; }

  var MB = 360, bIdx = 0;
  var bA = new Uint8Array(MB), bX = new Float32Array(MB), bZ = new Float32Array(MB), bD = new Float32Array(MB), bL = new Float32Array(MB);
  function mermiEkle(x, z, d) {
    for (var n = 0; n < MB; n++) {
      bIdx++; if (bIdx >= MB) bIdx = 0;
      if (!bA[bIdx]) { bA[bIdx] = 1; bX[bIdx] = x; bZ[bIdx] = z; bD[bIdx] = d; bL[bIdx] = 1.05; return; }
    }
  }

  var MP = 320, pIdx = 0;
  var pX = new Float32Array(MP), pY = new Float32Array(MP), pZ = new Float32Array(MP);
  var pVX = new Float32Array(MP), pVY = new Float32Array(MP), pVZ = new Float32Array(MP), pL = new Float32Array(MP);
  var pC = new Uint8Array(MP);
  var PRENK = ['#5c8a2e', '#c0392b', '#ffd166', '#8b5a2b', '#4da3ff', '#ffffff'];
  function parca(x, z, y, renk, n, guc) {
    n = Math.ceil(n * kalite);
    for (var i = 0; i < n; i++) {
      pIdx++; if (pIdx >= MP) pIdx = 0;
      pX[pIdx] = x; pZ[pIdx] = z; pY[pIdx] = y;
      pVX[pIdx] = (Math.random() - 0.5) * 3 * guc; pVZ[pIdx] = (Math.random() - 0.3) * 3 * guc;
      pVY[pIdx] = (1 + Math.random() * 2.5) * guc;
      pL[pIdx] = 0.5 + Math.random() * 0.4; pC[pIdx] = renk;
    }
  }

  var MF = 16, fIdx = 0;
  var fX = new Float32Array(MF), fZ = new Float32Array(MF), fY = new Float32Array(MF), fL = new Float32Array(MF);
  var fS = new Array(MF), fR = new Array(MF);
  function yaziEkle(x, z, s, renk) {
    fIdx++; if (fIdx >= MF) fIdx = 0;
    fX[fIdx] = x; fZ[fIdx] = z; fY[fIdx] = 1; fL[fIdx] = 1.2; fS[fIdx] = s; fR[fIdx] = renk;
  }

  // Asker dizilişi (ayçiçeği deseni)
  var MAXDIZ = 160;
  var OX = new Float32Array(MAXDIZ), OZ = new Float32Array(MAXDIZ), SIRA = new Int16Array(MAXDIZ);
  (function () {
    var tmp = [];
    for (var i = 0; i < MAXDIZ; i++) {
      var r = 0.17 * Math.sqrt(i), a = i * 2.39996;
      OX[i] = Math.cos(a) * r; OZ[i] = Math.sin(a) * r * 0.8; tmp.push(i);
    }
    tmp.sort(function (a, b) { return OZ[b] - OZ[a]; });
    for (var j = 0; j < MAXDIZ; j++) SIRA[j] = tmp[j];
  })();

  // ================= OYUN DURUMU =================
  var durum = 0; // 0 menü, 1 oyun, 2 duraklatıldı, 3 sonuç
  var asker = 0, askerStr = '0', sqX = 0, sqZ = 0, hedefX = 0, hiz = 0, t = 0;
  var cizilen = 0, formR = 0.2;
  var bossFazi = false, bossI = -1, bossTemas = 0, bitti = false, bitisT = -1, kazandi = false;
  var kazanc = 0, silahSv = 0, atisAcc = 0, sallanma = 0;
  var bolum = null, evI = 0, bolumStr = '', paraStr = '', sonPara = -1;
  var MERMI_RENK = ['#ffe066', '#7df9ff', '#ff7bf2', '#ff5a36'];

  function askerYaz() { askerStr = String(asker); }

  function bolumUret(L) {
    var r = rngYap(L * 7919 + 13);
    var ev = [];
    var uzunluk = Math.min(140 + L * 14, 420);
    var E = 6 + L * 1.5; // beklenen asker sayısı
    var z = 14, ilk = true;
    function kapi(op, v) { return { op: op, v: v }; }
    while (z < uzunluk) {
      var t0 = r();
      if (ilk || t0 < 0.38) {
        ilk = false;
        var carpan = L >= 5 && r() < 0.3 ? 3 : 2;
        var iyi = (E < 160 && r() < 0.4) ? kapi(1, carpan) : kapi(0, Math.round(3 + r() * (4 + L * 1.2)));
        var kotu = r() < 0.5 ? kapi(0, -Math.round(2 + r() * (3 + L * 0.8))) : kapi(0, Math.round(1 + r() * 3));
        if (L >= 3 && r() < 0.25) kotu = kapi(1, 0.5);
        var solIyi = r() < 0.5;
        var a = solIyi ? iyi : kotu, b = solIyi ? kotu : iyi;
        ev.push({ z: z, k: K_KAPI, x: -1.5, op: a.op, v: a.v });
        ev.push({ z: z, k: K_KAPI, x: 1.5, op: b.op, v: b.v });
        E = iyi.op === 1 ? E * 2 : E + iyi.v;
        z += 14 + r() * 5;
      } else if (t0 < 0.85) {
        var n = kes(Math.round(E * (0.35 + r() * 0.3 + L * 0.025)), 3, 90);
        if (L >= 4 && r() < 0.2) n = Math.min(120, n + Math.round(E * 0.4));
        var hp = Math.round(2 + L * 1.1);
        var derin = 2 + n * 0.12;
        for (var i = 0; i < n; i++) {
          var kos = L >= 2 && r() < 0.12 + L * 0.01;
          ev.push({ z: z + r() * derin, k: kos ? K_KOS : K_ZOMBI, x: (r() * 2 - 1) * (YOL - 0.4), hp: kos ? Math.max(1, Math.round(hp * 0.7)) : hp });
        }
        if (L >= 4 && r() < 0.3 + L * 0.03) {
          var tn = 1 + Math.floor(r() * (1 + L / 6));
          for (var j = 0; j < tn; j++) ev.push({ z: z + derin + r() * 2, k: K_TANK, x: (r() * 2 - 1) * (YOL - 0.8), hp: 20 + L * 12 });
        }
        E = Math.max(5, E - n * 0.12);
        z += derin + 10 + r() * 6;
      } else {
        var silah = r() < 0.5;
        ev.push({ z: z, k: K_SANDIK, x: r() < 0.5 ? -1.7 : 1.7, hp: Math.round(15 + L * 6 + E * 0.5), v: silah ? 0 : 1, adet: Math.round(4 + L * 1.5) });
        z += 10 + r() * 4;
      }
    }
    ev.sort(function (a, b) { return a.z - b.z; });
    return { ev: ev, uzunluk: uzunluk + 6, bossHp: Math.round(E * 18 * (1 + L * 0.08)) };
  }

  function bolumBasla() {
    var L = kayit.bolum;
    bolum = bolumUret(L); evI = 0;
    varlikTemizle(); bA.fill(0); pL.fill(0); fL.fill(0);
    asker = baslangicAsker(); askerYaz();
    sqX = 0; hedefX = 0; sqZ = 0; hiz = HIZ; t = 0;
    camZ = sqZ - KAMERA; camX = 0;
    bossFazi = false; bossI = -1; bossTemas = 0; bitti = false; bitisT = -1; kazandi = false;
    kazanc = 0; silahSv = 0; atisAcc = 0; sallanma = 0;
    bolumStr = 'Bölüm ' + L;
    durum = 1;
    ekran(null);
    if (oto && otoAdim > 3) setTimeout(function () { var g = 0; while (durum === 1 && g++ < 200000) guncelle(1 / 30); }, 0);
  }

  function olayUret(o) {
    var i = vEkle(o.k, o.x, o.z, o.hp || 1);
    if (i < 0) return;
    if (o.k === K_KAPI) {
      eOp[i] = o.op; eV[i] = o.v; kapiYazi(i);
      // önceki kapı aynı çiftin diğer yarısı mı?
      if (sonKapi >= 0 && eA[sonKapi] && eK[sonKapi] === K_KAPI && eZ[sonKapi] === Math.fround(o.z) && eP[sonKapi] < 0) {
        eP[i] = sonKapi; eP[sonKapi] = i;
      }
      sonKapi = i;
    } else if (o.k === K_SANDIK) {
      eV[i] = o.v; eG[i] = o.adet;
    }
  }
  var sonKapi = -1;

  function kapiYazi(i) {
    eTx[i] = eOp[i] === 1 ? '×' + eV[i] : (eV[i] > 0 ? '+' + eV[i] : String(eV[i]));
  }

  function bossBaslat() {
    bossFazi = true;
    var L = kayit.bolum;
    bossI = vEkle(K_BOSS, 0, sqZ + 24, bolum.bossHp);
    var n = 4 + L, hp = Math.round(2 + L * 0.7);
    for (var i = 0; i < n; i++) {
      var kos = Math.random() < 0.3;
      vEkle(kos ? K_KOS : K_ZOMBI, (Math.random() * 2 - 1) * (YOL - 0.4), sqZ + 14 + Math.random() * 10, hp);
    }
    yaziEkle(sqX, sqZ + 3, 'BOSS!', '#ff5a36');
  }

  function hasarAl(n) {
    if (bitti) return;
    asker -= n;
    if (asker <= 0) { asker = 0; bitir(false); }
    askerYaz();
    sallanma = 0.18;
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* yok */ } }
  }

  function bitir(kazan) {
    if (bitti) return;
    bitti = true; kazandi = kazan; bitisT = kazan ? 1.6 : 1.2;
    if (kazan) kazanc += 20 + 10 * kayit.bolum;
  }

  function kapiUygula(i) {
    var once = asker;
    if (eOp[i] === 1) asker = asker * eV[i]; else asker = asker + eV[i];
    asker = kes(Math.round(asker), 0, 9999);
    askerYaz();
    var fark = asker - once;
    yaziEkle(sqX, sqZ + 1, (fark >= 0 ? '+' : '') + fark, fark >= 0 ? '#7df9ff' : '#ff5a5a');
    if (asker <= 0) bitir(false);
  }

  function oldur(i) {
    var k = eK[i];
    kazanc += KPARA[k];
    if (k === K_SANDIK) {
      parca(eX[i], eZ[i], 0.5, 3, 10, 1);
      if (eV[i] === 0) {
        if (silahSv < 3) silahSv++;
        yaziEkle(eX[i], eZ[i], 'SİLAH +' + silahSv, '#ffd166');
      } else {
        asker = Math.min(9999, asker + eG[i]); askerYaz();
        yaziEkle(eX[i], eZ[i], '+' + eG[i] + ' ASKER', '#7df9ff');
      }
    } else if (k === K_BOSS) {
      parca(eX[i], eZ[i], 2, 0, 40, 2.5); parca(eX[i], eZ[i], 2, 1, 30, 2.5);
      bitir(true);
    } else {
      parca(eX[i], eZ[i], KH[k] * 0.6, 0, k === K_TANK ? 14 : 5, k === K_TANK ? 1.6 : 1);
    }
    vSil(i);
  }

  // Mermi isabet: true dönerse mermi biter
  function vur(i, b) {
    var k = eK[i];
    eFl[i] = 0.06;
    if (k === K_KAPI) {
      if (eOp[i] === 0) {
        eG[i] += 1;
        if (eG[i] >= 10) { eG[i] = 0; eV[i] += 1; kapiYazi(i); }
      }
      return true;
    }
    if (k === K_SANDIK) {
      eHp[i] -= bD[b];
      if (eHp[i] <= 0) oldur(i);
      return true;
    }
    if (bD[b] >= eHp[i]) {
      bD[b] -= eHp[i]; eHp[i] = 0; oldur(i);
      return bD[b] < 0.05;
    }
    eHp[i] -= bD[b];
    return true;
  }

  // ================= GÜNCELLEME =================
  function guncelle(dt) {
    t += dt;
    if (sallanma > 0) sallanma -= dt;

    var hedefHiz = (bossFazi || bitti) ? 0 : HIZ;
    hiz += (hedefHiz - hiz) * Math.min(1, dt * 3);
    sqZ += hiz * dt;
    if (!bossFazi && sqZ >= bolum.uzunluk) bossBaslat();

    // kontrol
    if (oto) otoSur();
    if (tusSol) hedefX -= 6 * dt;
    if (tusSag) hedefX += 6 * dt;
    cizilen = Math.min(asker, Math.round(60 + 100 * kalite), MAXDIZ);
    formR = 0.17 * Math.sqrt(cizilen) + 0.15;
    var lim = YOL - formR - 0.1; if (lim < 0) lim = 0;
    hedefX = kes(hedefX, -lim, lim);
    sqX += (hedefX - sqX) * Math.min(1, dt * 14);
    camZ = sqZ - KAMERA; camX = sqX * 0.35;

    // yeni varlıklar
    var ev = bolum.ev;
    while (evI < ev.length && ev[evI].z < camZ + UZAK) olayUret(ev[evI++]);

    // ateş
    if (!bitti && asker > 0) {
      var akis = Math.min(asker, Math.round(8 + 12 * kalite));
      var dmg = asker * hasarCarpani() * (1 + 0.35 * silahSv) / akis;
      atisAcc += dt * atisHizi() * akis;
      var sinir = 40;
      while (atisAcc >= 1 && sinir-- > 0) {
        atisAcc -= 1;
        var j = (Math.random() * cizilen) | 0;
        mermiEkle(sqX + OX[j], sqZ + OZ[j] + 0.2, dmg);
      }
      if (atisAcc > 1) atisAcc = 1;
    }

    // varlıklar: listeyi sıkıştır + hareket
    var w = 0, i, k;
    for (var n = 0; n < eN; n++) {
      i = eOrd[n];
      if (!eA[i]) { bos[bosN++] = i; continue; }
      eOrd[w++] = i;
      if (eFl[i] > 0) eFl[i] -= dt;
      k = eK[i];
      var mesafe = eZ[i] - sqZ;
      if (k === K_BOSS) {
        if (mesafe > 1.8) eZ[i] -= KSP[k] * dt;
        else if (!bitti) {
          bossTemas += dt;
          if (bossTemas > 0.45) { bossTemas = 0; hasarAl(Math.max(1, Math.ceil(asker * 0.07))); parca(sqX, sqZ + 0.5, 0.4, 4, 4, 1); }
        }
        eX[i] += (sqX * 0.5 - eX[i]) * dt * 0.6;
      } else if (k <= K_TANK) {
        if (mesafe < 32) {
          eZ[i] -= KSP[k] * dt;
          if (mesafe < 14) {
            var dx = sqX - eX[i];
            dx = dx > 0.6 ? 0.6 : dx < -0.6 ? -0.6 : dx;
            eX[i] += dx * (k === K_KOS ? 2 : 1.2) * dt;
          }
        }
        if (mesafe < 0.3 && !bitti && Math.abs(eX[i] - sqX) < formR + KR[k]) {
          hasarAl(KGUC[k]);
          parca(eX[i], eZ[i], 0.4, 0, 4, 1); parca(eX[i], eZ[i], 0.3, 4, 3, 1);
          vSil(i); continue;
        }
        if (eZ[i] < camZ + 1) { vSil(i); continue; }
      } else if (k === K_KAPI) {
        if (eZ[i] <= sqZ && !bitti) {
          var p = eP[i];
          var sec = ((eX[i] < 0) === (sqX < 0) || p < 0) ? i : p;
          kapiUygula(sec);
          vSil(i); if (p >= 0) vSil(p);
          continue;
        }
      } else if (k === K_SANDIK) {
        if (eZ[i] < sqZ - 1) { vSil(i); continue; }
      }
    }
    eN = w;

    // uzaktan yakına sırala (neredeyse sıralı olduğu için hızlı)
    for (var a = 1; a < eN; a++) {
      var v = eOrd[a], z = eZ[v], b2 = a - 1;
      while (b2 >= 0 && eZ[eOrd[b2]] < z) { eOrd[b2 + 1] = eOrd[b2]; b2--; }
      eOrd[b2 + 1] = v;
    }

    // çarpışma ızgarası
    izBas.fill(-1);
    for (n = 0; n < eN; n++) {
      i = eOrd[n]; if (!eA[i]) continue;
      var c = (eZ[i] - camZ) | 0;
      if (c >= 0 && c < HUCRE) { izSon[i] = izBas[c]; izBas[c] = i; }
    }

    // mermiler
    for (var m = 0; m < MB; m++) {
      if (!bA[m]) continue;
      var z0 = bZ[m];
      bZ[m] += 32 * dt; bL[m] -= dt;
      if (bL[m] <= 0) { bA[m] = 0; continue; }
      var c0 = ((z0 - camZ) | 0) - 1, c1 = ((bZ[m] - camZ) | 0) + 1;
      if (c0 < 0) c0 = 0; if (c1 >= HUCRE) c1 = HUCRE - 1;
      var bitir2 = false;
      for (var cc = c0; cc <= c1 && !bitir2; cc++) {
        for (var e = izBas[cc]; e >= 0; e = izSon[e]) {
          if (!eA[e]) continue;
          var ez = eZ[e];
          if (ez < z0 - 0.3 || ez > bZ[m] + 0.3) continue;
          if (Math.abs(eX[e] - bX[m]) > KR[eK[e]]) continue;
          if (vur(e, m)) { bitir2 = true; break; }
        }
      }
      if (bitir2) { bA[m] = 0; parca(bX[m], bZ[m], 0.4, 2, 1, 0.5); }
    }

    // parçacıklar
    for (var q = 0; q < MP; q++) {
      if (pL[q] <= 0) continue;
      pL[q] -= dt;
      pX[q] += pVX[q] * dt; pZ[q] += pVZ[q] * dt; pY[q] += pVY[q] * dt;
      pVY[q] -= 9 * dt;
      if (pY[q] < 0) { pY[q] = 0; pVY[q] *= -0.3; pVX[q] *= 0.6; pVZ[q] *= 0.6; }
    }
    for (var f = 0; f < MF; f++) if (fL[f] > 0) { fL[f] -= dt; fY[f] += dt * 1.4; }

    if (bitisT >= 0) { bitisT -= dt; if (bitisT < 0) sonucGoster(); }
  }

  // Test için otomatik oyuncu (?oto)
  function otoSur() {
    var enIyi = -1, enZ = 1e9;
    for (var n = 0; n < eN; n++) {
      var i = eOrd[n];
      if (!eA[i] || eK[i] !== K_KAPI || eZ[i] < sqZ) continue;
      if (eZ[i] < enZ) { enZ = eZ[i]; enIyi = i; }
    }
    if (enIyi >= 0) {
      var p = eP[enIyi], a = enIyi;
      var deger = function (j) { return eOp[j] === 1 ? asker * eV[j] : asker + eV[j]; };
      if (p >= 0 && deger(p) > deger(a)) a = p;
      hedefX = eX[a] < 0 ? -2 : 2;
    } else hedefX = 0;
  }

  // ================= ÇİZİM =================
  function arkaPlan() {
    ctx.fillStyle = gokGrad; ctx.fillRect(0, 0, W, ufuk + 1);
    ctx.fillStyle = '#5e7a2a'; ctx.fillRect(0, ufuk, W, H - ufuk);

    // çim şeritleri (hız hissi)
    ctx.fillStyle = '#4d6622';
    var z0 = Math.floor(camZ / 3) * 3, y1, y2;
    for (; z0 < camZ + UZAK; z0 += 3) {
      if (((z0 / 3) & 1) === 0) continue;
      P(0, z0 + 1.5); y1 = sy; P(0, z0); y2 = sy;
      if (y2 > H) y2 = H;
      if (y2 > y1) ctx.fillRect(0, y1, W, y2 - y1);
    }

    // yol
    var zN = camZ + 0.4, zF = camZ + UZAK;
    var x1, x2, yN, x3, x4, yF;
    P(-YOL - 0.2, zN); x1 = sx; yN = sy; P(YOL + 0.2, zN); x2 = sx;
    P(YOL + 0.2, zF); x3 = sx; yF = sy; P(-YOL - 0.2, zF); x4 = sx;
    ctx.fillStyle = '#8a8078';
    ctx.beginPath(); ctx.moveTo(x1, yN); ctx.lineTo(x2, yN); ctx.lineTo(x3, yF); ctx.lineTo(x4, yF); ctx.fill();
    P(-YOL, zN); x1 = sx; P(YOL, zN); x2 = sx; P(YOL, zF); x3 = sx; P(-YOL, zF); x4 = sx;
    ctx.fillStyle = '#4f4c49';
    ctx.beginPath(); ctx.moveTo(x1, yN); ctx.lineTo(x2, yN); ctx.lineTo(x3, yF); ctx.lineTo(x4, yF); ctx.fill();

    // orta çizgi
    ctx.fillStyle = '#d8c25a';
    ctx.beginPath();
    var zz = Math.floor(camZ / 4) * 4;
    for (; zz < camZ + UZAK; zz += 4) {
      var za = zz < zN ? zN : zz, zb = zz + 2;
      if (zb <= za) continue;
      P(-0.07, za); x1 = sx; y1 = sy; P(0.07, za); x2 = sx;
      P(0.07, zb); x3 = sx; y2 = sy; P(-0.07, zb); x4 = sx;
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y1); ctx.lineTo(x3, y2); ctx.lineTo(x4, y2);
    }
    ctx.fill();

    // yol kenarı süsleri (uzaktan yakına)
    var adim = 7;
    var zi = Math.floor((camZ + UZAK) / adim);
    var ziMin = Math.floor(camZ / adim) + 1;
    for (; zi >= ziMin; zi--) {
      for (var s = -1; s <= 1; s += 2) {
        var h = Math.sin(zi * 12.9898 + s * 78.233) * 43758.5453; h -= Math.floor(h);
        if (h < 0.25) continue;
        var tur = (h * 7) % 3 | 0;
        var dz = zi * adim + h * 3;
        P(s * (YOL + 1.1 + h * 3.5), dz);
        if (sy > H + 200) continue;
        var spr = DEKOR[tur], dw = DEKOR_W[tur] * sk, dh = DEKOR_H[tur] * sk;
        ctx.drawImage(spr.c, sx - dw * 0.5, sy - dh, dw, dh);
      }
    }

    ctx.fillStyle = sisGrad; ctx.fillRect(0, ufuk, W, H * 0.09);
  }

  function kapiCiz(i) {
    var z = eZ[i];
    P(eX[i] - KR[K_KAPI], z); var ax = sx, by = sy, k = sk;
    P(eX[i] + KR[K_KAPI], z); var bx = sx;
    var h = KH[K_KAPI] * k;
    var iyi = eOp[i] === 1 || eV[i] > 0;
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = eFl[i] > 0 ? '#ffffff' : (iyi ? (eOp[i] === 1 ? '#22e08a' : '#3ea0ff') : '#ff4d6d');
    ctx.fillRect(ax, by - h, bx - ax, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = iyi ? '#e4f2ff' : '#ffe0e6';
    var p = 0.07 * k;
    ctx.fillRect(ax - p, by - h - p, p * 2, h + p);
    ctx.fillRect(bx - p, by - h - p, p * 2, h + p);
    ctx.fillRect(ax, by - h - p, bx - ax, p * 1.6);
    font(0.8 * k);
    ctx.fillStyle = '#fff';
    ctx.fillText(eTx[i], (ax + bx) * 0.5, by - h * 0.5);
  }

  function varlikCiz(i) {
    var k = eK[i];
    P(eX[i], eZ[i]);
    if (k === K_KAPI) { kapiCiz(i); return; }
    var spr = SPR[k], w = KW[k] * sk, h = KH[k] * sk;
    var f = 0;
    if (k <= K_BOSS) f = ((t * (k === K_KOS ? 10 : k === K_BOSS ? 3 : 6) + eSeed[i]) | 0) & 1;
    ctx.drawImage(eFl[i] > 0 ? spr.b : spr.c, f * spr.w, 0, spr.w, spr.h, sx - w * 0.5, sy - h, w, h);
    if ((k === K_TANK || k === K_SANDIK) && eHp[i] < eMax[i]) {
      var bw = w * 0.9, by = sy - h - 0.12 * sk;
      ctx.fillStyle = '#000'; ctx.fillRect(sx - bw * 0.5, by, bw, 0.08 * sk + 1);
      ctx.fillStyle = k === K_TANK ? '#ff4d4d' : '#ffd166';
      ctx.fillRect(sx - bw * 0.5, by, bw * eHp[i] / eMax[i], 0.08 * sk + 1);
    }
    if (k === K_SANDIK) {
      var hp = Math.ceil(eHp[i]);
      if (hp !== eTxV[i]) { eTxV[i] = hp; eTx[i] = (eV[i] === 0 ? 'SİLAH ' : '+' + eG[i] + ' ') + hp; }
      font(0.3 * sk); ctx.fillStyle = '#fff';
      ctx.fillText(eTx[i], sx, sy - h - 0.3 * sk);
    }
  }

  function askerleriCiz() {
    var frameHiz = hiz > 0.5 ? 9 : 0;
    var spr = SPR_ASKER, w0 = 0.46, h0 = 0.68;
    for (var n = 0; n < MAXDIZ; n++) {
      var j = SIRA[n];
      if (j >= cizilen) continue;
      P(sqX + OX[j], sqZ + OZ[j]);
      var w = w0 * sk, h = h0 * sk;
      var f = ((t * frameHiz + j * 0.37) | 0) & 1;
      ctx.drawImage(spr.c, f * spr.w, 0, spr.w, spr.h, sx - w * 0.5, sy - h, w, h);
    }
  }

  function ciz() {
    var ox = 0, oy = 0;
    if (sallanma > 0) { ox = (Math.random() - 0.5) * 8; oy = (Math.random() - 0.5) * 8; }
    ctx.setTransform(PXR, 0, 0, PXR, ox * PXR, oy * PXR);
    arkaPlan();

    // takımın arkasındaki varlıklar
    var n = 0, i;
    var on = sqZ + 0.4;
    for (; n < eN; n++) {
      i = eOrd[n];
      if (!eA[i]) continue;
      if (eZ[i] < on) break;
      if (eZ[i] > camZ + UZAK) continue;
      varlikCiz(i);
    }
    if (durum !== 0 && asker > 0) askerleriCiz();
    for (; n < eN; n++) { i = eOrd[n]; if (eA[i]) varlikCiz(i); }

    // mermiler (tek çizimde)
    ctx.strokeStyle = MERMI_RENK[silahSv];
    ctx.lineWidth = 2 + silahSv * 0.6;
    ctx.beginPath();
    for (var m = 0; m < MB; m++) {
      if (!bA[m]) continue;
      P(bX[m], bZ[m]); var x1 = sx, y1 = sy - 0.4 * sk;
      P(bX[m], bZ[m] - 0.5); ctx.moveTo(x1, y1); ctx.lineTo(sx, sy - 0.4 * sk);
    }
    ctx.stroke();

    // parçacıklar (renk gruplarıyla)
    for (var c = 0; c < PRENK.length; c++) {
      ctx.fillStyle = PRENK[c];
      for (var q = 0; q < MP; q++) {
        if (pL[q] <= 0 || pC[q] !== c) continue;
        P(pX[q], pZ[q]);
        var s = 0.09 * sk;
        ctx.fillRect(sx - s * 0.5, sy - pY[q] * sk - s * 0.5, s, s);
      }
    }

    // uçan yazılar
    for (var f = 0; f < MF; f++) {
      if (fL[f] <= 0) continue;
      P(fX[f], fZ[f]);
      ctx.globalAlpha = fL[f] > 1 ? 1 : fL[f];
      font(Math.max(18, 0.5 * sk));
      ctx.fillStyle = '#000'; ctx.fillText(fS[f], sx + 2, sy - fY[f] * sk + 2);
      ctx.fillStyle = fR[f]; ctx.fillText(fS[f], sx, sy - fY[f] * sk);
    }
    ctx.globalAlpha = 1;

    if (durum !== 0) {
      // takım sayısı
      if (asker > 0) {
        P(sqX, sqZ + formR * 0.8);
        var fs = Math.max(16, Math.min(34, 0.32 * sk));
        var by = sy - 0.95 * sk;
        var bw = askerStr.length * fs * 0.62 + fs * 0.9;
        ctx.fillStyle = 'rgba(20,60,140,0.85)';
        ctx.fillRect(sx - bw * 0.5, by - fs * 0.7, bw, fs * 1.4);
        font(fs); ctx.fillStyle = '#fff'; ctx.fillText(askerStr, sx, by);
      }
      hudCiz();
    }
    ctx.setTransform(PXR, 0, 0, PXR, 0, 0);
  }

  function hudCiz() {
    var ust = 14;
    var bw = Math.min(W * 0.56, 420), bx = (W - bw) * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(bx, ust, bw, 10);
    var oran = bolum ? Math.min(1, sqZ / bolum.uzunluk) : 0;
    ctx.fillStyle = '#ffd166'; ctx.fillRect(bx, ust, bw * oran, 10);
    font(15); ctx.fillStyle = '#fff';
    ctx.fillText(bolumStr, W * 0.5, ust + 24);

    var para = kayit.para + kazanc;
    if (para !== sonPara) { sonPara = para; paraStr = '◆ ' + para; }
    ctx.textAlign = 'left'; font(18); ctx.fillStyle = '#ffd166';
    ctx.fillText(paraStr, 12, ust + 34);
    ctx.textAlign = 'center';

    if (bossFazi && bossI >= 0) {
      var by2 = ust + 44, oran2 = Math.max(0, eHp[bossI] / eMax[bossI]);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by2, bw, 14);
      ctx.fillStyle = '#ff3b3b'; ctx.fillRect(bx, by2, bw * oran2, 14);
      font(12); ctx.fillStyle = '#fff'; ctx.fillText('BOSS', W * 0.5, by2 + 7);
    }

    if (kayit.bolum === 1 && t < 4) {
      ctx.globalAlpha = 1 - t / 4;
      font(Math.min(30, W * 0.07)); ctx.fillStyle = '#fff';
      ctx.fillText('◀  SÜRÜKLE  ▶', W * 0.5, H * 0.92);
      ctx.globalAlpha = 1;
    }
    if (fpsGoster) { ctx.textAlign = 'left'; font(12); ctx.fillStyle = '#0f0'; ctx.fillText(fpsStr, 12, H - 12); ctx.textAlign = 'center'; }
  }

  // ================= EKRANLAR =================
  var $ = function (id) { return document.getElementById(id); };
  var elMenu = $('menu'), elDurak = $('durak'), elSonuc = $('sonuc'), elDurBtn = $('duraklatBtn');

  function ekran(el) {
    elMenu.classList.toggle('gizli', el !== elMenu);
    elDurak.classList.toggle('gizli', el !== elDurak);
    elSonuc.classList.toggle('gizli', el !== elSonuc);
    elDurBtn.classList.toggle('gizli', durum !== 1);
  }

  function menuGoster() {
    durum = 0;
    $('mBolum').textContent = 'Bölüm ' + kayit.bolum;
    $('mPara').textContent = kayit.para;
    var kutu = $('yukselt'); kutu.innerHTML = '';
    YUK.forEach(function (y, i) {
      var b = document.createElement('button');
      var dolu = kayit.up[i] >= y.max;
      var m = maliyet(i);
      b.innerHTML = '<b>' + y.ad + '</b><br>Sv ' + (kayit.up[i] + 1) + '<br>' + (dolu ? 'EN ÜST' : '◆ ' + m);
      b.disabled = dolu || kayit.para < m;
      b.onclick = function () {
        if (kayit.para < m || dolu) return;
        kayit.para -= m; kayit.up[i]++; kaydet(); menuGoster();
      };
      kutu.appendChild(b);
    });
    // menü arkasında boş yol görünsün
    bolum = null; varlikTemizle(); bA.fill(0); pL.fill(0); fL.fill(0); silahSv = 0;
    camZ = -KAMERA; camX = 0; sqZ = 0;
    ciz();
    ekran(elMenu);
  }

  function sonucGoster() {
    durum = 3;
    kayit.para += kazanc;
    if (kazandi) { kayit.bolum++; if (kayit.bolum > kayit.enIyi) kayit.enIyi = kayit.bolum; }
    kaydet();
    $('sBaslik').textContent = kazandi ? 'Bölüm Geçildi!' : 'Takım Düştü!';
    $('sBaslik').style.color = kazandi ? '#7dffb0' : '#ff6b6b';
    $('sYazi').textContent = kazandi ? 'Sıradaki: Bölüm ' + kayit.bolum : 'Güçlenip tekrar dene.';
    $('sPara').textContent = '+◆ ' + kazanc;
    $('sonucBtn').textContent = kazandi ? 'DEVAM' : 'TEKRAR';
    ekran(elSonuc);
    if (oto) { document.title += (kazandi ? ' K' : ' X') + kayit.bolum + ':' + asker; if (!kazandi && /[?&]otoup/.test(location.search)) otoYukselt(); if (kayit.bolum > 30 || document.title.length > 400) oto = false; else setTimeout(bolumBasla, 50); }
  }

  function otoYukselt() {
    for (var d = 0; d < 30; d++) { var i = d % 3; if (kayit.para >= maliyet(i) && kayit.up[i] < YUK[i].max) { kayit.para -= maliyet(i); kayit.up[i]++; } }
  }

  function duraklat() { if (durum === 1) { durum = 2; ekran(elDurak); } }
  function devam() { if (durum === 2) { durum = 1; ekran(null); } }

  $('oynaBtn').onclick = bolumBasla;
  $('sonucBtn').onclick = bolumBasla;
  $('devamBtn').onclick = devam;
  $('menuBtn1').onclick = menuGoster;
  $('menuBtn2').onclick = menuGoster;
  elDurBtn.onclick = duraklat;
  $('guncelBtn').onclick = function () { location.reload(); };
  $('surum').textContent = 'v' + SURUM;

  // ================= GİRDİ =================
  var surukle = false, sonX = 0, tusSol = false, tusSag = false;
  cv.addEventListener('pointerdown', function (e) {
    surukle = true; sonX = e.clientX;
    try { cv.setPointerCapture(e.pointerId); } catch (x) { /* yok */ }
  });
  cv.addEventListener('pointermove', function (e) {
    if (durum !== 1) return;
    var k = focal / KAMERA;
    if (e.pointerType === 'mouse') { hedefX = (e.clientX - W * 0.5) / k * 1.4; return; }
    if (!surukle) return;
    hedefX += (e.clientX - sonX) / k * 1.3;
    sonX = e.clientX;
  });
  function birak() { surukle = false; }
  cv.addEventListener('pointerup', birak);
  cv.addEventListener('pointercancel', birak);
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('keydown', function (e) {
    var c = e.code;
    if (c === 'ArrowLeft' || c === 'KeyA') tusSol = true;
    else if (c === 'ArrowRight' || c === 'KeyD') tusSag = true;
    else if (c === 'Escape' || c === 'KeyP') { if (durum === 1) duraklat(); else if (durum === 2) devam(); }
    else if ((c === 'Enter' || c === 'Space') && (durum === 0 || durum === 3)) { e.preventDefault(); bolumBasla(); }
  });
  window.addEventListener('keyup', function (e) {
    var c = e.code;
    if (c === 'ArrowLeft' || c === 'KeyA') tusSol = false;
    else if (c === 'ArrowRight' || c === 'KeyD') tusSag = false;
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) duraklat(); });
  window.addEventListener('resize', boyutla);

  // ================= DÖNGÜ + UYARLANABİLİR KALİTE =================
  var oto = /[?&]oto/.test(location.search);
  var otoAdim = /[?&]hizli/.test(location.search) ? 400 : 3;
  var fpsGoster = /[?&]fps/.test(location.search);
  var fpsStr = '', fpsN = 0, fpsT = 0, iyiSure = 0, onceki = 0;

  function olc(ham) {
    fpsT += ham; fpsN++;
    if (fpsT < 1) return;
    var fps = fpsN / fpsT; fpsN = 0; fpsT = 0;
    if (fpsGoster) fpsStr = Math.round(fps) + ' FPS  kalite ' + kalite.toFixed(2);
    if (durum !== 1) return;
    if (fps < 45 && kalite > 0.5) { kalite = Math.max(0.5, kalite - 0.15); iyiSure = 0; boyutla(); }
    else if (fps > 57) { if (++iyiSure >= 5 && kalite < 1) { kalite = Math.min(1, kalite + 0.1); iyiSure = 0; boyutla(); } }
    else iyiSure = 0;
  }

  function dongu(zaman) {
    requestAnimationFrame(dongu);
    var ham = (zaman - onceki) / 1000; onceki = zaman;
    if (!(ham > 0) || ham > 0.25) ham = 1 / 60;
    olc(ham);
    if (durum !== 1) return;
    if (oto) { var adim = otoAdim; while (adim-- > 0 && durum === 1) guncelle(1 / 30); }
    else guncelle(ham > 0.05 ? 0.05 : ham);
    if (durum === 1) ciz();
  }

  // ================= BAŞLAT =================
  boyutla();
  menuGoster();
  requestAnimationFrame(dongu);
  if (oto) bolumBasla();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* yok say */ });
  }
  if (window.fetch && location.protocol !== 'file:') {
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.version && j.version !== SURUM) $('guncelBtn').classList.remove('gizli'); })
      .catch(function () { /* çevrimdışı */ });
  }
})();
