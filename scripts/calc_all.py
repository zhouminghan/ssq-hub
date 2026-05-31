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

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'web', 'data')
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
    recent_100 = draws[-100:]
    red_freq_50 = Counter()
    blue_freq_50 = Counter()
    for d in recent_50:
        for r in d['red']:
            red_freq_50[r] += 1
        blue_freq_50[d['blue']] += 1

    red_freq_100 = Counter()
    blue_freq_100 = Counter()
    for d in recent_100:
        for r in d['red']:
            red_freq_100[r] += 1
        blue_freq_100[d['blue']] += 1

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

    # ── 每号画像（号码 → 历史最长遗漏 + 那期 + 最近 5 次出现）──
    # 一次正向遍历，O(N)；同时累计每号最长遗漏与最近出现期号队列
    red_max_miss = {n: 0 for n in range(1, 34)}
    red_max_miss_issue = {n: '' for n in range(1, 34)}
    red_streak = {n: 0 for n in range(1, 34)}     # 当前距上次出现的期数
    red_recent5 = {n: [] for n in range(1, 34)}   # 倒序最近 5 次

    blue_max_miss = {n: 0 for n in range(1, 17)}
    blue_max_miss_issue = {n: '' for n in range(1, 17)}
    blue_streak = {n: 0 for n in range(1, 17)}
    blue_recent5 = {n: [] for n in range(1, 17)}

    for d in draws:
        red_set = set(d['red'])
        for n in range(1, 34):
            if n in red_set:
                # 这期出现：上一段未出长度 = 当前 streak（不含本期）
                if red_streak[n] > red_max_miss[n]:
                    red_max_miss[n] = red_streak[n]
                    red_max_miss_issue[n] = d['issue']
                red_streak[n] = 0
                red_recent5[n].append(d['issue'])
                if len(red_recent5[n]) > 5:
                    red_recent5[n].pop(0)
            else:
                red_streak[n] += 1

        b = d['blue']
        for n in range(1, 17):
            if n == b:
                if blue_streak[n] > blue_max_miss[n]:
                    blue_max_miss[n] = blue_streak[n]
                    blue_max_miss_issue[n] = d['issue']
                blue_streak[n] = 0
                blue_recent5[n].append(d['issue'])
                if len(blue_recent5[n]) > 5:
                    blue_recent5[n].pop(0)
            else:
                blue_streak[n] += 1

    # 末尾兜底：当前未出的"挂着"的 streak 也要参与最长比对
    for n in range(1, 34):
        if red_streak[n] > red_max_miss[n]:
            red_max_miss[n] = red_streak[n]
            red_max_miss_issue[n] = ''  # 仍在持续中
    for n in range(1, 17):
        if blue_streak[n] > blue_max_miss[n]:
            blue_max_miss[n] = blue_streak[n]
            blue_max_miss_issue[n] = ''

    red_per_number = {}
    for n in range(1, 34):
        key = str(n).zfill(2)
        red_per_number[key] = {
            'freq_global': red_freq.get(n, 0),
            'freq_50': red_freq_50.get(n, 0),
            'freq_100': red_freq_100.get(n, 0),
            'current_miss': red_missing[n],
            'max_miss': red_max_miss[n],
            'max_miss_issue': red_max_miss_issue[n],
            'recent_5_issues': list(reversed(red_recent5[n])),  # 最近的在前
        }

    blue_per_number = {}
    for n in range(1, 17):
        key = str(n).zfill(2)
        blue_per_number[key] = {
            'freq_global': blue_freq.get(n, 0),
            'freq_50': blue_freq_50.get(n, 0),
            'freq_100': blue_freq_100.get(n, 0),
            'current_miss': blue_missing[n],
            'max_miss': blue_max_miss[n],
            'max_miss_issue': blue_max_miss_issue[n],
            'recent_5_issues': list(reversed(blue_recent5[n])),
        }

    # ── 连号 / 同尾 / AC 值（最近 100 期，作为模式分布参考）──
    # 连号：6 红中存在相邻数对；同尾：6 红中存在尾数相同对
    # AC 值：6 红两两差值的去重集合大小 - 5（双色球公认指标，常落 5-10）
    consec_count = 0
    same_tail_count = 0
    ac_dist = Counter()
    for d in recent_100:
        rs = sorted(d['red'])
        # 连号
        if any(rs[i + 1] - rs[i] == 1 for i in range(5)):
            consec_count += 1
        # 同尾（个位数相同）
        tails = [r % 10 for r in rs]
        if len(set(tails)) < len(tails):
            same_tail_count += 1
        # AC 值
        diffs = set()
        for i in range(6):
            for j in range(i + 1, 6):
                diffs.add(rs[j] - rs[i])
        ac = len(diffs) - 5
        ac_dist[ac] += 1

    n100 = len(recent_100)
    consecutive = {
        'window': n100,
        'with_consec_count': consec_count,
        'ratio': round(consec_count / n100, 4) if n100 else 0,
    }
    same_tail = {
        'window': n100,
        'with_same_tail_count': same_tail_count,
        'ratio': round(same_tail_count / n100, 4) if n100 else 0,
    }
    ac_distribution = {str(k): v for k, v in sorted(ac_dist.items())}

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
        'red_per_number': red_per_number,
        'blue_per_number': blue_per_number,
        'consecutive': consecutive,
        'same_tail': same_tail,
        'ac_distribution': ac_distribution,
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
