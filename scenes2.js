// ぽんぽんタッチ 第2弾：あーん・ぬりぬり・めだまやき・でんわ・トイレ
// app.js の後に読み込む（SCENES / ORDER / el / img / A / J / rand / pct を使う）

// 上に出す文字（「あーん」「できたね」など）
function caption(scene, text, color) {
  let c = scene.querySelector('.caption');
  if (!c) { c = el('div', 'caption'); scene.append(c); }
  c.textContent = text;
  c.style.color = color || '';
  c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
}
// キラキラを散らす
function sparkles(scene, n = 14) {
  const box = el('div', 'sparkles');
  for (let i = 0; i < n; i++) {
    const s = el('span', '', '✦');
    Object.assign(s.style, { left: rand(4, 92) + '%', top: rand(12, 92) + '%', fontSize: rand(14, 34) + 'px', animationDelay: rand(0, 0.8) + 's' });
    box.append(s);
  }
  scene.append(box);
  return box;
}
// 連打で段階が飛ばないよう、少し間をあける
function gate(ms) { let t = 0; return () => { const n = performance.now(); if (n - t < ms) return false; t = n; return true; }; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---- あーん ----
SCENES.feed = {
  thumb: A('thumb_feed'),
  foods: [['umeboshi', 'sour'], ['cake', 'yum'], ['sushi', 'yum'], ['banana', 'yum'], ['lemon', 'sour']],
  mouth: { x: 49, y: 71, w: 24 }, // 男の子の絵の中の口の位置（絵に対する%）
  mount(root) {
    const scene = el('div', 'scene feed');
    const boy = el('div', 'boy'); const face = img(A('boy_1')); boy.append(face);
    const food = img(''); food.className = 'food hidden';
    Object.assign(food.style, { left: this.mouth.x + '%', top: this.mouth.y + '%', width: this.mouth.w + '%' });
    boy.append(food);
    scene.append(boy);
    root.append(scene);
    Sound.preload(['aan', 'mogu', 'suppai', 'oishii', ...this.foods.map(f => f[0])]);
    let step = 0, queue = [], cur = null, spark = null;
    const ok = gate(450);
    const label = { umeboshi: 'うめぼし', cake: 'けーき', sushi: 'おすし', banana: 'ばなな', lemon: 'れもん' };
    const reset = () => {
      scene.dataset.mood = ''; spark && spark.remove(); spark = null;
      face.src = A('boy_1'); food.classList.add('hidden');
      caption(scene, 'あーん'); step = 0;
    };
    reset();
    scene.addEventListener('pointerdown', () => {
      if (!ok()) return;
      if (step === 0) {                      // 食べ物が口に入る
        if (!queue.length) queue = shuffle(this.foods);
        cur = queue.pop();
        face.src = A('boy_2');
        food.src = A('food_' + cur[0]); food.classList.remove('hidden');
        food.animate([{ transform: 'translate(-50%,-160%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], { duration: 350, easing: 'cubic-bezier(.3,1.4,.5,1)' });
        caption(scene, label[cur[0]]);
        Sound.play('appear'); Sound.voice(cur[0]);
      } else if (step === 1) {               // もぐもぐ
        food.classList.add('hidden'); face.src = A('boy_3');
        boy.animate([{ transform: 'scale(1,1)' }, { transform: 'scale(1.03,.97)' }, { transform: 'scale(1,1)' }], { duration: 300, iterations: 3 });
        caption(scene, 'もぐもぐ');
        Sound.play('chew'); Sound.voice('mogu');
      } else if (step === 2) {               // すっぱい／おいしいね
        const sour = cur[1] === 'sour';
        face.src = A(sour ? 'boy_4' : 'boy_5');
        scene.dataset.mood = sour ? 'sour' : 'yum';
        caption(scene, sour ? 'すっぱい！' : 'おいしいね');
        if (!sour) spark = sparkles(scene);
        boy.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-4%)' }, { transform: 'translateY(0)' }], { duration: 400, easing: 'ease-out' });
        Sound.voice(sour ? 'suppai' : 'oishii');
      } else {                               // つぎの「あーん」
        reset(); Sound.voice('aan');
        step = -1;
      }
      step++;
    });
  },
  unmount() {},
};

// ---- ぬりぬり ----
SCENES.paint = {
  thumb: A('thumb_paint'),
  items: [['shelf', '#4a90e2', 'たな'], ['desk', '#6cc04a', 'つくえ'], ['chair', '#ef5fa7', 'いす'], ['bed', '#f5a031', 'べっど'], ['door', '#a070e0', 'どあ']],
  mount(root) {
    const scene = el('div', 'scene paint');
    const cv = el('canvas', 'paint-canvas');
    scene.append(cv); root.append(scene);
    Sound.preload(['nuri', 'dekita', ...this.items.map(i => i[0])]);
    const ctx = cv.getContext('2d');
    let idx = -1, pic = null, colored = null, mask = null, box = null, done = false, taps = 0, lastVoice = 0, spark = null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const layout = () => {
      const r = scene.getBoundingClientRect();
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      if (!pic) return;
      const maxW = cv.width * 0.84, maxH = cv.height * 0.58;
      const s = Math.min(maxW / pic.width, maxH / pic.height);
      const w = pic.width * s, h = pic.height * s;
      box = { x: (cv.width - w) / 2, y: cv.height * 0.58 - h / 2, w, h };
    };
    const draw = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (!pic || !box) return;
      ctx.drawImage(pic, box.x, box.y, box.w, box.h);
      const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height;
      const tc = t.getContext('2d');
      tc.drawImage(colored, box.x, box.y, box.w, box.h);
      tc.globalCompositeOperation = 'destination-in';
      tc.drawImage(mask, 0, 0);
      ctx.drawImage(t, 0, 0);
    };
    const next = () => {
      idx = (idx + 1) % this.items.length;
      const [key, color, name] = this.items[idx];
      done = false; taps = 0; scene.dataset.mood = ''; spark && spark.remove(); spark = null;
      const im = new Image();
      im.onload = () => {
        pic = im; layout();
        // 白い絵に色をかけ合わせて「塗った後」の絵を作る
        colored = document.createElement('canvas'); colored.width = im.width; colored.height = im.height;
        const c = colored.getContext('2d');
        c.drawImage(im, 0, 0); c.globalCompositeOperation = 'multiply'; c.fillStyle = color; c.fillRect(0, 0, im.width, im.height);
        c.globalCompositeOperation = 'destination-in'; c.drawImage(im, 0, 0);
        mask = document.createElement('canvas'); mask.width = cv.width; mask.height = cv.height;
        draw();
      };
      im.src = A('paint_' + key);
      caption(scene, name);
      Sound.voice(key);
    };
    // 塗れた割合（絵のある所のうち、塗った所）
    const coverage = () => {
      const a = document.createElement('canvas'); a.width = cv.width; a.height = cv.height;
      const ac = a.getContext('2d'); ac.drawImage(pic, box.x, box.y, box.w, box.h);
      const pa = ac.getImageData(0, 0, a.width, a.height).data;
      const ma = mask.getContext('2d').getImageData(0, 0, a.width, a.height).data;
      let all = 0, hit = 0;
      for (let y = Math.floor(box.y); y < box.y + box.h; y += 6) for (let x = Math.floor(box.x); x < box.x + box.w; x += 6) {
        const i = (y * a.width + x) * 4 + 3;
        if (pa[i] > 100) { all++; if (ma[i] > 100) hit++; }
      }
      return all ? hit / all : 0;
    };
    scene.addEventListener('pointerdown', (ev) => {
      if (!pic) return;
      if (done) { next(); return; }
      const p = pct(ev, scene);
      const x = p.x / 100 * cv.width, y = p.y / 100 * cv.height;
      const m = mask.getContext('2d'); m.fillStyle = '#000';
      const R = box.w * 0.2;
      for (let k = 0; k < 9; k++) {           // ぽてっとした形にする
        const a = rand(0, Math.PI * 2), d = rand(0, R * 0.6);
        m.beginPath(); m.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rand(R * 0.45, R * 0.75), 0, Math.PI * 2); m.fill();
      }
      draw(); Sound.play('splat'); taps++;
      const now = performance.now();
      if (now - lastVoice > 1500 && taps % 2 === 1) { Sound.voice('nuri'); lastVoice = now; caption(scene, 'ぬりぬり', this.items[idx][1]); }
      if (coverage() > 0.85) {
        done = true;
        m.fillRect(0, 0, mask.width, mask.height); draw();
        scene.dataset.mood = 'done';
        caption(scene, 'できたね！', this.items[idx][1]);
        spark = sparkles(scene);
        cv.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 500, easing: 'ease-out' });
        Sound.play('fanfare'); Sound.voice('dekita', 0.3);
      }
    });
    this.onResize = () => { layout(); if (mask) { const old = mask; mask = document.createElement('canvas'); mask.width = cv.width; mask.height = cv.height; mask.getContext('2d').drawImage(old, 0, 0, cv.width, cv.height); } draw(); };
    window.addEventListener('resize', this.onResize);
    next();
  },
  unmount() { window.removeEventListener('resize', this.onResize); },
};

// ---- めだまやき ----
SCENES.egg = {
  thumb: A('thumb_egg'),
  pan: { x: 42, y: 52, w: 44 },  // フライパンの中のたまごを置く位置（画面に対する%）
  mount(root) {
    const scene = el('div', 'scene egg');
    scene.append(Object.assign(img(J('bg_pan')), { className: 'bg' }));
    const egg = img(''); egg.className = 'egg-item hidden';
    scene.append(egg); root.append(scene);
    Sound.preload(['kon', 'kapa', 'ju', 'yaketa', 'futago']);
    let step = 0, twin = false, steams = [], spark = null;
    const ok = gate(450);
    const at = (src, x, y, w) => { egg.src = A(src); Object.assign(egg.style, { left: x + '%', top: y + '%', width: w + '%' }); egg.classList.remove('hidden'); };
    const P = this.pan;
    scene.addEventListener('pointerdown', () => {
      if (!ok()) return;
      if (step === 0) {                         // こん
        scene.dataset.mood = ''; spark && spark.remove(); spark = null;
        at('egg_whole', P.x + P.w * 0.45, P.y - 14, 22);
        egg.animate([{ transform: 'translate(-50%,-50%) translateY(-60%)' }, { transform: 'translate(-50%,-50%) rotate(-12deg)' }, { transform: 'translate(-50%,-50%) rotate(6deg)' }, { transform: 'translate(-50%,-50%)' }], { duration: 500, easing: 'ease-out' });
        caption(scene, 'こんっ'); Sound.play('knock'); Sound.voice('kon');
      } else if (step === 1) {                  // かぱっ → 生たまごが落ちる
        twin = Math.random() < 0.25;
        at('egg_crack', P.x, P.y - 16, 30);
        caption(scene, 'かぱっ'); Sound.play('crack'); Sound.voice('kapa');
        setTimeout(() => {
          at(twin ? 'egg_raw2' : 'egg_raw', P.x, P.y, P.w);
          egg.animate([{ transform: 'translate(-50%,-50%) scale(.5)', opacity: .3 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], { duration: 300, easing: 'ease-out' });
        }, 450);
      } else if (step === 2) {                  // じゅ〜（たまに、ふたごだ！）
        caption(scene, twin ? 'ふたごだ！' : 'じゅ〜');
        Sound.play('sizzle'); Sound.voice(twin ? 'futago' : 'ju');
        [[-30, -22], [30, -22]].forEach(([dx, dy], i) => {
          const s = img(A('steam')); s.className = 'steam';
          Object.assign(s.style, { left: (P.x + dx) + '%', top: (P.y + dy) + '%' });
          s.style.animationDelay = i * 0.3 + 's';
          scene.append(s); steams.push(s);
        });
      } else if (step === 3) {                  // じょうずにやけたね
        steams.forEach(s => s.remove()); steams = [];
        at(twin ? 'egg_fried2' : 'egg_fried', P.x, P.y, P.w);
        scene.dataset.mood = 'done';
        caption(scene, 'じょうずにやけたね');
        spark = sparkles(scene);
        Sound.play('fanfare'); Sound.voice('yaketa', 0.2);
      } else {                                  // からっぽに戻す
        egg.animate([{ transform: 'translate(-50%,-50%)' }, { transform: 'translate(200%,-50%) rotate(40deg)', opacity: 0 }], { duration: 400, easing: 'ease-in', fill: 'forwards' })
          .onfinish = () => { egg.classList.add('hidden'); egg.getAnimations().forEach(a => a.cancel()); };
        scene.dataset.mood = ''; spark && spark.remove(); spark = null;
        scene.querySelector('.caption')?.remove();
        Sound.play('tap');
        step = -1;
      }
      step++;
    });
  },
  unmount() {},
};

// ---- でんわ ----
SCENES.phone = {
  thumb: A('thumb_phone'),
  mount(root) {
    const scene = el('div', 'scene phone');
    const pad = el('div', 'phone-pad');
    const top = el('div', 'phone-top');
    const bHang = el('button', 'pbtn icon'); bHang.append(img(A('phone_hangup')));
    const bMascot = el('button', 'pbtn icon'); bMascot.append(img(A('phone_mascot')));
    const bCall = el('button', 'pbtn icon'); bCall.append(img(A('phone_call')));
    top.append(bHang, bMascot, bCall);
    const keys = el('div', 'phone-keys');
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '＊', '0', '＃'].forEach((k, i) => {
      const b = el('button', 'pkey' + (i === 9 || i === 11 ? ' sym' : ''), k);
      b.addEventListener('pointerdown', () => {
        Sound.play('dial', i === 10 ? 0 : i === 9 ? 10 : i === 11 ? 11 : i + 1);
        b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 220);
      });
      keys.append(b);
    });
    pad.append(top, keys); scene.append(pad); root.append(scene);
    Sound.preload(['natsuki']);
    const bounce = b => b.animate([{ transform: 'scale(1)' }, { transform: 'scale(.88)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 350 });
    bHang.addEventListener('pointerdown', () => { Sound.play('hangup'); bounce(bHang); });
    bCall.addEventListener('pointerdown', () => { Sound.play('ring'); bounce(bCall); });
    bMascot.addEventListener('pointerdown', () => {
      Sound.voice('natsuki');
      bMascot.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-12deg) scale(1.1)' }, { transform: 'rotate(12deg) scale(1.1)' }, { transform: 'rotate(0)' }], { duration: 600 });
    });
  },
  unmount() {},
};

// ---- トイレ ----
SCENES.toilet = {
  thumb: A('thumb_toilet'),
  bowl: { x: 50, y: 71, rx: 22, ry: 13 }, // 便器の中（画面に対する%）
  mount(root) {
    const scene = el('div', 'scene toilet');
    scene.append(Object.assign(img(J('bg_toilet')), { className: 'bg' }));
    const tint = el('div', 'tint'); scene.append(tint);
    const head = el('div', 'baby'); const face = img(A('baby_0')); head.append(face);
    scene.append(head); root.append(scene);
    Sound.preload(['puri', 'pu', 'ja', 'sukkiri']);
    const B = this.bowl;
    let poops = [], flushing = false, faceTimer, spark = null;
    const setFace = (n, ms) => { clearTimeout(faceTimer); face.src = A('baby_' + n); if (ms) faceTimer = setTimeout(() => { face.src = A('baby_0'); }, ms); };
    const setMood = (m, ms) => { scene.dataset.mood = m; if (ms) setTimeout(() => { if (scene.dataset.mood === m) scene.dataset.mood = ''; }, ms); };

    scene.addEventListener('pointerdown', (ev) => {
      if (flushing) return;
      const p = pct(ev, scene);
      spark && spark.remove(); spark = null;
      const inBowl = ((p.x - B.x) / (B.rx * 1.4)) ** 2 + ((p.y - B.y) / (B.ry * 1.6)) ** 2 <= 1;
      if (!inBowl) {
        if (Math.random() < 0.2) {             // たまに、おなら
          setFace(3, 1200); setMood('fart', 1000);
          const f = img(A('fart')); f.className = 'fart';
          f.style.left = rand(35, 65) + '%'; f.style.top = '40%';
          scene.append(f); setTimeout(() => f.remove(), 1400);
          Sound.play('fart'); Sound.voice('pu', 0.15);
          return;
        }
        setFace(1, 700);                        // ぷりっ
        const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * 0.85;
        const x = B.x + Math.cos(a) * B.rx * r, y = B.y + Math.sin(a) * B.ry * r;
        const d = el('div', 'poop'); d.append(img(A('poop_' + (1 + Math.floor(Math.random() * 3)))));
        Object.assign(d.style, { left: x + '%', top: y + '%' });
        d.animate([{ transform: 'translate(-50%,-50%) translateY(-120%) scale(.4)' }, { transform: 'translate(-50%,-50%) scale(1.1)', offset: .7 }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 380, easing: 'ease-out' });
        scene.insertBefore(d, head);
        poops.push(d);
        if (poops.length > 14) poops.shift().remove();
        Sound.play('plop'); Sound.voice('puri');
        return;
      }
      // 便器を触ると流す
      flushing = true;
      const sw = img(A('flush_swirl')); sw.className = 'swirl';
      Object.assign(sw.style, { left: B.x + '%', top: B.y + '%', width: B.rx * 2.2 + '%' });
      scene.insertBefore(sw, poops[0] || head);
      poops.forEach((d, i) => d.animate([{ transform: 'translate(-50%,-50%) rotate(0) scale(1)', left: d.style.left, top: d.style.top },
        { transform: 'translate(-50%,-50%) rotate(540deg) scale(0)', left: B.x + '%', top: B.y + '%' }], { duration: 1500 + i * 40, easing: 'ease-in', fill: 'forwards' }));
      setFace(2);
      Sound.play('flush'); Sound.voice('ja', 0.1);
      setTimeout(() => {
        poops.forEach(d => d.remove()); poops = []; sw.remove();
        setMood('clean', 2500); spark = sparkles(scene, 10);
        Sound.voice('sukkiri');
        setFace(2, 1800); flushing = false;
      }, 1900);
    });
    this.cleanup = () => clearTimeout(faceTimer);
  },
  unmount() { this.cleanup && this.cleanup(); },
};

ORDER.push('feed', 'paint', 'egg', 'phone', 'toilet');
