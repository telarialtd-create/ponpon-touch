// ぽんぽんタッチ：効果音とBGMをすべて Web Audio で合成する（外部の音源ファイルは使わない）
const Sound = (() => {
  let ctx = null, master = null, seBus = null, bgmBus = null;
  let bgmOn = true, seOn = true;
  let bgmTimer = null, bgmStep = 0, bgmNext = 0, bgmSong = null;
  let siren = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    seBus = ctx.createGain(); seBus.gain.value = 0.8; seBus.connect(master);
    bgmBus = ctx.createGain(); bgmBus.gain.value = 0.22; bgmBus.connect(master);
  }

  const now = () => ctx.currentTime;

  // 音を1つ鳴らす基本部品（周波数の変化と音量の包絡つき）
  function tone({ type = 'sine', f0, f1 = f0, t = 0, dur = 0.2, vol = 0.4, attack = 0.005, bus = seBus, curve = 'exp' }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    const s = now() + t;
    o.type = type;
    o.frequency.setValueAtTime(f0, s);
    if (f1 !== f0) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(f1, s + dur);
      else o.frequency.linearRampToValueAtTime(f1, s + dur);
    }
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(vol, s + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    o.connect(g); g.connect(bus);
    o.start(s); o.stop(s + dur + 0.05);
    return o;
  }

  function noise({ t = 0, dur = 0.2, vol = 0.3, freq = 1200, q = 1, freq1 = freq }) {
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    const s = now() + t;
    bp.frequency.setValueAtTime(freq, s);
    bp.frequency.exponentialRampToValueAtTime(freq1, s + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(vol, s + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    src.connect(bp); bp.connect(g); g.connect(seBus);
    src.start(s); src.stop(s + dur + 0.05);
  }

  // ---- 効果音 ----
  const se = {
    // 起動時：キラキラした4音のチャイム
    start() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        tone({ type: 'triangle', f0: f, t: i * 0.09, dur: 0.5, vol: 0.3 });
        tone({ type: 'sine', f0: f * 2, t: i * 0.09, dur: 0.3, vol: 0.08 });
      });
    },
    // ボタン：「ピコッ」
    tap() {
      tone({ type: 'sine', f0: 880, f1: 1500, dur: 0.09, vol: 0.35 });
      tone({ type: 'triangle', f0: 1760, t: 0.07, dur: 0.12, vol: 0.15 });
    },
    // 遊びの切り替え：上がっていくキラキラ
    change() {
      [659, 784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f0: f, t: i * 0.05, dur: 0.25, vol: 0.22 }));
      noise({ t: 0, dur: 0.35, vol: 0.06, freq: 4000, freq1: 9000, q: 2 });
    },
    // 車：「ブーン」
    vroom() {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      const lp = ctx.createBiquadFilter(), g = ctx.createGain();
      const s = now();
      o1.type = 'sawtooth'; o2.type = 'square';
      o1.frequency.setValueAtTime(70, s); o1.frequency.exponentialRampToValueAtTime(150, s + 0.9); o1.frequency.exponentialRampToValueAtTime(120, s + 1.6);
      o2.frequency.setValueAtTime(72, s); o2.frequency.exponentialRampToValueAtTime(152, s + 0.9); o2.frequency.exponentialRampToValueAtTime(121, s + 1.6);
      lp.type = 'lowpass'; lp.frequency.value = 700;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.25, s + 0.1);
      g.gain.setValueAtTime(0.25, s + 1.1);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 1.8);
      o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(seBus);
      o1.start(s); o2.start(s); o1.stop(s + 1.9); o2.stop(s + 1.9);
    },
    // 木の実が落ちる：「ヒュ〜…ポン」
    drop() {
      tone({ type: 'sine', f0: 1400, f1: 500, dur: 0.45, vol: 0.25 });
      tone({ type: 'sine', f0: 300, f1: 600, t: 0.5, dur: 0.12, vol: 0.4 });
      tone({ type: 'triangle', f0: 600, f1: 900, t: 0.62, dur: 0.1, vol: 0.15 });
    },
    // まるが出る：「ぽよん」（色ごとに高さを変える）
    pop(pitch = 1) {
      tone({ type: 'sine', f0: 300 * pitch, f1: 700 * pitch, dur: 0.12, vol: 0.4 });
      tone({ type: 'sine', f0: 700 * pitch, f1: 520 * pitch, t: 0.11, dur: 0.18, vol: 0.25 });
    },
    // まるが消える：「パッ」
    burst(pitch = 1) {
      noise({ dur: 0.12, vol: 0.25, freq: 2500, freq1: 5000, q: 1.5 });
      tone({ type: 'triangle', f0: 1200 * pitch, f1: 2000 * pitch, dur: 0.1, vol: 0.2 });
    },
    // 綿毛：「ふわ〜」
    fluff() {
      noise({ dur: 0.9, vol: 0.12, freq: 800, freq1: 3000, q: 3 });
      tone({ type: 'sine', f0: 600, f1: 1100, dur: 0.9, vol: 0.18, attack: 0.15 });
      tone({ type: 'sine', f0: 900, f1: 1650, t: 0.05, dur: 0.8, vol: 0.08, attack: 0.15 });
    },
    // 食べ物が出る：「ぽわん」
    appear() {
      tone({ type: 'sine', f0: 500, f1: 1000, dur: 0.18, vol: 0.3 });
      tone({ type: 'triangle', f0: 1000, f1: 1300, t: 0.12, dur: 0.2, vol: 0.15 });
    },
    // もぐもぐ：短い「ぽこぽこ」
    chew() {
      [0, 0.18, 0.36].forEach(t => tone({ type: 'sine', f0: 260, f1: 180, t, dur: 0.12, vol: 0.35 }));
    },
    // ぬりぬり：「べちゃっ」
    splat() {
      noise({ dur: 0.18, vol: 0.3, freq: 600, freq1: 250, q: 0.8 });
      tone({ type: 'sine', f0: 350, f1: 160, dur: 0.15, vol: 0.25 });
    },
    // できたね：ファンファーレ
    fanfare() {
      [[523, 0], [659, .12], [784, .24], [1047, .4]].forEach(([f, t]) => {
        tone({ type: 'triangle', f0: f, t, dur: t === .4 ? .7 : .2, vol: .28 });
        tone({ type: 'sine', f0: f * 2, t, dur: .25, vol: .06 });
      });
      noise({ t: .4, dur: .6, vol: .05, freq: 5000, freq1: 9000, q: 2 });
    },
    // たまご：「こん」
    knock() { tone({ type: 'sine', f0: 900, f1: 600, dur: 0.08, vol: 0.4 }); noise({ dur: 0.05, vol: 0.2, freq: 3000, q: 2 }); },
    // たまご：「かぱっ」
    crack() { noise({ dur: 0.12, vol: 0.3, freq: 2500, freq1: 1200, q: 1 }); tone({ type: 'sine', f0: 700, f1: 300, t: 0.08, dur: 0.15, vol: 0.2 }); },
    // 焼ける：「じゅ〜」
    sizzle() { noise({ dur: 1.6, vol: 0.18, freq: 5000, freq1: 3500, q: 0.6 }); },
    // でんわ：数字ボタン「ピッ」
    dial(i = 0) {
      const lo = [941, 697, 697, 697, 770, 770, 770, 852, 852, 852, 941, 941][i], hi = [1336, 1209, 1336, 1477, 1209, 1336, 1477, 1209, 1336, 1477, 1209, 1477][i];
      tone({ type: 'sine', f0: lo, dur: 0.15, vol: 0.2 }); tone({ type: 'sine', f0: hi, dur: 0.15, vol: 0.2 });
    },
    // でんわ：かけたとき「プルルル」
    ring() {
      for (let k = 0; k < 2; k++) for (let i = 0; i < 16; i++) {
        const t = k * 1.4 + i * 0.05;
        tone({ type: 'sine', f0: i % 2 ? 400 : 440, t, dur: 0.05, vol: 0.15 });
      }
    },
    // でんわ：切れたとき「ツー、ツー」
    hangup() { [0, 0.5, 1.0].forEach(t => tone({ type: 'sine', f0: 480, t, dur: 0.3, vol: 0.18, attack: 0.01 })); },
    // うんちが出る：「ぽとん」
    plop() { tone({ type: 'sine', f0: 600, f1: 200, dur: 0.15, vol: 0.35 }); tone({ type: 'sine', f0: 300, f1: 450, t: 0.15, dur: 0.1, vol: 0.2 }); },
    // おなら：「ぷぅ」
    fart() {
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(), s = now();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(110, s); o.frequency.linearRampToValueAtTime(70, s + 0.5);
      lp.type = 'lowpass'; lp.frequency.value = 500;
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.35, s + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.55);
      o.connect(lp); lp.connect(g); g.connect(seBus); o.start(s); o.stop(s + 0.6);
    },
    // トイレを流す：「ジャー」
    flush() { noise({ dur: 2.2, vol: 0.25, freq: 900, freq1: 300, q: 0.5 }); noise({ t: 0.2, dur: 1.8, vol: 0.12, freq: 3000, freq1: 1500, q: 1 }); },
  };

  // ---- 子どもの声（assets/voice/*.mp4（中身はAAC）を読み込んで鳴らす） ----
  const voiceBuf = {};
  function loadVoice(key) {
    if (!voiceBuf[key]) {
      voiceBuf[key] = fetch(`assets/voice/${key}.mp4`).then(r => r.arrayBuffer())
        .then(b => new Promise((ok, ng) => ctx.decodeAudioData(b, ok, ng))).catch(() => null);
    }
    return voiceBuf[key];
  }
  async function voice(key, delay = 0) {
    const buf = await loadVoice(key);
    if (!buf) return;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; g.gain.value = 1.2;
    src.connect(g); g.connect(seBus);
    src.start(now() + delay);
  }

  // ---- サイレン（止めるまで鳴り続ける） ----
  function sirenStart(kind) {
    sirenStop();
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = kind === 'ambulance' ? 'square' : 'sawtooth';
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    g.gain.value = 0.0001;
    o.connect(lp); lp.connect(g); g.connect(seBus);
    const s = now();
    g.gain.exponentialRampToValueAtTime(kind === 'ambulance' ? 0.09 : 0.11, s + 0.05);
    const f = o.frequency;
    f.setValueAtTime(kind === 'ambulance' ? 960 : 450, s);
    // 30秒ぶんの変化を先に予約し、それ以降はタイマーで継ぎ足す
    let t = s;
    const schedule = (until) => {
      while (t < until) {
        if (kind === 'ambulance') {        // ピーポー：960Hz と 770Hz を 0.65秒ずつ
          f.setValueAtTime(960, t); f.setValueAtTime(770, t + 0.65); t += 1.3;
        } else if (kind === 'police') {    // ウーウー：上がって下がる（速め）
          f.setValueAtTime(500, t); f.linearRampToValueAtTime(1150, t + 1.2); f.linearRampToValueAtTime(500, t + 2.4); t += 2.4;
        } else {                           // 消防車：ゆっくり上がって下がる＋鐘
          f.setValueAtTime(400, t); f.linearRampToValueAtTime(950, t + 2.0); f.linearRampToValueAtTime(400, t + 3.5);
          [0, 0.5, 1.0, 1.5].forEach(d => tone({ type: 'triangle', f0: 1700, t: t - now() + d, dur: 0.35, vol: 0.12 }));
          t += 3.5;
        }
      }
    };
    schedule(s + 8);
    const timer = setInterval(() => schedule(now() + 8), 4000);
    o.start(s);
    siren = { o, g, timer };
  }
  function sirenStop() {
    if (!siren) return;
    clearInterval(siren.timer);
    const s = now();
    siren.g.gain.cancelScheduledValues(s);
    siren.g.gain.setValueAtTime(siren.g.gain.value, s);
    siren.g.gain.exponentialRampToValueAtTime(0.0001, s + 0.15);
    siren.o.stop(s + 0.2);
    siren = null;
  }

  // ---- BGM（オリジナル曲・オルゴール風） ----
  // 音名→周波数。数字はオクターブ。'-' は休符。
  const N = n => {
    if (n === '-') return 0;
    const m = n.match(/^([A-G])(#?)(\d)$/);
    const idx = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
    return 440 * Math.pow(2, (idx - 9) / 12 + (+m[3] - 4));
  };
  const songs = {
    // のりもの：元気なマーチ
    vehicle: { bpm: 132, mel: 'C5 E5 G5 E5 F5 A5 G5 - E5 G5 C6 G5 A5 G5 E5 - F5 E5 D5 E5 F5 G5 A5 G5 E5 D5 C5 D5 E5 - C5 -'.split(' '),
               bass: 'C3 G3 F3 C3 C3 G3 F3 G3'.split(' ') },
    // 木の実：ゆったりワルツ風
    fruit: { bpm: 108, mel: 'G4 C5 E5 D5 C5 - A4 C5 F5 E5 D5 - G4 B4 D5 F5 E5 D5 C5 E5 G5 - E5 - F5 E5 D5 C5 D5 - C5 - - -'.split(' '),
             bass: 'C3 F3 G3 C3 F3 G3 C3 C3'.split(' ') },
    // まる：はずむポップ
    ball: { bpm: 144, mel: 'E5 - E5 G5 A5 - G5 E5 D5 - D5 E5 G5 - - - C5 - C5 D5 E5 G5 E5 D5 C5 D5 E5 - D5 - - -'.split(' '),
            bass: 'A2 D3 G2 C3 A2 D3 G2 C3'.split(' ') },
    // たんぽぽ：ふんわり子守唄
    dandelion: { bpm: 92, mel: 'E5 - G5 - A5 G5 E5 - D5 - E5 - G5 - - - E5 - G5 - C6 B5 A5 - G5 - E5 - D5 - - -'.split(' '),
                 bass: 'C3 A2 F2 G2 C3 A2 F2 G2'.split(' ') },
    // あーん：ころころしたスキップ
    feed: { bpm: 126, mel: 'G5 E5 G5 E5 F5 D5 F5 D5 E5 C5 E5 G5 C6 - - - A5 F5 A5 F5 G5 E5 G5 E5 F5 D5 B4 D5 C5 - - -'.split(' '),
            bass: 'C3 G2 C3 F2 F2 C3 G2 C3'.split(' ') },
    // ぬりぬり：のんびりお散歩
    paint: { bpm: 112, mel: 'C5 D5 E5 - G5 - E5 - A5 G5 E5 - D5 - - - C5 D5 E5 - G5 - A5 - G5 E5 D5 - C5 - - -'.split(' '),
             bass: 'C3 A2 F2 G2 C3 A2 G2 C3'.split(' ') },
    // めだまやき：はずむ台所の歌
    egg: { bpm: 138, mel: 'D5 F#5 A5 F#5 B5 A5 F#5 - E5 G5 B5 G5 A5 - - - D5 F#5 A5 B5 A5 F#5 E5 - F#5 E5 C#5 E5 D5 - - -'.split(' '),
           bass: 'D3 G2 A2 D3 D3 G2 A2 D3'.split(' ') },
    // でんわ：ちょこちょこ歩く
    phone: { bpm: 150, mel: 'C5 - C5 E5 G5 - E5 - F5 - F5 A5 G5 - - - E5 - E5 G5 C6 - A5 - G5 F5 E5 D5 C5 - - -'.split(' '),
             bass: 'C3 F2 C3 G2 C3 F2 G2 C3'.split(' ') },
    // トイレ：とぼけたおどり
    toilet: { bpm: 120, mel: 'A4 - C5 - E5 D5 C5 - B4 - D5 - F5 E5 D5 - C5 E5 A5 - G5 F5 E5 - D5 - B4 - A4 - - -'.split(' '),
              bass: 'A2 E2 A2 D3 A2 E2 E2 A2'.split(' ') },
  };

  function bell(f, t, dur, vol) {
    if (!f) return;
    tone({ type: 'sine', f0: f, t, dur, vol, bus: bgmBus, attack: 0.003 });
    tone({ type: 'sine', f0: f * 2.01, t, dur: dur * 0.5, vol: vol * 0.25, bus: bgmBus, attack: 0.003 });
  }

  function bgmTick() {
    const song = songs[bgmSong];
    const step = 60 / song.bpm / 2; // 8分音符
    while (bgmNext < now() + 0.3) {
      const t = bgmNext - now();
      const i = bgmStep % song.mel.length;
      bell(N(song.mel[i]), t, step * 3, 0.35);
      if (i % 4 === 0) {
        const b = song.bass[(i / 4) % song.bass.length];
        tone({ type: 'triangle', f0: N(b), t, dur: step * 3.5, vol: 0.3, bus: bgmBus, attack: 0.01 });
      }
      bgmStep++; bgmNext += step;
    }
  }

  // bgmSong＝今の遊びの曲（BGMオフでも覚えておき、オンに戻したら流す）
  function bgmStart() {
    clearInterval(bgmTimer); bgmTimer = null;
    if (!ctx || !bgmOn || !bgmSong) return;
    bgmStep = 0; bgmNext = now() + 0.3;
    bgmTimer = setInterval(bgmTick, 80);
  }
  function bgmPlay(name) {
    if (bgmSong === name && bgmTimer) return;
    bgmSong = name;
    bgmStart();
  }
  function bgmStop() { clearInterval(bgmTimer); bgmTimer = null; bgmSong = null; }

  return {
    init,
    play(name, ...a) { if (ctx && seOn && se[name]) se[name](...a); },
    voice(key, delay) { if (ctx && seOn) voice(key, delay); },
    preload(keys) { if (ctx) keys.forEach(loadVoice); },
    sirenStart(kind) { if (ctx && seOn) sirenStart(kind); },
    sirenStop() { if (ctx) sirenStop(); },
    sirenActive: () => !!siren,
    bgmPlay, bgmStop,
    setBgm(on) { bgmOn = on; bgmStart(); },
    setSe(on) { seOn = on; if (!on) sirenStop(); },
    get bgmOn() { return bgmOn; }, get seOn() { return seOn; },
  };
})();
