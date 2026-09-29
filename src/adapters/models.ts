import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import pack from '../../scripts/release-pack-v1.json' with { type: 'json' };
export interface ModelStatus {
  stage: 'checking' | 'missing' | 'downloading' | 'installing' | 'cancelling' | 'paused' | 'error' | 'ready';
  downloaded: number;
  total: number;
  installedBytes: number;
  installed: number;
  error: string | null;
  root: string | null;
}
export const installedModelBytes = pack.assets.reduce((sum, asset) => sum + asset.bytes, 0);
export const totalModelBytes = pack.assets.reduce((sum, asset) => sum + asset.transport.bytes, 0);
export const formatModelBytes = (bytes: number) => bytes >= 1e9
  ? `${(bytes / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} GB`
  : `${(bytes / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} MB`;
export const desktopModels = isTauri();
export async function modelStatus(): Promise<ModelStatus> {
  if (!desktopModels) return { stage:'missing',downloaded:0,total:totalModelBytes,installedBytes:installedModelBytes,installed:0,error:null,root:null };
  const status = await invoke<ModelStatus>('model_status');
  return {...status, root:status.root ? convertFileSrc(status.root) : null};
}
export const downloadModels = () => invoke<void>('download_models');
export const cancelModelDownload = () => invoke<void>('cancel_model_download');
