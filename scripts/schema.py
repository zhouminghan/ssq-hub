"""共享数据模型：Draw 记录的单一真相源

所有脚本（fetch / calc / verify）通过此模块消费和校验 Draw 记录，
增字段只需改此处。
"""

from typing import List, Dict


# ── 字段约束 ──
RED_COUNT = 6
RED_MIN = 1
RED_MAX = 33
BLUE_MIN = 1
BLUE_MAX = 16
ISSUE_LEN = 7  # 期号固定 7 位（如 2026075）


def validate_draw(d: dict) -> bool:
    """校验一条开奖记录是否合法。

    规则：issue/date/red/blue 四字段齐全，
    红球 6 个 1-33，蓝球 1 个 1-16。
    """
    if not isinstance(d, dict):
        return False
    if not all(k in d for k in ('issue', 'date', 'red', 'blue')):
        return False
    if not (isinstance(d['red'], list) and len(d['red']) == RED_COUNT):
        return False
    if not all(isinstance(r, int) and RED_MIN <= r <= RED_MAX for r in d['red']):
        return False
    if not (isinstance(d['blue'], int) and BLUE_MIN <= d['blue'] <= BLUE_MAX):
        return False
    return True


def make_draw(issue: str, date: str, red: List[int], blue: int) -> Dict:
    """构造一条开奖记录（红球自动排序）。"""
    return {
        'issue': str(issue),
        'date': date,
        'red': sorted(red),
        'blue': blue,
    }
