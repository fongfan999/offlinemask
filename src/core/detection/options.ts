import type { Detection } from './types.ts';
export const detectionOptions = [
  { id: 'email', label: 'Email', model: false, detail: 'Địa chỉ email đầy đủ.' },
  { id: 'phone', label: 'Số điện thoại', model: false, detail: 'Số Việt Nam và số quốc tế có mã quốc gia.' },
  { id: 'banking', label: 'Tài khoản và mã định danh', model: false, detail: 'Số tài khoản, CCCD/CMND, hộ chiếu, mã số thuế, mã giao dịch và mã khách hàng có nhãn.' },
  { id: 'name', label: 'Họ và tên', model: true, detail: 'Tên người trong ngữ cảnh.' },
  { id: 'address', label: 'Địa chỉ', model: true, detail: 'Địa chỉ đường phố và địa danh.' },
  { id: 'other', label: 'Thông tin riêng tư khác', model: true, detail: 'Tổ chức, ngày sinh, thông tin thẻ và thông tin đăng nhập.' },
] as const;
export type DetectionOption = typeof detectionOptions[number]['id'];
export const localOptions: DetectionOption[] = ['email', 'phone', 'banking'];
export function requiresModels(options: readonly DetectionOption[]): boolean {
  return detectionOptions.some(option => option.model && options.includes(option.id));
}
export function filterDetections(detections: readonly Detection[], options: readonly DetectionOption[]): Detection[] {
  const categories: Record<string, DetectionOption> = {
    TEN:'name', DIA_CHI:'address', EMAIL:'email', SDT:'phone',
    STK:'banking', CCCD:'banking', GIAY_TO:'banking', GD:'banking', KH:'banking',
  };
  return detections.filter(detection => options.includes(categories[detection.type] ?? 'other'));
}
