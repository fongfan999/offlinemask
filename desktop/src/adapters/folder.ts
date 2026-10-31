import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  isLitter,
  outputFolderNames,
  type FolderEntry,
  type MachineResources,
} from "../core/folder.ts";
import { saveFile } from "./sheet-files.ts";

/** A folder (or several files) the user handed the page, by drop or by the folder
 * picker (decision 0171). The web view gives exactly those files; nothing else on disk
 * is read. */
export interface PickedFolder {
  name: string;
  entries: FolderEntry[];
}

/** Whether a drop carries a folder or more than one file, so it opens the folder page. */
export function isFolderDrop(transfer: DataTransfer | null): boolean {
  const items = [...(transfer?.items ?? [])].filter((item) => item.kind === "file");
  return items.length > 1 || items.some((item) => item.webkitGetAsEntry()?.isDirectory);
}

const readEntries = (reader: FileSystemDirectoryReader) =>
  new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
const entryFile = (entry: FileSystemFileEntry) =>
  new Promise<File>((resolve, reject) => entry.file(resolve, reject));

/** Every file under the dropped items, with its path inside the dropped folder. Entries
 * must be taken while the drop event runs; walking them can take its time. */
export async function droppedFolder(transfer: DataTransfer): Promise<PickedFolder> {
  const roots = [...transfer.items]
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => !!entry);
  const single = roots.length === 1 && roots[0]!.isDirectory ? roots[0]! : null;
  const entries: FolderEntry[] = [];
  async function walk(entry: FileSystemEntry, path: string) {
    if (isLitter(entry.name)) return;
    if (entry.isFile) {
      entries.push({ path, file: await entryFile(entry as FileSystemFileEntry) });
      return;
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries returns a batch at a time until it returns none.
    for (let batch = await readEntries(reader); batch.length; batch = await readEntries(reader))
      for (const child of batch) await walk(child, path ? `${path}/${child.name}` : child.name);
  }
  if (single) await walk(single, "");
  else for (const root of roots) await walk(root, root.name);
  return { name: single?.name ?? "Tệp đã chọn", entries };
}

/** The files of a folder input (`webkitdirectory`): "Hồ sơ/2024/a.docx" → "2024/a.docx". */
export function inputFolder(files: FileList): PickedFolder {
  const all = [...files];
  const name = all[0]?.webkitRelativePath.split("/")[0] || "Thư mục";
  const entries = all
    .map((file) => ({
      path: file.webkitRelativePath.split("/").slice(1).join("/") || file.name,
      file,
    }))
    .filter((entry) => !entry.path.split("/").some(isLitter));
  return { name, entries };
}

/** Processor count and installed memory; in the browser preview only what it says. */
export async function machineResources(): Promise<MachineResources> {
  if (isTauri()) {
    try {
      return await invoke<MachineResources>("machine_resources");
    } catch {
      // Fall through to the web view's own figure.
    }
  }
  const memory = (navigator as { deviceMemory?: number }).deviceMemory;
  return { cores: navigator.hardwareConcurrency || 4, memory: memory ? memory * 1024 ** 3 : null };
}

/** Where a masked folder is written: a new folder inside the one the user picks. The
 * folder dialog adds only the picked folder to the app's file scope. `write` puts one
 * file at its relative path. In the browser preview each file downloads instead. */
export interface FolderTarget {
  name: string;
  write(path: string, bytes: Uint8Array): Promise<void>;
  /** The same, a piece at a time, for a streamed file (decision 0174). */
  writeStream(path: string, pieces: ReadableStream<Uint8Array>): Promise<void>;
}
/** Whether making a folder failed because the name is taken. The system's words are in
 * the user's language (Vietnamese Windows says "đã tồn tại"), so the code decides:
 * EEXIST is 17 on macOS and Linux; on Windows ERROR_FILE_EXISTS is 80, ERROR_ALREADY_EXISTS 183. */
export const folderExists = (error: unknown) =>
  /\(os error (17|80|183)\)|exists/i.test(String(error));
export async function pickFolderTarget(root: string): Promise<FolderTarget | null> {
  if (!isTauri())
    return {
      name: `${root} (OfflineMasked)`,
      async write(path, bytes) {
        await saveFile(bytes, path.split("/").pop()!);
      },
      async writeStream(path, pieces) {
        const bytes = new Uint8Array(await new Response(pieces).arrayBuffer());
        await saveFile(bytes, path.split("/").pop()!);
      },
    };
  const [{ open }, { mkdir, writeFile }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs"),
  ]);
  const parent = await open({
    directory: true,
    recursive: true,
    title: "Chọn nơi lưu thư mục đã ẩn",
  });
  if (typeof parent !== "string") return null;
  // Joined here: the path API is a command the app is not granted, and needs none.
  const separator = parent.includes("\\") && !parent.includes("/") ? "\\" : "/";
  const join = (...parts: string[]) => [parent.replace(/[\\/]+$/, ""), ...parts].join(separator);
  let name = "";
  for (const candidate of outputFolderNames(root)) {
    try {
      // Without `recursive` an existing folder is an error: try the next name. Any
      // other error (no permission, a full disk) is the answer, not a reason to go on.
      await mkdir(join(candidate));
      name = candidate;
      break;
    } catch (error) {
      if (!folderExists(error)) throw error;
      if (candidate.endsWith(" 99)")) throw new Error("No free folder name", { cause: error });
    }
  }
  const made = new Set<string>();
  /** The file's full path, its folders made first. */
  async function place(path: string) {
    const parts = path.split("/");
    const folder = parts.slice(0, -1);
    if (folder.length && !made.has(folder.join("/"))) {
      await mkdir(join(name, ...folder), { recursive: true });
      made.add(folder.join("/"));
    }
    return join(name, ...parts);
  }
  return {
    name,
    async write(path, bytes) {
      await writeFile(await place(path), bytes);
    },
    async writeStream(path, pieces) {
      // The plugin opens the file and writes each piece as it comes.
      await writeFile(await place(path), pieces);
    },
  };
}
