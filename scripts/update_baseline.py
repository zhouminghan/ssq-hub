#!/usr/bin/env python3
"""Explicitly refresh the protected history baseline.

This must only be run after reviewing every changed historical record in
web/data/corrections.json. Normal fetch and calculation runs never call it.
"""

from manifest import load_history_strict, write_baseline


def main() -> None:
    draws = load_history_strict()
    changed = write_baseline(draws)
    print(
        f"baseline {'updated' if changed else 'unchanged'}: "
        f"{len(draws)} records"
    )


if __name__ == "__main__":
    main()
