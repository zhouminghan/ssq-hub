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

  subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};
