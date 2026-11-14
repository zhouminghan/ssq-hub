#!/usr/bin/env python3
"""Strict data quality gate for local development and GitHub Actions."""

from __future__ import annotations

import glob
import json
import os
from datetime import UTC, datetime

from _paths import (
    CORRECTIONS_FILE,
    HISTORY_BASELINE_FILE,
    HISTORY_DIR,
    INDEX_FILE,
    LATEST_FILE,
    MANIFEST_FILE,
    SCHEMA_DIR,
    SOURCE_STATE_FILE,
    STATS_FILE,
)
from calc_all import calc_stats
from manifest import build_manifest, load_history_strict, verify_history_against_baseline

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_DIR = os.path.join(BASE_DIR, "web")
errors: list[str] = []
warnings: list[str] = []


def load_schema(name: str) -> dict:
    with open(os.path.join(SCHEMA_DIR, name), encoding="utf-8") as file:
        return json.load(file)


def make_worker(schema_name: str):
    try:
        from jsonschema import Draft202012Validator, FormatChecker
        from referencing import Registry, Resource
    except ImportError:
        if not any("jsonschema" in item for item in warnings):
            warn("jsonschema 未安装；结构校验由 npm run test:schema 执行")
        return None

    schema = load_schema(schema_name)
    draw_schema = load_schema("draw.schema.json")
    resources = [
        Resource.from_contents(draw_schema),
        Resource.from_contents(schema),
    ]
    registry = Registry().with_resources(
        (resource.id(), resource) for resource in resources if resource.id()
    )
    return Draft202012Validator(schema, registry=registry, format_checker=FormatChecker())


def validate_shape(instance: object, schema_name: str, label: str) -> None:
    validator = make_worker(schema_name)
    if validator is None:
        if not isinstance(instance, (dict, list)):
            fail(f"{label} 顶层结构必须是对象或数组")
        return
    problems = sorted(validator.iter_errors(instance), key=lambda item: list(item.path))
    if not problems:
        print(f"  ✅ {label}: JSON Schema 通过")
        return
    for problem in problems[:8]:
        path = ".".join(str(part) for part in problem.absolute_path) or "$"
        errors.append(f"{label} schema error at {path}: {problem.message}")
        print(f"  ❌ {label} {path}: {problem.message}")


def fail(message: str) -> None:
    errors.append(message)
    print(f"  ❌ {message}")


def warn(message: str) -> None:
    warnings.append(message)
    print(f"  ⚠️  {message}")


def load_json(path: str):
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def verify_history_files():
    print("\n[1/8] 历史年表与语义")
    try:
        draws = load_history_strict()
    except Exception as error:
        fail(f"历史数据加载失败: {error}")
        return [], {}

    by_year = {}
    for path in sorted(glob.glob(os.path.join(HISTORY_DIR, "*.json"))):
        year = os.path.basename(path).removesuffix(".json")
        payload = load_json(path)
        validate_shape(payload, "history.schema.json", os.path.basename(path))
        by_year[year] = payload
        if payload:
            first, last = payload[0], payload[-1]
            if first["issue"][:4] != year or last["issue"][:4] != year:
                fail(f"{year}.json 包含非本年期号")
            if number_gap(payload):
                fail(f"{year}.json 期号不是严格连续")

    print(
        f"  ✅ 历史数据: {len(draws)} 期, {len(by_year)} 年, "
        f"{draws[0]['date']} → {draws[-1]['date']}"
    )
    baseline_errors = verify_history_against_baseline(draws)
    if baseline_errors:
        for message in baseline_errors:
            fail(message)
    else:
        print("  ✅ 历史记录指纹与受保护基线一致")

    validate_shape(load_json(HISTORY_BASELINE_FILE), "history-baseline.schema.json", "history_baseline.json")
    return draws, by_year


def number_gap(records: list[dict]) -> bool:
    for left, right in zip(records, records[1:], strict=False):
        if int(right["issue"][4:]) != int(left["issue"][4:]) + 1:
            return True
    return False


def verify_index(draws: list[dict], by_year: dict[str, list[dict]]) -> None:
    print("\n[2/8] 历史索引")
    index = load_json(INDEX_FILE)
    validate_shape(index, "history-index.schema.json", "history_index.json")
    if index.get("total") != len(draws):
        fail(f"index.total={index.get('total')} != history={len(draws)}")

    expected_years = sorted(by_year)
    actual_years = [item.get("year") for item in index.get("years", [])]
    if actual_years != expected_years:
        fail(f"index years mismatch: {actual_years} != {expected_years}")

    for item in index.get("years", []):
        year = item.get("year")
        payload = by_year.get(year, [])
        if item.get("count") != len(payload):
            fail(f"index {year} count={item.get('count')} != {len(payload)}")
        if payload and item.get("range") != [payload[0]["date"], payload[-1]["date"]]:
            fail(f"index {year} date range mismatch")
    if not errors:
        print(f"  ✅ Index 与 {len(by_year)} 个年度文件一致")


def verify_generated(draws: list[dict]) -> None:
    print("\n[3/8] latest / stats / manifest 一致性")
    latest = load_json(LATEST_FILE)
    stats = load_json(STATS_FILE)
    manifest = load_json(MANIFEST_FILE)
    validate_shape(latest, "latest.schema.json", "latest.json")
    validate_shape(stats, "stats.schema.json", "stats.json")
    validate_shape(manifest, "manifest.schema.json", "manifest.json")

    last = draws[-1]
    checks = {
        "latest.latest_draw": latest.get("latest_draw") == last,
        "latest.latest_issue": latest.get("latest_issue") == last["issue"],
        "latest.latest_date": latest.get("latest_date") == last["date"],
        "latest.total": latest.get("total") == len(draws),
        "stats.latest_issue": stats.get("latest_issue") == last["issue"],
        "stats.latest_date": stats.get("latest_date") == last["date"],
        "stats.total": stats.get("total") == len(draws),
        "manifest.latest_issue": manifest.get("latest_issue") == last["issue"],
        "manifest.total": manifest.get("total") == len(draws),
        "generated_at": latest.get("generated_at") == stats.get("generated_at") == manifest.get("generated_at"),
    }
    for label, passed in checks.items():
        if not passed:
            fail(f"{label} 不一致")

    expected_manifest = build_manifest(draws)
    if expected_manifest != manifest:
        fail("manifest.json 与历史数据重建结果不一致")

    generated = calc_stats(
        draws,
        generated_at=stats.get("generated_at"),
        source=stats.get("source"),
    )
    if generated != stats:
        fail("stats.json 与历史数据全量重算结果不一致")

    red_total = sum(stats["red_freq_global"].values())
    blue_total = sum(stats["blue_freq_global"].values())
    red50 = sum(stats["red_freq_50"].values())
    red100 = sum(stats["red_freq_100"].values())
    blue50 = sum(stats["blue_freq_50"].values())
    blue100 = sum(stats["blue_freq_100"].values())
    invariants = {
        "red global": red_total == len(draws) * 6,
        "blue global": blue_total == len(draws),
        "red 50": red50 == min(len(draws), 50) * 6,
        "blue 50": blue50 == min(len(draws), 50),
        "red 100": red100 == min(len(draws), 100) * 6,
        "blue 100": blue100 == min(len(draws), 100),
        "AC distribution": sum(stats["ac_distribution"].values()) == min(len(draws), 100),
        "structure total": stats["structure_recent_50"]["total_balls"] == min(len(draws), 50) * 6,
    }
    for label, passed in invariants.items():
        if not passed:
            fail(f"统计不变量失败: {label}")

    for bucket in ("red_per_number", "blue_per_number"):
        for number, info in stats[bucket].items():
            if info["current_miss"] > info["max_miss"]:
                fail(f"{bucket}.{number} current_miss > max_miss")

    if not errors:
        print("  ✅ 最新期、统计、索引和清单完全一致")


def verify_corrections() -> None:
    print("\n[4/8] 历史修正记录")
    if not os.path.exists(CORRECTIONS_FILE):
        print("  ✅ 无历史修正记录")
        return
    payload = load_json(CORRECTIONS_FILE)
    validate_shape(payload, "corrections.schema.json", "corrections.json")
    print(f"  ✅ 已记录 {len(payload.get('corrections', []))} 次历史修正")


def verify_source_state() -> None:
    print("\n[5/8] 数据来源追踪")
    if not check_source_exists():
        return
    payload = load_json(SOURCE_STATE_FILE)
    validate_shape(payload, "source-state.schema.json", "source_state.json")
    latest = load_json(LATEST_FILE)
    if payload.get("latest_issue") != latest.get("latest_issue"):
        fail("source_state.latest_issue 与 latest.json 不一致")
    if payload.get("latest_date") != latest.get("latest_date"):
        fail("source_state.latest_date 与 latest.json 不一致")
    if " + ".join(payload.get("sources", [])) != latest.get("source"):
        fail("source_state.sources 未正确传播到 latest.source")
    if not errors:
        print(f"  ✅ 来源: {' + '.join(payload.get('sources', []))}")


def check_source_exists() -> bool:
    if not os.path.exists(SOURCE_STATE_FILE):
        fail("source_state.json 不存在")
        return False
    return True


def verify_freshness() -> None:
    print("\n[6/8] 数据新鲜度")
    stats = load_json(STATS_FILE)
    updated = datetime.fromisoformat(stats["updated"]).replace(tzinfo=UTC)
    age_days = (datetime.now(tz=UTC) - updated).days
    if age_days > 30:
        fail(f"数据已 {age_days} 天未更新")
    elif age_days > 10:
        warn(f"数据距今 {age_days} 天，可能是节假日或更新链路异常")
    else:
        print(f"  ✅ 数据距今 {age_days} 天")


def verify_project_files() -> None:
    print("\n[7/8] 项目结构")
    critical = [
        "web/index.html",
        "web/.nojekyll",
        "web/js/main.js",
        "web/js/dashboard.js",
        "web/js/data-loader.js",
        "web/js/filter-bar.js",
        "web/js/insights.js",
        "web/js/trend-table.js",
        "web/js/trend-overlay.js",
        "web/js/number-profile.js",
        "web/js/theme.js",
        "web/js/utils/dom.js",
        "web/js/utils/format.js",
        "web/css/theme.css",
        "web/css/layout.css",
        "web/css/filter-bar.css",
        "web/css/trend-table.css",
        "web/css/number-profile.css",
        "web/css/insights.css",
        "web/css/responsive.css",
        "web/data/history_index.json",
        "web/data/stats.json",
        "web/data/latest.json",
        "web/data/manifest.json",
        "web/data/history_baseline.json",
        "web/data/source_state.json",
        "package.json",
        "package-lock.json",
    ]
    missing = [path for path in critical if not os.path.exists(os.path.join(BASE_DIR, path))]
    if missing:
        fail("缺少关键文件: " + ", ".join(missing))
    else:
        print(f"  ✅ 关键文件齐全 ({len(critical)})")


def report() -> None:
    print("\n" + "=" * 58)
    if errors:
        print(f"数据质量门禁失败: {len(errors)} 个错误, {len(warnings)} 个警告")
        for error in errors:
            print(f"  ❌ {error}")
        raise SystemExit(1)
    print(f"数据质量门禁通过: 0 个错误, {len(warnings)} 个警告")


def main() -> None:
    print("=" * 58)
    print("SSQ Hub 严格数据质量门禁")
    print("=" * 58)
    draws, by_year = verify_history_files()
    verify_index(draws, by_year)
    if draws:
        verify_generated(draws)
    verify_corrections()
    verify_source_state()
    verify_freshness()
    verify_project_files()
    print("\n[8/8] 汇总")
    report()


if __name__ == "__main__":
    main()
