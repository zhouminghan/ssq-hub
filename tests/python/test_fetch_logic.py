import copy
import os
import unittest
from datetime import date
from unittest.mock import patch

from fetch_latest import assert_expected_draw, merge_draws, reconcile_sources
from schema import make_draw


class FetchLogicTests(unittest.TestCase):
    def setUp(self):
        self.draw = make_draw("2026131", "2026-11-15", [1, 2, 3, 4, 5, 6], 7)

    def test_append_only_merge_adds_new_issue(self):
        added, corrections, conflicts = merge_draws({}, [self.draw])
        self.assertEqual(added, 1)
        self.assertEqual(corrections, [])
        self.assertEqual(conflicts, [])

    def test_changed_existing_record_is_rejected_by_default(self):
        old = copy.deepcopy(self.draw)
        new = {**self.draw, "blue": 8}
        added, corrections, conflicts = merge_draws({self.draw["issue"]: old}, [new])
        self.assertEqual(added, 0)
        self.assertEqual(corrections, [])
        self.assertEqual(len(conflicts), 1)

    def test_explicit_correction_is_staged(self):
        old = copy.deepcopy(self.draw)
        new = {**self.draw, "blue": 8}
        _, corrections, conflicts = merge_draws(
            {self.draw["issue"]: old},
            [new],
            allow_corrections=True,
        )
        self.assertEqual(conflicts, [])
        self.assertEqual(corrections[0][0], self.draw["issue"])

    def test_source_disagreement_is_rejected(self):
        other = {**self.draw, "blue": 8}
        with self.assertRaises(ValueError):
            reconcile_sources([("a", [self.draw]), ("b", [other])])

    def test_matching_sources_are_merged_without_duplicates(self):
        result = reconcile_sources([
            ("a", [self.draw]),
            ("b", [self.draw]),
        ])
        self.assertEqual(result, [self.draw])

    def test_draw_day_without_new_issue_fails(self):
        stale = {**self.draw, "issue": "2026130", "date": "2026-11-12"}
        with self.assertRaises(SystemExit):
            assert_expected_draw(stale, today=date(2026, 11, 15))

    def test_declared_pause_allows_no_new_draw(self):
        stale = {**self.draw, "issue": "2026130", "date": "2026-11-12"}
        with patch.dict(os.environ, {"LOTTERY_PAUSE_UNTIL": "2026-11-20"}):
            assert_expected_draw(stale, today=date(2026, 11, 15))

    def test_partial_backfill_still_fails_when_today_draw_is_missing(self):
        latest = make_draw("2026130", "2026-11-12", [1, 2, 3, 4, 5, 6], 1)
        older = make_draw("2026129", "2026-11-10", [2, 3, 4, 5, 6, 7], 2)
        added, _, _ = merge_draws({latest["issue"]: latest}, [older])
        self.assertEqual(added, 1)
        with self.assertRaises(SystemExit):
            assert_expected_draw(latest, today=date(2026, 11, 15))


if __name__ == "__main__":
    unittest.main()
