"""Unit tests of records.py, with the standard library only (no test dependency in uv.lock):

    uv run --project desktop/scripts/train python -m unittest discover -s desktop/scripts/train/tests

smoke.sh runs them first.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import tempfile

from records import Record, Span, checkpoint_dirs, pack_documents, read_records, write_records  # noqa: E402


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


class FakeTokenizer:
    """One id per whitespace-separated word, enough to count a window."""

    def __call__(self, texts, add_special_tokens=False):
        if isinstance(texts, str):
            return {"input_ids": [1] * len(texts.split())}
        return {"input_ids": [[1] * len(text.split()) for text in texts]}


FIRST = "Hôm nay, ngày 18/01/2026, tại Số 70 Hai Bà Trưng, Phường Hoàn Kiếm, Thành phố Hà Nội, Việt"
SECOND = "Nam, chúng tôi gồm:"


class PackDocuments(unittest.TestCase):
    def test_a_value_wrapped_across_two_paragraphs_is_one_span_again(self):
        records = [
            Record("d#0", "d", FIRST, [Span(30, len(FIRST), "LOCATION", clipped=True)]),
            Record("d#1", "d", SECOND, [Span(0, 3, "LOCATION", clipped=True)]),
            Record("d#2", "d", "BÊN CHO THUÊ (Bên A):", []),
        ]
        (window,) = pack_documents(records, FakeTokenizer())
        self.assertEqual(len(window.spans), 1)
        span = window.spans[0]
        self.assertEqual(window.text[span.start : span.end], "Số 70 Hai Bà Trưng, Phường Hoàn Kiếm, Thành phố Hà Nội, Việt\n\nNam")
        self.assertEqual((span.label, span.clipped), ("LOCATION", False))

    def test_whole_spans_at_a_paragraph_edge_stay_apart(self):
        records = [
            Record("d#0", "d", "Bên A: Trần Văn Hùng", [Span(7, 20, "PERSON")]),
            Record("d#1", "d", "Lê Thị Mai ký", [Span(0, 10, "PERSON")]),
        ]
        (window,) = pack_documents(records, FakeTokenizer())
        self.assertEqual([window.text[s.start : s.end] for s in window.spans], ["Trần Văn Hùng", "Lê Thị Mai"])

    def test_a_window_boundary_between_the_pieces_leaves_them_clipped(self):
        records = [
            Record("d#0", "d", FIRST, [Span(30, len(FIRST), "LOCATION", clipped=True)]),
            Record("d#1", "d", SECOND, [Span(0, 3, "LOCATION", clipped=True)]),
        ]
        first, second = pack_documents(records, FakeTokenizer(), max_tokens=len(FIRST.split()) + 2)
        self.assertTrue(first.spans[0].clipped and second.spans[0].clipped)

    def test_clipped_survives_a_round_trip_through_jsonl(self):
        records = [Record("d#0", "d", FIRST, [Span(30, len(FIRST), "LOCATION", clipped=True), Span(0, 3, "PERSON")])]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "set.jsonl"
            write_records(path, records)
            self.assertEqual(read_records(path), records)
            self.assertEqual(path.read_text(encoding="utf-8").count('"clipped": true'), 1)


if __name__ == "__main__":
    unittest.main()
