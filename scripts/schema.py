"""Draw record model and strict semantic validation.

This module is the single source of truth shared by fetch, calculation, and
verification. Validation deliberately checks semantics that JSON Schema and
simple range checks cannot express together: issue/year alignment, valid dates,
unique sorted red balls, booleans masquerading as integers, and final ordering.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Iterable
from datetime import date

RED_COUNT = 6
RED_MIN = 1
RED_MAX = 33
BLUE_MIN = 1
BLUE_MAX = 16
ISSUE_LEN = 7
ISSUE_PATTERN = re.compile(r"^\d{7}$")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def validate_draw_details(draw: object) -> list[str]:
    """Return every semantic validation error found in one draw."""
    if not isinstance(draw, dict):
        return ["draw must be an object"]

    errors: list[str] = []
    for field in ("issue", "date", "red", "blue"):
        if field not in draw:
            errors.append(f"missing field: {field}")
    if errors:
        return errors

    issue = draw["issue"]
    if not isinstance(issue, str) or not ISSUE_PATTERN.fullmatch(issue):
        errors.append("issue must be a 7-digit string")

    date_text = draw["date"]
    parsed_date = None
    if not isinstance(date_text, str) or not DATE_PATTERN.fullmatch(date_text):
        errors.append("date must use YYYY-MM-DD")
    else:
        try:
            parsed_date = date.fromisoformat(date_text)
        except ValueError:
            errors.append("date is not a valid calendar date")

    if (
        parsed_date is not None
        and isinstance(issue, str)
        and ISSUE_PATTERN.fullmatch(issue)
        and issue[:4] != date_text[:4]
    ):
        errors.append("issue year must match draw date year")

    red = draw["red"]
    if not isinstance(red, list):
        errors.append("red must be a list")
    else:
        if len(red) != RED_COUNT:
            errors.append(f"red must contain exactly {RED_COUNT} balls")
        if not all(_is_int(ball) and RED_MIN <= ball <= RED_MAX for ball in red):
            errors.append(f"red balls must be integers in {RED_MIN}..{RED_MAX}")
        if len(set(red)) != len(red):
            errors.append("red balls must be unique")
        if red != sorted(red):
            errors.append("red balls must be sorted ascending")

    blue = draw["blue"]
    if not (_is_int(blue) and BLUE_MIN <= blue <= BLUE_MAX):
        errors.append(f"blue must be an integer in {BLUE_MIN}..{BLUE_MAX}")

    return errors


def validate_draw(draw: object) -> bool:
    """Return True only when every draw invariant is satisfied."""
    return not validate_draw_details(draw)


def make_draw(issue: str, date: str, red: Iterable[int], blue: int) -> dict:
    """Construct one canonical draw record."""
    return {
        "issue": str(issue),
        "date": date,
        "red": sorted(int(ball) for ball in red),
        "blue": int(blue),
    }


def canonical_draw_payload(draw: dict) -> str:
    """Stable serialization used by history fingerprints."""
    payload = {
        "issue": draw["issue"],
        "date": draw["date"],
        "red": draw["red"],
        "blue": draw["blue"],
    }
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def draw_fingerprint(draw: dict) -> str:
    return hashlib.sha256(canonical_draw_payload(draw).encode("utf-8")).hexdigest()[:20]


def validate_unique_sorted(draws: Iterable[dict]) -> list[str]:
    errors: list[str] = []
    issues: set[str] = set()
    previous = ""
    for index, draw in enumerate(draws):
        for detail in validate_draw_details(draw):
            errors.append(f"record {index}: {detail}")
        issue = draw.get("issue") if isinstance(draw, dict) else None
        if not isinstance(issue, str):
            continue
        if issue in issues:
            errors.append(f"duplicate issue: {issue}")
        if previous and issue <= previous:
            errors.append(f"records are not strictly ordered at {issue}")
        issues.add(issue)
        previous = issue
    return errors
