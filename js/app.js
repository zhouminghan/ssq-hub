const { createApp, ref, computed, onMounted, watch, nextTick } = Vue;

createApp({
  setup() {
    // === 数据 ===
    const historyIndex = ref({ total: 0, years: [] });
    const historyDraws = ref([]);
    const statsData = ref({});
    const latestData = ref({});
    const yearLoading = ref(false);
    const yearCache = {};

    // === Tab — 三大板块 ===
    const tabs = [
      { id: 'picks', name: '推荐选号', icon: '🎯' },
      { id: 'history', name: '历史查询', icon: '📊' },
      { id: 'stats', name: '统计分析', icon: '📈' },
    ];
    const activeTab = ref('picks');

    // === 推荐选号模式 ===
    const pickMode = ref('system');   // system | diy | random

    // === 方法论（大神科普版 — 融入统计分析 Tab） ===
    const methods = [
      {
        icon: '📊', name: '频率追踪法', source: '概率统计',
        desc: '统计每个号码在全部历史、近50期、近10期的出现频率。短期高频号称为"热号"，连续活跃说明它处于热态周期中。',
        detail: '关注近10期频率 ≥ 30% 的号码（热号池）。大神常以"追热不追冷"为第一原则，热号延续性往往比冷号回补更稳。',
        tags: ['全局频率', '近50期', '近10期', '热号追踪'],
      },
      {
        icon: '❄️', name: '遗漏回补理论', source: '大数定律',
        desc: '当一个历史高频号长期未出现（遗漏值高），根据大数定律，其出现概率会向均值回归。但要注意遗漏期数要足够长（>15期）才有参考价值。',
        detail: '选遗漏 > 15 期且全局频率 > 均值的号码。配合热号使用效果更佳：4冷+2热 是经典组合。',
        tags: ['遗漏期数', '大数定律', '冷热搭配'],
      },
      {
        icon: '🎯', name: '三区均衡法', source: '区间分布',
        desc: '将33个红球分为三区（1-11/12-22/23-33），历史数据显示三区出球长期趋于均衡（各约33%）。单期偏差正常，但选号时三区都覆盖可降低踏空风险。',
        detail: '推荐 2-2-2 或 2-3-1 分布，避免全部集中在一个区间。这是很多资深彩民选号的基础框架。',
        tags: ['区间均衡', '2-2-2分布', '覆盖防踏空'],
      },
      {
        icon: '⚖️', name: '奇偶大小比', source: '结构分析',
        desc: '统计近期奇偶比和大小比。历史数据显示奇偶长期接近50:50，常见比例为 3:3 和 4:2。过于极端的奇偶比（如 6:0）极少出现。',
        detail: '选号时保持 3奇3偶 或 4奇2偶，同时关注大小比（以17为分界）也保持均衡。',
        tags: ['奇偶比', '大小比', '3:3黄金比'],
      },
      {
        icon: '🧮', name: '综合评分模型', source: '加权算法',
        desc: '本站特有的加权评分体系：全局频率(15%) + 近50期(30%) + 近10期(30%) + 冷号回补奖励(25%)。四维度综合评估每个号码的投注价值。',
        detail: '评分 Top15 进入候选池，再通过三区均衡筛选出最终推荐。评分每期动态更新，反映最新走势。',
        tags: ['四维评分', '动态更新', 'Top15候选'],
      },
      {
        icon: '🎰', name: '复式覆盖策略', source: '组合数学',
        desc: '通过多选红球/蓝球组成复式，用组合数学原理覆盖更多可能。7+2=14注/28元是入门推荐，10+3=630注适合合买。',
        detail: '小复式（7+2）性价比最高，增加1个红球可多覆盖整整一倍组合。蓝球多选2-3个即可大幅提升蓝球命中率。',
        tags: ['组合数学', '7+2入门', '性价比'],
      },
    ];

    // === 历史查询 ===
    const searchQuery = ref('');
    const filterYear = ref('');
    const page = ref(1);
    const pageSize = 30;

    const availableYears = computed(() => {
      return historyIndex.value.years.map(y => y.year).sort().reverse();
    });

    async function loadYearData(year) {
      if (yearCache[year]) return yearCache[year];
      try {
        const res = await fetch(`data/history/${year}.json`);
        const data = await res.json();
        yearCache[year] = data;
        return data;
      } catch (e) {
        console.error(`加载 ${year} 年数据失败:`, e);
        return [];
      }
    }

    async function onYearChange(year) {
      filterYear.value = year;
      page.value = 1;
      yearLoading.value = true;
      const y = year || new Date().getFullYear().toString();
      historyDraws.value = await loadYearData(y);
      yearLoading.value = false;
    }

    const filteredDraws = computed(() => {
      let draws = [...historyDraws.value].reverse();
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.trim();
        draws = draws.filter(d => {
          if (d.issue.includes(q)) return true;
          if (d.date.includes(q)) return true;
          const nums = q.split(/[\s,，]+/).map(Number).filter(n => n > 0);
          if (nums.length > 0) return nums.every(n => d.red.includes(n) || d.blue === n);
          return false;
        });
      }
      return draws;
    });

    const totalPages = computed(() => Math.ceil(filteredDraws.value.length / pageSize));
    const paginatedDraws = computed(() => {
      const start = (page.value - 1) * pageSize;
      return filteredDraws.value.slice(start, start + pageSize);
    });

    function doSearch() { page.value = 1; }

    // === 加权随机核心 ===
    function weightedRandomPick(candidates, count) {
      const picked = [];
      const pool = [...candidates];
      for (let i = 0; i < count && pool.length > 0; i++) {
        const minScore = Math.min(...pool.map(c => c.score));
        const adjusted = pool.map(c => ({ ...c, w: c.score - minScore + 0.5 }));
        const totalW = adjusted.reduce((s, c) => s + c.w, 0);
        let rand = Math.random() * totalW;
        let chosen = adjusted[adjusted.length - 1];
        for (const c of adjusted) {
          rand -= c.w;
          if (rand <= 0) { chosen = c; break; }
        }
        picked.push(chosen);
        pool.splice(pool.findIndex(c => c.ball === chosen.ball), 1);
      }
      return picked;
    }

    function comb(n, k) {
      if (k > n) return 0;
      if (k === 0 || k === n) return 1;
      let r = 1;
      for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
      return Math.round(r);
    }

    // === 评分计算 ===
    function calcRedScores() {
      if (!statsData.value.red_freq_global) return [];
      const total = statsData.value.total || 1;
      const w = {};
      weights.value.forEach(item => { w[item.key] = item.value / 100; });
      const scored = [];
      for (let ball = 1; ball <= 33; ball++) {
        const bk = String(ball).padStart(2, '0');
        const gf = (statsData.value.red_freq_global[bk] || 0) / total * 100;
        const f50 = (statsData.value.red_freq_50[bk] || 0) / 50 * 100;
        const f10 = (statsData.value.red_freq_10[bk] || 0) / 10 * 100;
        let coldBonus = 0;
        if (gf > 18 && f50 < 14) coldBonus = (gf - f50) * 1.5;
        scored.push({ ball, score: gf * w.global + f50 * w.f50 + f10 * w.f10 + coldBonus * w.cold });
      }
      return scored;
    }

    function calcBlueScores() {
      if (!statsData.value.blue_freq_global) return [];
      const total = statsData.value.total || 1;
      const w = {};
      weights.value.forEach(item => { w[item.key] = item.value / 100; });
      const scored = [];
      for (let ball = 1; ball <= 16; ball++) {
        const bk = String(ball).padStart(2, '0');
        scored.push({ ball, score:
          (statsData.value.blue_freq_global[bk] || 0) / total * 100 * w.global +
          (statsData.value.blue_freq_50[bk] || 0) / 50 * 100 * w.f50 +
          (statsData.value.blue_freq_10[bk] || 0) / 10 * 100 * w.f10
        });
      }
      return scored;
    }

    // === 自定义选号 ===
    const weights = ref([
      { label: '全局频率', value: 15, key: 'global' },
      { label: '近50期频率', value: 30, key: 'f50' },
      { label: '近10期频率', value: 30, key: 'f10' },
      { label: '冷号回补', value: 25, key: 'cold' },
    ]);

    const complexOpts = ref({ redCount: 8, blueCount: 2 });
    const diyResults = ref([]);

    function generateDiySingle() {
      const redScored = calcRedScores();
      const blueScored = calcBlueScores();
      if (redScored.length === 0) return null;
      const z1 = redScored.filter(b => b.ball <= 11);
      const z2 = redScored.filter(b => b.ball >= 12 && b.ball <= 22);
      const z3 = redScored.filter(b => b.ball >= 23);
      let pick = [
        ...weightedRandomPick(z1, 2),
        ...weightedRandomPick(z2, 2),
        ...weightedRandomPick(z3, 2),
      ].map(b => b.ball);
      if (pick.length < 6) {
        const rest = redScored.filter(s => !pick.includes(s.ball));
        pick.push(...weightedRandomPick(rest, 6 - pick.length).map(b => b.ball));
      }
      pick = pick.slice(0, 6).sort((a, b) => a - b);
      const blue = weightedRandomPick(blueScored, 1)[0]?.ball || 1;
      return { name: '🎯 权重均衡', type: 'single', red: pick, blue, method: '自定义权重 · 三区均衡', cost: 2 };
    }

    function generateDiyComplex() {
      const redScored = calcRedScores();
      const blueScored = calcBlueScores();
      if (redScored.length === 0) return null;
      const reds = weightedRandomPick(redScored, complexOpts.value.redCount).map(b => b.ball).sort((a, b) => a - b);
      const blues = weightedRandomPick(blueScored, complexOpts.value.blueCount).map(b => b.ball).sort((a, b) => a - b);
      const nc = comb(reds.length, 6) * blues.length;
      return { name: '🎰 权重复式', type: 'complex', red: reds, blue: blues, method: '自定义权重 · ' + reds.length + '+' + blues.length, cost: nc * 2, note_count: nc };
    }

    function generateAllDiy() {
      const results = [];
      for (let i = 0; i < 3; i++) {
        const s = generateDiySingle();
        if (s) {
          s.name = ['🎯 权重均衡 A', '🔥 权重均衡 B', '⚡ 权重均衡 C'][i];
          results.push(s);
        }
      }
      const c = generateDiyComplex();
      if (c) results.push(c);
      diyResults.value = results;
    }

    function refreshOneDiy(idx) {
      const plan = diyResults.value[idx];
      if (!plan) return;
      let newPlan;
      if (plan.type === 'single') {
        newPlan = generateDiySingle();
        if (newPlan) newPlan.name = plan.name;
      } else {
        newPlan = generateDiyComplex();
        if (newPlan) newPlan.name = plan.name;
      }
      if (newPlan) diyResults.value[idx] = newPlan;
    }

    // === 随机摇号 ===
    const randOpts = ref({ balanceZone: true, balanceOddEven: false, redCount: 8, blueCount: 2 });
    const randomResults = ref([]);
    const isShaking = ref(false);

    function generateRandomSingle() {
      let reds = [];
      const pool = Array.from({ length: 33 }, (_, i) => i + 1);
      const pick = arr => arr[Math.floor(Math.random() * arr.length)];

      if (randOpts.value.balanceZone) {
        reds.push(pick(pool.filter(n => n <= 11)));
        reds.push(pick(pool.filter(n => n >= 12 && n <= 22)));
        reds.push(pick(pool.filter(n => n >= 23)));
        while (reds.length < 6) reds.push(pick(pool.filter(x => !reds.includes(x))));
      } else {
        while (reds.length < 6) reds.push(pick(pool.filter(x => !reds.includes(x))));
      }

      if (randOpts.value.balanceOddEven) {
        let tries = 0;
        while (tries < 100) {
          const odd = reds.filter(n => n % 2 === 1).length;
          if (odd === 3) break;
          reds = [];
          const r = [...pool];
          while (reds.length < 6) { const i = Math.floor(Math.random() * r.length); reds.push(r[i]); r.splice(i, 1); }
          tries++;
        }
      }
      reds.sort((a, b) => a - b);
      const blue = Math.floor(Math.random() * 16) + 1;
      const method = '纯随机' + (randOpts.value.balanceZone ? ' · 区间均衡' : '') + (randOpts.value.balanceOddEven ? ' · 奇偶均衡' : '');
      return { name: '🎲 随机单式', type: 'single', red: reds, blue, method, cost: 2 };
    }

    function generateRandomComplex() {
      const redCount = randOpts.value.redCount;
      const blueCount = randOpts.value.blueCount;
      const pool = Array.from({ length: 33 }, (_, i) => i + 1);
      const pick = arr => arr[Math.floor(Math.random() * arr.length)];

      let reds = [];
      while (reds.length < redCount) reds.push(pick(pool.filter(x => !reds.includes(x))));
      reds.sort((a, b) => a - b);

      let blues = [];
      const bp = Array.from({ length: 16 }, (_, i) => i + 1);
      while (blues.length < blueCount) blues.push(pick(bp.filter(x => !blues.includes(x))));
      blues.sort((a, b) => a - b);

      const nc = comb(redCount, 6) * blueCount;
      const method = '纯随机' + (randOpts.value.balanceZone ? ' · 区间均衡' : '') + (randOpts.value.balanceOddEven ? ' · 奇偶均衡' : '');
      return { name: '🎰 随机复式', type: 'complex', red: reds, blue: blues, method, cost: nc * 2, note_count: nc };
    }

    function generateAllRandom() {
      isShaking.value = true;
      setTimeout(() => { isShaking.value = false; }, 600);
      const results = [];
      for (let i = 0; i < 3; i++) {
        const s = generateRandomSingle();
        s.name = ['🎲 随机 A', '🎲 随机 B', '🎲 随机 C'][i];
        results.push(s);
      }
      const c = generateRandomComplex();
      results.push(c);
      randomResults.value = results;
    }

    function refreshOneRandom(idx) {
      isShaking.value = true;
      setTimeout(() => { isShaking.value = false; }, 600);
      const plan = randomResults.value[idx];
      if (!plan) return;
      let newPlan;
      if (plan.type === 'single') {
        newPlan = generateRandomSingle();
        newPlan.name = plan.name;
      } else {
        newPlan = generateRandomComplex();
        newPlan.name = plan.name;
      }
      randomResults.value[idx] = newPlan;
    }

    // === 系统推荐 — 换一批 & 单个刷新 ===
    const plansRefreshing = ref(false);

    function regenerateAll() {
      plansRefreshing.value = true;
      setTimeout(() => { plansRefreshing.value = false; }, 400);
      refreshAllPlans();
    }

    function refreshOnePlan(type, idx) {
      if (!statsData.value.red_scores || !statsData.value.blue_scores) return;
      const rs = statsData.value.red_scores;
      const bs = statsData.value.blue_scores;

      if (type === 'single') {
        const keys = ['plan_a', 'plan_b', 'plan_c'];
        const key = keys[idx];
        if (!key) return;
        const plan = generateSinglePlan(key, rs, bs);
        latestData.value.picks[key] = plan;
      } else {
        const keys = ['plan_d', 'plan_e'];
        const key = keys[idx];
        if (!key) return;
        const plan = generateComplexPlan(key, rs, bs);
        latestData.value.picks[key] = plan;
      }
    }

    function generateSinglePlan(key, rs, bs) {
      const hotSorted = [...rs].sort((a, b) => b.freq_10 - a.freq_10);

      if (key === 'plan_a') {
        const top15 = rs.slice(0, 15);
        const z1 = top15.filter(b => b.ball <= 11);
        const z2 = top15.filter(b => b.ball >= 12 && b.ball <= 22);
        const z3 = top15.filter(b => b.ball >= 23);
        let red = [];
        [z1, z2, z3].forEach(zone => {
          red.push(...weightedRandomPick(zone.map(b => ({ ball: b.ball, score: b.score })), 2).map(p => p.ball));
        });
        if (red.length < 6) red.push(...weightedRandomPick(top15.filter(b => !red.includes(b.ball)).map(b => ({ ball: b.ball, score: b.score })), 6 - red.length).map(p => p.ball));
        red = red.slice(0, 6).sort((a, b) => a - b);
        const blue = weightedRandomPick(bs.slice(0, 5).map(b => ({ ball: b.ball, score: b.score })), 1)[0]?.ball || bs[0].ball;
        return { name: '🎯 均衡型', type: 'single', red, blue, method: '三区均衡 + 综合评分', cost: 2 };
      }

      if (key === 'plan_b') {
        const pool = hotSorted.slice(0, 10).map(b => ({ ball: b.ball, score: b.freq_10 + b.score * 0.1 }));
        const red = weightedRandomPick(pool, 6).map(p => p.ball).sort((a, b) => a - b);
        const blue = weightedRandomPick(bs.slice(0, 5).map(b => ({ ball: b.ball, score: b.score })), 1)[0]?.ball || bs[0].ball;
        return { name: '🔥 热号追击', type: 'single', red, blue, method: '短期频率追踪', cost: 2 };
      }

      if (key === 'plan_c') {
        const cold = rs.filter(b => b.global_count > 600 && b.freq_50 < 10)
          .sort((a, b) => (b.global_count - b.freq_50 * 10) - (a.global_count - a.freq_50 * 10));
        const coldPicked = weightedRandomPick(cold.slice(0, 6).map(b => ({ ball: b.ball, score: b.global_count - b.freq_50 * 10 })), 4).map(p => p.ball);
        const hotFill = hotSorted.filter(b => !coldPicked.includes(b.ball)).slice(0, 4);
        const hotPicked = weightedRandomPick(hotFill.map(b => ({ ball: b.ball, score: b.freq_10 })), Math.max(0, 6 - coldPicked.length)).map(p => p.ball);
        const red = [...coldPicked, ...hotPicked].slice(0, 6).sort((a, b) => a - b);
        const coldBlue = bs.slice(-5).map(b => ({ ball: b.ball, score: 1 / (b.score + 0.1) }));
        const blue = weightedRandomPick(coldBlue, 1)[0]?.ball || bs[bs.length - 1].ball;
        return { name: '❄️ 冷号回补', type: 'single', red, blue, method: '遗漏回补理论', cost: 2 };
      }
    }

    function generateComplexPlan(key, rs, bs) {
      if (key === 'plan_d') {
        // 小复式 7+2
        const pool = rs.slice(0, 10).map(b => ({ ball: b.ball, score: b.score }));
        const red = weightedRandomPick(pool, 7).map(p => p.ball).sort((a, b) => a - b);
        const blue = weightedRandomPick(bs.slice(0, 5).map(b => ({ ball: b.ball, score: b.score })), 2).map(p => p.ball).sort((a, b) => a - b);
        const nc = comb(red.length, 6) * blue.length;
        return { name: '🎰 小复式', type: 'complex', red, blue, method: '高频精选 + 双蓝保底', cost: nc * 2, note_count: nc };
      }

      if (key === 'plan_e') {
        // 中复式 10+3
        const top8 = rs.slice(0, 8).map(b => b.ball);
        const missing = rs
          .filter(b => (statsData.value.red_missing?.[String(b.ball).padStart(2, '0')] || 0) > 15)
          .sort((a, b) => {
            const ma = statsData.value.red_missing?.[String(a.ball).padStart(2, '0')] || 0;
            const mb = statsData.value.red_missing?.[String(b.ball).padStart(2, '0')] || 0;
            return mb - ma;
          }).filter(b => !top8.includes(b.ball)).slice(0, 4).map(b => b.ball);
        const allPool = [...new Set([...top8, ...missing])].slice(0, 12).map(b => ({ ball: b, score: 1 }));
        const red = weightedRandomPick(allPool, 10).map(p => p.ball).sort((a, b) => a - b);
        const blue = weightedRandomPick(bs.slice(0, 6).map(b => ({ ball: b.ball, score: b.score })), 3).map(p => p.ball).sort((a, b) => a - b);
        const nc = comb(red.length, 6) * blue.length;
        return { name: '🏆 中复式', type: 'complex', red, blue, method: '高频聚合 + 遗漏回补', cost: nc * 2, note_count: nc };
      }
    }

    function refreshAllPlans() {
      if (!statsData.value.red_scores || !statsData.value.blue_scores) return;
      const rs = statsData.value.red_scores;
      const bs = statsData.value.blue_scores;
      const target = latestData.value.picks.target_issue;

      latestData.value.picks = {
        target_issue: target,
        plan_a: generateSinglePlan('plan_a', rs, bs),
        plan_b: generateSinglePlan('plan_b', rs, bs),
        plan_c: generateSinglePlan('plan_c', rs, bs),
        plan_d: generateComplexPlan('plan_d', rs, bs),
        plan_e: generateComplexPlan('plan_e', rs, bs),
      };
    }

    // === 图表 ===
    const chartTab = ref('redFreq');
    const chartCanvas = ref(null);
    let chartInstance = null;

    function switchChart(tab) {
      chartTab.value = tab;
      renderChart();
    }

    function renderChart() {
      if (!chartCanvas.value || !statsData.value.red_freq_global) return;
      if (chartInstance) chartInstance.destroy();

      const ctx = chartCanvas.value.getContext('2d');
      let config;

      if (chartTab.value === 'redFreq') {
        const labels = [], gd = [], f50d = [], f10d = [];
        for (let i = 1; i <= 33; i++) {
          const k = String(i).padStart(2, '0');
          labels.push(k);
          gd.push(((statsData.value.red_freq_global[k] || 0) / statsData.value.total * 100).toFixed(1));
          f50d.push(((statsData.value.red_freq_50[k] || 0) / 50 * 100).toFixed(1));
          f10d.push(((statsData.value.red_freq_10[k] || 0) / 10 * 100).toFixed(1));
        }
        config = {
          type: 'bar',
          data: { labels, datasets: [
            { label: '全局频率%', data: gd, backgroundColor: 'rgba(231,76,60,0.6)', borderRadius: 3 },
            { label: '近50期%', data: f50d, backgroundColor: 'rgba(243,156,18,0.6)', borderRadius: 3 },
            { label: '近10期%', data: f10d, backgroundColor: 'rgba(52,152,219,0.6)', borderRadius: 3 },
          ]},
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, title: { display: true, text: '频率 %' } } } }
        };
      } else if (chartTab.value === 'blueFreq') {
        const labels = [], gd = [], f50d = [], f10d = [];
        for (let i = 1; i <= 16; i++) {
          const k = String(i).padStart(2, '0');
          labels.push(k);
          gd.push(((statsData.value.blue_freq_global[k] || 0) / statsData.value.total * 100).toFixed(1));
          f50d.push(((statsData.value.blue_freq_50[k] || 0) / 50 * 100).toFixed(1));
          f10d.push(((statsData.value.blue_freq_10[k] || 0) / 10 * 100).toFixed(1));
        }
        config = {
          type: 'bar',
          data: { labels, datasets: [
            { label: '全局频率%', data: gd, backgroundColor: 'rgba(52,152,219,0.6)', borderRadius: 3 },
            { label: '近50期%', data: f50d, backgroundColor: 'rgba(46,204,113,0.6)', borderRadius: 3 },
            { label: '近10期%', data: f10d, backgroundColor: 'rgba(155,89,182,0.6)', borderRadius: 3 },
          ]},
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, title: { display: true, text: '频率 %' } } } }
        };
      } else if (chartTab.value === 'missing') {
        const labels = [], data = [], colors = [];
        for (let i = 1; i <= 33; i++) {
          const k = String(i).padStart(2, '0');
          labels.push(k);
          const v = (statsData.value.red_missing || {})[k] || 0;
          data.push(v);
          colors.push(v > 20 ? 'rgba(231,76,60,0.8)' : v > 10 ? 'rgba(243,156,18,0.7)' : 'rgba(46,204,113,0.6)');
        }
        config = {
          type: 'bar',
          data: { labels, datasets: [{ label: '遗漏期数', data, backgroundColor: colors, borderRadius: 3 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: '遗漏期数' } } } }
        };
      } else if (chartTab.value === 'ranking') {
        const scores = (statsData.value.red_scores || []).slice(0, 15);
        const labels = scores.map(s => String(s.ball).padStart(2, '0'));
        const data = scores.map(s => s.score);
        const colors = scores.map(s => {
          if (s.status.includes('极热')) return 'rgba(231,76,60,0.8)';
          if (s.status.includes('热')) return 'rgba(243,156,18,0.7)';
          if (s.status.includes('温')) return 'rgba(52,152,219,0.6)';
          return 'rgba(149,165,166,0.6)';
        });
        config = {
          type: 'bar',
          data: { labels, datasets: [{ label: '综合评分', data, backgroundColor: colors, borderRadius: 3 }] },
          options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, title: { display: true, text: '综合评分' } } } }
        };
      }

      chartInstance = new Chart(ctx, config);
    }

    // === 结构特征 computed ===
    const structureItems = computed(() => {
      const s = statsData.value.structure;
      if (!s) return [];
      const total = s.total_balls || 300;
      const pct = v => Math.round(v / total * 100);
      return [
        { label: '一区(01~11)', pct: pct(s.zone1), cls: 'zone1' },
        { label: '二区(12~22)', pct: pct(s.zone2), cls: 'zone2' },
        { label: '三区(23~33)', pct: pct(s.zone3), cls: 'zone3' },
        { label: '奇数', pct: pct(s.odd), cls: 'odd' },
        { label: '偶数', pct: pct(s.even), cls: 'even' },
      ];
    });

    // === Utils ===
    function padBall(n) { return String(n).padStart(2, '0'); }

    function getSinglePlans() {
      const p = latestData.value.picks;
      if (!p) return [];
      return [p.plan_a, p.plan_b, p.plan_c].filter(Boolean);
    }

    function getComplexPlans() {
      const p = latestData.value.picks;
      if (!p) return [];
      return [p.plan_d, p.plan_e].filter(Boolean);
    }

    function getAllSystemPlans() {
      const singles = getSinglePlans().map((p, i) => ({ ...p, _idx: i }));
      const complexes = getComplexPlans().map((p, i) => ({ ...p, _idx: i }));
      return [...singles, ...complexes];
    }

    // === 数据加载 ===
    async function loadData() {
      try {
        const [indexRes, statsRes, latestRes] = await Promise.all([
          fetch('data/history_index.json'),
          fetch('data/stats.json'),
          fetch('data/latest.json'),
        ]);
        historyIndex.value = await indexRes.json();
        statsData.value = await statsRes.json();
        latestData.value = await latestRes.json();

        historyDraws.value = await loadYearData(new Date().getFullYear().toString());

        await nextTick();
        renderChart();

        // 自动生成默认的自定义选号结果 + 随机结果
        generateAllDiy();
        generateAllRandom();
      } catch (e) {
        console.error('加载数据失败:', e);
      }
    }

    watch(activeTab, async (val) => {
      if (val === 'stats') {
        await nextTick();
        renderChart();
      }
    });

    // 监听权重变化 → 自动重新生成自定义号码
    watch(weights, () => {
      if (statsData.value.red_freq_global) generateAllDiy();
    }, { deep: true });

    // 监听复式参数变化 → 只重新生成复式那一组
    watch(complexOpts, () => {
      if (!statsData.value.red_freq_global) return;
      const idx = diyResults.value.findIndex(p => p.type === 'complex');
      if (idx >= 0) {
        const newPlan = generateDiyComplex();
        if (newPlan) {
          newPlan.name = diyResults.value[idx].name;
          diyResults.value[idx] = newPlan;
        }
      }
    }, { deep: true });

    // 监听随机参数变化 → 只重新生成复式那一组（balanceZone/balanceOddEven 变化才全部重生成）
    watch(() => [randOpts.value.redCount, randOpts.value.blueCount], () => {
      const idx = randomResults.value.findIndex(p => p.type === 'complex');
      if (idx >= 0) {
        const newPlan = generateRandomComplex();
        newPlan.name = randomResults.value[idx].name;
        randomResults.value[idx] = newPlan;
      }
    });

    watch(() => [randOpts.value.balanceZone, randOpts.value.balanceOddEven], () => {
      if (randomResults.value.length) generateAllRandom();
    });

    onMounted(() => { loadData(); });

    return {
      historyIndex, historyDraws, statsData, latestData,
      yearLoading, onYearChange,
      tabs, activeTab,
      pickMode, methods,
      searchQuery, filterYear, page, pageSize,
      availableYears, filteredDraws, totalPages, paginatedDraws,
      doSearch,
      // DIY
      weights, complexOpts, diyResults, generateAllDiy, refreshOneDiy,
      // Random
      randOpts, randomResults, isShaking, generateAllRandom, refreshOneRandom,
      // System
      plansRefreshing, regenerateAll, refreshOnePlan,
      // Chart
      chartTab, chartCanvas, switchChart,
      structureItems,
      // Utils
      padBall, getSinglePlans, getComplexPlans, getAllSystemPlans,
    };
  }
}).mount('#app');
