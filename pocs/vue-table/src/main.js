import { createApp, h, onMounted, ref } from 'vue';
import './style.css';

const index = await fetch('/data/history_index.json').then((response) => response.json());
const annual = await Promise.all(
  index.years.map((year) => fetch(`/data/history/${year.year}.json`).then((response) => response.json())),
);
const allDraws = annual.flat().sort((a, b) => a.issue.localeCompare(b.issue));

createApp({
  setup() {
    const draws = ref(allDraws.slice(-50));
    const renderMs = ref(null);
    onMounted(() => {
      window.__ssqPocBooted = performance.now();
    });

    const render = (count) => {
      const start = performance.now();
      draws.value = allDraws.slice(-count);
      requestAnimationFrame(() => {
        renderMs.value = Math.round(performance.now() - start);
      });
    };

    return () => h('div', { class: 'shell' }, [
      h('header', [
        h('strong', 'SSQ Hub Vue table POC'),
        h('span', `${allDraws.length} draws`),
        h('button', { onClick: () => render(3527) }, 'Render all'),
        renderMs.value == null ? null : h('output', `${renderMs.value} ms`),
      ]),
      h('div', { class: 'scroll' }, [
        h('table', [
          h('thead', h('tr', [
            h('th', { class: 'issue' }, '期号'),
            ...Array.from({ length: 33 }, (_, index) => h('th', String(index + 1).padStart(2, '0'))),
            ...Array.from({ length: 16 }, (_, index) => h('th', { class: 'blue' }, String(index + 1).padStart(2, '0'))),
            ...Array.from({ length: 8 }, () => h('th', { class: 'aux' }, '结构')),
          ])),
          h('tbody', draws.value.map((draw) => h('tr', [
            h('td', { class: 'issue' }, draw.issue),
            ...Array.from({ length: 33 }, (_, index) => {
              const number = index + 1;
              const hit = draw.red.includes(number);
              return h('td', { class: hit ? 'hit red' : '' }, hit ? String(number).padStart(2, '0') : '');
            }),
            ...Array.from({ length: 16 }, (_, index) => {
              const number = index + 1;
              const hit = draw.blue === number;
              return h('td', { class: hit ? 'hit blue' : '' }, hit ? String(number).padStart(2, '0') : '');
            }),
            ...Array.from({ length: 8 }, () => h('td', { class: 'aux' }, '—')),
          ]))),
        ]),
      ]),
    ]);
  },
}).mount('#app');
