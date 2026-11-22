import {
  DataError,
  MAX_PHOTO_EDGE_PX,
  MAX_PHOTO_SOURCE_BYTES,
  SUPPORTED_IMAGE_MIME_TYPES,
  type SupportedImageMimeType,
} from '../contracts';

export interface PhotoSource {
  blob: Blob;
  fileName?: string;
  /** 由文件头实际识别出的格式，而不是只相信扩展名或 MIME 声明。 */
  sourceMime: SupportedImageMimeType;
}

export interface ProcessedPhoto {
  blob: Blob;
  mime: SupportedImageMimeType;
  width: number;
  height: number;
}

/** 浏览器实现与测试注入的边界；照片仓储不直接假定 Canvas 可用。 */
export interface PhotoProcessor {
  process(source: PhotoSource): Promise<ProcessedPhoto>;
}

const LOSSY_QUALITY = 0.85;
const HEADER_BYTES = 16;

export function isSupportedImageMimeType(value: string): value is SupportedImageMimeType {
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

export function assertPhotoSourceSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) {
    throw new DataError('INVALID_PHOTO', '照片文件为空');
  }
  if (size > MAX_PHOTO_SOURCE_BYTES) {
    throw new DataError('PHOTO_TOO_LARGE', `照片不能超过 ${MAX_PHOTO_SOURCE_BYTES / 1024 / 1024} MB`, {
      size,
      maxSize: MAX_PHOTO_SOURCE_BYTES,
    });
  }
}

export function detectImageMime(bytes: Uint8Array): SupportedImageMimeType | undefined {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return undefined;
}

export function calculateScaledSize(
  width: number,
  height: number,
  maxEdge: number = MAX_PHOTO_EDGE_PX,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new DataError('IMAGE_DECODE_FAILED', '图片尺寸无效');
  }
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxEdge / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** 读取文件头、校验体积与真实格式。实际解码发生在 PhotoProcessor。 */
export async function readPhotoSource(blob: Blob): Promise<PhotoSource> {
  assertPhotoSourceSize(blob.size);
  let header: Uint8Array;
  try {
    header = new Uint8Array(await blob.slice(0, HEADER_BYTES).arrayBuffer());
  } catch (error) {
    throw new DataError('INVALID_PHOTO', '无法读取照片文件', {
      cause: (error as { message?: string } | null)?.message,
    });
  }
  const sourceMime = detectImageMime(header);
  if (!sourceMime) {
    throw new DataError('UNSUPPORTED_IMAGE_TYPE', '仅支持 JPEG、PNG、WebP 照片');
  }
  const fileName = typeof File !== 'undefined' && blob instanceof File ? blob.name : undefined;
  return { blob, fileName, sourceMime };
}

interface DrawSurface {
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  toBlob(type: string, quality?: number): Promise<Blob>;
}

function createSurface(width: number, height: number): DrawSurface {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new DataError('PHOTO_PROCESSING_FAILED', '无法创建图片处理画布');
    }
    return {
      context,
      toBlob: (type, quality) => canvas.convertToBlob({ type, quality }),
    };
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new DataError('PHOTO_PROCESSING_FAILED', '无法创建图片处理画布');
    }
    return {
      context,
      toBlob: (type, quality) =>
        new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (result) => {
              if (result) resolve(result);
              else reject(new DataError('PHOTO_PROCESSING_FAILED', '图片编码失败'));
            },
            type,
            quality,
          );
        }),
    };
  }

  throw new DataError('PHOTO_PROCESSING_FAILED', '当前环境不支持图片压缩');
}

async function processPhotoInBrowser(source: PhotoSource): Promise<ProcessedPhoto> {
  if (typeof createImageBitmap !== 'function') {
    throw new DataError('PHOTO_PROCESSING_FAILED', '当前浏览器不支持图片处理');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source.blob, { imageOrientation: 'from-image' });
  } catch (firstError) {
    try {
      // 旧浏览器可能不认识 imageOrientation 选项；无选项再解码一次。
      bitmap = await createImageBitmap(source.blob);
    } catch {
      throw new DataError('IMAGE_DECODE_FAILED', '无法解码图片，请确认文件未损坏', {
        cause: (firstError as { message?: string } | null)?.message,
      });
    }
  }

  try {
    const target = calculateScaledSize(bitmap.width, bitmap.height);
    if (target.width === bitmap.width && target.height === bitmap.height) {
      const blob =
        source.blob.type === source.sourceMime
          ? source.blob
          : new Blob([source.blob], { type: source.sourceMime });
      return { blob, mime: source.sourceMime, width: bitmap.width, height: bitmap.height };
    }

    const surface = createSurface(target.width, target.height);
    surface.context.imageSmoothingEnabled = true;
    surface.context.imageSmoothingQuality = 'high';
    surface.context.drawImage(bitmap, 0, 0, target.width, target.height);

    const quality = source.sourceMime === 'image/png' ? undefined : LOSSY_QUALITY;
    const encoded = await surface.toBlob(source.sourceMime, quality);
    if (!isSupportedImageMimeType(encoded.type)) {
      throw new DataError('PHOTO_PROCESSING_FAILED', '浏览器无法编码该图片格式');
    }
    return { blob: encoded, mime: encoded.type, width: target.width, height: target.height };
  } finally {
    bitmap.close();
  }
}

export const browserPhotoProcessor: PhotoProcessor = {
  process: processPhotoInBrowser,
};