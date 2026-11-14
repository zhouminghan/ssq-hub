import copy
import json
import os
import subprocess
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

import fetch_latest
from _utils import write_if_changed
from calc_all import load_history
from fetch_latest import (
    PauseWindow,
    active_pause_window,
    assert_expected_draw,
    expected_draw_received,
    fetch_with_retry,
    load_pause_windows,
    merge_draws,
    reconcile_sources,
    save_by_year,
)
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

    def test_one_empty_source_does_not_discard_usable_source(self):
        result = reconcile_sources([("a", []), ("b", [self.draw])])
        self.assertEqual(result, [self.draw])

    def test_fresh_source_supplies_current_draw_when_other_source_is_stale(self):
        stale = make_draw("2026130", "2026-11-12", [1, 2, 3, 4, 5, 6], 1)
        result = reconcile_sources([("a", [stale]), ("b", [stale, self.draw])])
        self.assertEqual(result, [stale, self.draw])
        self.assertTrue(expected_draw_received(result, date(2026, 11, 15)))

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

    def test_delayed_scheduled_run_uses_previous_draw_day_after_midnight(self):
        stale = make_draw("2026130", "2026-11-12", [1, 2, 3, 4, 5, 6], 1)
        self.assertEqual(
            fetch_latest.expected_draw_date_for_run(date(2026, 11, 18)),
            date(2026, 11, 17),
        )
        with self.assertRaises(SystemExit):
            assert_expected_draw(stale, today=date(2026, 11, 18))

    def test_cross_year_issue_orders_after_previous_year(self):
        previous = make_draw("2026154", "2026-12-31", [1, 2, 3, 4, 5, 6], 1)
        first = make_draw("2027001", "2027-01-03", [2, 3, 4, 5, 6, 7], 2)
        added, corrections, conflicts = merge_draws({previous["issue"]: previous}, [first])
        self.assertEqual((added, corrections, conflicts), (1, [], []))
        self.assertTrue(expected_draw_received([previous, first], date(2027, 1, 3)))

    def test_cross_year_draw_day_still_requires_today_draw(self):
        previous = make_draw("2026154", "2026-12-31", [1, 2, 3, 4, 5, 6], 1)
        with self.assertRaises(SystemExit):
            assert_expected_draw(previous, today=date(2027, 1, 3))

    def test_cross_year_save_rotates_annual_files_and_index(self):
        previous = make_draw("2026154", "2026-12-31", [1, 2, 3, 4, 5, 6], 1)
        first = make_draw("2027001", "2027-01-03", [2, 3, 4, 5, 6, 7], 2)
        with tempfile.TemporaryDirectory() as temp:
            history_dir = os.path.join(temp, "history")
            index_file = os.path.join(temp, "history_index.json")
            with (
                patch.object(fetch_latest, "HISTORY_DIR", history_dir),
                patch.object(fetch_latest, "INDEX_FILE", index_file),
            ):
                save_by_year([previous, first])
            with open(os.path.join(history_dir, "2026.json"), encoding="utf-8") as file:
                year_2026 = json.load(file)
            with open(os.path.join(history_dir, "2027.json"), encoding="utf-8") as file:
                year_2027 = json.load(file)
            with open(index_file, encoding="utf-8") as file:
                index = json.load(file)
        self.assertEqual(year_2026, [previous])
        self.assertEqual(year_2027, [first])
        self.assertEqual(index["total"], 2)
        self.assertEqual(index["range"], ["2026-12-31", "2027-01-03"])
        self.assertEqual([item["year"] for item in index["years"]], ["2026", "2027"])

    def test_main_skips_network_during_official_pause(self):
        stale = make_draw("2026019", "2026-02-12", [1, 2, 3, 4, 5, 6], 1)
        with (
            patch.object(fetch_latest, "today_china", return_value=date(2026, 2, 22)),
            patch.object(fetch_latest, "load_all_draws", return_value={stale["issue"]: stale}),
            patch.object(fetch_latest, "verify_history_against_baseline", return_value=[]),
            patch.object(fetch_latest, "fetch_latest_draws") as fetch,
            patch("sys.argv", ["fetch_latest.py", "--require-new"]),
        ):
            fetch_latest.main()
        fetch.assert_not_called()

    def test_full_or_manual_run_also_skips_network_during_pause(self):
        stale = make_draw("2026019", "2026-02-12", [1, 2, 3, 4, 5, 6], 1)
        with (
            patch.object(fetch_latest, "today_china", return_value=date(2026, 2, 22)),
            patch.object(fetch_latest, "load_all_draws", return_value={stale["issue"]: stale}),
            patch.object(fetch_latest, "verify_history_against_baseline", return_value=[]),
            patch.object(fetch_latest, "fetch_latest_draws") as fetch,
            patch("sys.argv", ["fetch_latest.py"]),
        ):
            fetch_latest.main()
        fetch.assert_not_called()

    def test_stale_source_is_retried_until_current_draw_arrives(self):
        stale = make_draw("2026130", "2026-11-12", [1, 2, 3, 4, 5, 6], 1)
        current = make_draw("2026131", "2026-11-15", [2, 3, 4, 5, 6, 7], 2)
        responses = [([stale], ["a"]), ([stale], ["a", "b"]), ([current], ["a", "b"])]
        sleeps = []

        def fetcher():
            return responses.pop(0)

        draws, sources = fetch_with_retry(
            fetcher,
            expected_date=date(2026, 11, 15),
            max_retries=3,
            delay=600,
            sleep=sleeps.append,
        )
        self.assertEqual(draws, [current])
        self.assertEqual(sources, ["a", "b"])
        self.assertEqual(sleeps, [600, 600])

    def test_stale_source_exhaustion_is_detectable(self):
        stale = make_draw("2026130", "2026-11-12", [1, 2, 3, 4, 5, 6], 1)
        draws, _ = fetch_with_retry(
            lambda: ([stale], ["a", "b"]),
            expected_date=date(2026, 11, 15),
            max_retries=2,
            delay=0,
            sleep=lambda _: None,
        )
        self.assertFalse(expected_draw_received(draws, date(2026, 11, 15)))

    def test_empty_source_is_retried_and_then_fails_when_exhausted(self):
        calls = []

        def fetcher():
            calls.append(1)
            return [], []

        draws, _ = fetch_with_retry(
            fetcher,
            expected_date=date(2026, 11, 15),
            max_retries=2,
            delay=0,
            sleep=lambda _: None,
        )
        self.assertEqual(draws, [])
        self.assertEqual(len(calls), 3)

    def test_transient_source_conflict_is_retried(self):
        current = make_draw("2026131", "2026-11-15", [2, 3, 4, 5, 6, 7], 2)
        calls = []

        def fetcher():
            calls.append(1)
            if len(calls) == 1:
                raise ValueError("temporary conflict")
            return [current], ["a", "b"]

        draws, sources = fetch_with_retry(
            fetcher,
            expected_date=date(2026, 11, 15),
            max_retries=1,
            delay=0,
            sleep=lambda _: None,
        )
        self.assertEqual(draws, [current])
        self.assertEqual(sources, ["a", "b"])
        self.assertEqual(len(calls), 2)

    def test_official_spring_festival_window_is_inclusive(self):
        windows = load_pause_windows()
        self.assertIsNotNone(active_pause_window(date(2026, 2, 14), windows))
        self.assertIsNotNone(active_pause_window(date(2026, 2, 22), windows))
        self.assertIsNotNone(active_pause_window(date(2026, 2, 23), windows))
        self.assertIsNone(active_pause_window(date(2026, 2, 24), windows))

    def test_2027_spring_festival_has_provisional_fail_safe_window(self):
        windows = load_pause_windows()
        window = active_pause_window(date(2027, 2, 9), windows)
        self.assertIsNotNone(window)
        self.assertTrue(window.provisional)
        self.assertIn("待发布", window.source)
        self.assertIsNone(active_pause_window(date(2027, 2, 14), windows))

    def test_configured_pause_windows_contain_no_real_draws(self):
        draw_dates = {draw["date"] for draw in load_history()}
        for window in load_pause_windows():
            self.assertFalse(
                {
                    date_text
                    for date_text in draw_dates
                    if window.start.isoformat() <= date_text <= window.end.isoformat()
                },
                window.label,
            )

    def test_spring_festival_suppresses_stale_error_but_resume_requires_draw(self):
        stale = make_draw("2026019", "2026-02-12", [1, 2, 3, 4, 5, 6], 1)
        windows = load_pause_windows()
        with patch("fetch_latest.load_pause_windows", return_value=windows):
            assert_expected_draw(stale, today=date(2026, 2, 22))
            with self.assertRaises(SystemExit):
                assert_expected_draw(stale, today=date(2026, 2, 24))

    def test_manual_override_remains_supported(self):
        window = PauseWindow("pause", date(2026, 2, 14), date(2026, 2, 23), "test")
        self.assertEqual(active_pause_window(date(2026, 2, 20), [window]), window)
        with patch.dict(os.environ, {"LOTTERY_PAUSE_UNTIL": "2026-02-25"}, clear=False):
            self.assertEqual(active_pause_window(date(2026, 2, 24), [window]).end, date(2026, 2, 25))

    def test_invalid_manual_override_fails_with_actionable_error(self):
        with patch.dict(os.environ, {"LOTTERY_PAUSE_UNTIL": "not-a-date"}, clear=False):
            with self.assertRaisesRegex(ValueError, "LOTTERY_PAUSE_UNTIL"):
                active_pause_window(date(2026, 2, 24), [])

    def test_overlapping_pause_windows_are_rejected(self):
        payload = {
            "schema_version": "1.0.0",
            "windows": [
                {"id": "a", "start": "2027-02-01", "end": "2027-02-05", "reason": "a"},
                {"id": "b", "start": "2027-02-05", "end": "2027-02-09", "reason": "b"},
            ]
        }
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".json") as file:
            json.dump(payload, file)
            file.flush()
            with patch.dict(os.environ, {"LOTTERY_PAUSE_WINDOWS_JSON": ""}, clear=False):
                with self.assertRaisesRegex(ValueError, "overlapping"):
                    load_pause_windows(file.name)

    def test_unknown_pause_config_schema_is_rejected(self):
        payload = {"schema_version": "2.0.0", "windows": []}
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".json") as file:
            json.dump(payload, file)
            file.flush()
            with patch.dict(os.environ, {"LOTTERY_PAUSE_WINDOWS_JSON": ""}, clear=False):
                with self.assertRaisesRegex(ValueError, "schema_version"):
                    load_pause_windows(file.name)

    def test_2027_spring_window_can_be_injected_without_code_change(self):
        stale = make_draw("2027010", "2027-02-02", [1, 2, 3, 4, 5, 6], 1)
        window = PauseWindow(
            "2027-spring-festival-test",
            date(2027, 2, 4),
            date(2027, 2, 13),
            "test fixture pending official lottery-market notice",
        )
        with patch("fetch_latest.load_pause_windows", return_value=[window]):
            assert_expected_draw(stale, today=date(2027, 2, 9))
            with self.assertRaises(SystemExit):
                assert_expected_draw(stale, today=date(2027, 2, 16))

    def test_next_draw_after_new_year_uses_new_year_issue_sequence(self):
        first = make_draw("2027001", "2027-01-03", [1, 2, 3, 4, 5, 6], 1)
        next_draw = make_draw("2027002", "2027-01-05", [2, 3, 4, 5, 6, 7], 2)
        self.assertEqual(int(next_draw["issue"][4:]) - int(first["issue"][4:]), 1)
        self.assertEqual(
            date.fromisoformat(next_draw["date"]) - date.fromisoformat(first["date"]),
            timedelta(days=2),
        )

    def test_no_change_merge_is_idempotent(self):
        added, corrections, conflicts = merge_draws(
            {self.draw["issue"]: copy.deepcopy(self.draw)},
            [copy.deepcopy(self.draw)],
        )
        self.assertEqual((added, corrections, conflicts), (0, [], []))

    def test_identical_generated_write_does_not_touch_file(self):
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".json") as file:
            file.write(json.dumps(self.draw, ensure_ascii=False, indent=2))
            file.flush()
            before = os.stat(file.name).st_mtime_ns
            self.assertFalse(write_if_changed(file.name, self.draw))
            self.assertEqual(os.stat(file.name).st_mtime_ns, before)

    def test_workflow_keeps_2210_schedule_and_new_draw_gate(self):
        workflow = (
            Path(__file__).resolve().parents[2] / ".github/workflows/update-data.yml"
        ).read_text(encoding="utf-8")
        repair = (
            Path(__file__).resolve().parents[2] / ".github/workflows/data-repair.yml"
        ).read_text(encoding="utf-8")
        self.assertIn("cron: '10 14 * * 0,2,4'", workflow)
        self.assertIn('FLAG="--require-new"', workflow)
        self.assertIn("web/config/lottery_pause_windows.json", workflow)
        self.assertIn("for attempt in 1 2 3", workflow)
        self.assertIn("--ignore-pause", repair)
        self.assertIn("for attempt in 1 2 3", repair)


class PushRaceSimulationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.remote = self.root / "remote.git"
        self._git(self.root, "init", "--bare", "--initial-branch=main", str(self.remote))

        seed = self.root / "seed"
        self._git(self.root, "clone", str(self.remote), str(seed))
        (seed / "history.json").write_text("seed\n", encoding="utf-8")
        self._git(seed, "add", "history.json")
        self._git(seed, "commit", "-m", "seed")
        self._git(seed, "push", "origin", "main")

        self.worker_a = self.root / "worker-a"
        self.worker_b = self.root / "worker-b"
        self._git(self.root, "clone", str(self.remote), str(self.worker_a))
        self._git(self.root, "clone", str(self.remote), str(self.worker_b))

    def tearDown(self):
        self.temp.cleanup()

    def _git(self, cwd: Path, *args: str, check: bool = True):
        return subprocess.run(
            ["git", *args],
            cwd=cwd,
            check=check,
            capture_output=True,
            text=True,
            env={
                **os.environ,
                "GIT_AUTHOR_NAME": "boundary-test",
                "GIT_AUTHOR_EMAIL": "boundary@example.invalid",
                "GIT_COMMITTER_NAME": "boundary-test",
                "GIT_COMMITTER_EMAIL": "boundary@example.invalid",
            },
        )

    def test_non_overlapping_upstream_commit_is_recovered_by_rebase_push(self):
        (self.worker_a / "history.json").write_text("data-a\n", encoding="utf-8")
        self._git(self.worker_a, "add", "history.json")
        self._git(self.worker_a, "commit", "-m", "data")
        self._git(self.worker_a, "push", "origin", "main")

        (self.worker_b / "docs.md").write_text("docs-b\n", encoding="utf-8")
        self._git(self.worker_b, "add", "docs.md")
        self._git(self.worker_b, "commit", "-m", "docs")
        rejected = self._git(self.worker_b, "push", "origin", "main", check=False)
        self.assertNotEqual(rejected.returncode, 0)

        self._git(self.worker_b, "fetch", "origin", "main")
        self._git(self.worker_b, "rebase", "origin/main")
        self._git(self.worker_b, "push", "origin", "main")

        log = self._git(self.worker_b, "log", "--format=%s", "-3").stdout
        self.assertIn("docs", log)
        self.assertIn("data", log)
        self.assertEqual(len(self._git(self.worker_b, "rev-list", "origin/main").stdout.splitlines()), 3)

    def test_overlapping_generated_data_change_aborts_without_overwrite(self):
        (self.worker_a / "history.json").write_text("data-a\n", encoding="utf-8")
        self._git(self.worker_a, "add", "history.json")
        self._git(self.worker_a, "commit", "-m", "data-a")
        self._git(self.worker_a, "push", "origin", "main")

        (self.worker_b / "history.json").write_text("data-b\n", encoding="utf-8")
        self._git(self.worker_b, "add", "history.json")
        self._git(self.worker_b, "commit", "-m", "data-b")
        rejected = self._git(self.worker_b, "push", "origin", "main", check=False)
        self.assertNotEqual(rejected.returncode, 0)

        self._git(self.worker_b, "fetch", "origin", "main")
        conflict = self._git(self.worker_b, "rebase", "origin/main", check=False)
        self.assertNotEqual(conflict.returncode, 0)
        self._git(self.worker_b, "rebase", "--abort")
        remote_content = self._git(
            self.root,
            "--git-dir",
            str(self.remote),
            "show",
            "main:history.json",
        ).stdout
        self.assertEqual(remote_content, "data-a\n")


if __name__ == "__main__":
    unittest.main()
