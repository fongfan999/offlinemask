/** Invented Vietnamese people, companies and goods for the synthetic document set
 * (decision 0153). Everything is drawn from short lists with a seeded random source, so a
 * seed always gives the same documents. No value belongs to a real person; identifiers
 * have the right shape but are random. */

/** xorshift32: small, fast and the same on every machine. */
export function random(seed) {
  let state = seed >>> 0 || 0x9e3779b9;
  const next = () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
  const rng = {
    next,
    int: (low, high) => low + Math.floor(next() * (high - low + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (probability) => next() < probability,
    digits: (count) => Array.from({ length: count }, () => Math.floor(next() * 10)).join(""),
    shuffle: (list) => {
      const copy = [...list];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
  return rng;
}

const families = [
  "Nguyễn",
  "Trần",
  "Lê",
  "Phạm",
  "Hoàng",
  "Huỳnh",
  "Phan",
  "Vũ",
  "Võ",
  "Đặng",
  "Bùi",
  "Đỗ",
  "Hồ",
  "Ngô",
  "Dương",
  "Lý",
];
const middles = {
  male: ["Văn", "Minh", "Đức", "Quốc", "Hữu", "Gia", "Thanh", "Hoàng", "Bảo"],
  female: ["Thị", "Ngọc", "Thu", "Thanh", "Minh", "Kim", "Bảo", "Hoài"],
};
const givens = {
  male: [
    "An",
    "Bình",
    "Dũng",
    "Hải",
    "Hùng",
    "Khoa",
    "Long",
    "Nam",
    "Phúc",
    "Quân",
    "Sơn",
    "Trung",
    "Tuấn",
    "Việt",
    "Khang",
    "Đạt",
  ],
  female: [
    "Hà",
    "Hạnh",
    "Hương",
    "Lan",
    "Linh",
    "Mai",
    "Ngọc",
    "Quỳnh",
    "Tâm",
    "Thảo",
    "Trang",
    "Vy",
    "Yến",
    "Nhung",
    "Châu",
    "Giang",
  ],
};
/** Without tone marks and in capitals, as bank statements print names. */
export const unaccented = (text) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D");

export function person(rng) {
  const sex = rng.chance(0.5) ? "male" : "female";
  const family = rng.pick(families);
  const name = `${family} ${rng.pick(middles[sex])} ${rng.pick(givens[sex])}`;
  const birth = `${String(rng.int(1, 28)).padStart(2, "0")}/${String(rng.int(1, 12)).padStart(2, "0")}/${rng.int(1965, 2003)}`;
  return {
    name,
    title: sex === "male" ? "Ông" : "Bà",
    sex: sex === "male" ? "Nam" : "Nữ",
    birth,
    cccd: cccd(rng, birth),
    phone: phone(rng),
    email: email(rng, name),
    address: address(rng),
  };
}

const provinces = ["001", "031", "048", "079", "092", "075", "036", "040", "026", "089"];
/** 12 digits: province, century and sex, year of birth, six random digits. */
export function cccd(rng, birth = "01/01/1990") {
  return `${rng.pick(provinces)}${rng.int(0, 3)}${birth.slice(-2)}${rng.digits(6)}`;
}
const prefixes = [
  "090",
  "091",
  "093",
  "096",
  "097",
  "098",
  "032",
  "033",
  "086",
  "088",
  "070",
  "079",
  "077",
  "083",
];
export function phone(rng) {
  const digits = `${rng.pick(prefixes)}${rng.digits(7)}`;
  return rng.pick([
    digits,
    `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`,
    `${digits.slice(0, 4)}.${digits.slice(4, 7)}.${digits.slice(7)}`,
  ]);
}
export function email(rng, name) {
  const [family, , given] = unaccented(name).toLowerCase().split(" ");
  return `${given}.${family}${rng.int(1, 99)}@${rng.pick(["gmail.com", "yahoo.com.vn", "outlook.com"])}`;
}
export const taxCode = (rng) => `0${rng.int(1, 9)}${rng.digits(8)}`;
export const account = (rng) => rng.digits(rng.int(9, 14));

const streets = [
  "Lê Lợi",
  "Nguyễn Huệ",
  "Trần Hưng Đạo",
  "Hai Bà Trưng",
  "Lý Thường Kiệt",
  "Điện Biên Phủ",
  "Cách Mạng Tháng Tám",
  "Võ Văn Tần",
  "Nguyễn Thị Minh Khai",
  "Phan Đình Phùng",
  "Hoàng Diệu",
  "Bạch Đằng",
  "Huỳnh Văn Bánh",
  "Nguyễn Trãi",
];
const places = [
  ["Phường Bến Thành", "Thành phố Hồ Chí Minh"],
  ["Phường Sài Gòn", "Thành phố Hồ Chí Minh"],
  ["Phường Tân Định", "Thành phố Hồ Chí Minh"],
  ["Phường Phú Nhuận", "Thành phố Hồ Chí Minh"],
  ["Phường Hoàn Kiếm", "Thành phố Hà Nội"],
  ["Phường Ba Đình", "Thành phố Hà Nội"],
  ["Phường Cầu Giấy", "Thành phố Hà Nội"],
  ["Phường Hải Châu", "Thành phố Đà Nẵng"],
  ["Phường Ninh Kiều", "Thành phố Cần Thơ"],
];
export function address(rng) {
  const [ward, city] = rng.pick(places);
  const house = rng.chance(0.3) ? `${rng.int(1, 300)}/${rng.int(1, 40)}` : String(rng.int(1, 400));
  return rng.pick([
    `${house} ${rng.pick(streets)}, ${ward}, ${city}`,
    `Số ${house} ${rng.pick(streets)}, ${ward}, ${city}, Việt Nam`,
    `${house} đường ${rng.pick(streets)}, ${ward.replace("Phường", "P.")}, ${city.replace("Thành phố", "TP.")}`,
  ]);
}

const companyWords = [
  "Sao Mai",
  "An Phát",
  "Bình Minh",
  "Hòa Bình",
  "Thành Công",
  "Phú Thịnh",
  "Đông Á",
  "Việt Tiến",
  "Hưng Thịnh",
  "Minh Long",
  "Tân Phong",
  "Kim Ngân",
];
const trades = [
  "Thương mại Dịch vụ",
  "Đầu tư Xây dựng",
  "Thực phẩm",
  "Công nghệ",
  "Vận tải",
  "Thương mại Tổng hợp",
  "Xuất nhập khẩu",
];
export function company(rng) {
  const form = rng.pick(["Công ty TNHH", "Công ty Cổ phần", "Công ty TNHH MTV"]);
  const name = `${form} ${rng.pick(trades)} ${rng.pick(companyWords)}`;
  return {
    name: rng.chance(0.4) ? name.toUpperCase() : name,
    tax: taxCode(rng),
    address: address(rng),
    phone: phone(rng),
  };
}
export function household(rng) {
  return {
    name: `HỘ KINH DOANH ${rng.pick(["HẢI SẢN", "TẠP HÓA", "CƠM NIÊU", "CÀ PHÊ", "VẬT LIỆU"])} ${rng.pick(companyWords).toUpperCase()}`,
    owner: person(rng),
  };
}
export const banks = [
  "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)",
  "Ngân hàng TMCP Kỹ Thương Việt Nam (Techcombank)",
  "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)",
  "Ngân hàng TMCP Á Châu (ACB)",
  "Ngân hàng TMCP Quân đội (MB)",
];
export const bankShort = ["Vietcombank", "Techcombank", "BIDV", "ACB", "MB", "VPBank", "Sacombank"];

/** Goods as invoices list them: brands in capitals, Title Case dishes, units on their own. */
export const goods = [
  ["VISSAN Xúc xích bò tiệt trùng gói 280g", "Gói", [25000, 35000]],
  ["KIMSAN Chả lụa Hà Nội 500g", "Gói", [70000, 95000]],
  ["AN BÌNH Gạo Japonica túi 3kg", "Túi", [45000, 60000]],
  ["Gạo ST25 túi 5kg", "Túi", [130000, 180000]],
  ["OLALA Trứng Gà Sạch hộp 10", "Hộp", [28000, 36000]],
  ["Thịt bò Úc xay khay 250g", "Khay", [80000, 95000]],
  ["Ốc Hương Thiên Nhiên", "Kg", [900000, 1400000]],
  ["Sò Huyết Cồ", "Kg", [500000, 700000]],
  ["Ghẹ Xanh Bình Thuận", "Kg", [1000000, 1300000]],
  ["Mì Xào Hải Sản", "Phần", [120000, 180000]],
  ["Rau Thập Cẩm Kho Quẹt", "Phần", [90000, 130000]],
  ["Bia lon Tiger Crystal 330ml", "Lon", [18000, 22000]],
  ["Nước mắm Phú Quốc chai 500ml", "Chai", [55000, 80000]],
  ["Chuối vàng", "Kg", [25000, 32000]],
  ["Cải ngọt WINECO L1 300g", "Gói", [12000, 16000]],
  ["Phí dịch vụ tư vấn tháng 10", "Lần", [2000000, 5000000]],
  ["Cước vận chuyển nội thành", "Chuyến", [150000, 300000]],
];

export const money = (value) => Math.round(value).toLocaleString("vi-VN").replace(/,/g, ".");
const numberWords = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
/** An amount in words, as invoices and contracts print it ("Ba trăm mười ba nghìn đồng"). */
export function inWords(value) {
  const groups = [];
  for (let rest = Math.round(value); rest > 0; rest = Math.floor(rest / 1000))
    groups.push(rest % 1000);
  const units = ["", "nghìn", "triệu", "tỷ"];
  const three = (n, full) => {
    const [h, t, o] = [Math.floor(n / 100), Math.floor((n % 100) / 10), n % 10];
    const words = [];
    if (h || full) words.push(numberWords[h], "trăm");
    if (t > 1) words.push(numberWords[t], "mươi");
    else if (t === 1) words.push("mười");
    else if (o && (h || full)) words.push("linh");
    if (o) words.push(t > 1 && o === 1 ? "mốt" : t >= 1 && o === 5 ? "lăm" : numberWords[o]);
    return words;
  };
  const words = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue;
    words.push(...three(groups[i], i < groups.length - 1), units[i]);
  }
  const text = `${words.filter(Boolean).join(" ")} đồng`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
export const date = (rng, year = 2026) =>
  `${String(rng.int(1, 28)).padStart(2, "0")}/${String(rng.int(1, 12)).padStart(2, "0")}/${year}`;
