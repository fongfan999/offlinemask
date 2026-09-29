export function importReview(candidate, template) {
  if (candidate?.version !== template.version || !Array.isArray(candidate.records)) throw Error('Tệp đánh giá không hợp lệ.');
  if (candidate.splitReview?.digest !== template.splitReview.digest) throw Error('Tệp thuộc bộ ví dụ khác.');
  const expected = new Map(template.records.map(row => [row.id, row.digest])), seen = new Set();
  for (const row of candidate.records) {
    if (!expected.has(row.id) || expected.get(row.id) !== row.digest || seen.has(row.id)) throw Error('Ví dụ đã thay đổi hoặc bị trùng trong tệp.');
    seen.add(row.id);
    if (!['pending', 'approved', 'rejected'].includes(row.status)) throw Error('Trạng thái đánh giá không hợp lệ.');
    if (row.status !== 'pending') {
      if (row.reviewer?.kind !== 'human' || !row.reviewer.id?.trim() || !Number.isFinite(Date.parse(row.reviewedAt)) || !row.note?.trim()) throw Error('Thiếu người đánh giá, ngày hoặc ghi chú.');
      if (row.status === 'approved' && Object.keys(template.records[0].checks).some(check => row.checks?.[check] !== true)) throw Error('Chưa đủ xác nhận kiểm tra.');
    }
  }
  if (seen.size !== expected.size) throw Error('Tệp chưa chứa đủ danh sách ví dụ.');
  // This page reviews annotations only; preserve the separate split review as pending.
  return { ...structuredClone(candidate), splitReview: structuredClone(template.splitReview) };
}

export function recordReview(ledger, id, reviewer, status, note, authors) {
  const identity = reviewer.trim();
  if (!identity) throw Error('Nhập tên hoặc mã người đánh giá trước.');
  if (authors.includes(identity)) throw Error('Tác giả không thể tự xác nhận là người đánh giá độc lập.');
  if (!['approved', 'rejected'].includes(status)) throw Error('Trạng thái không hợp lệ.');
  if (status === 'rejected' && !note.trim()) throw Error('Ghi ngắn gọn phần cần sửa.');
  const entry = ledger.records.find(row => row.id === id);
  if (!entry) throw Error('Không tìm thấy ví dụ.');
  return { ...entry, status, reviewer: { kind: 'human', id: identity }, reviewedAt: new Date().toISOString(),
    checks: Object.fromEntries(Object.keys(entry.checks).map(key => [key, status === 'approved'])),
    note: note.trim() || 'Tôi đã kiểm tra nguồn khai báo, các giá trị đầy đủ, ranh giới, loại thông tin và phần văn bản không đánh dấu.' };
}
