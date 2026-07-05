// ── 极简响应式 Store（pub/sub） ──
const state = Object.create(null);
const subs = new Set();

export const store = {
  get(key) { return state[key]; },
  set(key, value) {
    const prev = state[key];
    if (prev === value) return;
    state[key] = value;
    subs.forEach((fn) => fn(key, value, prev));
  },
  /** 批量设置（一次性广播，避免 N 次冗余渲染） */
  patch(obj) {
    const changed = [];
    for (const k in obj) {
      if (state[k] !== obj[k]) {
        const prev = state[k];
        state[k] = obj[k];
        changed.push(k);
        // 异步通知（保留 prev 语义，与 set() 一致）
        subs.forEach(fn => fn(k, obj[k], prev));
      }
    }
  },
  subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};
