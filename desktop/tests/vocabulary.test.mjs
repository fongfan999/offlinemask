// The vocabulary data files (decision 0161): every list is non-empty, written with tone
// marks in lower case, free of duplicates, and names its source.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { vocabulary } from "../src/core/detection/vocabulary.ts";

const folder = new URL("../src/core/detection/vocabulary/", import.meta.url);
const files = readdirSync(folder).filter((name) => name.endsWith(".json"));

const lists = (value, path = []) =>
  Array.isArray(value)
    ? [[path.join("."), value]]
    : typeof value === "object" && value !== null
      ? Object.entries(value).flatMap(([key, child]) => lists(child, [...path, key]))
      : [];

test("every vocabulary file names its source and holds non-empty lists without duplicates", () => {
  assert.ok(files.length >= 7, files.join(", "));
  for (const file of files) {
    const data = JSON.parse(readFileSync(new URL(file, folder), "utf8"));
    assert.match(data.$comment ?? "", /curated|MIT|CC BY|Decree|Law|generated/i, `${file}: source`);
    for (const [path, list] of lists(data)) {
      if (path.startsWith("sources") || path === "$comment") continue;
      assert.ok(list.length > 0, `${file} ${path}: empty`);
      const values = list.map((entry) => (typeof entry === "string" ? entry : entry.name));
      assert.deepEqual([...new Set(values)].length, values.length, `${file} ${path}: duplicate`);
    }
  }
});

test("the compiled vocabulary answers the questions the rules ask", () => {
  assert.ok(vocabulary.places.provinces.has("hồ chí minh"));
  assert.ok(vocabulary.places.provinces.has("bình dương"), "a former province stays known");
  assert.ok(vocabulary.places.countries.has("việt nam"));
  assert.ok(vocabulary.people.familyNames.has("nguyen"), "family names are folded");
  assert.ok(vocabulary.people.nameSyllables.has("thị"));
  assert.match(
    "sở lao động - thương binh và xã hội",
    new RegExp(`^${vocabulary.bodies.termAlternation}$`, "iu"),
  );
  assert.match(
    "CÔNG TY TNHH",
    new RegExp(
      `^${vocabulary.organizations.kindAlternation}${"[^\\S\\r\\n]+"}${vocabulary.organizations.kindAlternation}$`,
      "iu",
    ),
  );
  assert.match("Như Điều 4", new RegExp(`^${vocabulary.wording.phraseAlternation}$`, "iu"));
  assert.match(
    "Mười sáu triệu năm trăm nghìn đồng",
    new RegExp(`^${vocabulary.wording.phraseAlternation}$`, "iu"),
  );
  assert.match("ho ten nguoi benh", new RegExp(`^${vocabulary.labels.name}$`));
  assert.ok(vocabulary.units.unitCell.test("Chuyến"));
});
