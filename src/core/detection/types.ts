import type { DetectionOption } from "./options.ts";
export interface Detection {
  start: number;
  end: number;
  type: string;
  label: string;
  source: string;
  reason: string;
  priority: number;
}

export type DetectionProgress = { stage: "loading" | "processing"; completed: number; total: number };
export type WorkerRequest = { text: string; modelRoot?: string; options: DetectionOption[] };
export type WorkerResponse = { runId: number } & (
  | { type: "native"; id: number; request: import("./native-recognition.ts").NativeCall }
  | { type: "encode"; id: number; text: string }
  | { type: "progress"; progress: DetectionProgress }
  | { type: "result"; detections: Detection[] }
  | { type: "error" }
  | { type: "cancelled" }
  | { type: "reset" });
