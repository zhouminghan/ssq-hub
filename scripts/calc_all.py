#!/usr/bin/env python3
"""
基于按年存储的历史数据重新计算 stats.json + latest.json

精简版（走势图应用）：
- stats.json: 红蓝球频次、遗漏值、每号画像、模式分布
- latest.json: 最新一期开奖信息

读取: data/history/*.json
"""

from collections import Counter

from _paths import LATEST_FILE, MANIFEST_FILE, STATS_FILE
from _utils import write_if_changed
from manifest import (
    PIPELINE_VERSION,
    SCHEMA_VERSION,
    build_manifest,
    load_history_strict,
    resolve_source_label,
    utc_now,
    verify_history_against_baseline,
)


def load_history():
    """从按年文件合并加载全部历史数据"""
    return load_history_strict()


def calc_stats(draws, generated_at=None, source='Public lottery issue records'):
    total = len(draws)

    red_freq_global = Counter()
    blue_freq_global = Counter()
    for d in draws:
        for r in d['red']:
            red_freq_global[r] += 1
        blue_freq_global[d['blue']] += 1

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
    red_streak = {n: 0 for n in range(1, 34)}
    red_recent5 = {n: [] for n in range(1, 34)}

    blue_max_miss = {n: 0 for n in range(1, 17)}
    blue_max_miss_issue = {n: '' for n in range(1, 17)}
    blue_streak = {n: 0 for n in range(1, 17)}
    blue_recent5 = {n: [] for n in range(1, 17)}

    for d in draws:
        red_set = set(d['red'])
        for n in range(1, 34):
            if n in red_set:
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
            red_max_miss_issue[n] = ''
    for n in range(1, 17):
        if blue_streak[n] > blue_max_miss[n]:
            blue_max_miss[n] = blue_streak[n]
            blue_max_miss_issue[n] = ''

    red_per_number = {}
    for n in range(1, 34):
        key = str(n).zfill(2)
        red_per_number[key] = {
            'freq_global': red_freq_global.get(n, 0),
            'freq_50': red_freq_50.get(n, 0),
            'freq_100': red_freq_100.get(n, 0),
            'current_miss': red_missing[n],
            'max_miss': red_max_miss[n],
            'max_miss_issue': red_max_miss_issue[n],
            'recent_5_issues': list(reversed(red_recent5[n])),
        }

    blue_per_number = {}
    for n in range(1, 17):
        key = str(n).zfill(2)
        blue_per_number[key] = {
            'freq_global': blue_freq_global.get(n, 0),
            'freq_50': blue_freq_50.get(n, 0),
            'freq_100': blue_freq_100.get(n, 0),
            'current_miss': blue_missing[n],
            'max_miss': blue_max_miss[n],
            'max_miss_issue': blue_max_miss_issue[n],
            'recent_5_issues': list(reversed(blue_recent5[n])),
        }

    # ── 连号 / 同尾 / AC 值（最近 100 期）──
    consec_count = 0
    same_tail_count = 0
    ac_dist = Counter()
    for d in recent_100:
        rs = sorted(d['red'])
        if any(rs[i + 1] - rs[i] == 1 for i in range(5)):
            consec_count += 1
        tails = [r % 10 for r in rs]
        if len(set(tails)) < len(tails):
            same_tail_count += 1
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

    def fmt(values):
        return {str(key).zfill(2): value for key, value in sorted(values.items())}
    red_freq_global_full = {str(n).zfill(2): red_freq_global.get(n, 0) for n in range(1, 34)}
    blue_freq_global_full = {str(n).zfill(2): blue_freq_global.get(n, 0) for n in range(1, 17)}
    red_freq_50_full = {str(n).zfill(2): red_freq_50.get(n, 0) for n in range(1, 34)}
    blue_freq_50_full = {str(n).zfill(2): blue_freq_50.get(n, 0) for n in range(1, 17)}
    red_freq_100_full = {str(n).zfill(2): red_freq_100.get(n, 0) for n in range(1, 34)}
    blue_freq_100_full = {str(n).zfill(2): blue_freq_100.get(n, 0) for n in range(1, 17)}

    return {
        'schema_version': SCHEMA_VERSION,
        'pipeline_version': PIPELINE_VERSION,
        'generated_at': generated_at or utc_now(),
        'source': source,
        'updated': draws[-1]['date'],
        'latest_issue': draws[-1]['issue'],
        'latest_date': draws[-1]['date'],
        'total': total,
        'red_freq_global': red_freq_global_full,
        'red_freq_50': red_freq_50_full,
        'red_freq_100': red_freq_100_full,
        'blue_freq_global': blue_freq_global_full,
        'blue_freq_50': blue_freq_50_full,
        'blue_freq_100': blue_freq_100_full,
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
    baseline_errors = verify_history_against_baseline(draws)
    if baseline_errors:
        raise SystemExit('❌ 历史数据保护检查失败: ' + '; '.join(baseline_errors))
    if not draws:
        raise SystemExit('❌ 无有效历史数据')
    print(f'📊 计算统计数据 ({len(draws)} 期)...')

    source = resolve_source_label()
    manifest = build_manifest(draws, source)
    generated_at = manifest['generated_at']
    stats = calc_stats(draws, generated_at=generated_at, source=source)
    if write_if_changed(STATS_FILE, stats):
        print('✅ stats.json 已更新')
    else:
        print('⏭  stats.json 未变化（跳过写入）')

    latest = {
        'schema_version': SCHEMA_VERSION,
        'pipeline_version': PIPELINE_VERSION,
        'generated_at': generated_at,
        'source': source,
        'latest_draw': draws[-1],
        'latest_issue': draws[-1]['issue'],
        'latest_date': draws[-1]['date'],
        'updated': draws[-1]['date'],
        'total': len(draws),
    }
    if write_if_changed(LATEST_FILE, latest):
        print('✅ latest.json 已更新')
    else:
        print('⏭  latest.json 未变化（跳过写入）')
    if write_if_changed(MANIFEST_FILE, manifest):
        print('✅ manifest.json 已更新')
    else:
        print('⏭  manifest.json 未变化（跳过写入）')
    print(f'🎰 最新一期: {draws[-1]["issue"]} ({draws[-1]["date"]})')
    print(f'   红球: {draws[-1]["red"]}  蓝球: {draws[-1]["blue"]}')


if __name__ == '__main__':
    main()
