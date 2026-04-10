#!/usr/bin/env python3
"""
自动更新 README.md 中的动态信息（由 GitHub Actions 调用）
读取 history_index.json + stats.json，替换 README 中的:
  1. Shield badge 中的数据量
  2. 正文中的 "当前共 **XXXX** 期"
  3. 功能特性表格中的期数
  4. 数据覆盖日期范围
"""

import json
import os
import re

BASE_DIR = os.path.join(os.path.dirname(__file__), '..')
DATA_DIR = os.path.join(BASE_DIR, 'data')
README_PATH = os.path.join(BASE_DIR, 'README.md')


def get_data_info():
    """从 history_index.json 和 stats.json 获取最新数据信息"""
    index_path = os.path.join(DATA_DIR, 'history_index.json')
    with open(index_path, 'r', encoding='utf-8') as f:
        index = json.load(f)

    stats_path = os.path.join(DATA_DIR, 'stats.json')
    latest_issue = None
    if os.path.exists(stats_path):
        with open(stats_path, 'r', encoding='utf-8') as f:
            stats = json.load(f)
        latest_issue = stats.get('latest_issue')

    return {
        'total': index['total'],
        'date_start': index['range'][0],
        'date_end': index['range'][1],
        'latest_issue': latest_issue,
    }


def update_readme(info):
    """更新 README.md 中的动态数据"""
    with open(README_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    total = info['total']
    date_start = info['date_start']
    date_end = info['date_end']
    changes = []

    # 1. 更新 badge: [![Data](...数据量-XXXX期-red...)]
    new_content = re.sub(
        r'(img\.shields\.io/badge/📊_数据量-)\d+期',
        rf'\g<1>{total}期',
        content
    )
    if new_content != content:
        changes.append('badge 期数')
    content = new_content

    # 2. 更新正文: 当前共 **XXXX** 期完整开奖记录
    new_content = re.sub(
        r'当前共 \*\*\d+\*\* 期完整开奖记录',
        f'当前共 **{total}** 期完整开奖记录',
        content
    )
    if new_content != content:
        changes.append('正文期数')
    content = new_content

    # 3. 更新功能特性表格: XXXX 期开奖数据
    new_content = re.sub(
        r'\d+ 期开奖数据，支持按期号',
        f'{total} 期开奖数据，支持按期号',
        content
    )
    if new_content != content:
        changes.append('表格期数')
    content = new_content

    # 4. 更新数据覆盖日期范围: **2003-02-23 ~ 至今**
    new_content = re.sub(
        r'\*\*\d{4}-\d{2}-\d{2} ~ 至今\*\*',
        f'**{date_start} ~ 至今**',
        content
    )
    if new_content != content:
        changes.append('日期范围')
    content = new_content

    # 5. 更新项目结构注释中的期数（如有）
    new_content = re.sub(
        r'全部历史开奖数据（\d+ 期）',
        f'全部历史开奖数据（{total} 期）',
        content
    )
    if new_content != content:
        changes.append('结构注释期数')
    content = new_content

    if content != original:
        with open(README_PATH, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'✅ README.md 已更新: {", ".join(changes)}')
        print(f'   期数: {total} | 日期范围: {date_start} ~ {date_end}')
    else:
        print(f'ℹ️  README.md 已是最新，无需更新 (期数={total})')


def main():
    info = get_data_info()
    print(f'📊 当前数据: {info["total"]} 期, 范围 {info["date_start"]} ~ {info["date_end"]}')
    if info['latest_issue']:
        print(f'   最新期号: {info["latest_issue"]}')
    update_readme(info)


if __name__ == '__main__':
    main()
