export type ImageFormat = "image/jpeg" | "image/png" | "image/webp";
export type ResizeMode = "exact" | "width" | "height" | "longest" | "original";
export interface ResizeOptions {
  mode: ResizeMode;
  width: number;
  height: number;
  fit: "contain" | "cover";
}
export interface ProcessOptions extends ResizeOptions {
  format: ImageFormat;
  maxBytes?: number;
}
export interface ImageSource {
  file: File;
  bitmap: ImageBitmap;
  width: number;
  height: number;
  format: ImageFormat;
}
export interface ImageResult {
  preservedOriginal?: boolean;
  blob: Blob;
  width: number;
  height: number;
  format: ImageFormat;
}

export type ProcessingStatus =
  "reading" | "waiting" | "processing" | "done" | "failed";
export interface ImageJob {
  id: string;
  originalFile: File;
  filename: string;
  width: number;
  height: number;
  originalSize: number;
  format?: ImageFormat;
  previewUrl: string;
  processingStatus: ProcessingStatus;
  resultBlob?: Blob;
  resultWidth?: number;
  resultHeight?: number;
  resultSize?: number;
  resultFormat?: ImageFormat;
  preservedOriginal: boolean;
  error: string;
}
export interface OutputSettings extends ResizeOptions {
  format: ImageFormat | "original";
  sizeUnit: "none" | "KB" | "MB";
  sizeLimit: number;
}
