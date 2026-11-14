import unittest

from schema import make_draw, validate_draw, validate_draw_details


class DrawSchemaTests(unittest.TestCase):
    def setUp(self):
        self.valid = make_draw("2026130", "2026-11-12", [1, 2, 6, 16, 20, 28], 2)

    def test_valid_draw(self):
        self.assertTrue(validate_draw(self.valid))

    def test_red_balls_must_be_unique_and_sorted(self):
        duplicate = {**self.valid, "red": [1, 1, 6, 16, 20, 28]}
        unsorted = {**self.valid, "red": [2, 1, 6, 16, 20, 28]}
        self.assertFalse(validate_draw(duplicate))
        self.assertFalse(validate_draw(unsorted))
        self.assertIn("red balls must be unique", validate_draw_details(duplicate))

    def test_issue_and_date_are_semantically_validated(self):
        bad_issue = {**self.valid, "issue": "abc"}
        bad_date = {**self.valid, "date": "not-a-date"}
        mismatched_year = {**self.valid, "issue": "2025130"}
        self.assertFalse(validate_draw(bad_issue))
        self.assertFalse(validate_draw(bad_date))
        self.assertFalse(validate_draw(mismatched_year))

    def test_boolean_is_not_accepted_as_integer(self):
        payload = {**self.valid, "blue": True}
        self.assertFalse(validate_draw(payload))


if __name__ == "__main__":
    unittest.main()
