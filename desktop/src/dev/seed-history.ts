import type { Ref } from "vue";
import type { Detection } from "../core/detection/types.ts";
import type { Finding } from "../core/review.ts";
import {
  aliasScope,
  createTextSession,
  type DocSession,
  type Session,
  type SheetSession,
} from "../core/sessions.ts";

/** Development only: fills an unlocked history with made-up entries to try paging and
 * search (decision 0192). Loaded by App.vue under `import.meta.env.DEV`, so it never ships.
 * Every name, number and address below is invented. Seeded ids end in `seedTail`, so
 * `offlinemaskSeed.clear()` removes exactly them. */
const seedTail = "5eed5eed5eed";
const people = [
  "Nguyễn Văn An",
  "Trần Thị Bích",
  "Lê Hoàng Cường",
  "Phạm Minh Dũng",
  "Võ Thị Hà",
  "Đặng Quốc Huy",
  "Bùi Thu Lan",
  "Hồ Gia Bảo",
];
const streets = ["12 Lê Lợi, Quận 1", "45 Trần Hưng Đạo, Hà Nội", "8 Nguyễn Huệ, Đà Nẵng"];
const texts: ((name: string, phone: string, email: string, street: string) => string)[] = [
  (n, p) => `Khách hàng ${n} gọi lúc sáng, số ${p}, cần báo giá nhẫn cưới vàng 18K.`,
  (n, _p, e) => `Gửi hoá đơn tháng 10 cho ${n} qua email ${e} trước thứ Sáu.`,
  (n, p, _e, s) => `Giao hàng cho ${n} tại ${s}, liên hệ ${p} khi đến nơi.`,
  (n, _p, e) => `Tóm tắt cuộc họp: ${n} (${e}) đồng ý gia hạn hợp đồng thêm 12 tháng.`,
  (n, p) => `Bảo hành dây chuyền cho ${n}, SĐT ${p}, hẹn trả ngày 05/11.`,
  (n, _p, e, s) => `Cập nhật địa chỉ của ${n}: ${s}. Email mới ${e}.`,
];
const docNames = [
  "Hợp đồng thuê nhà",
  "Biên bản bàn giao",
  "Đơn xin nghỉ phép",
  "Báo giá trang sức",
  "Thư mời phỏng vấn",
];
const sheetNames = ["Danh sách khách hàng", "Bảng lương tháng 10", "Đơn hàng tuần 43"];

function pick<T>(items: readonly T[], i: number): T {
  return items[i % items.length]!;
}
function seedId(taken: Set<string>): string {
  let head: string;
  do
    head = Math.floor(Math.random() * 0x10000 * 0x10000)
      .toString(16)
      .padStart(8, "0");
  while (taken.has(head.slice(0, 4)));
  taken.add(head.slice(0, 4));
  return `${head}-0000-4000-8000-${seedTail}`;
}
function detect(text: string, value: string, type: string, label: string): Detection[] {
  const start = text.indexOf(value);
  return start < 0
    ? []
    : [
        {
          start,
          end: start + value.length,
          type,
          label,
          source: "seed",
          reason: "seed",
          priority: 1,
        },
      ];
}
function finding(n: number, type: string, label: string, value: string, scope: string): Finding {
  return {
    id: `${type}_${n}`,
    label,
    value,
    alias: `[${type}_${n}_${scope}]`,
    reason: "seed",
    source: "seed",
  };
}

/** `count` entries, newest first, spread over the last `days` days. */
export function seedSessions(count: number, existing: readonly Session[], days = 7): Session[] {
  const taken = new Set(existing.map((session) => aliasScope(session.id)));
  let number = existing.reduce((max, s) => Math.max(max, s.number), 0);
  const now = Date.now();
  const out: Session[] = [];
  for (let i = 0; i < count; i++) {
    const createdAt = new Date(now - ((i + 1) / count) * days * 86_400_000).toISOString();
    const name = pick(people, i);
    const id = seedId(taken);
    const scope = aliasScope(id);
    number += 1;
    const kind = i % 5;
    if (kind === 3) {
      const fileName = `${pick(docNames, i)} ${name.split(" ").at(-1)}.docx`;
      const text = `Bên A: [TEN_1_${scope}], địa chỉ [DIA_CHI_1_${scope}].`;
      const doc: DocSession = {
        id,
        number,
        format: "word",
        fixture: "private-doc-v1",
        createdAt,
        fileName,
        paragraphs: 12,
        preview: [{ text, marks: [{ start: 7, end: 7 + `[TEN_1_${scope}]`.length }] }],
        findings: [
          finding(1, "TEN", "Họ và tên", name, scope),
          finding(1, "DIA_CHI", "Địa chỉ", pick(streets, i), scope),
        ],
        masked: 2,
      };
      out.push(doc);
    } else if (kind === 4) {
      const fileName = `${pick(sheetNames, i)}.xlsx`;
      const sheet: SheetSession = {
        id,
        number,
        format: "excel",
        fixture: "private-sheet-v1",
        createdAt,
        fileName,
        mode: "columns",
        sheets: [
          {
            name: "Sheet1",
            rows: 3,
            plans: [{ mode: "hide", type: "TEN", label: "Họ và tên" }, { mode: "keep" }],
          },
        ],
        preview: [
          {
            header: ["Họ và tên", "Thành phố"],
            rows: [1, 2, 3].map((n) => [
              `[TEN_${n}_${scope}]`,
              pick(["Hà Nội", "Huế", "Cần Thơ"], n),
            ]),
          },
        ],
        findings: [1, 2, 3].map((n) => finding(n, "TEN", "Họ và tên", pick(people, i + n), scope)),
        masked: 3,
      };
      out.push(sheet);
    } else {
      const phone = `09${String(10_000_000 + i * 7919).slice(-8)}`;
      const email = `khach${i + 1}@example.com`;
      const text = pick(texts, i)(name, phone, email, pick(streets, i));
      const detections = [
        ...detect(text, name, "TEN", "Họ và tên"),
        ...detect(text, phone, "SDT", "Số điện thoại"),
        ...detect(text, email, "EMAIL", "Email"),
        ...detect(text, pick(streets, i), "DIA_CHI", "Địa chỉ"),
      ];
      const session = createTextSession(text, [], detections);
      out.push({ ...session, id, number, createdAt, analysis: retag(session.analysis, scope) });
    }
  }
  return out;
}
/** createTextSession picks its own id; give its aliases the seeded id's scope instead. */
function retag<T extends { findings: Finding[] }>(analysis: T, scope: string): T {
  return {
    ...analysis,
    findings: analysis.findings.map((f) => ({
      ...f,
      alias: f.alias.replace(/_[a-f0-9]{4,8}\]$/, `_${scope}]`),
    })),
  };
}
export function isSeeded(session: Session): boolean {
  return session.id.endsWith(seedTail);
}

/** `offlinemaskSeed.add(80)` and `offlinemaskSeed.clear()` in the dev tools console. The
 * shell's watcher saves the change into the vault, as it does for real entries. */
export function installSeed(sessions: Ref<Session[]>, unlocked: () => boolean) {
  const sort = (list: Session[]) =>
    list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  Object.assign(window, {
    offlinemaskSeed: {
      add(count = 80, days = 7) {
        if (!unlocked())
          return "Set or enter the passcode first: seeded entries go into the vault.";
        sessions.value = sort([...sessions.value, ...seedSessions(count, sessions.value, days)]);
        return `Added ${count} made-up entries over ${days} days.`;
      },
      clear() {
        const before = sessions.value.length;
        sessions.value = sessions.value.filter((session) => !isSeeded(session));
        return `Removed ${before - sessions.value.length} made-up entries.`;
      },
    },
  });
}
