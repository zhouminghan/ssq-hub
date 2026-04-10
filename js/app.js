const { createApp, ref, computed, onMounted, watch, nextTick } = Vue;

createApp({
  setup() {
    // === 数据 ===
    const historyIndex = ref({ total: 0, years: [] });  // 年份索引
    const historyDraws = ref([]);  // 当前加载的开奖数据
    const historyData = ref({ total: 0, draws: [] });  // 兼容旧引用
    const statsData = ref({});
    const latestData = ref({});
    const yearLoading = ref(false);  // 年份数据加载中
    const yearCache = {};  // 已加载的年份缓存

    // === Tab ===
    const tabs = [
      { id: 'history', name: '历史查询', icon: '📊' },
      { id: 'picker', name: '智能选号', icon: '🎯' },
      { id: 'stats', name: '统计分析', icon: '📈' },
    ];
    const activeTab = ref('history');

    // === 历史查询 ===
    const searchQuery = ref('');
    const filterYear = ref('');
    const page = ref(1);
    const pageSize = 30;

    const availableYears = computed(() => {
      return historyIndex.value.years.map(y => y.year).sort().reverse();
    });

    // 按年份加载数据
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

    // 切换年份时加载对应数据
    async function onYearChange(year) {
      filterYear.value = year;
      page.value = 1;

      if (!year) {
        // 选了"全部"时，加载当前年
        const currentYear = new Date().getFullYear().toString();
        yearLoading.value = true;
        historyDraws.value = await loadYearData(currentYear);
        yearLoading.value = false;
      } else {
        yearLoading.value = true;
        historyDraws.value = await loadYearData(year);
        yearLoading.value = false;
      }
    }

    const filteredDraws = computed(() => {
      let draws = [...historyDraws.value].reverse(); // 最新在前
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.trim();
        draws = draws.filter(d => {
          // 按期号
          if (d.issue.includes(q)) return true;
          // 按日期
          if (d.date.includes(q)) return true;
          // 按号码（多号码以空格/逗号分隔）
          const nums = q.split(/[\s,，]+/).map(Number).filter(n => n > 0);
          if (nums.length > 0) {
            return nums.every(n => d.red.includes(n) || d.blue === n);
          }
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

    function doSearch() {
      page.value = 1;
    }

    // === 选号 ===
    const weights = ref([
      { label: '全局频率', value: 15, key: 'global' },
      { label: '近50期频率', value: 30, key: 'f50' },
      { label: '近10期频率', value: 30, key: 'f10' },
      { label: '冷号回补', value: 25, key: 'cold' },
    ]);
    const customPick = ref({ red: [], blue: 0 });

    // 加权随机：按评分权重概率选取，评分越高被选中概率越大
    function weightedRandomPick(candidates, count) {
      const picked = [];
      const pool = [...candidates];
      for (let i = 0; i < count && pool.length > 0; i++) {
        // 评分归一化为概率
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
        const idx = pool.findIndex(c => c.ball === chosen.ball);
        pool.splice(idx, 1);
      }
      return picked;
    }

    function generateCustomPick() {
      if (!statsData.value.red_freq_global) return;

      const total = statsData.value.total || 0;
      const w = {};
      weights.value.forEach(item => { w[item.key] = item.value / 100; });

      // 红球评分
      const scored = [];
      for (let ball = 1; ball <= 33; ball++) {
        const bk = String(ball).padStart(2, '0');
        const gCount = (statsData.value.red_freq_global || {})[bk] || 0;
        const f50Count = (statsData.value.red_freq_50 || {})[bk] || 0;
        const f10Count = (statsData.value.red_freq_10 || {})[bk] || 0;

        const gf = gCount / total * 100;
        const f50 = f50Count / 50 * 100;
        const f10 = f10Count / 10 * 100;

        let coldBonus = 0;
        if (gf > 18 && f50 < 14) {
          coldBonus = (gf - f50) * 1.5;
        }

        const score = gf * w.global + f50 * w.f50 + f10 * w.f10 + coldBonus * w.cold;
        scored.push({ ball, score });
      }

      // 按区间加权随机选取（评分高的概率大，但每次不完全一样）
      const z1Pool = scored.filter(b => b.ball <= 11);
      const z2Pool = scored.filter(b => b.ball >= 12 && b.ball <= 22);
      const z3Pool = scored.filter(b => b.ball >= 23);

      const z1 = weightedRandomPick(z1Pool, 2);
      const z2 = weightedRandomPick(z2Pool, 2);
      const z3 = weightedRandomPick(z3Pool, 2);
      let pick = [...z1, ...z2, ...z3].map(b => b.ball);

      // 不够6个时从全池补充
      if (pick.length < 6) {
        const remaining = scored.filter(s => !pick.includes(s.ball));
        const extra = weightedRandomPick(remaining, 6 - pick.length);
        pick.push(...extra.map(b => b.ball));
      }
      pick = pick.slice(0, 6).sort((a, b) => a - b);

      // 蓝球（加权随机）
      const blueScored = [];
      for (let ball = 1; ball <= 16; ball++) {
        const bk = String(ball).padStart(2, '0');
        const gCount = (statsData.value.blue_freq_global || {})[bk] || 0;
        const f50Count = (statsData.value.blue_freq_50 || {})[bk] || 0;
        const f10Count = (statsData.value.blue_freq_10 || {})[bk] || 0;
        const score = gCount / total * 100 * w.global + f50Count / 50 * 100 * w.f50 + f10Count / 10 * 100 * w.f10;
        blueScored.push({ ball, score });
      }
      const bluePick = weightedRandomPick(blueScored, 1);

      customPick.value = { red: pick, blue: bluePick[0]?.ball || 1 };
    }

    // === 随机选号 ===
    const randOpts = ref({ balanceZone: true, balanceOddEven: false });
    const randomResult = ref({ red: [], blue: 0 });
    const isShaking = ref(false);

    function randomPick() {
      isShaking.value = true;
      setTimeout(() => { isShaking.value = false; }, 600);

      let reds = [];
      const pool = Array.from({ length: 33 }, (_, i) => i + 1);

      if (randOpts.value.balanceZone) {
        // 每区至少1个，共6个
        const z1 = pool.filter(n => n <= 11);
        const z2 = pool.filter(n => n >= 12 && n <= 22);
        const z3 = pool.filter(n => n >= 23);
        reds.push(pick(z1));
        reds.push(pick(z2));
        reds.push(pick(z3));
        // 剩余3个从全池(去重)中选
        const remaining = pool.filter(n => !reds.includes(n));
        while (reds.length < 6) {
          reds.push(pick(remaining));
          remaining.splice(remaining.indexOf(reds[reds.length - 1]), 1);
        }
      } else {
        while (reds.length < 6) {
          const n = pick(pool.filter(x => !reds.includes(x)));
          reds.push(n);
        }
      }

      if (randOpts.value.balanceOddEven) {
        // 确保3奇3偶
        let attempts = 0;
        while (attempts < 100) {
          const oddCount = reds.filter(n => n % 2 === 1).length;
          if (oddCount === 3) break;
          reds = [];
          const rem = [...pool];
          while (reds.length < 6) {
            const idx = Math.floor(Math.random() * rem.length);
            reds.push(rem[idx]);
            rem.splice(idx, 1);
          }
          attempts++;
        }
      }

      reds.sort((a, b) => a - b);
      const blue = Math.floor(Math.random() * 16) + 1;
      randomResult.value = { red: reds, blue };

      function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
      }
    }

    // === 下期推荐重新生成 ===
    const plansRefreshing = ref(false);

    function regeneratePlans() {
      if (!statsData.value.red_scores || !statsData.value.blue_scores) return;

      plansRefreshing.value = true;
      setTimeout(() => { plansRefreshing.value = false; }, 400);

      const redScores = [...statsData.value.red_scores]; // 已按评分降序
      const blueScores = [...statsData.value.blue_scores];
      const total = statsData.value.total || 0;

      // --- 方案A: 均衡型（加权随机，按区间均衡） ---
      const top15 = redScores.slice(0, 15);
      const z1Pool = top15.filter(b => b.ball <= 11);
      const z2Pool = top15.filter(b => b.ball >= 12 && b.ball <= 22);
      const z3Pool = top15.filter(b => b.ball >= 23);

      const pickA = [];
      [z1Pool, z2Pool, z3Pool].forEach(zone => {
        const picked = weightedRandomPick(zone.map(b => ({ ball: b.ball, score: b.score })), 2);
        pickA.push(...picked.map(p => p.ball));
      });
      // 不够6个时从top15补充
      if (pickA.length < 6) {
        const remaining = top15.filter(b => !pickA.includes(b.ball));
        const extra = weightedRandomPick(remaining.map(b => ({ ball: b.ball, score: b.score })), 6 - pickA.length);
        pickA.push(...extra.map(p => p.ball));
      }
      const planARed = pickA.slice(0, 6).sort((a, b) => a - b);
      const planABlue = weightedRandomPick(blueScores.slice(0, 5).map(b => ({ ball: b.ball, score: b.score })), 1)[0]?.ball || blueScores[0].ball;

      // --- 方案B: 热号追击（近10期高频，加权随机） ---
      const hotSorted = [...redScores].sort((a, b) => b.freq_10 - a.freq_10);
      const hotPool = hotSorted.slice(0, 10).map(b => ({ ball: b.ball, score: b.freq_10 + b.score * 0.1 }));
      const pickB = weightedRandomPick(hotPool, 6).map(p => p.ball).sort((a, b) => a - b);
      const planBBlue = weightedRandomPick(blueScores.slice(0, 5).map(b => ({ ball: b.ball, score: b.score })), 1)[0]?.ball || blueScores[0].ball;

      // --- 方案C: 冷号回补（全局多但近期少） ---
      const coldCandidates = redScores
        .filter(b => b.global_count > 600 && b.freq_50 < 10)
        .sort((a, b) => (b.global_count - b.freq_50 * 10) - (a.global_count - a.freq_50 * 10));
      const coldPool = coldCandidates.slice(0, 6).map(b => ({ ball: b.ball, score: b.global_count - b.freq_50 * 10 }));
      const coldPicked = weightedRandomPick(coldPool, 4).map(p => p.ball);
      // 用热号补齐
      const hotFill = hotSorted.filter(b => !coldPicked.includes(b.ball)).slice(0, 4);
      const hotFillPicked = weightedRandomPick(hotFill.map(b => ({ ball: b.ball, score: b.freq_10 })), Math.max(0, 6 - coldPicked.length)).map(p => p.ball);
      const planCRed = [...coldPicked, ...hotFillPicked].slice(0, 6).sort((a, b) => a - b);
      // 蓝球选冷球
      const coldBluePool = blueScores.slice(-5).map(b => ({ ball: b.ball, score: 1 / (b.score + 0.1) }));
      const planCBlue = weightedRandomPick(coldBluePool, 1)[0]?.ball || blueScores[blueScores.length - 1].ball;

      // 写入 latestData
      const targetIssue = latestData.value.picks.target_issue;
      latestData.value.picks = {
        target_issue: targetIssue,
        plan_a: { name: '🎯 均衡型', red: planARed, blue: planABlue, desc: '综合评分前列，兼顾区间平衡（随机刷新）' },
        plan_b: { name: '🔥 热号追击', red: pickB, blue: planBBlue, desc: '近10期高频号码延续（随机刷新）' },
        plan_c: { name: '❄️ 冷号回补', red: planCRed, blue: planCBlue, desc: '全局热/近期冷号回补（随机刷新）' },
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

      if (chartInstance) {
        chartInstance.destroy();
      }

      const ctx = chartCanvas.value.getContext('2d');
      let config;

      if (chartTab.value === 'redFreq') {
        const labels = [];
        const globalData = [];
        const f50Data = [];
        const f10Data = [];
        for (let i = 1; i <= 33; i++) {
          const k = String(i).padStart(2, '0');
          labels.push(k);
          globalData.push(((statsData.value.red_freq_global[k] || 0) / statsData.value.total * 100).toFixed(1));
          f50Data.push(((statsData.value.red_freq_50[k] || 0) / 50 * 100).toFixed(1));
          f10Data.push(((statsData.value.red_freq_10[k] || 0) / 10 * 100).toFixed(1));
        }
        config = {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: '全局频率%', data: globalData, backgroundColor: 'rgba(231,76,60,0.6)', borderRadius: 3 },
              { label: '近50期%', data: f50Data, backgroundColor: 'rgba(243,156,18,0.6)', borderRadius: 3 },
              { label: '近10期%', data: f10Data, backgroundColor: 'rgba(52,152,219,0.6)', borderRadius: 3 },
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, title: { display: true, text: '频率 %' } } }
          }
        };
      } else if (chartTab.value === 'blueFreq') {
        const labels = [];
        const globalData = [];
        const f50Data = [];
        const f10Data = [];
        for (let i = 1; i <= 16; i++) {
          const k = String(i).padStart(2, '0');
          labels.push(k);
          globalData.push(((statsData.value.blue_freq_global[k] || 0) / statsData.value.total * 100).toFixed(1));
          f50Data.push(((statsData.value.blue_freq_50[k] || 0) / 50 * 100).toFixed(1));
          f10Data.push(((statsData.value.blue_freq_10[k] || 0) / 10 * 100).toFixed(1));
        }
        config = {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: '全局频率%', data: globalData, backgroundColor: 'rgba(52,152,219,0.6)', borderRadius: 3 },
              { label: '近50期%', data: f50Data, backgroundColor: 'rgba(46,204,113,0.6)', borderRadius: 3 },
              { label: '近10期%', data: f10Data, backgroundColor: 'rgba(155,89,182,0.6)', borderRadius: 3 },
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, title: { display: true, text: '频率 %' } } }
          }
        };
      } else if (chartTab.value === 'missing') {
        const labels = [];
        const data = [];
        const colors = [];
        for (let i = 1; i <= 33; i++) {
          const k = String(i).padStart(2, '0');
          labels.push(k);
          const v = (statsData.value.red_missing || {})[k] || 0;
          data.push(v);
          colors.push(v > 20 ? 'rgba(231,76,60,0.8)' : v > 10 ? 'rgba(243,156,18,0.7)' : 'rgba(46,204,113,0.6)');
        }
        config = {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: '遗漏期数',
              data,
              backgroundColor: colors,
              borderRadius: 3
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, title: { display: true, text: '遗漏期数' } } }
          }
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
          data: {
            labels,
            datasets: [{
              label: '综合评分',
              data,
              backgroundColor: colors,
              borderRadius: 3
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, title: { display: true, text: '综合评分' } } }
          }
        };
      }

      chartInstance = new Chart(ctx, config);
    }

    // === Utils ===
    function padBall(n) {
      return String(n).padStart(2, '0');
    }

    function getPlans() {
      const picks = latestData.value.picks;
      if (!picks) return [];
      return [picks.plan_a, picks.plan_b, picks.plan_c].filter(Boolean);
    }

    function zonePercent(val) {
      const total = statsData.value.structure?.total_balls || 300;
      return Math.round(val / total * 100);
    }

    // === 数据加载 ===
    async function loadData() {
      try {
        // 先加载索引、统计、推荐（都很小）
        const [indexRes, statsRes, latestRes] = await Promise.all([
          fetch('data/history_index.json'),
          fetch('data/stats.json'),
          fetch('data/latest.json'),
        ]);
        historyIndex.value = await indexRes.json();
        statsData.value = await statsRes.json();
        latestData.value = await latestRes.json();

        // 兼容旧引用
        historyData.value = { total: historyIndex.value.total, draws: [] };

        // 默认加载当前年份数据
        const currentYear = new Date().getFullYear().toString();
        historyDraws.value = await loadYearData(currentYear);

        // 初始化选号
        generateCustomPick();

        // 渲染图表
        await nextTick();
        renderChart();
      } catch (e) {
        console.error('加载数据失败:', e);
      }
    }

    // Tab 切换时重绘图表
    watch(activeTab, async (val) => {
      if (val === 'stats') {
        await nextTick();
        renderChart();
      }
    });

    onMounted(() => {
      loadData();
    });

    return {
      historyIndex, historyDraws, historyData, statsData, latestData,
      yearLoading, onYearChange,
      tabs, activeTab,
      searchQuery, filterYear, page, pageSize,
      availableYears, filteredDraws, totalPages, paginatedDraws,
      doSearch,
      weights, customPick, generateCustomPick,
      randOpts, randomResult, isShaking, randomPick,
      plansRefreshing, regeneratePlans,
      chartTab, chartCanvas, switchChart,
      padBall, getPlans, zonePercent,
    };
  }
}).mount('#app');
