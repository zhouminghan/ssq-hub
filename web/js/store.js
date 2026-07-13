// ── 响应式 Store（pub/sub with key namespacing） ──
const state = Object.create(null);
const subs = new Map(); // key → Set<fn>，'*' → 全局订阅

export const store = {
  get(key) {
    return state[key];
  },

  set(key, value) {
    const prev = state[key];
    if (prev === value) return;
    state[key] = value;

    // 通知按 key 订阅的监听者
    const bucket = subs.get(key);
    if (bucket) bucket.forEach((fn) => fn(value, prev));

    // 通知全局订阅者（兼容旧调用）
    const global = subs.get('*');
    if (global) global.forEach((fn) => fn(key, value, prev));
  },

  /**
   * subscribe(key, fn) — 只订阅指定 key 的变更
   * subscribe(fn)         — 订阅所有 key 变更（向后兼容）
   */
  subscribe(key, fn) {
    if (typeof key === 'function') {
      fn = key;
      key = '*';
    }
    if (!subs.has(key)) subs.set(key, new Set());
    subs.get(key).add(fn);
    return () => subs.get(key).delete(fn);
  },
};
