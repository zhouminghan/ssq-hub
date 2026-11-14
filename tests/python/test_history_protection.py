import copy
import unittest

from calc_all import load_history
from manifest import build_baseline, records_digest, verify_history_against_baseline
from schema import draw_fingerprint


class HistoryProtectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.draws = load_history()
        cls.baseline = build_baseline(cls.draws)

    def test_real_history_matches_checked_in_baseline(self):
        self.assertEqual(verify_history_against_baseline(self.draws), [])

    def test_missing_year_is_detected(self):
        broken = [draw for draw in self.draws if not draw["issue"].startswith("2005")]
        errors = verify_history_against_baseline(broken)
        self.assertTrue(any("missing" in error for error in errors))

    def test_modified_record_is_detected(self):
        broken = copy.deepcopy(self.draws)
        broken[-1]["blue"] = 3
        errors = verify_history_against_baseline(broken)
        self.assertTrue(any("changed" in error for error in errors))

    def test_baseline_metadata_tampering_is_detected(self):
        broken = copy.deepcopy(self.baseline)
        broken["record_count"] = 1
        broken["records_sha256"] = "0" * 64
        errors = verify_history_against_baseline(self.draws, broken)
        self.assertTrue(any("record_count" in error for error in errors))
        self.assertTrue(any("records_sha256" in error for error in errors))

    def test_append_preserves_existing_fingerprints(self):
        appended = self.draws + [{
            "issue": "2099001",
            "date": "2099-01-01",
            "red": [1, 2, 3, 4, 5, 6],
            "blue": 1,
        }]
        self.assertEqual(verify_history_against_baseline(appended), [])
        self.assertNotEqual(records_digest(appended), records_digest(self.draws))
        self.assertEqual(draw_fingerprint(appended[-1]), draw_fingerprint(appended[-1]))


if __name__ == "__main__":
    unittest.main()
