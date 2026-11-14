"""项目共用工具函数"""
import json
import os
import tempfile


def write_if_changed(filepath, content, indent=2):
    """不变式：读旧 → 字符串比较 → 不等才写。破坏会让 mtime 失真。

    content 可以是:
      - str: 直接写入和比较
      - dict / list / 其他: JSON 序列化后写入和比较
    """
    if isinstance(content, str):
        new_payload = content
    else:
        new_payload = json.dumps(content, ensure_ascii=False, indent=indent)

    if os.path.exists(filepath):
        try:
            with open(filepath, encoding='utf-8') as f:
                if f.read() == new_payload:
                    return False
        except Exception:
            pass

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    # Atomic replacement prevents a killed process from truncating a year file.
    fd, temp_path = tempfile.mkstemp(
        prefix=f'.{os.path.basename(filepath)}.',
        suffix='.tmp',
        dir=os.path.dirname(filepath),
        text=True,
    )
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(new_payload)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp_path, filepath)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)
    return True
