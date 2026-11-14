#!/usr/bin/env python3
"""Fetch recent SSQ draws with source cross-checking and protected history.

Normal runs only append new issues. Existing issue content can only be replaced
through the explicit --allow-corrections path, which writes an audit ledger and
requires a human to refresh the protected baseline afterwards.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta, timezone

from _paths import (
    CORRECTIONS_FILE,
    DATA_DIR,
    HISTORY_DIR,
    INDEX_FILE,
    PAUSE_WINDOWS_FILE,
    SOURCE_STATE_FILE,
)
from _utils import write_if_changed
from manifest import (
    SCHEMA_VERSION,
    extend_baseline,
    load_history_strict,
    verify_history_against_baseline,
)
from schema import make_draw, validate_draw

try:
    import requests
except ImportError:  # Unit tests can inject a fake session without requests.
    requests = None

COMMON_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}
RETRY_DELAY = 10 * 60
MAX_RETRIES = 3
CN_TZ = timezone(timedelta(hours=8))
DRAW_WEEKDAYS = (1, 3, 6)
DEFAULT_PAUSE_FILE = PAUSE_WINDOWS_FILE


@dataclass(frozen=True)
class PauseWindow:
    label: str
    start: date | None
    end: date
    reason: str
    source: str = ""
    provisional: bool = False


def _requests_module():
    if requests is None:
        raise RuntimeError("requests is not installed; run pip install -r requirements.txt")
    return requests


def load_all_draws() -> dict[str, dict]:
    """Load validated history for merge decisions."""
    return {draw["issue"]: draw for draw in load_history_strict()}


def _parse_iso_date(value: object, label: str) -> date:
    if not isinstance(value, str):
        raise ValueError(f"{label} must be a YYYY-MM-DD string")
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"{label} is not a valid date: {value!r}") from error


def load_pause_windows(path: str | None = None) -> list[PauseWindow]:
    """Load officially declared market-suspension windows, failing closed on errors."""
    configured_json = os.environ.get("LOTTERY_PAUSE_WINDOWS_JSON", "").strip()
    configured_path = os.environ.get("LOTTERY_PAUSE_WINDOWS_FILE", "").strip()
    if configured_json:
        try:
            payload = json.loads(configured_json)
        except json.JSONDecodeError as error:
            raise ValueError(f"LOTTERY_PAUSE_WINDOWS_JSON is invalid JSON: {error}") from error
        source_label = "LOTTERY_PAUSE_WINDOWS_JSON"
    else:
        source_path = configured_path or path or DEFAULT_PAUSE_FILE
        try:
            with open(source_path, encoding="utf-8") as file:
                payload = json.load(file)
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError(f"cannot load pause-window file {source_path}: {error}") from error
        source_label = source_path

    if isinstance(payload, dict):
        if payload.get("schema_version") != "1.0.0":
            raise ValueError(f"{source_label} schema_version must be '1.0.0'")
        raw_windows = payload.get("windows")
    else:
        raw_windows = payload
    if not isinstance(raw_windows, list):
        raise ValueError(f"{source_label} must contain a windows array")

    windows: list[PauseWindow] = []
    seen_ids: set[str] = set()
    for index, raw in enumerate(raw_windows):
        if not isinstance(raw, dict):
            raise ValueError(f"{source_label} window {index} must be an object")
        window_id = raw.get("id")
        if not isinstance(window_id, str) or not window_id.strip():
            raise ValueError(f"{source_label} window {index} requires a non-empty id")
        if window_id in seen_ids:
            raise ValueError(f"{source_label} contains duplicate window id {window_id!r}")
        seen_ids.add(window_id)
        start = _parse_iso_date(raw.get("start"), f"{source_label}.{window_id}.start")
        end = _parse_iso_date(raw.get("end"), f"{source_label}.{window_id}.end")
        if end < start:
            raise ValueError(f"{source_label}.{window_id} ends before it starts")
        reason = raw.get("reason")
        if not isinstance(reason, str) or not reason.strip():
            raise ValueError(f"{source_label}.{window_id} requires a reason")
        source = raw.get("source", "")
        if not isinstance(source, str):
            raise ValueError(f"{source_label}.{window_id}.source must be a string")
        provisional = raw.get("provisional", False)
        if not isinstance(provisional, bool):
            raise ValueError(f"{source_label}.{window_id}.provisional must be a boolean")
        windows.append(PauseWindow(window_id, start, end, reason, source, provisional))

    ordered = sorted(windows, key=lambda window: (window.start, window.end))
    for left, right in zip(ordered, ordered[1:], strict=False):
        if right.start <= left.end:
            raise ValueError(
                f"{source_label} has overlapping windows: {left.label} and {right.label}"
            )
    return ordered


def active_pause_window(
    today: date,
    windows: list[PauseWindow] | None = None,
) -> PauseWindow | None:
    """Return the active scheduled-suspension window, including the legacy override."""
    windows = load_pause_windows() if windows is None else windows
    for window in windows:
        if window.start is not None and window.start <= today <= window.end:
            return window

    pause_until_value = os.environ.get("LOTTERY_PAUSE_UNTIL", "").strip()
    if not pause_until_value:
        return None
    try:
        pause_until = date.fromisoformat(pause_until_value)
    except ValueError as error:
        raise ValueError(
            "LOTTERY_PAUSE_UNTIL must be a valid YYYY-MM-DD date"
        ) from error
    if pause_until >= today:
        return PauseWindow(
            label="manual-override",
            start=None,
            end=pause_until,
            reason="manual LOTTERY_PAUSE_UNTIL override",
        )
    return None


def expected_draw_received(draws: list[dict], expected_date: date | None) -> bool:
    """A scheduled draw run is current only when the newest date is today."""
    if expected_date is None:
        return bool(draws)
    return bool(draws) and max(draw["date"] for draw in draws) == expected_date.isoformat()


def today_china() -> date:
    return datetime.now(CN_TZ).date()


def expected_draw_date_for_run(today: date) -> date | None:
    """Map a delayed scheduled run to the most recent eligible draw day."""
    for offset in range(7):
        candidate = today - timedelta(days=offset)
        if candidate.weekday() in DRAW_WEEKDAYS:
            return candidate
    return None


def fetch_with_retry(
    fetcher,
    *,
    expected_date: date | None,
    max_retries: int = MAX_RETRIES,
    delay: int = RETRY_DELAY,
    sleep=time.sleep,
) -> tuple[list[dict], list[str]]:
    """Retry empty or stale source results without requiring a stale-result exception."""
    last_draws: list[dict] = []
    last_sources: list[str] = []
    for attempt in range(max_retries + 1):
        if attempt:
            print(f"数据源为空或缺少当日开奖，{delay // 60} 分钟后重试 ({attempt}/{max_retries})")
            sleep(delay)
        try:
            last_draws, last_sources = fetcher()
        except ValueError as error:
            if attempt == max_retries:
                raise
            print(f"数据源本轮校验失败，将在重试窗口内重查: {error}")
            continue
        if expected_draw_received(last_draws, expected_date):
            return last_draws, last_sources
        if expected_date is None and last_draws:
            return last_draws, last_sources
    return last_draws, last_sources


def fetch_from_cwl(session=None) -> list[dict]:
    """Fetch recent draws from the official China Welfare Lottery API."""
    url = "https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice"
    params = {"name": "ssq", "issueCount": 30}
    headers = {
        **COMMON_HEADERS,
        "Referer": "https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/",
        "Accept": "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest",
    }
    try:
        if session is None:
            _requests_module()
            session = requests.Session()
            session.headers.update(COMMON_HEADERS)
            try:
                session.get("https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/", timeout=15)
            except Exception:
                pass
        response = session.get(url, params=params, headers=headers, timeout=30)
        response.raise_for_status()
        payload = response.json()
        draws = []
        for item in payload.get("result", []):
            draws.append(make_draw(
                issue=item["code"],
                date=item["date"][:10],
                red=[int(value) for value in item["red"].split(",")],
                blue=int(item["blue"]),
            ))
        draws = [draw for draw in draws if validate_draw(draw)]
        if draws:
            print(f"  OK 福彩官方 API: {len(draws)} 期")
        return draws
    except Exception as error:
        print(f"  WARN 福彩官方 API 失败: {error}")
        return []


RE_ROW = re.compile(r'<tr class="t_tr1">.*?</tr>', re.DOTALL)
RE_RED = re.compile(r'<td class="t_cfont2">(\d+)</td>')
RE_BLUE = re.compile(r'<td class="t_cfont4">(\d+)</td>')
RE_ISSUE = re.compile(r"<td>(\d{5})</td>")
RE_DATE = re.compile(r"<td>(\d{4}-\d{2}-\d{2})</td>")


def fetch_from_500(session=None) -> list[dict]:
    """Fetch recent draws from 500.com's public HTML history table."""
    url = "https://datachart.500.com/ssq/history/newinc/history.php"
    params = {"start": "03001", "end": "99999", "limit": 30}
    try:
        if session is None:
            _requests_module()
            session = requests.Session()
        response = session.get(url, params=params, headers=COMMON_HEADERS, timeout=30)
        response.raise_for_status()
        draws = []
        for row in RE_ROW.findall(response.text):
            issue_match = RE_ISSUE.search(row)
            reds = RE_RED.findall(row)
            blue_match = RE_BLUE.search(row)
            date_match = RE_DATE.search(row)
            if not (issue_match and len(reds) == 6 and blue_match and date_match):
                continue
            draw_date = date_match.group(1)
            draws.append(make_draw(
                issue=draw_date[:2] + issue_match.group(1),
                date=draw_date,
                red=[int(value) for value in reds],
                blue=int(blue_match.group(1)),
            ))
        draws = sorted(
            (draw for draw in draws if validate_draw(draw)),
            key=lambda draw: draw["issue"],
        )
        if draws:
            print(f"  OK 500彩票网: {len(draws)} 期 (最新 {draws[-1]['issue']})")
        return draws
    except Exception as error:
        print(f"  WARN 500彩票网失败: {error}")
        return []


def reconcile_sources(candidates: list[tuple[str, list[dict]]]) -> list[dict]:
    """Reject source disagreements and return a newest-first-priority union."""
    usable = [(name, draws) for name, draws in candidates if draws]
    if not usable:
        return []

    maps = [(name, {draw["issue"]: draw for draw in draws}) for name, draws in usable]
    conflicts: list[str] = []
    for index, (left_name, left) in enumerate(maps):
        for right_name, right in maps[index + 1:]:
            for issue in left.keys() & right.keys():
                if left[issue] != right[issue]:
                    conflicts.append(f"{issue}: {left_name} != {right_name}")
    if conflicts:
        raise ValueError("数据源交叉校验失败: " + "; ".join(conflicts[:8]))

    newest = max(usable, key=lambda item: max(d["issue"] for d in item[1]))[1]
    known = {draw["issue"] for draw in newest}
    merged = list(newest)
    for _, source_map in maps:
        for draw in source_map.values():
            if draw["issue"] not in known:
                known.add(draw["issue"])
                merged.append(draw)
    return sorted(merged, key=lambda draw: draw["issue"])


def fetch_latest_draws(session=None) -> tuple[list[dict], list[str]]:
    """Try available sources and return cross-checked candidate draws."""
    sources = [
        ("500彩票网", fetch_from_500),
        ("福彩官方", fetch_from_cwl),
    ]
    candidates: list[tuple[str, list[dict]]] = []
    for name, fetcher in sources:
        print(f"FETCH {name}")
        candidates.append((name, fetcher(session=session)))
        if len(candidates) < len(sources):
            time.sleep(1)
    draws = reconcile_sources(candidates)
    return draws, [name for name, values in candidates if values]


def merge_draws(
    draws_map: dict[str, dict],
    new_draws: list[dict],
    *,
    allow_corrections: bool = False,
) -> tuple[int, list[tuple[str, dict, dict]], list[dict]]:
    """Append new issues and optionally stage validated historical corrections."""
    added = 0
    conflicts: list[dict] = []
    corrections: list[tuple[str, dict, dict]] = []
    for draw in new_draws:
        if not validate_draw(draw):
            conflicts.append({"issue": draw.get("issue", "unknown"), "reason": "invalid record"})
            continue
        issue = draw["issue"]
        if issue not in draws_map:
            draws_map[issue] = draw
            added += 1
        elif draws_map[issue] != draw:
            if allow_corrections:
                corrections.append((issue, draws_map[issue], draw))
                draws_map[issue] = draw
            else:
                conflicts.append({
                    "issue": issue,
                    "reason": "existing issue content differs from source",
                })
    return added, corrections, conflicts


def save_by_year(all_draws: list[dict]) -> None:
    by_year: dict[str, list[dict]] = defaultdict(list)
    for draw in all_draws:
        by_year[draw["date"][:4]].append(draw)

    years_info = []
    for year in sorted(by_year):
        year_draws = sorted(by_year[year], key=lambda draw: draw["issue"])
        write_if_changed(os.path.join(HISTORY_DIR, f"{year}.json"), year_draws)
        years_info.append({
            "year": year,
            "count": len(year_draws),
            "range": [year_draws[0]["date"], year_draws[-1]["date"]],
        })
    write_if_changed(INDEX_FILE, {
        "total": len(all_draws),
        "range": [all_draws[0]["date"], all_draws[-1]["date"]],
        "years": years_info,
    })


def append_corrections(records: list[tuple[str, dict, dict]], source: str, reason: str) -> None:
    payload = {"schema_version": SCHEMA_VERSION, "corrections": []}
    if os.path.exists(CORRECTIONS_FILE):
        with open(CORRECTIONS_FILE, encoding="utf-8") as file:
            payload = json.load(file)
    verified_at = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    for issue, old, new in records:
        payload["corrections"].append({
            "issue": issue,
            "old": old,
            "new": new,
            "source": source,
            "verified_at": verified_at,
            "reason": reason,
        })
    write_if_changed(CORRECTIONS_FILE, payload)


def write_source_state(sources: list[str], latest: dict) -> None:
    write_if_changed(SOURCE_STATE_FILE, {
        "schema_version": SCHEMA_VERSION,
        "verified_at": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "sources": sources,
        "cross_checked": len(sources) > 1,
        "latest_issue": latest["issue"],
        "latest_date": latest["date"],
    })


def assert_expected_draw(
    latest: dict,
    today: date | None = None,
    expected_date: date | None = None,
) -> None:
    """Fail a scheduled draw-day run when both sources only return old data."""
    today = today or today_china()
    expected_date = expected_date or expected_draw_date_for_run(today)
    if expected_date is None or latest["date"] == expected_date.isoformat():
        return
    try:
        pause = active_pause_window(expected_date)
    except ValueError as error:
        raise SystemExit(f"停售窗口配置无效: {error}") from error
    if pause:
        qualifier = "，临时保护窗口" if pause.provisional else ""
        print(
            f"{pause.label}: 当前处于停售期（{pause.reason}，"
            f"截至 {pause.end.isoformat()}{qualifier}）"
        )
        return
    raise SystemExit(
        f"开奖日未取得新期: 最新仍为 {latest['issue']} / {latest['date']}；"
        "若为官方停售日，请更新 web/config/lottery_pause_windows.json "
        "或设置仓库变量 LOTTERY_PAUSE_WINDOWS_JSON"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--allow-corrections",
        action="store_true",
        help="replace changed historical issues and append a correction ledger",
    )
    parser.add_argument(
        "--reason",
        default="manual correction verified against cross-checked public sources",
        help="human-readable reason recorded in corrections.json",
    )
    parser.add_argument(
        "--require-new",
        action="store_true",
        help="fail on a scheduled draw day when sources contain no newer draw",
    )
    parser.add_argument(
        "--ignore-pause",
        action="store_true",
        help="allow an explicitly reviewed repair run to contact sources during a declared pause",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    os.makedirs(DATA_DIR, exist_ok=True)
    draws_map = load_all_draws()
    ordered_before = sorted(draws_map.values(), key=lambda draw: draw["issue"])
    baseline_errors = verify_history_against_baseline(ordered_before)
    if baseline_errors:
        raise SystemExit("历史数据保护检查失败: " + "; ".join(baseline_errors))
    print(f"当前数据: {len(ordered_before)} 期, 最新 {ordered_before[-1]['issue']}")

    today = today_china()
    expected_date = expected_draw_date_for_run(today) if args.require_new else None
    pause_anchor = expected_date or today
    try:
        pause = active_pause_window(pause_anchor)
    except ValueError as error:
        raise SystemExit(f"停售窗口配置无效: {error}") from error
    if pause and not args.ignore_pause:
        qualifier = "，临时保护窗口" if pause.provisional else ""
        print(
            f"{pause.label}: 官方/人工停售期，跳过联网抓取"
            f"（{pause.reason}，截至 {pause.end.isoformat()}{qualifier}）"
        )
        return

    session = None
    if requests is not None:
        session = requests.Session()
        session.headers.update(COMMON_HEADERS)

    def fetch_once() -> tuple[list[dict], list[str]]:
        return fetch_latest_draws(session=session)

    try:
        all_candidates, sources = fetch_with_retry(fetch_once, expected_date=expected_date)
    except ValueError as error:
        raise SystemExit(f"数据源校验失败（重试后仍冲突）: {error}") from error

    if not all_candidates:
        raise SystemExit("所有数据源均不可用：重试后仍未取得任何开奖数据")

    added, corrections, conflicts = merge_draws(
        draws_map,
        all_candidates,
        allow_corrections=args.allow_corrections,
    )
    if conflicts:
        raise SystemExit(f"发现未授权历史写入冲突: {conflicts[:5]}")
    all_draws = sorted(draws_map.values(), key=lambda draw: draw["issue"])
    if args.require_new:
        assert_expected_draw(all_draws[-1], today=today, expected_date=expected_date)
    if added == 0 and not corrections:
        print("没有新期或已授权修正，数据未变化")
        return

    if len(all_draws) < len(ordered_before):
        raise SystemExit("拒绝写入少于基线数量的历史数据")
    save_by_year(all_draws)
    if corrections:
        append_corrections(corrections, "+".join(sources), args.reason)
        print(f"已记录 {len(corrections)} 条历史修正；请审核后运行 update_baseline.py")
    else:
        extend_baseline(all_draws)
    write_source_state(sources, all_draws[-1])
    print(f"新增 {added} 期，共 {len(all_draws)} 期，数据源: {'+'.join(sources)}")


if __name__ == "__main__":
    main()
