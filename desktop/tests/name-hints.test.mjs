import test from "node:test";
import assert from "node:assert/strict";
import { possibleNames } from "../src/core/name-hints.ts";

test("finds title-case runs left in a masked copy", () => {
  const text =
    "Kính gửi bộ phận hỗ trợ,\n\nTôi là Nguyễn Minh Anh, chủ tài khoản [STK_1_dcac]. Vui lòng kiểm tra.\n\nTrân trọng,\nNguyễn Minh Anh";
  assert.deepEqual(possibleNames(text), ["Nguyễn Minh Anh"]);
});

test("ignores sentence starts, aliases, numbers and single capitalised words", () => {
  assert.deepEqual(
    possibleNames("Vui lòng kiểm tra [GD_1_dcac]. Ngày 08/09/2026. Trân trọng,"),
    [],
  );
  assert.deepEqual(possibleNames("[TEN_1_dcac] đã gọi SDT 0901"), []);
});

test("caps the hint list and keeps distinct runs only", () => {
  const text = "Lê An Lê An, Trần Bình, Phạm Chi, Võ Dũng Em";
  assert.deepEqual(possibleNames(text), ["Lê An Lê An", "Trần Bình", "Phạm Chi"]);
});
