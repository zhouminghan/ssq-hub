#!/usr/bin/env python3
"""
从网络抓取最新双色球开奖数据，增量更新按年存储的历史数据
写入: data/history/{year}.json + data/history_index.json

支持多数据源自动切换:
  1. 福彩官方 API (cwl.gov.cn) — 国内首选
  2. 备用 API (idcd.com) — 海外 GitHub Actions 可用
"""

import json
import os
import sys
import glob
import time
import requests
from collections import defaultdict

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
HISTORY_DIR = os.path.join(DATA_DIR, 'history')
INDEX_FILE = os.path.join(DATA_DIR, 'history_index.json')

COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}


def load_all_draws():
    """从按年文件中加载全部历史数据"""
    all_draws = []
    if not os.path.isdir(HISTORY_DIR):
        return all_draws
    for fpath in sorted(glob.glob(os.path.join(HISTORY_DIR, '*.json'))):
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, list):
                all_draws.extend(data)
            else:
                print(f'⚠️ 跳过格式异常的文件(非列表): {os.path.basename(fpath)}')
        except (json.JSONDecodeError, ValueError) as e:
            print(f'⚠️ 跳过损坏的 JSON 文件: {os.path.basename(fpath)} ({e})')
        except Exception as e:
            print(f'⚠️ 读取文件失败: {os.path.basename(fpath)} ({e})')
    return all_draws


# ───────── 数据源 1: 福彩官方 ─────────
def fetch_from_cwl():
    """从福彩官网 API 获取数据"""
    url = 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'
    params = {'name': 'ssq', 'issueCount': 30}
    headers = {**COMMON_HEADERS, 'Referer': 'https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/'}
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=30)
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


# ───────── 数据源 3: mxnzp.com 备用 ─────────
def fetch_from_mxnzp():
    """从 mxnzp.com 通用彩票 API 获取数据"""
    url = 'https://www.mxnzp.com/api/lottery/common/latest'
    params = {'code': 'ssq'}
    try:
        resp = requests.get(url, params=params, headers=COMMON_HEADERS, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if data.get('code') != 1:
            print(f'  ⚠️ mxnzp.com API 返回错误: {data.get("msg")}')
            return []
        item = data.get('data', {})
        if not item:
            return []
        try:
            opencode = item.get('openCode', '')
            parts = opencode.split('+')
            red = sorted([int(x) for x in parts[0].split(',')])
            blue = int(parts[1].strip()) if len(parts) > 1 else 0
            issue = item.get('expect', '')
            date = item.get('openTime', '')[:10]
            if red and blue and issue and date:
                print(f'  ✅ mxnzp.com API 返回 1 期 (最新期)')
                return [{'issue': issue, 'date': date, 'red': red, 'blue': blue}]
        except (ValueError, TypeError, IndexError):
            pass
        return []
    except Exception as e:
        print(f'  ⚠️ mxnzp.com API 失败: {e}')
        return []


def fetch_latest_draws():
    """依次尝试多个数据源，返回获取到的开奖数据"""
    sources = [
        ('福彩官方', fetch_from_cwl),
        ('idcd.com', fetch_from_idcd),
        ('mxnzp.com', fetch_from_mxnzp),
    ]
    for name, fetcher in sources:
        print(f'🔄 尝试数据源: {name}')
        draws = fetcher()
        if draws:
            return draws
        time.sleep(1)  # 间隔 1 秒再试下一个源
    return []


def merge_draws(existing, new_draws):
    """合并新旧数据（去重）"""
    existing_issues = {d['issue'] for d in existing}
    added = 0
    for d in new_draws:
        if d['issue'] not in existing_issues:
            existing.append(d)
            existing_issues.add(d['issue'])
            added += 1
    # 按期号排序
    existing.sort(key=lambda x: x['issue'])
    return added


def save_by_year(all_draws):
    """按年份写入文件 + 更新索引"""
    os.makedirs(HISTORY_DIR, exist_ok=True)

    # 按年分组
    by_year = defaultdict(list)
    for d in all_draws:
        year = d['date'][:4]
        by_year[year].append(d)

    # 写入各年文件
    years_info = []
    for year in sorted(by_year.keys()):
        year_draws = by_year[year]
        year_file = os.path.join(HISTORY_DIR, f'{year}.json')
        with open(year_file, 'w', encoding='utf-8') as f:
            json.dump(year_draws, f, ensure_ascii=False, indent=2)
        years_info.append({
            'year': year,
            'count': len(year_draws),
            'range': [year_draws[0]['date'], year_draws[-1]['date']],
        })

    # 写入索引
    index = {
        'total': len(all_draws),
        'range': [all_draws[0]['date'], all_draws[-1]['date']],
        'years': years_info,
    }
    with open(INDEX_FILE, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    return years_info


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    existing_draws = load_all_draws()
    last_issue = existing_draws[-1]['issue'] if existing_draws else 'N/A'
    print(f'📦 当前数据: {len(existing_draws)} 期, 最新: {last_issue}')

    # 抓取新数据 (自动尝试多个数据源)
    new_draws = fetch_latest_draws()
    if not new_draws:
        print('❌ 所有数据源均未获取到新数据，跳过本次更新')
        # 以正常退出码结束，不阻塞 CI 流程
        sys.exit(0)

    print(f'🌐 共获取 {len(new_draws)} 期数据')

    # 合并
    added = merge_draws(existing_draws, new_draws)

    if added == 0:
        print('✅ 没有新数据需要更新')
        sys.exit(2)  # exit(2) = 无新数据，区别于 exit(0)=有新数据, exit(1)=异常

    # 按年保存
    years_info = save_by_year(existing_draws)

    print(f'✅ 新增 {added} 期数据，共 {len(existing_draws)} 期')
    print(f'   最新: {existing_draws[-1]["issue"]} ({existing_draws[-1]["date"]})')
    print(f'   涉及年份: {", ".join(y["year"] for y in years_info)}')


if __name__ == '__main__':
    main()
