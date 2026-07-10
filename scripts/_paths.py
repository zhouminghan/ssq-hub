"""项目共用路径常量"""
import os

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT_DIR, 'web', 'data')
HISTORY_DIR = os.path.join(DATA_DIR, 'history')
INDEX_FILE = os.path.join(DATA_DIR, 'history_index.json')
STATS_FILE = os.path.join(DATA_DIR, 'stats.json')
LATEST_FILE = os.path.join(DATA_DIR, 'latest.json')
