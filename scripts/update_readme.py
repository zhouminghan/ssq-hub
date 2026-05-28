#!/usr/bin/env python3
"""
README 数据展示约定（已简化）

旧版本会把"数据量 XXXX 期 / 时间范围 / 最新期号"写入 README，
导致每次开奖后 README 都会被自动改一笔，diff 噪音大且不必要。

新版本：README 顶部用 shields.io dynamic JSON badge 实时拉取
       https://zhouminghan.github.io/ssq-hub/data/latest.json
       的 `total` 与 `latest_draw.issue` 字段，README 本身不再变动。

本脚本保留为 no-op，仅打印当前数据摘要供 Actions 日志参考。
保留入口避免 workflow yaml 联动改动。
"""

import json
import os

BASE_DIR = os.path.join(os.path.dirname(__file__), '..')
DATA_DIR = os.path.join(BASE_DIR, 'data')


def main():
    index_path = os.path.join(DATA_DIR, 'history_index.json')
    stats_path = os.path.join(DATA_DIR, 'stats.json')

    if not os.path.exists(index_path):
        print('ℹ️  history_index.json 不存在，跳过')
        return

    with open(index_path, 'r', encoding='utf-8') as f:
        index = json.load(f)

    latest_issue = None
    if os.path.exists(stats_path):
        with open(stats_path, 'r', encoding='utf-8') as f:
            latest_issue = json.load(f).get('latest_issue')

    summary = (
        f'📊 当前数据: {index["total"]} 期, '
        + f'范围 {index["range"][0]} ~ {index["range"][1]}, '
        + f'最新 {latest_issue or "N/A"}'
    )
    print(summary)
    print('ℹ️  README 已采用 shields.io dynamic badge，无需写回（no-op）')


if __name__ == '__main__':
    main()
