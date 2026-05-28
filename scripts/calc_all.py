#!/usr/bin/env python3
"""
基于按年存储的历史数据重新计算 stats.json + latest.json

精简版（走势图应用）：
- stats.json: 红蓝球频次、遗漏值、近 50 期结构特征
- latest.json: 最新一期开奖信息（不再生成推荐选号，由前端模拟选号取代）

读取: data/history/*.json
"""

import json
import os
import glob
from collections import Counter

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
HISTORY_DIR = os.path.join(DATA_DIR, 'history')


def load_history():
    """从按年文件合并加载全部历史数据"""
    all_draws = []
    for fpath in sorted(glob.glob(os.path.join(HISTORY_DIR, '*.json'))):
        with open(fpath, 'r', encoding='utf-8') as f:
            all_draws.extend(json.load(f))
    return all_draws


def calc_stats(draws):
    total = len(draws)

    red_freq = Counter()
    blue_freq = Counter()
    for d in draws:
        for r in d['red']:
            red_freq[r] += 1
        blue_freq[d['blue']] += 1

    recent_50 = draws[-50:]
    red_freq_50 = Counter()
    blue_freq_50 = Counter()
    for d in recent_50:
        for r in d['red']:
            red_freq_50[r] += 1
        blue_freq_50[d['blue']] += 1

    # 遗漏（距今 N 期未出，0 = 上一期出过）
    red_missing = {}
    for ball in range(1, 34):
        miss = total
        for i, d in enumerate(reversed(draws)):
            if ball in d['red']:
                miss = i
                break
        red_missing[ball] = miss

    blue_missing = {}
    for ball in range(1, 17):
        miss = total
        for i, d in enumerate(reversed(draws)):
            if ball == d['blue']:
                miss = i
                break
        blue_missing[ball] = miss

    # 近 50 期结构（红球）
    z1 = z2 = z3 = odd = even = small = big = 0
    for d in recent_50:
        for r in d['red']:
            if r <= 11:
                z1 += 1
            elif r <= 22:
                z2 += 1
            else:
                z3 += 1
            if r % 2 == 1:
                odd += 1
            else:
                even += 1
            if r <= 16:
                small += 1
            else:
                big += 1

    fmt = lambda d: {str(k).zfill(2): v for k, v in sorted(d.items())}

    return {
        'updated': draws[-1]['date'],
        'latest_issue': draws[-1]['issue'],
        'total': total,
        'red_freq_global': fmt(red_freq),
        'red_freq_50': fmt(red_freq_50),
        'blue_freq_global': fmt(blue_freq),
        'blue_freq_50': fmt(blue_freq_50),
        'red_missing': fmt(red_missing),
        'blue_missing': fmt(blue_missing),
        'structure_recent_50': {
            'zone1': z1, 'zone2': z2, 'zone3': z3,
            'odd': odd, 'even': even, 'small': small, 'big': big,
            'total_balls': len(recent_50) * 6,
        },
    }


def main():
    draws = load_history()
    if not draws:
        print('⚠️ 无历史数据，跳过')
        return
    print(f'📊 计算统计数据 ({len(draws)} 期)...')

    stats = calc_stats(draws)
    with open(os.path.join(DATA_DIR, 'stats.json'), 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print('✅ stats.json 已更新')

    latest = {
        'latest_draw': draws[-1],
        'updated': draws[-1]['date'],
        'total': len(draws),
    }
    with open(os.path.join(DATA_DIR, 'latest.json'), 'w', encoding='utf-8') as f:
        json.dump(latest, f, ensure_ascii=False, indent=2)
    print('✅ latest.json 已更新')
    print(f'🎰 最新一期: {draws[-1]["issue"]} ({draws[-1]["date"]})')
    print(f'   红球: {draws[-1]["red"]}  蓝球: {draws[-1]["blue"]}')


if __name__ == '__main__':
    main()
