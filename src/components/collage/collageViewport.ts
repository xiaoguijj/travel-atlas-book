import { COLLAGE_CANVAS_HEIGHT, COLLAGE_CANVAS_WIDTH } from '../../data/contracts';

export const COLLAGE_ASPECT_RATIO = COLLAGE_CANVAS_WIDTH / COLLAGE_CANVAS_HEIGHT;
export const COLLAGE_ZOOM_STEPS = [0.5, 0.65, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const;
export const MIN_COLLAGE_ZOOM = COLLAGE_ZOOM_STEPS[0];
export const MAX_COLLAGE_ZOOM = COLLAGE_ZOOM_STEPS[COLLAGE_ZOOM_STEPS.length - 1];
export const DEFAULT_COLLAGE_ZOOM = 1;

export interface CollageViewportBounds {
  workspaceWidth: number;
  workspaceHeight: number;
  windowWidth: number;
  windowHeight: number;
}

export interface PaperDisplaySize {
  width: number;
  height: number;
}

/** Clamp zoom to supported viewport scaling range [0.5, 2.0]. */
export function clampCollageZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return DEFAULT_COLLAGE_ZOOM;
  return Math.min(MAX_COLLAGE_ZOOM, Math.max(MIN_COLLAGE_ZOOM, zoom));
}

/** Return the next smaller zoom preset step. */
export function stepZoomOut(current: number): number {
  for (let index = COLLAGE_ZOOM_STEPS.length - 1; index >= 0; index -= 1) {
    const step = COLLAGE_ZOOM_STEPS[index];
    if (step < current - 0.001) return step;
  }
  return MIN_COLLAGE_ZOOM;
}

/** Return the next larger zoom preset step. */
export function stepZoomIn(current: number): number {
  for (const step of COLLAGE_ZOOM_STEPS) {
    if (step > current + 0.001) return step;
  }
  return MAX_COLLAGE_ZOOM;
}

export function formatZoomPercent(zoom: number): string {
  return `${Math.round(clampCollageZoom(zoom) * 100)}%`;
}

/**
 * Compute the largest paper dimensions (preserving the 4:3 logical aspect ratio)
 * that fit inside `.workspace` without overlapping floating toolbars or clipping cover/clip decor.
 */
export function computeFitPaperSize(bounds: CollageViewportBounds): PaperDisplaySize {
  const { workspaceWidth, workspaceHeight, windowWidth, windowHeight } = bounds;
  if (workspaceWidth <= 0 || workspaceHeight <= 0) return { width: 0, height: 0 };

  if (windowWidth <= 900) {
    const minWidth = windowWidth <= 560 ? 280 : 320;
    const horizontalReserve = windowWidth <= 560 ? 42 : 56;
    const verticalReserve = windowHeight <= 500 ? 130 : 148;
    const maxWidth = Math.max(minWidth, workspaceWidth - horizontalReserve);
    const maxHeight = Math.max(0, workspaceHeight - verticalReserve);
    const widthByHeight = maxHeight * COLLAGE_ASPECT_RATIO;
    const width = Math.round(Math.min(maxWidth, Math.max(minWidth, widthByHeight)));
    return { width, height: Math.round(width / COLLAGE_ASPECT_RATIO) };
  }

  // 桌面三栏布局下，左右工具轨与属性栏已由页面留白让出（见 CollageView.module.css 的桌面媒体块），
  // 缩放条也移进了右栏，工作区内只剩顶部选中栏浮层；纵向留白只需容纳选中栏与内边距。
  const horizontalReserve = 32;
  const verticalReserve = 62;
  const maxWidth = Math.min(1120, Math.max(320, workspaceWidth - horizontalReserve));
  const maxHeight = Math.max(240, workspaceHeight - verticalReserve);
  const widthByHeight = maxHeight * COLLAGE_ASPECT_RATIO;
  const minWidth = Math.min(maxWidth, 320);
  const width = Math.round(Math.min(maxWidth, Math.max(minWidth, widthByHeight)));
  return { width, height: Math.round(width / COLLAGE_ASPECT_RATIO) };
}
