/** A synthetic Word sample for "Thử với tệp mẫu" (decision 0078). Every name, number
 * and address is invented. Built on demand so JSZip loads only when asked. */
export const sampleDocName = "Hợp đồng mẫu.docx";

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const paragraph = (text: string, bold = false) =>
  `<w:p><w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

export async function sampleDocx(): Promise<Uint8Array> {
  const { default: JSZip } = await import("jszip");
  const body = [
    paragraph("HỢP ĐỒNG THUÊ NHÀ", true),
    paragraph("Số: 12/2026/HĐTN"),
    paragraph(
      "Bên cho thuê (Bên A): Ông Trần Quốc Bảo, CCCD 079203004512, điện thoại 0912 345 678.",
    ),
    paragraph(
      "Bên thuê (Bên B): Bà Lê Ngọc Hà, email ngocha.le@example.com, điện thoại 0987 654 321.",
    ),
    paragraph("Địa chỉ nhà thuê: 25 Lý Thường Kiệt, Phường 7, Quận 10, TP. Hồ Chí Minh."),
    paragraph(
      "Giá thuê: 9.500.000 đồng/tháng, thanh toán vào tài khoản số 0071000123456 tại Vietcombank.",
    ),
    paragraph("Thời hạn thuê: 12 tháng, từ ngày 01/11/2026."),
    paragraph("Bên B cam kết giữ gìn tài sản và thanh toán đúng hạn."),
    paragraph("Đại diện Bên A: Trần Quốc Bảo — Đại diện Bên B: Lê Ngọc Hà"),
  ].join("");
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "uint8array" });
}
