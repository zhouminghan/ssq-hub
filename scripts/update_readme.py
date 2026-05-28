#!/usr/bin/env python3
"""
更新 README.md 中的动态数据（由 GitHub Actions 调用）

替换两类占位/标记：
  1. badge: img.shields.io/badge/📊_数据量-XXXX期
  2. <!-- DATA-INFO --> ... <!-- /DATA-INFO --> 之间的内容
"""

import json
import os
import re

BASE_DIR = os.path.join(os.path.dirname(__file__), '..')
DATA_DIR = os.path.join(BASE_DIR, 'data')
README_PATH = os.path.join(BASE_DIR, 'README.md')


def get_data_info():
    with open(os.path.join(DATA_DIR, 'history_index.json'), 'r', encoding='utf-8') as f:
        index = json.load(f)
    latest_issue = None
    stats_path = os.path.join(DATA_DIR, 'stats.json')
    if os.path.exists(stats_path):
        with open(stats_path, 'r', encoding='utf-8') as f:
            latest_issue = json.load(f).get('latest_issue')
    return {
        'total': index['total'],
        'date_start': index['range'][0],
        'date_end': index['range'][1],
        'latest_issue': latest_issue,
    }


def update_readme(info):
    if not os.path.exists(README_PATH):
        print('ℹ️  README.md 不存在，跳过')
        return
    with open(README_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content

    # 1. badge 数据量
    content = re.sub(
        r'(img\.shields\.io/badge/📊_数据量-)\d+期',
        rf'\g<1>{info["total"]}期',
        content,
    )

    # 2. <!-- DATA-INFO --> ... <!-- /DATA-INFO -->
    block = (
        f'<!-- DATA-INFO -->\n'
        f'- 数据期数：**{info["total"]}** 期\n'
        f'- 时间范围：{info["date_start"]} ~ {info["date_end"]}\n'
        f'- 最新期号：{info["latest_issue"] or "N/A"}\n'
        f'<!-- /DATA-INFO -->'
    )
    content = re.sub(
        r'<!-- DATA-INFO -->.*?<!-- /DATA-INFO -->',
        block,
        content,
        flags=re.DOTALL,
    )

    if content != original:
        with open(README_PATH, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'✅ README.md 已更新 (期数={info["total"]})')
    else:
        print(f'ℹ️  README.md 无需更新 (期数={info["total"]})')


def main():
    info = get_data_info()
    print(f'📊 当前数据: {info["total"]} 期, 范围 {info["date_start"]} ~ {info["date_end"]}')
    update_readme(info)


if __name__ == '__main__':
    main()
