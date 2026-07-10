"""项目共用工具函数"""
import json
import os


def write_if_changed(filepath, new_content, indent=2):
    """不变式：读旧 → 字符串比较 → 不等才写。破坏会让 mtime 失真。"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            old = f.read()
        if json.dumps(json.loads(old), ensure_ascii=False, indent=indent) == json.dumps(new_content, ensure_ascii=False, indent=indent):
            return False
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(new_content, f, ensure_ascii=False, indent=indent)
    return True
