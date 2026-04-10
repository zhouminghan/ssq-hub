#!/usr/bin/env python3
"""
数据完整性自检脚本（由 GitHub Actions 调用，也可本地运行）
校验项:
  1. history_index.json 完整性
  2. 各年份 JSON 文件格式与一致性
  3. stats.json 与 latest.json 一致性
  4. README.md 期数一致性
  5. 数据记录格式校验（红球/蓝球范围）
"""

import json
import os
import re
import sys
import glob

BASE_DIR = os.path.join(os.path.dirname(__file__), '..')
DATA_DIR = os.path.join(BASE_DIR, 'data')
HISTORY_DIR = os.path.join(DATA_DIR, 'history')
INDEX_FILE = os.path.join(DATA_DIR, 'history_index.json')
README_PATH = os.path.join(BASE_DIR, 'README.md')

errors = []
warnings = []


def check(condition, msg, is_warning=False):
    """断言检查，失败时记录而非立即退出"""
    if not condition:
        if is_warning:
            warnings.append(f'⚠️  {msg}')
            print(f'  ⚠️  {msg}')
        else:
            errors.append(f'❌ {msg}')
            print(f'  ❌ {msg}')
        return False
    return True


def verify_index():
    """校验 history_index.json"""
    print('\n🔍 [1/5] 校验 history_index.json ...')
    if not check(os.path.exists(INDEX_FILE), 'history_index.json 不存在'):
        return None

    with open(INDEX_FILE, 'r', encoding='utf-8') as f:
        idx = json.load(f)

    check('total' in idx, 'history_index.json 缺少 total 字段')
    check('range' in idx, 'history_index.json 缺少 range 字段')
    check('years' in idx, 'history_index.json 缺少 years 字段')
    check(isinstance(idx.get('years', []), list), 'years 应为数组')
    check(idx.get('total', 0) > 0, f'total={idx.get("total")} 不合理，应大于 0')

    # 年份之和应等于 total
    year_sum = sum(y.get('count', 0) for y in idx.get('years', []))
    check(year_sum == idx.get('total', 0),
          f'各年份 count 之和 ({year_sum}) != total ({idx.get("total")})')

    print(f'  ✅ history_index.json: {idx["total"]} 期, {len(idx["years"])} 个年份')
    return idx


def verify_history_files(idx):
    """校验各年份历史文件"""
    print('\n🔍 [2/5] 校验历史数据文件 ...')
    year_files = sorted(glob.glob(os.path.join(HISTORY_DIR, '*.json')))
    check(len(year_files) > 0, '没有找到任何年份数据文件')

    total_draws = 0
    all_issues = set()
    bad_records = 0

    for fpath in year_files:
        fname = os.path.basename(fpath)
        with open(fpath, 'r', encoding='utf-8') as f:
            draws = json.load(f)

        check(isinstance(draws, list), f'{fname} 不是数组格式')
        total_draws += len(draws)

        for d in draws:
            # 格式校验
            has_fields = all(k in d for k in ('issue', 'date', 'red', 'blue'))
            if not has_fields:
                bad_records += 1
                continue

            # 红球: 6个，范围1-33
            if not (isinstance(d['red'], list) and len(d['red']) == 6):
                bad_records += 1
                continue
            if not all(1 <= r <= 33 for r in d['red']):
                bad_records += 1
                continue

            # 蓝球: 1个，范围1-16
            if not (isinstance(d['blue'], int) and 1 <= d['blue'] <= 16):
                bad_records += 1
                continue

            # 期号唯一性
            if d['issue'] in all_issues:
                check(False, f'发现重复期号: {d["issue"]}', is_warning=True)
            all_issues.add(d['issue'])

    check(bad_records == 0,
          f'有 {bad_records} 条记录格式异常（红球非6个/范围越界/蓝球越界）',
          is_warning=(bad_records < 5))

    if idx:
        check(total_draws == idx['total'],
              f'历史文件总期数 ({total_draws}) != index.total ({idx["total"]})')

    print(f'  ✅ 历史文件: {len(year_files)} 个, 共 {total_draws} 期, 格式异常 {bad_records} 条')
    return total_draws


def verify_stats_latest(idx):
    """校验 stats.json 和 latest.json"""
    print('\n🔍 [3/5] 校验 stats.json 和 latest.json ...')

    stats_path = os.path.join(DATA_DIR, 'stats.json')
    latest_path = os.path.join(DATA_DIR, 'latest.json')

    # stats.json
    if check(os.path.exists(stats_path), 'stats.json 不存在'):
        with open(stats_path, 'r', encoding='utf-8') as f:
            stats = json.load(f)

        check('total' in stats, 'stats.json 缺少 total 字段')
        check('latest_issue' in stats, 'stats.json 缺少 latest_issue 字段')
        check('red_scores' in stats, 'stats.json 缺少 red_scores 字段')
        check('blue_scores' in stats, 'stats.json 缺少 blue_scores 字段')

        if idx:
            check(stats.get('total') == idx['total'],
                  f'stats.total ({stats.get("total")}) != index.total ({idx["total"]})')

        print(f'  ✅ stats.json: total={stats.get("total")}, latest={stats.get("latest_issue")}')

    # latest.json
    if check(os.path.exists(latest_path), 'latest.json 不存在'):
        with open(latest_path, 'r', encoding='utf-8') as f:
            latest = json.load(f)

        check('latest_draw' in latest, 'latest.json 缺少 latest_draw')
        check('picks' in latest, 'latest.json 缺少 picks')
        picks = latest.get('picks', {})

        # 单式方案校验 (plan_a ~ plan_c)
        for plan in ['plan_a', 'plan_b', 'plan_c']:
            if check(plan in picks, f'latest.json 缺少 picks.{plan}'):
                p = picks[plan]
                check(p.get('type') == 'single',
                      f'{plan}.type 应为 "single"，实际为 "{p.get("type")}"',
                      is_warning=True)
                check(isinstance(p.get('red'), list) and len(p['red']) == 6,
                      f'{plan}.red 不是6个红球')
                check(isinstance(p.get('blue'), int) and 1 <= p['blue'] <= 16,
                      f'{plan}.blue 不在1-16范围')
                # 红球范围校验
                if isinstance(p.get('red'), list):
                    check(all(1 <= r <= 33 for r in p['red']),
                          f'{plan}.red 中存在超出1-33范围的号码')
                    check(len(set(p['red'])) == len(p['red']),
                          f'{plan}.red 中存在重复号码')

        # 复式方案校验 (plan_d ~ plan_e)
        for plan in ['plan_d', 'plan_e']:
            if check(plan in picks, f'latest.json 缺少 picks.{plan}'):
                p = picks[plan]
                check(p.get('type') == 'complex',
                      f'{plan}.type 应为 "complex"，实际为 "{p.get("type")}"',
                      is_warning=True)

                # 红球: 7~20个，范围1-33
                red = p.get('red', [])
                check(isinstance(red, list) and 7 <= len(red) <= 20,
                      f'{plan}.red 应为7-20个红球，实际 {len(red) if isinstance(red, list) else "非数组"}')
                if isinstance(red, list):
                    check(all(1 <= r <= 33 for r in red),
                          f'{plan}.red 中存在超出1-33范围的号码')
                    check(len(set(red)) == len(red),
                          f'{plan}.red 中存在重复号码')

                # 蓝球: 可以是单个int或数组
                blue = p.get('blue')
                if isinstance(blue, list):
                    check(len(blue) >= 1 and len(blue) <= 16,
                          f'{plan}.blue 数组长度应为1-16，实际 {len(blue)}')
                    check(all(isinstance(b, int) and 1 <= b <= 16 for b in blue),
                          f'{plan}.blue 数组中存在超出1-16范围的号码')
                    check(len(set(blue)) == len(blue),
                          f'{plan}.blue 数组中存在重复号码')
                elif isinstance(blue, int):
                    check(1 <= blue <= 16,
                          f'{plan}.blue={blue} 不在1-16范围')
                else:
                    check(False, f'{plan}.blue 类型异常：{type(blue).__name__}')

                # 注数与费用校验
                if isinstance(red, list) and len(red) >= 7:
                    from math import comb
                    blue_count = len(blue) if isinstance(blue, list) else 1
                    expected_notes = comb(len(red), 6) * blue_count
                    actual_notes = p.get('note_count')
                    if actual_notes is not None:
                        check(actual_notes == expected_notes,
                              f'{plan}.note_count={actual_notes}，期望 C({len(red)},6)×{blue_count}={expected_notes}',
                              is_warning=True)
                    actual_cost = p.get('cost')
                    if actual_cost is not None:
                        check(actual_cost == expected_notes * 2,
                              f'{plan}.cost={actual_cost}，期望 {expected_notes}×2={expected_notes*2}',
                              is_warning=True)

        print(f'  ✅ latest.json: 推荐期号={picks.get("target_issue")}, 单式×3 + 复式×2')


def verify_readme(idx):
    """校验 README 中的期数是否与实际一致"""
    print('\n🔍 [4/5] 校验 README.md 期数一致性 ...')

    if not os.path.exists(README_PATH):
        check(False, 'README.md 不存在')
        return

    with open(README_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    total = idx['total'] if idx else None
    if not total:
        print('  ⏭️  无法获取 total，跳过 README 校验')
        return

    # 检查 badge 中的期数
    badge_match = re.search(r'数据量[-_](\d+)期', content)
    if badge_match:
        badge_num = int(badge_match.group(1))
        check(badge_num == total,
              f'README badge 期数 ({badge_num}) != 实际 ({total})',
              is_warning=True)

    # 检查正文中的期数
    text_match = re.search(r'当前共 \*\*(\d+)\*\* 期', content)
    if text_match:
        text_num = int(text_match.group(1))
        check(text_num == total,
              f'README 正文期数 ({text_num}) != 实际 ({total})',
              is_warning=True)

    # 检查功能表格中的期数
    table_match = re.search(r'(\d+) 期开奖数据，支持按期号', content)
    if table_match:
        table_num = int(table_match.group(1))
        check(table_num == total,
              f'README 表格期数 ({table_num}) != 实际 ({total})',
              is_warning=True)

    print(f'  ✅ README.md 期数一致性检查完成')


def verify_file_structure():
    """校验项目必要文件是否齐全"""
    print('\n🔍 [5/5] 校验项目文件结构 ...')

    required_files = [
        'index.html',
        'css/style.css',
        'js/app.js',
        'data/history_index.json',
        'data/stats.json',
        'data/latest.json',
        'scripts/fetch_latest.py',
        'scripts/calc_all.py',
        'scripts/update_readme.py',
        '.github/workflows/update_data.yml',
    ]

    missing = []
    for f in required_files:
        fpath = os.path.join(BASE_DIR, f)
        if not os.path.exists(fpath):
            missing.append(f)

    check(len(missing) == 0, f'缺少必要文件: {", ".join(missing)}')
    print(f'  ✅ 项目结构: {len(required_files)} 个必要文件均存在')


def main():
    print('=' * 50)
    print('🔬 SSQ-Hub 数据完整性自检')
    print('=' * 50)

    idx = verify_index()
    verify_history_files(idx)
    verify_stats_latest(idx)
    verify_readme(idx)
    verify_file_structure()

    # 汇总
    print('\n' + '=' * 50)
    if errors:
        print(f'💥 自检失败: {len(errors)} 个错误, {len(warnings)} 个警告')
        for e in errors:
            print(f'  {e}')
        for w in warnings:
            print(f'  {w}')
        sys.exit(1)
    elif warnings:
        print(f'✅ 自检通过（{len(warnings)} 个警告）')
        for w in warnings:
            print(f'  {w}')
    else:
        print('🎉 自检全部通过，数据完整无误！')

    sys.exit(0)


if __name__ == '__main__':
    main()
