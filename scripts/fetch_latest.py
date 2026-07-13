#!/usr/bin/env python3
"""
从网络抓取最新双色球开奖数据，覆盖更新按年存储的历史数据
写入: data/history/{year}.json + data/history_index.json

更新策略: 增量追加 + 同期号覆盖 + 按内容比对写入
  - 新期号 → 追加
  - 已有期号 → 用最新数据覆盖（确保数据勘误能同步）
  - 写入前 byte 级比对：内容未变化的年份文件跳过写入

支持多数据源自动切换:
  1. 500 彩票网 (datachart.500.com) — 海外可用，HTML 表格解析
  2. 福彩官方 API (cwl.gov.cn) — 国内 IP 可用
  3. 备用 API (idcd.com) — 第三方 JSON
"""

import json
import os
import re
import sys
import glob
import time
import requests
from collections import defaultdict

from _paths import DATA_DIR, HISTORY_DIR, INDEX_FILE
from _utils import write_if_changed
from schema import make_draw, validate_draw

COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}


def load_all_draws():
    """从按年文件中加载全部历史数据，返回 dict（issue → draw）便于覆盖"""
    draws_map = {}
    if not os.path.isdir(HISTORY_DIR):
        return draws_map
    for fpath in sorted(glob.glob(os.path.join(HISTORY_DIR, '*.json'))):
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, list):
                for d in data:
                    draws_map[d['issue']] = d
            else:
                print(f'⚠️ 跳过格式异常的文件(非列表): {os.path.basename(fpath)}')
        except (json.JSONDecodeError, ValueError) as e:
            print(f'⚠️ 跳过损坏的 JSON 文件: {os.path.basename(fpath)} ({e})')
        except Exception as e:
            print(f'⚠️ 读取文件失败: {os.path.basename(fpath)} ({e})')
    return draws_map


# ───────── 数据源 1: 福彩官方 ─────────
def fetch_from_cwl(session=None):
    """从福彩官网 API 获取数据"""
    url = 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'
    params = {'name': 'ssq', 'issueCount': 30}
    headers = {
        **COMMON_HEADERS,
        'Referer': 'https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/',
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
    }
    try:
        if session is None:
            session = requests.Session()
            session.headers.update(COMMON_HEADERS)
            try:
                session.get('https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/', timeout=15)
            except Exception:
                pass
        resp = session.get(url, params=params, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        draws = []
        for item in data.get('result', []):
            red = sorted([int(x) for x in item['red'].split(',')])
            draws.append(make_draw(
                issue=item['code'],
                date=item['date'][:10],
                red=red,
                blue=int(item['blue']),
            ))
        if draws:
            print(f'  ✅ 福彩官方 API 返回 {len(draws)} 期')
        return draws
    except Exception as e:
        print(f'  ⚠️ 福彩官方 API 失败: {e}')
        return []


# ───────── 数据源 2: idcd.com 备用 ─────────
def fetch_from_idcd(session=None):
    """从 idcd.com 备用 API 获取数据"""
    url = 'https://www.idcd.com/api/welfare-lottery'
    params = {'type': 'ssq', 'limit': 30}
    try:
        fetcher = session if session else requests.Session()
        resp = fetcher.get(url, params=params, headers=COMMON_HEADERS, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        draws = []
        items = data.get('data', [])
        if not items:
            print(f'  ⚠️ idcd.com API 返回数据为空')
            return []
        for item in items:
            try:
                red_raw = item.get('red', '')
                if isinstance(red_raw, str):
                    red = sorted([int(x) for x in red_raw.split(',')])
                else:
                    red = sorted([int(x) for x in red_raw])
                blue_raw = item.get('blue', '')
                blue = int(blue_raw) if isinstance(blue_raw, str) else blue_raw
                issue = item.get('issue', item.get('code', ''))
                date = item.get('date', '')[:10]
                if red and blue and issue and date:
                    draws.append(make_draw(issue=issue, date=date, red=red, blue=blue))
            except (ValueError, TypeError, KeyError):
                continue
        if draws:
            print(f'  ✅ idcd.com 备用 API 返回 {len(draws)} 期')
        return draws
    except Exception as e:
        print(f'  ⚠️ idcd.com 备用 API 失败: {e}')
        return []


# ───────── 数据源 3: 500 彩票网 ─────────
_RE_ROW = re.compile(r'<tr class="t_tr1">.*?</tr>', re.DOTALL)
_RE_RED = re.compile(r'<td class="t_cfont2">(\d+)</td>')
_RE_BLUE = re.compile(r'<td class="t_cfont4">(\d+)</td>')
_RE_ISSUE = re.compile(r'<td>(\d{5})</td>')
_RE_DATE = re.compile(r'<td>(\d{4}-\d{2}-\d{2})</td>')


def fetch_from_500(session=None):
    """从 500 彩票网 datachart 获取数据（解析 HTML 表格）"""
    url = 'https://datachart.500.com/ssq/history/newinc/history.php'
    params = {'start': '03001', 'end': '99999', 'limit': 30}
    try:
        fetcher = session if session else requests.Session()
        resp = fetcher.get(url, params=params, headers=COMMON_HEADERS, timeout=30)
        resp.raise_for_status()
        html = resp.text
        rows = _RE_ROW.findall(html)
        if not rows:
            print('  ⚠️ 500 彩票网 未匹配到数据行')
            return []
        draws = []
        for row in rows:
            issue_m = _RE_ISSUE.search(row)
            reds = _RE_RED.findall(row)
            blue_m = _RE_BLUE.search(row)
            date_m = _RE_DATE.search(row)
            if not (issue_m and len(reds) == 6 and blue_m and date_m):
                continue
            short_issue = issue_m.group(1)
            date = date_m.group(1)
            year = date[:4]
            issue = year[:2] + short_issue
            draws.append(make_draw(
                issue=issue,
                date=date,
                red=[int(x) for x in reds],
                blue=int(blue_m.group(1)),
            ))
        draws.sort(key=lambda x: x['issue'])
        if draws:
            print(f'  ✅ 500 彩票网 返回 {len(draws)} 期 (最新 {draws[-1]["issue"]})')
        return draws
    except Exception as e:
        print(f'  ⚠️ 500 彩票网 失败: {e}')
        return []


def fetch_latest_draws(session=None):
    """依次尝试多个数据源，返回获取到的开奖数据

    优先级: 500 彩票网 → 福彩官方 → idcd.com
    接收可选的 session 参数，支持测试注入。
    """
    sources = [
        ('500 彩票网', fetch_from_500),
        ('福彩官方', fetch_from_cwl),
        ('idcd.com', fetch_from_idcd),
    ]
    for name, fetcher in sources:
        print(f'🔄 尝试数据源: {name}')
        draws = fetcher(session=session)
        if draws:
            return draws
        time.sleep(1)
    return []


def merge_draws(draws_map, new_draws):
    """合并新旧数据（新增 + 覆盖更新已有期号）"""
    added = 0
    updated = 0
    for d in new_draws:
        if not validate_draw(d):
            continue
        issue = d['issue']
        if issue not in draws_map:
            draws_map[issue] = d
            added += 1
        elif draws_map[issue] != d:
            draws_map[issue] = d
            updated += 1
    return added, updated


def draws_map_to_sorted_list(draws_map):
    """将 dict 转为按期号排序的列表"""
    return sorted(draws_map.values(), key=lambda x: x['issue'])


def save_by_year(all_draws):
    """按年份写入文件 + 更新索引（仅写入实际有变化的文件）"""
    os.makedirs(HISTORY_DIR, exist_ok=True)

    by_year = defaultdict(list)
    for d in all_draws:
        year = d['date'][:4]
        by_year[year].append(d)

    years_info = []
    written_years = []
    skipped_years = []
    for year in sorted(by_year.keys()):
        year_draws = by_year[year]
        year_file = os.path.join(HISTORY_DIR, f'{year}.json')
        if write_if_changed(year_file, year_draws):
            written_years.append(year)
        else:
            skipped_years.append(year)
        years_info.append({
            'year': year,
            'count': len(year_draws),
            'range': [year_draws[0]['date'], year_draws[-1]['date']],
        })

    index = {
        'total': len(all_draws),
        'range': [all_draws[0]['date'], all_draws[-1]['date']],
        'years': years_info,
    }
    index_changed = write_if_changed(INDEX_FILE, index)

    if written_years:
        print(f'   ✏️  写入 {len(written_years)} 个年份文件: {", ".join(written_years)}')
    if skipped_years:
        print(f'   ⏭  跳过 {len(skipped_years)} 个未变化的年份文件')
    print(f'   📑 history_index.json: {"已更新" if index_changed else "未变化（跳过）"}')

    return years_info


# ───────── 内建重试 ─────────
RETRY_DELAY = 45 * 60  # 45 分钟
MAX_RETRIES = 1


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    draws_map = load_all_draws()
    sorted_issues = sorted(draws_map.keys())
    last_issue = sorted_issues[-1] if sorted_issues else 'N/A'
    print(f'📦 当前数据: {len(draws_map)} 期, 最新: {last_issue}')

    # retry loop: attempt 0 → 立即抓取, attempt 1 → sleep 45min 后重试
    for attempt in range(MAX_RETRIES + 1):
        if attempt > 0:
            print(f'\n⏳ 首次抓取失败，{RETRY_DELAY // 60} 分钟后重试...')
            time.sleep(RETRY_DELAY)

        new_draws = fetch_latest_draws()
        if not new_draws:
            if attempt < MAX_RETRIES:
                continue  # 回到循环顶部 sleep 后重试
            print('❌ 所有数据源均未获取到新数据，跳过本次更新')
            sys.exit(0)

        print(f'🌐 共获取 {len(new_draws)} 期数据')
        added, updated = merge_draws(draws_map, new_draws)

        if added == 0 and updated == 0:
            print('✅ 没有新数据需要更新，也没有数据变更')
            sys.exit(0)

        all_draws = draws_map_to_sorted_list(draws_map)
        years_info = save_by_year(all_draws)

        total = len(all_draws)
        print(f'✅ 新增 {added} 期, 覆盖更新 {updated} 期, 共 {total} 期')
        print(f'   最新: {all_draws[-1]["issue"]} ({all_draws[-1]["date"]})')
        print(f'   涉及年份: {", ".join(y["year"] for y in years_info)}')
        return

    sys.exit(1)


if __name__ == '__main__':
    main()
