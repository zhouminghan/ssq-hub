#!/usr/bin/env python3
"""
基于按年存储的历史数据重新计算 stats.json 和 latest.json
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
    return {'draws': all_draws}


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

    recent_10 = draws[-10:]
    red_freq_10 = Counter()
    blue_freq_10 = Counter()
    for d in recent_10:
        for r in d['red']:
            red_freq_10[r] += 1
        blue_freq_10[d['blue']] += 1

    # 红球评分
    red_scores = []
    for ball in range(1, 34):
        gf = red_freq.get(ball, 0) / total * 100
        f50 = red_freq_50.get(ball, 0) / 50 * 100
        f10 = red_freq_10.get(ball, 0) / 10 * 100
        cold_bonus = max(0, (gf - f50) * 1.5) if gf > 18 and f50 < 14 else 0
        score = round(gf * 0.15 + f50 * 0.30 + f10 * 0.30 + cold_bonus * 0.25, 1)

        if f10 >= 40: status = '🔥极热'
        elif f10 >= 20: status = '🔥热'
        elif f10 >= 10: status = '温'
        elif f50 <= 6: status = '❄️冷号'
        else: status = '偏冷'

        red_scores.append({
            'ball': ball, 'score': score,
            'global_count': red_freq.get(ball, 0),
            'freq_50': red_freq_50.get(ball, 0),
            'freq_10': red_freq_10.get(ball, 0),
            'status': status
        })
    red_scores.sort(key=lambda x: x['score'], reverse=True)

    # 蓝球评分
    blue_scores = []
    for ball in range(1, 17):
        gf = blue_freq.get(ball, 0) / total * 100
        f50 = blue_freq_50.get(ball, 0) / 50 * 100
        f10 = blue_freq_10.get(ball, 0) / 10 * 100
        cold_bonus = max(0, (gf - f50) * 1.5) if gf > 6 and f50 < 4 else 0
        score = round(gf * 0.15 + f50 * 0.30 + f10 * 0.30 + cold_bonus * 0.25, 1)

        if f10 >= 20: status = '🔥热'
        elif f10 >= 10: status = '温'
        elif f50 <= 2: status = '❄️冷号'
        else: status = '偏冷'

        blue_scores.append({
            'ball': ball, 'score': score,
            'global_count': blue_freq.get(ball, 0),
            'freq_50': blue_freq_50.get(ball, 0),
            'freq_10': blue_freq_10.get(ball, 0),
            'status': status
        })
    blue_scores.sort(key=lambda x: x['score'], reverse=True)

    # 遗漏
    red_missing = {}
    for ball in range(1, 34):
        for i, d in enumerate(reversed(draws)):
            if ball in d['red']:
                red_missing[ball] = i
                break
        else:
            red_missing[ball] = total

    blue_missing = {}
    for ball in range(1, 17):
        for i, d in enumerate(reversed(draws)):
            if ball == d['blue']:
                blue_missing[ball] = i
                break
        else:
            blue_missing[ball] = total

    # 结构特征
    z1 = z2 = z3 = odd = even = small = big = 0
    for d in recent_50:
        for r in d['red']:
            if r <= 11: z1 += 1
            elif r <= 22: z2 += 1
            else: z3 += 1
            if r % 2 == 1: odd += 1
            else: even += 1
            if r <= 16: small += 1
            else: big += 1

    sum_vals = [sum(d['red']) for d in recent_10]
    avg_sum = round(sum(sum_vals) / len(sum_vals), 1)

    fmt = lambda d: {str(k).zfill(2): v for k, v in sorted(d.items())}

    return {
        'updated': draws[-1]['date'],
        'latest_issue': draws[-1]['issue'],
        'total': total,
        'red_freq_global': fmt(red_freq),
        'red_freq_50': fmt(red_freq_50),
        'red_freq_10': fmt(red_freq_10),
        'blue_freq_global': fmt(blue_freq),
        'blue_freq_50': fmt(blue_freq_50),
        'blue_freq_10': fmt(blue_freq_10),
        'red_scores': red_scores,
        'blue_scores': blue_scores,
        'avg_sum_10': avg_sum,
        'red_missing': fmt(red_missing),
        'blue_missing': fmt(blue_missing),
        'structure': {
            'zone1': z1, 'zone2': z2, 'zone3': z3,
            'odd': odd, 'even': even, 'small': small, 'big': big,
            'total_balls': len(recent_50) * 6
        }
    }


def generate_picks(stats, draws):
    red_scores = stats['red_scores']
    blue_scores = stats['blue_scores']

    top = sorted(red_scores[:15], key=lambda x: x['ball'])
    z1 = [b for b in top if b['ball'] <= 11]
    z2 = [b for b in top if 12 <= b['ball'] <= 22]
    z3 = [b for b in top if b['ball'] >= 23]

    pick_a = []
    for zone in [z1, z2, z3]:
        zs = sorted(zone, key=lambda x: x['score'], reverse=True)
        pick_a.extend([b['ball'] for b in zs[:2]])
    pick_a = sorted(pick_a[:6])

    hot = sorted(red_scores, key=lambda x: x['freq_10'], reverse=True)
    pick_b = sorted([b['ball'] for b in hot[:6]])

    cold_c = sorted(
        [b for b in red_scores if b['global_count'] > 600 and b['freq_50'] < 10],
        key=lambda x: x['global_count'] - x['freq_50'] * 10, reverse=True
    )
    cp = [b['ball'] for b in cold_c[:4]]
    hp = [b['ball'] for b in hot[:2] if b['ball'] not in cp]
    pick_c = sorted((cp + hp)[:6])

    next_issue = str(int(draws[-1]['issue']) + 1).zfill(7)

    return {
        'target_issue': next_issue,
        'plan_a': {'name': '🎯 均衡型', 'red': pick_a, 'blue': blue_scores[0]['ball'], 'desc': '综合评分前列，兼顾区间平衡'},
        'plan_b': {'name': '🔥 热号追击', 'red': pick_b, 'blue': blue_scores[0]['ball'], 'desc': '近10期高频号码延续'},
        'plan_c': {'name': '❄️ 冷号回补', 'red': pick_c, 'blue': blue_scores[-1]['ball'], 'desc': '全局热/近期冷号回补'},
    }


def main():
    history = load_history()
    draws = history['draws']
    print(f'📊 计算统计数据 ({len(draws)} 期)...')

    stats = calc_stats(draws)
    with open(os.path.join(DATA_DIR, 'stats.json'), 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print('✅ stats.json 已更新')

    picks = generate_picks(stats, draws)
    latest = {
        'latest_draw': draws[-1],
        'picks': picks,
        'updated': draws[-1]['date']
    }
    with open(os.path.join(DATA_DIR, 'latest.json'), 'w', encoding='utf-8') as f:
        json.dump(latest, f, ensure_ascii=False, indent=2)
    print('✅ latest.json 已更新')
    print(f'🎯 下期推荐: {picks["target_issue"]}')
    print(f'   方案A: {picks["plan_a"]["red"]} + [{picks["plan_a"]["blue"]}]')


if __name__ == '__main__':
    main()
