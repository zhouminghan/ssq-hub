import unittest

from calc_all import calc_stats, load_history


class StatsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.draws = load_history()

    def test_statistical_invariants_on_real_history(self):
        stats = calc_stats(self.draws, generated_at="2026-11-14T00:00:00Z")
        self.assertEqual(sum(stats["red_freq_global"].values()), len(self.draws) * 6)
        self.assertEqual(sum(stats["blue_freq_global"].values()), len(self.draws))
        self.assertEqual(sum(stats["red_freq_100"].values()), 600)
        self.assertEqual(sum(stats["blue_freq_100"].values()), 100)
        self.assertEqual(sum(stats["ac_distribution"].values()), 100)
        self.assertEqual(len(stats["red_freq_global"]), 33)
        self.assertEqual(len(stats["blue_freq_global"]), 16)

    def test_calculation_is_deterministic(self):
        first = calc_stats(self.draws, generated_at="fixed")
        second = calc_stats(self.draws, generated_at="fixed")
        self.assertEqual(first, second)

    def test_current_miss_never_exceeds_historical_max(self):
        stats = calc_stats(self.draws, generated_at="fixed")
        for bucket in ("red_per_number", "blue_per_number"):
            for number, info in stats[bucket].items():
                self.assertLessEqual(info["current_miss"], info["max_miss"], number)


if __name__ == "__main__":
    unittest.main()
