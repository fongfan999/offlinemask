# 0179 — Restore looks each code up once, whatever the number of known codes

Date: 31 October 2026. Measuring how big file restore tables get (for decision 0178) showed that restoring was the real cost, and the owner asked for it to be fixed first.

## Why

`restoreAliases` built one regular expression listing every known alias, for every call. A spreadsheet's result was restored cell by cell, so `restoreTables` rebuilt that regex, and the alias map, for each cell. Measured in Node 24: a clipboard restore took 0.7 s with 50,000 known aliases and 2.3 s with 100,000. A returned 1,000-row file took 10 s, and the time grew with the square of the file size. About 460,000 aliases, the size of one 100,000-row sheet, crashed V8 while it compiled the regex, which would take the app's window down. Home's restore tab passes every table known in the launch, so each kept table slowed every other restore.

## What

- **One pass, one map.** `restoreWith(text, values)` walks the alias-shaped tokens (`aliasShape`) once and looks each one up in a `Map`. `aliasValues(findings)` builds that map once per restore. `restoreAliases` keeps its signature and calls both.
- **Files build the map once per file.** `restoreTables` and `restoreParagraphs` build it before their loops. `restoreReplacements` now takes the map instead of the findings.
- **Behaviour is unchanged.** Only exact known aliases are replaced, unknown alias-shaped tokens are reported, and the rest of the text is kept character for character. A known alias always has the alias shape, so matching that shape and looking it up finds the same tokens as the old regex.
- **Test.** `restore.test.mjs` restores a clipboard reply and a 5,000-row sheet against 500,000 known aliases within a generous time limit.
