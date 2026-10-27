"""Unit tests of records.py, with the standard library only (no test dependency in uv.lock):

    uv run --project desktop/scripts/train python -m unittest discover -s desktop/scripts/train/tests

smoke.sh runs them first.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from records import checkpoint_dirs  # noqa: E402


class CheckpointDirs(unittest.TestCase):
    out = Path("/run")

    def test_only_the_best_epoch_by_default(self):
        self.assertEqual(checkpoint_dirs(self.out, 1, 0.5, -1.0, False), [self.out / "checkpoint"])
        self.assertEqual(checkpoint_dirs(self.out, 2, 0.4, 0.5, False), [])
        self.assertEqual(checkpoint_dirs(self.out, 3, 0.6, 0.5, False), [self.out / "checkpoint"])

    def test_keep_epochs_saves_every_epoch_beside_the_best(self):
        self.assertEqual(
            checkpoint_dirs(self.out, 1, 0.5, -1.0, True), [self.out / "checkpoint-1", self.out / "checkpoint"]
        )
        self.assertEqual(checkpoint_dirs(self.out, 2, 0.4, 0.5, True), [self.out / "checkpoint-2"])
        self.assertEqual(
            checkpoint_dirs(self.out, 3, 0.6, 0.5, True), [self.out / "checkpoint-3", self.out / "checkpoint"]
        )

    def test_an_equal_score_does_not_replace_the_best(self):
        self.assertEqual(checkpoint_dirs(self.out, 2, 0.5, 0.5, True), [self.out / "checkpoint-2"])


if __name__ == "__main__":
    unittest.main()
