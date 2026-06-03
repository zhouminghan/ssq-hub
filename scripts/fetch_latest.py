#!/usr/bin/env python3
"""
从网络抓取最新双色球开奖数据，覆盖更新按年存储的历史数据
写入: data/history/{year}.json + data/history_index.json

更新策略: 增量追加 + 同期号覆盖 + 按内容比对写入
  - 新期号 → 追加
  - 已有期号 → 用最新数据覆盖（确保数据勘误能同步）
  - 写入前 byte 级比对：内容未变化的年份文件跳过写入（节省 IO + mtime 真实反映变更）

支持多数据源自动切换:
  1. 福彩官方 API (cwl.gov.cn) — 国内 IP 首选；GitHub Actions 海外段会 403
  2. 500 彩票网 (datachart.500.com) — 海外可用，HTML 表格解析，无需 key
  3. 备用 API (idcd.com) — 第三方 JSON，曾返回空
"""

import json
import os
import re
import sys
import glob
import time
import requests
from collections import defaultdict

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'web', 'data')
HISTORY_DIR = os.path.join(DATA_DIR, 'history')
INDEX_FILE = os.path.join(DATA_DIR, 'history_index.json')

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
def fetch_from_cwl():
    """从福彩官网 API 获取数据（需先访问首页拿 cookie，否则会 302/403）"""
    url = 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'
    params = {'name': 'ssq', 'issueCount': 30}
    headers = {
        **COMMON_HEADERS,
        'Referer': 'https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/',
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
    }
    try:
        # 关键：先用 session 访问列表页，触发 cookie 下发
        sess = requests.Session()
        sess.headers.update(COMMON_HEADERS)
        try:
            sess.get('https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/', timeout=15)
        except Exception:
            pass  # cookie 拿不到也试一次直连
        resp = sess.get(url, params=params, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        draws = []
        for item in data.get('result', []):
            red = sorted([int(x) for x in item['red'].split(',')])
            blue = int(item['blue'])
            draws.append({
                'issue': item['code'],
                'date': item['date'][:10],
                'red': red,
                'blue': blue
            })
        if draws:
            print(f'  ✅ 福彩官方 API 返回 {len(draws)} 期')
        return draws
    except Exception as e:
        print(f'  ⚠️ 福彩官方 API 失败: {e}')
        return []


# ───────── 数据源 2: idcd.com 备用 ─────────
def fetch_from_idcd():
    """从 idcd.com 备用 API 获取数据（海外可用）"""
    url = 'https://www.idcd.com/api/welfare-lottery'
    params = {'type': 'ssq', 'limit': 30}
    try:
        resp = requests.get(url, params=params, headers=COMMON_HEADERS, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        draws = []
        # idcd.com 返回格式: { code: 0, data: [ {issue, date, red, blue}, ... ] }
        items = data.get('data', [])
        if not items:
            print(f'  ⚠️ idcd.com API 返回数据为空')
            return []
        for item in items:
            try:
                # red 可能是 "01,02,03,04,05,06" 字符串或列表
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
                    draws.append({'issue': issue, 'date': date, 'red': red, 'blue': blue})
            except (ValueError, TypeError, KeyError):
                continue
        if draws:
            print(f'  ✅ idcd.com 备用 API 返回 {len(draws)} 期')
        return draws
    except Exception as e:
        print(f'  ⚠️ idcd.com 备用 API 失败: {e}')
        return []


# ───────── 数据源 3: 500 彩票网 ─────────
# datachart.500.com 返回 HTML 表格，对 UA 宽松、无需 cookie/referer
# 海外（GitHub Actions）实测可用，是 cwl.gov.cn 被 403 时的主力替补
# 行格式（一行一期，紧凑无换行）：
#   <tr class="t_tr1"><!--<td>2</td>--><td>26060</td>
#     <td class="t_cfont2">07</td>...<td class="t_cfont2">27</td>   ← 6 个红球
#     <td class="t_cfont4">11</td>                                   ← 蓝球
#     <td class="t_cfont4">&nbsp;</td><td>奖池</td>...<td>2026-05-28</td>
#   </tr>
_RE_ROW = re.compile(r'<tr class="t_tr1">.*?</tr>', re.DOTALL)
_RE_RED = re.compile(r'<td class="t_cfont2">(\d+)</td>')
_RE_BLUE = re.compile(r'<td class="t_cfont4">(\d+)</td>')
_RE_ISSUE = re.compile(r'<td>(\d{5})</td>')         # 期号 5 位（如 26060）
_RE_DATE = re.compile(r'<td>(\d{4}-\d{2}-\d{2})</td>')


def fetch_from_500():
    """从 500 彩票网 datachart 获取数据（解析 HTML 表格）

    - 一次抓最近 30 期
    - 期号在页面里是 5 位（年份后两位 + 3 位序号），需补全为 7 位（如 26060 → 2026060）
    """
    url = 'https://datachart.500.com/ssq/history/newinc/history.php'
    # start 留空让它默认返回最近期，end 给一个未来值确保覆盖到最新
    # 经测：仅传 limit 不行，需要 start+end；用宽口径让站点自己截最近 30 期
    params = {'start': '03001', 'end': '99999', 'limit': 30}
    try:
        resp = requests.get(url, params=params, headers=COMMON_HEADERS, timeout=30)
        resp.raise_for_status()
        # 站点 charset 是 gb2312，但我们只关心数字和日期 ASCII，不解码也行
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
            short_issue = issue_m.group(1)          # "26060"
            date = date_m.group(1)                  # "2026-05-28"
            year = date[:4]                         # "2026"
            # 补全期号：年份前两位 + 5 位短期号 = 7 位
            issue = year[:2] + short_issue
            draws.append({
                'issue': issue,
                'date': date,
                'red': sorted(int(x) for x in reds),
                'blue': int(blue_m.group(1)),
            })
        # 500 默认按期号倒序，统一翻成升序方便后续合并
        draws.sort(key=lambda x: x['issue'])
        if draws:
            print(f'  ✅ 500 彩票网 返回 {len(draws)} 期 (最新 {draws[-1]["issue"]})')
        return draws
    except Exception as e:
        print(f'  ⚠️ 500 彩票网 失败: {e}')
        return []


def fetch_latest_draws():
    """依次尝试多个数据源，返回获取到的开奖数据"""
    sources = [
        ('500 彩票网', fetch_from_500),
        ('福彩官方', fetch_from_cwl),
        ('idcd.com', fetch_from_idcd),
    ]
    for name, fetcher in sources:
        print(f'🔄 尝试数据源: {name}')
        draws = fetcher()
        if draws:
            return draws
        time.sleep(1)  # 间隔 1 秒再试下一个源
    return []


def merge_draws(draws_map, new_draws):
    """合并新旧数据（新增 + 覆盖更新已有期号）
    
    Returns:
        (added, updated) - 新增期数, 覆盖更新期数
    """
    added = 0
    updated = 0
    for d in new_draws:
        issue = d['issue']
        if issue not in draws_map:
            draws_map[issue] = d
            added += 1
        elif draws_map[issue] != d:
            # 已有期号但数据不同 → 覆盖更新
            draws_map[issue] = d
            updated += 1
    return added, updated


def draws_map_to_sorted_list(draws_map):
    """将 dict 转为按期号排序的列表"""
    return sorted(draws_map.values(), key=lambda x: x['issue'])


def _write_if_changed(path, payload_str):
    """如果磁盘上的文件内容与新内容 byte-级一致则跳过写入

    增量优化：避免每次 fetch 都把全部 24 年文件重写一遍
    - 节省 IO（实际场景下只有当年文件会变）
    - 让 mtime 真实反映"哪一年发生了变更"，便于排查
    - git diff 行为不变（git 本来就按内容比对）

    Returns:
        True 表示实际写入了，False 表示跳过
    """
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                if f.read() == payload_str:
                    return False
        except Exception:
            pass  # 读不到/编码异常 → 走正常写入路径
    with open(path, 'w', encoding='utf-8') as f:
        f.write(payload_str)
    return True


def save_by_year(all_draws):
    """按年份写入文件 + 更新索引（仅写入实际有变化的文件）"""
    os.makedirs(HISTORY_DIR, exist_ok=True)

    # 按年分组
    by_year = defaultdict(list)
    for d in all_draws:
        year = d['date'][:4]
        by_year[year].append(d)

    # 写入各年文件（内容未变则跳过）
    years_info = []
    written_years = []
    skipped_years = []
    for year in sorted(by_year.keys()):
        year_draws = by_year[year]
        year_file = os.path.join(HISTORY_DIR, f'{year}.json')
        payload = json.dumps(year_draws, ensure_ascii=False, indent=2)
        if _write_if_changed(year_file, payload):
            written_years.append(year)
        else:
            skipped_years.append(year)
        years_info.append({
            'year': year,
            'count': len(year_draws),
            'range': [year_draws[0]['date'], year_draws[-1]['date']],
        })

    # 写入索引（同样按内容比对）
    index = {
        'total': len(all_draws),
        'range': [all_draws[0]['date'], all_draws[-1]['date']],
        'years': years_info,
    }
    index_payload = json.dumps(index, ensure_ascii=False, indent=2)
    index_changed = _write_if_changed(INDEX_FILE, index_payload)

    # 增量摘要
    if written_years:
        print(f'   ✏️  写入 {len(written_years)} 个年份文件: {", ".join(written_years)}')
    if skipped_years:
        print(f'   ⏭  跳过 {len(skipped_years)} 个未变化的年份文件')
    print(f'   📑 history_index.json: {"已更新" if index_changed else "未变化（跳过）"}')

    return years_info


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    draws_map = load_all_draws()
    sorted_issues = sorted(draws_map.keys())
    last_issue = sorted_issues[-1] if sorted_issues else 'N/A'
    print(f'📦 当前数据: {len(draws_map)} 期, 最新: {last_issue}')

    # 抓取新数据 (自动尝试多个数据源)
    new_draws = fetch_latest_draws()
    if not new_draws:
        print('❌ 所有数据源均未获取到新数据，跳过本次更新')
        sys.exit(0)

    print(f'🌐 共获取 {len(new_draws)} 期数据')

    # 合并（新增 + 覆盖更新）
    added, updated = merge_draws(draws_map, new_draws)

    if added == 0 and updated == 0:
        print('✅ 没有新数据需要更新，也没有数据变更')
        sys.exit(0)  # 正常退出，不阻塞后续步骤

    # 转为排序列表
    all_draws = draws_map_to_sorted_list(draws_map)

    # 按年保存
    years_info = save_by_year(all_draws)

    total = len(all_draws)
    print(f'✅ 新增 {added} 期, 覆盖更新 {updated} 期, 共 {total} 期')
    print(f'   最新: {all_draws[-1]["issue"]} ({all_draws[-1]["date"]})')
    print(f'   涉及年份: {", ".join(y["year"] for y in years_info)}')


if __name__ == '__main__':
    main()
