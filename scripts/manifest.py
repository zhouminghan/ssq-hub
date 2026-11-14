"""History fingerprints, protected baseline, and generated data manifest."""

from __future__ import annotations

import glob
import hashlib
import json
import os
from collections import defaultdict
from datetime import UTC, datetime

from _paths import (
    HISTORY_BASELINE_FILE,
    HISTORY_DIR,
    MANIFEST_FILE,
    SOURCE_STATE_FILE,
)
from _utils import write_if_changed
from schema import draw_fingerprint, validate_unique_sorted

SCHEMA_VERSION = "2.0.0"
PIPELINE_VERSION = "2.0.0"


def utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: str, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def load_history_strict() -> list[dict]:
    """Load every annual file; corrupt files or records are fatal."""
    draws: list[dict] = []
    files = sorted(glob.glob(os.path.join(HISTORY_DIR, "*.json")))
    if not files:
        raise ValueError("no annual history files found")
    for path in files:
        with open(path, encoding="utf-8") as file:
            payload = json.load(file)
        if not isinstance(payload, list):
            raise ValueError(f"{os.path.basename(path)} must contain a JSON array")
        draws.extend(payload)
    errors = validate_unique_sorted(draws)
    if errors:
        raise ValueError("invalid history: " + "; ".join(errors[:10]))
    return draws


def records_digest(draws: list[dict]) -> str:
    digest = hashlib.sha256()
    for draw in draws:
        digest.update(draw_fingerprint(draw).encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def fingerprints_digest(records: dict[str, str]) -> str:
    digest = hashlib.sha256()
    for issue in sorted(records):
        digest.update(records[issue].encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def build_baseline(draws: list[dict]) -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "record_count": len(draws),
        "records_sha256": fingerprints_digest({
            draw["issue"]: draw_fingerprint(draw) for draw in draws
        }),
        "records": {draw["issue"]: draw_fingerprint(draw) for draw in draws},
    }


def write_baseline(draws: list[dict]) -> bool:
    baseline = build_baseline(draws)
    return write_if_changed(HISTORY_BASELINE_FILE, baseline)


def extend_baseline(draws: list[dict]) -> bool:
    """Add validated append-only issues while preserving every protected record."""
    errors = verify_history_against_baseline(draws)
    if errors:
        raise ValueError("cannot extend baseline: " + "; ".join(errors))
    return write_baseline(draws)


def verify_history_against_baseline(
    draws: list[dict],
    baseline: dict | None = None,
) -> list[str]:
    """Allow new issues while rejecting missing or modified protected records."""
    baseline = baseline if baseline is not None else load_json(HISTORY_BASELINE_FILE)
    if not baseline:
        return ["history_baseline.json is missing"]

    protected = baseline.get("records", {})
    current = {draw["issue"]: draw_fingerprint(draw) for draw in draws}
    missing = sorted(set(protected) - set(current))
    changed = sorted(
        issue for issue in protected.keys() & current.keys()
        if protected[issue] != current[issue]
    )
    errors: list[str] = []
    if baseline.get("record_count") != len(protected):
        errors.append(
            f"baseline record_count metadata mismatch: "
            f"{baseline.get('record_count')} != {len(protected)}"
        )
    if protected and baseline.get("records_sha256") != fingerprints_digest(protected):
        errors.append("baseline records_sha256 metadata mismatch")
    if missing:
        errors.append(f"protected issues are missing: {missing[:8]}")
    if changed:
        errors.append(f"protected issue records changed: {changed[:8]}")
    return errors


def resolve_source_label(default: str = "Public lottery issue records") -> str:
    state = load_json(SOURCE_STATE_FILE)
    sources = state.get("sources", []) if state else []
    return " + ".join(sources) if sources else default


def build_manifest(draws: list[dict], source: str | None = None) -> dict:
    source = source or resolve_source_label()
    by_year: dict[str, list[dict]] = defaultdict(list)
    for draw in draws:
        by_year[draw["date"][:4]].append(draw)

    years = []
    for year in sorted(by_year):
        year_draws = sorted(by_year[year], key=lambda item: item["issue"])
        years.append({
            "year": year,
            "count": len(year_draws),
            "range": [year_draws[0]["date"], year_draws[-1]["date"]],
            "first_issue": year_draws[0]["issue"],
            "last_issue": year_draws[-1]["issue"],
            "records_sha256": records_digest(year_draws),
        })

    generated_at = utc_now()
    previous = load_json(MANIFEST_FILE)
    stable_fields = (
        "records_sha256",
        "total",
        "range",
        "latest_issue",
        "latest_date",
        "years",
    )
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "pipeline_version": PIPELINE_VERSION,
        "generated_at": generated_at,
        "source": source,
        "total": len(draws),
        "range": [draws[0]["date"], draws[-1]["date"]],
        "latest_issue": draws[-1]["issue"],
        "latest_date": draws[-1]["date"],
        "records_sha256": records_digest(draws),
        "years": years,
    }
    if previous and all(previous.get(field) == manifest[field] for field in stable_fields):
        manifest["generated_at"] = previous.get("generated_at", generated_at)
    return manifest


def write_manifest(draws: list[dict], source: str = "Public lottery issue records") -> bool:
    return write_if_changed(MANIFEST_FILE, build_manifest(draws, source))
