// The Ẩn nhanh circle across applications, on this Mac, before a release (README.md).
//
//   mise exec -- pnpm -C desktop quick-actions:matrix [--apps TextEdit,Chrome] [--runs 2]
//     [--no-chat] [--owner OfflineMask] [--out <dir>] [--list]
//
// Needs OfflineMask running with Ẩn nhanh on, and Accessibility for the terminal that runs
// this. Opens its own windows with synthetic text and closes only those; chat apps are
// driven only in a conversation the owner opened and confirmed, and Return is never sent.
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { apps, rawValues, sample } from "./apps.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const desktop = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};
const runs = Math.max(1, Number(option("runs", "1")));
const owner = option("owner", "OfflineMask");
const only = option("apps", "")
  .split(",")
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = option("out", join(desktop, "artifacts/quick-actions-matrix", stamp));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

if (process.platform !== "darwin") throw Error("The matrix drives macOS applications only");

// --- The Swift helper, rebuilt when its source changes -------------------------------
const bin = join(desktop, "artifacts/quick-actions-matrix/bin");
const helperPath = join(bin, "helper");
async function buildHelper() {
  const source = join(here, "helper.swift");
  const digest = createHash("sha256")
    .update(await readFile(source))
    .digest("hex");
  const stampFile = join(bin, "helper.sha256");
  if (existsSync(helperPath) && existsSync(stampFile)) {
    if ((await readFile(stampFile, "utf8")) === digest) return;
  }
  await mkdir(bin, { recursive: true });
  console.log("Building the Swift helper (swiftc -O)…");
  execFileSync("swiftc", ["-O", source, "-o", helperPath], { stdio: "inherit" });
  await writeFile(stampFile, digest);
}
/** One helper subcommand; its JSON answer. */
function helper(command, options = {}) {
  const argv = [command];
  for (const [key, value] of Object.entries(options))
    if (value !== undefined && value !== null) argv.push(`--${key}`, String(value));
  const text = execFileSync(helperPath, argv, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const answer = JSON.parse(text.trim().split("\n").at(-1));
  if (answer.error) throw Error(`${command}: ${answer.error}`);
  return answer;
}
function osascript(script, ...argv) {
  return execFileSync("osascript", ["-e", script, ...argv], { encoding: "utf8" }).trim();
}

// --- Opening and closing the windows the matrix owns ----------------------------------
const page = pathToFileURL(join(here, "test-page.html")).href;
const pageUrl = `${page}#${encodeURIComponent(sample)}`;
const pageTitle = "Ẩn nhanh matrix";

/** RTF keeps Vietnamese intact in TextEdit, Word and Pages without an encoding prompt. */
function rtf(text) {
  const body = [...text]
    .map((char) => {
      const code = char.codePointAt(0);
      if (char === "\\" || char === "{" || char === "}") return `\\${char}`;
      return code < 128 ? char : `\\u${code > 32767 ? code - 65536 : code}?`;
    })
    .join("");
  return `{\\rtf1\\ansi\\uc1{\\fonttbl\\f0 Helvetica;}\\f0\\fs28 ${body}\\par}`;
}

/** Each opener answers with the app's pid, a reset between runs, and its own close. */
const openers = {
  async document(app, info, scratch) {
    const stem = `offlinemask-matrix-${stamp}-${app.name.toLowerCase()}`;
    const file = join(scratch, `${stem}.rtf`);
    let runIndex = 0;
    const close = () =>
      osascript(
        `on run argv
          tell application id "${info.bundle}" to close (every document whose name starts with (item 1 of argv)) saving no
        end run`,
        stem,
      );
    const openOne = async () => {
      runIndex++;
      const path = file.replace(/\.rtf$/, `-${runIndex}.rtf`);
      await writeFile(path, rtf(sample));
      execFileSync("open", ["-a", info.path, path]);
      const pid = await pidOf(info);
      await closeOnFailure(close, async () => {
        const shown = helper("wait-title", { pid, title: basename(path, ".rtf"), timeout: 20000 });
        if (!shown.found) throw Error(`${app.name} did not open ${basename(path)}`);
        await sleep(400);
      });
      return pid;
    };
    return { pid: await openOne(), reset: openOne, close };
  },

  async notes(app, info) {
    const title = `OfflineMask matrix ${stamp}`;
    const made = [];
    // Only the notes the matrix made; they go to Recently Deleted.
    const close = () => {
      for (const id of made)
        osascript(
          `on run argv
          tell application "Notes" to delete note id (item 1 of argv)
        end run`,
          id,
        );
    };
    const openOne = async () => {
      const id = osascript(
        `on run argv
          tell application "Notes"
            set made to make new note at default folder of default account with properties {body:"<div><h1>" & (item 1 of argv) & "</h1></div><div>" & (item 2 of argv) & "</div>"}
            show made
            activate
            return id of made
          end tell
        end run`,
        title,
        sample,
      );
      made.push(id);
      await sleep(900);
      return pidOf(info);
    };
    let pid;
    await closeOnFailure(close, async () => (pid = await openOne()));
    return { pid, reset: openOne, close };
  },

  async safari(app, info) {
    const windowId = osascript(
      `on run argv
        tell application "Safari"
          make new document with properties {URL:(item 1 of argv)}
          activate
          return id of front window
        end tell
      end run`,
      pageUrl,
    );
    const pid = await pidOf(info);
    const close = () =>
      osascript(
        `on run argv
        tell application "Safari" to close (every window whose id is (item 1 of argv as integer))
      end run`,
        windowId,
      );
    await closeOnFailure(close, () => waitForPage(pid));
    return { pid, reset: () => reloadPage(pid), close };
  },

  async chrome(app, info, scratch) {
    // A separate Chrome on a throwaway profile: the owner's browser and profile are untouched.
    const profile = join(scratch, "chrome-profile");
    await mkdir(profile, { recursive: true });
    const flag = `--user-data-dir=${profile}`;
    const child = spawn(
      join(info.path, "Contents/MacOS/Google Chrome"),
      [flag, "--no-first-run", "--no-default-browser-check", "--new-window", pageUrl],
      { stdio: "ignore", detached: true },
    );
    child.unref();
    const pid = child.pid;
    const close = async () => {
      process.kill(pid, "SIGTERM");
      await sleep(1500);
    };
    await closeOnFailure(close, async () => {
      const shown = helper("wait-title", { pid, title: pageTitle, timeout: 20000 });
      if (!shown.found) throw Error("The test Chrome did not show the page");
      await waitForPage(pid);
    });
    return { pid, reset: () => reloadPage(pid), close };
  },

  async chat(app, info, _scratch, ask) {
    if (!ask) return null;
    const answer = await ask(
      `\n${app.name}: open a TEST conversation (or a note to yourself), click in its message box,\n` +
        `then press Enter here to let the matrix paste sample text there (it never sends; s skips). `,
    );
    if (answer.trim().toLowerCase().startsWith("s")) return null;
    const pid = await pidOf(info);
    helper("web-accessibility", { pid });
    helper("activate", { pid, wait: 1500 });
    const box = helper("read", { pid }).element;
    return { pid, composer: box, reset: async () => pid, close: () => {} };
  },
};

/** Runs `ready` for a window just opened; when it fails, that window is closed again. */
async function closeOnFailure(close, ready) {
  try {
    await ready();
  } catch (error) {
    await Promise.resolve()
      .then(close)
      .catch(() => {});
    throw error;
  }
}

async function pidOf(info) {
  for (let tries = 0; tries < 50; tries++) {
    const found = helper("app", { bundle: info.bundle });
    if (found.pid) return found.pid;
    await sleep(200);
  }
  throw Error(`${info.bundle} did not start`);
}
/** Chromium builds its web tree for assistive technology only once asked (decision 0126). */
async function waitForPage(pid) {
  // A browser that has just started can miss the first request; ask again.
  for (let attempt = 0; attempt < 3; attempt++) {
    helper("web-accessibility", { pid });
    await sleep(2000);
    if (helper("wait-element", { pid, "dom-id": "field-textarea", timeout: 6000 }).found) return;
  }
  throw Error("The test page's fields never appeared in Accessibility");
}
async function reloadPage(pid) {
  helper("activate", { pid });
  helper("reload");
  await sleep(1200);
  await waitForPage(pid);
  return pid;
}

/** The message box the owner focused: same role and column (it grows with its text). */
const sameBox = (now, box) =>
  Boolean(box?.frame) &&
  now.role === box.role &&
  now.frame?.[0] === box.frame[0] &&
  now.frame?.[2] === box.frame[2];

/** A document view that has just opened can take a few seconds to appear (Word). */
async function focus(pid, field) {
  for (let attempt = 0; ; attempt++) {
    try {
      return helper("focus", { pid, "dom-id": field.domId, role: field.role });
    } catch (error) {
      if (attempt >= 15) throw error;
      await sleep(500);
    }
  }
}

// --- One field, one run -----------------------------------------------------------------
const pasteLine = /^(paste|beforeinput:insertFromPaste)@(.+)$/;
function readLog(pid) {
  return (helper("read", { pid, "dom-id": "log" }).text ?? "").split("\n").filter(Boolean);
}

async function runField(app, session, field, run) {
  const web = app.kind === "safari" || app.kind === "chrome";
  const row = { app: app.name, field: field.label, run, expect: field.expect };
  try {
    helper("activate", { pid: session.pid });
    if (app.kind === "chat") {
      const now = helper("read", { pid: session.pid }).element;
      if (!sameBox(now, session.composer))
        throw Error("focus left the message box; nothing was pasted");
      helper("paste-text", { text: sample });
    }
    const { digest } = helper("set-clipboard-image");
    const logBefore = web ? readLog(session.pid) : [];
    if (field.select !== "triple-click" && (field.domId || field.role))
      await focus(session.pid, field);
    const result = helper("case", {
      pid: session.pid,
      owner,
      "dom-id": field.domId,
      role: field.domId ? undefined : field.role,
      select: field.select,
      "result-timeout": 6000,
    });
    const clipboard = helper("check-clipboard", { digest, timeout: 4000 });
    row.circleMs = result.circleMs ?? null;
    row.resultMs = result.resultMs ?? null;
    row.outcome = result.outcome;
    row.clipboardRestored = clipboard.restored;
    row.clipboardTypes = clipboard.types;
    row.masked =
      result.outcome === "replaced" ? rawValues.every((raw) => !result.after.includes(raw)) : null;
    if (web) {
      const pastes = readLog(session.pid)
        .slice(logBefore.length)
        .map((line) => line.match(pasteLine))
        .filter(Boolean)
        .map((match) => match[2]);
      row.pasteTargets = [...new Set(pastes)];
      row.strayPaste =
        pastes.some((target) => target !== field.domId) ||
        (field.expect === "preview" && pastes.length > 0);
    } else {
      // Outside a web page only the field itself can be watched.
      row.strayPaste = result.changed && result.outcome !== "replaced";
    }
    row.ok =
      row.outcome === field.expect &&
      !row.strayPaste &&
      row.clipboardRestored &&
      (row.masked ?? true);
    if (app.kind === "chat") {
      const now = helper("read", { pid: session.pid }).element;
      if (sameBox(now, session.composer)) helper("clear-field");
      else row.note = "message box not cleared: focus moved";
    }
  } catch (error) {
    row.outcome = "error";
    row.ok = false;
    row.note = error.message.split("\n")[0];
  }
  console.log(
    `  ${row.app} · ${row.field} #${run}: ${row.outcome}` +
      (row.circleMs != null ? `, circle ${row.circleMs} ms` : "") +
      (row.resultMs != null ? `, result ${row.resultMs} ms` : "") +
      (row.ok ? "" : "  ✗"),
  );
  return row;
}

// --- Report -----------------------------------------------------------------------------
const yesNo = (value) => (value == null ? "—" : value ? "yes" : "no");
function markdown(rows, skipped, meta) {
  const lines = [
    `# Ẩn nhanh matrix — ${meta.date}`,
    "",
    `OfflineMask window owner \`${owner}\`, ${runs} run(s) per field, macOS ${meta.macos}.`,
    "",
    "| App | Field | Run | Circle | Result | Outcome | Expected | Stray paste | Masked | Clipboard back | OK |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows
      .map((row) =>
        [
          row.app,
          row.field,
          row.run,
          row.circleMs != null ? `${row.circleMs} ms` : "—",
          row.resultMs != null ? `${row.resultMs} ms` : "—",
          row.outcome + (row.note ? ` (${row.note})` : ""),
          row.expect,
          yesNo(row.strayPaste) +
            (row.strayPaste && row.pasteTargets?.length ? ` (${row.pasteTargets.join(", ")})` : ""),
          yesNo(row.masked),
          yesNo(row.clipboardRestored),
          row.ok ? "✓" : "✗",
        ].join(" | "),
      )
      .map((line) => `| ${line} |`),
  ];
  if (skipped.length)
    lines.push("", "Skipped: " + skipped.map((s) => `${s.app} (${s.reason})`).join(", ") + ".");
  lines.push(
    "",
    "Circle: from the selection keystroke or click to the circle on screen. Result: from the click to the field changing or the preview card showing. Stray paste: a paste event outside the field (web pages), or a change to a field that was not replaced.",
  );
  return lines.join("\n") + "\n";
}

// --- Main -------------------------------------------------------------------------------
await buildHelper();
if (!helper("trusted").trusted)
  throw Error("Give this terminal Accessibility in System Settings › Privacy & Security");

const installed = [];
const skipped = [];
for (const app of apps) {
  if (only.length && !only.includes(app.name.toLowerCase())) continue;
  if (args.includes("--no-chat") && app.kind === "chat") continue;
  const info = helper("app", { bundle: app.bundles.join(",") });
  if (info.path) installed.push({ app, info });
  else skipped.push({ app: app.name, reason: "not installed" });
}
if (args.includes("--list")) {
  for (const { app, info } of installed) console.log(`${app.name}\t${info.path}`);
  for (const s of skipped) console.log(`${s.app}\t(${s.reason})`);
  process.exit(0);
}
try {
  execFileSync("pgrep", ["-x", owner], { stdio: "ignore" });
} catch {
  throw Error(`${owner} is not running: start it (or pnpm -C desktop desktop:dev:native) first`);
}

const prompt = process.stdin.isTTY
  ? createInterface({ input: process.stdin, output: process.stdout })
  : null;
const ask = prompt ? (question) => prompt.question(question) : null;
const scratch = await mkdtemp(join(tmpdir(), "offlinemask-matrix-"));
const rows = [];
const original = helper("frontmost");
try {
  for (const { app, info } of installed) {
    console.log(`${app.name}…`);
    let session = null;
    try {
      session = await openers[app.kind](app, info, scratch, ask);
      if (!session) {
        skipped.push({
          app: app.name,
          reason: ask ? "skipped by the owner" : "needs a terminal to confirm",
        });
        continue;
      }
      for (let run = 1; run <= runs; run++) {
        if (run > 1) session.pid = await session.reset();
        for (const field of app.fields) rows.push(await runField(app, session, field, run));
      }
    } catch (error) {
      rows.push({
        app: app.name,
        field: "—",
        run: 1,
        outcome: "error",
        ok: false,
        note: error.message.split("\n")[0],
      });
      console.log(`  ${app.name}: ${error.message}`);
    } finally {
      if (session) {
        try {
          await session.close();
        } catch (error) {
          console.log(`  ${app.name}: could not close the matrix's window: ${error.message}`);
        }
      }
    }
  }
} finally {
  prompt?.close();
  await rm(scratch, { recursive: true, force: true });
  if (original.pid) helper("activate", { pid: original.pid });
}

const meta = {
  date: new Date().toISOString(),
  macos: execFileSync("sw_vers", ["-productVersion"], { encoding: "utf8" }).trim(),
  owner,
  runs,
};
await mkdir(out, { recursive: true });
const report = markdown(rows, skipped, meta);
await writeFile(join(out, "report.md"), report);
await writeFile(
  join(out, "report.json"),
  JSON.stringify({ ...meta, rows, skipped }, null, 2) + "\n",
);
console.log(`\n${report}\nWritten to ${out}`);
process.exitCode = rows.every((row) => row.ok) ? 0 : 1;
