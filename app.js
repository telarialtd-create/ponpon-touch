// ぽんぽんタッチ：画面の切り替えと4つの遊び
const $ = s => document.querySelector(s);
const A = name => `assets/${name}.png`;
const J = name => `assets/${name}.jpg`;
const rand = (a, b) => a + Math.random() * (b - a);

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
function img(src) { const i = new Image(); i.src = src; i.alt = ''; return i; }

// 押したときの座標をステージに対する % にする
function pct(ev, box) {
  const r = box.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / r.width * 100, y: (ev.clientY - r.top) / r.height * 100 };
}

// 端末に覚えさせる設定（読めない環境でも動くように try で包む）
const store = {
  get(k, d) { try { const v = localStorage.getItem('ponpon.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ponpon.' + k, JSON.stringify(v)); } catch {} },
};

// ================= 遊び =================
const SCENES = {};

// ---- のりもの ----
SCENES.vehicle = {
  thumb: A('thumb_vehicle'),
  mount(root) {
    const cars = ['ambulance', 'fire', 'police'];
    let idx = 0, x = 10, speed = 10, fastUntil = 0, leaving = false, raf;
    const scene = el('div', 'scene vehicle');
    const top = el('div', 'top'); top.append(Object.assign(img(J('bg_town')), { className: 'bg' }));
    const car = el('div', 'car bob'); const carImg = img(A('car_' + cars[0])); car.append(carImg);
    top.append(car);
    const bottom = el('div', 'bottom');
    const bSiren = el('button', 'ctrl'); bSiren.append(img(A('btn_sound')));
    const bSwap = el('button', 'ctrl'); bSwap.append(img(A('btn_swap')));
    bottom.append(bSiren, bSwap);
    scene.append(top, bottom);
    root.append(scene);

    car.style.pointerEvents = 'auto';
    car.addEventListener('pointerdown', () => {
      Sound.play('vroom');
      fastUntil = performance.now() + 5000;
    });
    bSiren.addEventListener('pointerdown', () => {
      if (Sound.sirenActive()) { Sound.sirenStop(); bSiren.classList.remove('on'); }
      else { Sound.sirenStart(cars[idx]); bSiren.classList.add('on'); }
    });
    bSwap.addEventListener('pointerdown', () => {
      Sound.play('tap');
      leaving = true;
    });

    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const fast = t < fastUntil;
      car.classList.toggle('fast', fast);
      const target = leaving ? 90 : fast ? 45 : 10;   // 画面幅の何%を1秒で進むか
      speed += (target - speed) * Math.min(1, dt * 3);
      x += speed * dt;
      if (x > 100) {
        x = -62;
        if (leaving) {
          leaving = false; speed = 30;
          idx = (idx + 1) % cars.length;
          carImg.src = A('car_' + cars[idx]);
          if (Sound.sirenActive()) Sound.sirenStart(cars[idx]);
        }
      }
      car.style.transform = `translateX(${x / 62 * 100}%)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    this.cleanup = () => { cancelAnimationFrame(raf); Sound.sirenStop(); };
  },
  unmount() { this.cleanup && this.cleanup(); },
};

// ---- 木の実 ----
SCENES.fruit = {
  thumb: A('thumb_fruit'),
  // 木の葉っぱの中で実を置く位置（画面に対する%）
  spots: [[50, 26], [29, 34], [71, 34], [50, 43], [27, 51], [73, 51]],
  kinds: ['apple', 'grape', 'orange'],
  mount(root) {
    const scene = el('div', 'scene');
    scene.append(Object.assign(img(J('bg_tree')), { className: 'bg' }));
    root.append(scene);
    let kind = 0, timers = [];

    const grow = () => {
      let left = this.spots.length;
      this.spots.forEach(([x, y], i) => {
        const f = el('div', 'fruit-item sway');
        const fi = img(A('fruit_' + this.kinds[kind])); f.append(fi);
        Object.assign(f.style, { left: x + '%', top: y + '%', pointerEvents: 'auto' });
        f.animate([{ transform: 'translate(-50%,-50%) scale(0)' }, { transform: 'translate(-50%,-50%) scale(1)' }],
          { duration: 400, delay: i * 70, easing: 'cubic-bezier(.3,1.6,.5,1)', fill: 'backwards' });
        f.addEventListener('pointerdown', () => {
          if (f.dataset.done) return;
          f.dataset.done = 1;
          f.classList.remove('sway');
          fi.src = A('fruit_' + this.kinds[kind] + '_wow');
          Sound.play('drop');
          // 地面へ落ちて、少し跳ねる
          const gx = rand(14, 86), gy = rand(84, 90);
          f.animate([
            { left: x + '%', top: y + '%' },
            { left: gx + '%', top: gy + '%', offset: .75, easing: 'ease-out' },
            { left: gx + '%', top: (gy - 4) + '%', offset: .87, easing: 'ease-in' },
            { left: gx + '%', top: gy + '%' },
          ], { duration: 800, easing: 'ease-in', fill: 'forwards' });
          timers.push(setTimeout(() => { fi.src = A('fruit_' + this.kinds[kind]); }, 900));
          if (--left === 0) {
            timers.push(setTimeout(() => {
              Sound.play('change');
              scene.querySelectorAll('.fruit-item').forEach(n => {
                n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
                setTimeout(() => n.remove(), 420);
              });
              kind = (kind + 1) % this.kinds.length;
              timers.push(setTimeout(grow, 500));
            }, 1300));
          }
        });
        scene.append(f);
      });
    };
    grow();
    this.cleanup = () => timers.forEach(clearTimeout);
  },
  unmount() { this.cleanup && this.cleanup(); },
};

// ---- まる ----
SCENES.ball = {
  thumb: A('thumb_ball'),
  colors: [['red', 1], ['blue', 1.12], ['green', 1.26], ['purple', 1.33], ['orange', 1.5]],
  mount(root) {
    const scene = el('div', 'scene ball-scene');
    root.append(scene);
    const balls = [];
    let raf;

    scene.addEventListener('pointerdown', (ev) => {
      const hit = ev.target.closest('.ball');
      if (hit) {
        const b = balls.find(b => b.el === hit);
        if (!b || b.gone) return;
        b.gone = true;
        Sound.play('burst', b.pitch);
        hit.classList.add('out');
        setTimeout(() => hit.remove(), 260);
        balls.splice(balls.indexOf(b), 1);
        return;
      }
      const p = pct(ev, scene);
      if (p.y < 8) return; // 上のボタン付近は無視
      const [c, pitch] = this.colors[Math.floor(Math.random() * this.colors.length)];
      const e = el('div', 'ball'); e.append(img(A('ball_' + c)));
      e.style.left = p.x + '%'; e.style.top = p.y + '%';
      e.style.pointerEvents = 'auto';
      scene.append(e);
      requestAnimationFrame(() => e.classList.add('in'));
      Sound.play('pop', pitch);
      balls.push({ el: e, x: p.x, y: p.y, vx: rand(-4, 4), vy: rand(-4, 4), pitch });
      if (balls.length > 24) { const o = balls.shift(); o.el.classList.add('out'); setTimeout(() => o.el.remove(), 260); }
    });

    // ふわふわ漂わせる
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      balls.forEach(b => {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < 8 || b.x > 92) b.vx *= -1;
        if (b.y < 12 || b.y > 94) b.vy *= -1;
        b.el.style.left = b.x + '%'; b.el.style.top = b.y + '%';
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    this.cleanup = () => cancelAnimationFrame(raf);
  },
  unmount() { this.cleanup && this.cleanup(); },
};

// ---- たんぽぽ ----
SCENES.dandelion = {
  thumb: A('thumb_dandelion'),
  head: { x: 51, y: 32, r: 32 }, // 綿毛の玉の位置と大きさ（%）
  mount(root) {
    const scene = el('div', 'scene');
    scene.append(Object.assign(img(J('bg_dandelion')), { className: 'bg' }));
    root.append(scene);
    let last = 0;
    scene.addEventListener('pointerdown', (ev) => {
      const p = pct(ev, scene), h = this.head;
      const r = scene.getBoundingClientRect();
      const dx = (p.x - h.x) * r.width / 100, dy = (p.y - h.y) * r.height / 100;
      if (Math.hypot(dx, dy) > h.r * r.width / 100) return;
      const now = performance.now();
      if (now - last > 250) Sound.play('fluff');
      last = now;
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const s = el('div', 'seed'); s.append(img(A('seed')));
        const sx = p.x + rand(-8, 8), sy = p.y + rand(-6, 6);
        s.style.left = sx + '%'; s.style.top = sy + '%';
        scene.append(s);
        const ex = sx + rand(-40, 40), dur = rand(2600, 4200);
        s.animate([
          { left: sx + '%', top: sy + '%', transform: 'translate(-50%,-50%) scale(.3) rotate(0deg)' },
          { transform: 'translate(-50%,-50%) scale(1) rotate(-12deg)', offset: .2 },
          { transform: 'translate(-50%,-50%) scale(1) rotate(12deg)', offset: .6 },
          { left: ex + '%', top: '-15%', transform: 'translate(-50%,-50%) scale(.9) rotate(-8deg)' },
        ], { duration: dur, easing: 'ease-out', fill: 'forwards' });
        setTimeout(() => s.remove(), dur + 50);
      }
      const f = el('div', 'fuwa', 'ふわ');
      f.style.left = (p.x + rand(5, 15)) + '%'; f.style.top = p.y + '%';
      scene.append(f); setTimeout(() => f.remove(), 1700);
    });
  },
  unmount() {},
};

// ================= 画面の切り替え =================
const ORDER = ['vehicle', 'fruit', 'ball', 'dandelion'];
let current = null;
let favs = store.get('favs', []);

function show(name) {
  if (current) SCENES[current].unmount();
  const stage = $('#stage'); stage.innerHTML = '';
  current = name;
  SCENES[name].mount(stage);
  Sound.bgmPlay(name);
  $('#btn-fav').classList.toggle('on', favs.includes(name));
  $('#btn-fav').textContent = favs.includes(name) ? '♥' : '♡';
  store.set('last', name);
}

let started = false;
$('#title').addEventListener('pointerdown', () => {
  Sound.init();
  if (!started) { started = true; Sound.play('start'); }
}, true);
$('#btn-play').addEventListener('click', () => {
  Sound.play('tap');
  $('#title').classList.add('hidden'); $('#play').classList.remove('hidden');
  show(store.get('last', 'vehicle'));
});
$('#play').addEventListener('pointerdown', () => Sound.init(), true);

$('#btn-home').addEventListener('click', () => {
  Sound.play('tap');
  if (current) SCENES[current].unmount();
  current = null; Sound.bgmStop();
  $('#play').classList.add('hidden'); $('#title').classList.remove('hidden');
});
$('#btn-change').addEventListener('click', () => {
  const others = ORDER.filter(n => n !== current);
  Sound.play('change');
  show(others[Math.floor(Math.random() * others.length)]);
});
$('#btn-pick').addEventListener('click', () => {
  Sound.play('tap');
  const grid = $('#picker-grid'); grid.innerHTML = '';
  ORDER.forEach(n => {
    const b = el('button', favs.includes(n) ? 'fav' : ''); b.append(img(SCENES[n].thumb));
    b.addEventListener('click', () => { Sound.play('tap'); $('#picker').classList.add('hidden'); show(n); });
    grid.append(b);
  });
  $('#picker').classList.remove('hidden');
});
$('#btn-fav').addEventListener('click', () => {
  Sound.play('tap');
  favs = favs.includes(current) ? favs.filter(n => n !== current) : [...favs, current];
  store.set('favs', favs);
  $('#btn-fav').classList.toggle('on', favs.includes(current));
  $('#btn-fav').textContent = favs.includes(current) ? '♥' : '♡';
});
$('#btn-settings').addEventListener('click', () => { Sound.play('tap'); $('#settings').classList.remove('hidden'); });
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => {
  Sound.play('tap'); b.closest('.modal').classList.add('hidden');
}));
$('#opt-bgm').checked = store.get('bgm', true); Sound.setBgm($('#opt-bgm').checked);
$('#opt-se').checked = store.get('se', true); Sound.setSe($('#opt-se').checked);
$('#opt-bgm').addEventListener('change', e => { Sound.setBgm(e.target.checked); store.set('bgm', e.target.checked); });
$('#opt-se').addEventListener('change', e => { Sound.setSe(e.target.checked); store.set('se', e.target.checked); });

// 画面を長押し・ダブルタップで拡大させない
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
