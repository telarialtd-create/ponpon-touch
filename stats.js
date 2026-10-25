// ぽんぽんタッチ：計測（どの遊びを何秒遊んだかを KIRAKU に送る）
// 個人情報は送らない。端末ごとのランダム番号だけを持たせる。手元（localhost 等）では送らない。
const Stats = {
  url: 'https://kiraku.telaria.tech/ponpon/e',
  on: location.protocol === 'https:' && !/^(localhost|127\.|192\.168\.)/.test(location.hostname),
  id: null,
  game: null,   // 今遊んでいる遊び
  since: 0,     // その遊びを始めた時刻（画面が隠れている間は数えない）
  paused: null, // 画面が隠れたときに遊んでいた遊び

  init() {
    let isNew = 0;
    try {
      this.id = localStorage.getItem('ponpon.sid');
      if (!this.id) {
        this.id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        localStorage.setItem('ponpon.sid', this.id);
        isNew = 1;
      }
    } catch {
      this.id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    }
    this.send({ t: 'open', n: isNew });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.paused = this.game; this.stop(); }
      else if (this.paused) { this.start(this.paused); this.paused = null; }
    });
    window.addEventListener('pagehide', () => this.stop());
  },

  start(game) {
    this.stop();
    this.game = game; this.since = Date.now();
  },

  stop() {
    if (!this.game) return;
    const s = Math.round((Date.now() - this.since) / 1000);
    if (s >= 1) this.send({ t: 'play', g: this.game, s });
    this.game = null;
  },

  send(e) {
    if (!this.on || !this.id) return;
    const body = JSON.stringify({ ...e, d: this.id });
    try {
      // text/plain にすると事前確認の通信が要らず、閉じる直前でも届きやすい
      if (navigator.sendBeacon && navigator.sendBeacon(this.url, new Blob([body], { type: 'text/plain' }))) return;
      fetch(this.url, { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(() => {});
    } catch {}
  },
};
Stats.init();
