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
from datetime import datetime, timedelta

BASE_DIR = os.path.join(os.path.dirname(__file__), '..')
WEB_DIR = os.path.join(BASE_DIR, 'web')
DATA_DIR = os.path.join(WEB_DIR, 'data')
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
    """校验 stats.json 和 latest.json（适配走势图精简版字段）"""
    print('\n🔍 [3/5] 校验 stats.json 和 latest.json ...')

    stats_path = os.path.join(DATA_DIR, 'stats.json')
    latest_path = os.path.join(DATA_DIR, 'latest.json')

    # stats.json：精简版只需要 total / latest_issue / 频次 / 遗漏
    if check(os.path.exists(stats_path), 'stats.json 不存在'):
        with open(stats_path, 'r', encoding='utf-8') as f:
            stats = json.load(f)

        check('total' in stats, 'stats.json 缺少 total 字段')
        check('latest_issue' in stats, 'stats.json 缺少 latest_issue 字段')
        check('red_freq_global' in stats, 'stats.json 缺少 red_freq_global 字段')
        check('blue_freq_global' in stats, 'stats.json 缺少 blue_freq_global 字段')
        check('red_missing' in stats, 'stats.json 缺少 red_missing 字段')
        check('blue_missing' in stats, 'stats.json 缺少 blue_missing 字段')
        # 扩展字段（每号画像 + 模式分布），用于号码画像抽屉
        check('red_per_number' in stats, 'stats.json 缺少 red_per_number 字段')
        check('blue_per_number' in stats, 'stats.json 缺少 blue_per_number 字段')
        rpn = stats.get('red_per_number', {})
        bpn = stats.get('blue_per_number', {})
        check(len(rpn) == 33, f'red_per_number 应有 33 项，当前 {len(rpn)}')
        check(len(bpn) == 16, f'blue_per_number 应有 16 项，当前 {len(bpn)}')
        # 抽样一项校验子字段完整性
        if rpn:
            sample = next(iter(rpn.values()))
            for f in ('freq_global', 'freq_50', 'freq_100', 'current_miss',
                      'max_miss', 'max_miss_issue', 'recent_5_issues'):
                check(f in sample, f'red_per_number 子项缺少 {f} 字段')

        if idx:
            check(stats.get('total') == idx['total'],
                  f'stats.total ({stats.get("total")}) != index.total ({idx["total"]})')

        # 新鲜度：updated 字段距今 ≤ 7 天 → 正常；> 7 天 → 警告；> 30 天 → 错误
        # 防止线上 GitHub Actions 抓数链路坏掉、stats 数月不更新而无人察觉
        updated_str = stats.get('updated', '')
        if updated_str:
            try:
                updated_dt = datetime.strptime(updated_str, '%Y-%m-%d')
                age_days = (datetime.now() - updated_dt).days
                if age_days > 30:
                    check(False,
                          f'stats.json 已 {age_days} 天未更新（updated={updated_str}），'
                          f'数据链路可能已中断')
                elif age_days > 7:
                    check(False,
                          f'stats.json 距今 {age_days} 天未更新（updated={updated_str}），'
                          f'若长时间无开奖请关注',
                          is_warning=True)
                else:
                    print(f'  ✅ stats.json 新鲜度: 距今 {age_days} 天')
            except ValueError:
                check(False,
                      f'stats.json updated 字段格式异常: {updated_str!r}',
                      is_warning=True)

        print(f'  ✅ stats.json: total={stats.get("total")}, latest={stats.get("latest_issue")}')

    # latest.json：精简版仅有 latest_draw + updated + total
    if check(os.path.exists(latest_path), 'latest.json 不存在'):
        with open(latest_path, 'r', encoding='utf-8') as f:
            latest = json.load(f)

        if check('latest_draw' in latest, 'latest.json 缺少 latest_draw'):
            ld = latest['latest_draw']
            check('issue' in ld and 'date' in ld and 'red' in ld and 'blue' in ld,
                  'latest_draw 字段不完整（issue/date/red/blue）')
            if isinstance(ld.get('red'), list):
                check(len(ld['red']) == 6 and all(1 <= r <= 33 for r in ld['red']),
                      'latest_draw.red 不是 6 个合法红球')
            check(isinstance(ld.get('blue'), int) and 1 <= ld['blue'] <= 16,
                  'latest_draw.blue 越界')

        if idx:
            check(latest.get('total') == idx['total'],
                  f'latest.total ({latest.get("total")}) != index.total ({idx["total"]})',
                  is_warning=True)

        print(f'  ✅ latest.json: latest={latest.get("latest_draw", {}).get("issue")}')


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
    """校验项目必要文件是否齐全（动态扫描，避免硬编码遗漏）"""
    print('\n🔍 [5/5] 校验项目文件结构 ...')

    # 1. 关键文件（必须存在，硬编码防止误删核心文件）
    critical_files = [
        'web/index.html',
        'web/.nojekyll',
        'web/js/store.js',
        'web/js/data-loader.js',
        'web/data/history_index.json',
        'web/data/stats.json',
        'web/data/latest.json',
    ]
    missing_critical = [f for f in critical_files if not os.path.exists(os.path.join(BASE_DIR, f))]
    if missing_critical:
        check(False, f'缺少关键文件: {", ".join(missing_critical)}')

    # 2. 历史数据文件（按年存储，至少 1 个）
    history_files = glob.glob(os.path.join(HISTORY_DIR, '*.json'))
    check(len(history_files) >= 1, '缺少 history/*.json 数据文件')

    # 统计（仅展示）
    js_files = glob.glob(os.path.join(WEB_DIR, 'js/**/*.js'), recursive=True)
    css_files = glob.glob(os.path.join(WEB_DIR, 'css/*.css'))
    py_files = glob.glob(os.path.join(BASE_DIR, 'scripts/*.py'))
    yml_files = glob.glob(os.path.join(BASE_DIR, '.github/workflows/*.yml'))
    print(f'  ✅ 项目结构: JS={len(js_files)}, CSS={len(css_files)}, Data={len(history_files)}, Py={len(py_files)}, CI={len(yml_files)}')


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
