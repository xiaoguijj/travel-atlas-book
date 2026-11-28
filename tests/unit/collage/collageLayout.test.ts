import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_LEGACY_COLLAGE_WIDTHS,
  COLLAGE_CANVAS_HEIGHT,
  COLLAGE_CANVAS_WIDTH,
  type CollageCanvas,
} from '../../../src/data/contracts';
import { assertCollageCanvas } from '../../../src/data/validation';
import {
  COLLAGE_ASPECT_RATIO,
  MAX_COLLAGE_ZOOM,
  MIN_COLLAGE_ZOOM,
  clampCollageZoom,
  computeFitPaperSize,
  formatZoomPercent,
  stepZoomIn,
  stepZoomOut,
} from '../../../src/components/collage/collageViewport';

describe('collage landscape canvas layout, zoom and legacy compatibility', () => {
  it('uses a 4:3 landscape logical canvas while keeping height unchanged', () => {
    expect(COLLAGE_CANVAS_WIDTH).toBe(2133);
    expect(COLLAGE_CANVAS_HEIGHT).toBe(1600);
    expect(COLLAGE_CANVAS_WIDTH / COLLAGE_CANVAS_HEIGHT).toBeCloseTo(4 / 3, 3);
    expect(COLLAGE_ASPECT_RATIO).toBeCloseTo(4 / 3, 3);
    expect(ACCEPTED_LEGACY_COLLAGE_WIDTHS).toEqual([1200, 1800]);
  });

  it('keeps legacy item coordinates untouched: widening only extends the paper rightward', () => {
    // 旧存档（1200 竖版与 1800 宽版）打开时元素坐标一律不变，仅纸张向右扩宽；
    // 不做居中平移、换轴或缩放，任何一次实际编辑后才以 2133 入库。
    const legacy: CollageCanvas = {
      width: 1200,
      height: 1600,
      items: [
        { id: 'p1', kind: 'photo', assetId: 'photo:1', x: 100, y: 120, width: 360, height: 280, rotation: -4 },
        { id: 's1', kind: 'sticker', assetId: 'sticker:stamp-nanjing', x: 600, y: 300, width: 240, height: 240, rotation: 8 },
        { id: 't1', kind: 'text', text: '金陵', x: 200, y: 800, width: 450, height: 120, rotation: 0, style: { fontSize: 48 } },
      ],
    };
    expect(() => assertCollageCanvas(legacy)).not.toThrow();
    expect(legacy.items.map((item) => [item.x, item.y, item.width, item.height, item.rotation])).toEqual([
      [100, 120, 360, 280, -4],
      [600, 300, 240, 240, 8],
      [200, 800, 450, 120, 0],
    ]);
  });

  it('validates 2133x1600, 1800x1600 and 1200x1600 canvases while rejecting arbitrary sizes', () => {
    expect(() => assertCollageCanvas({ width: 2133, height: 1600, items: [] })).not.toThrow();
    expect(() => assertCollageCanvas({ width: 1800, height: 1600, items: [] })).not.toThrow();
    expect(() => assertCollageCanvas({ width: 1200, height: 1600, items: [] })).not.toThrow();
    expect(() => assertCollageCanvas({ width: 1000, height: 1600, items: [] })).toThrow();
    expect(() => assertCollageCanvas({ width: 2133, height: 1200, items: [] })).toThrow();
  });

  it('computes adaptive fit sizes without overlapping toolbars or clipping across viewports', () => {
    // 桌面三栏布局：左右栏由页面留白让出，工作区只按自身尺寸与内侧边距适配。
    const desktop = computeFitPaperSize({ workspaceWidth: 1440, workspaceHeight: 800, windowWidth: 1440, windowHeight: 900 });
    expect(desktop.width).toBeGreaterThan(750);
    expect(desktop.width).toBeLessThanOrEqual(1120);
    expect(desktop.height).toBeLessThanOrEqual(800 - 62);
    expect(desktop.width / desktop.height).toBeCloseTo(4 / 3, 2);

    const narrowDesktop = computeFitPaperSize({ workspaceWidth: 960, workspaceHeight: 820, windowWidth: 960, windowHeight: 900 });
    expect(narrowDesktop.width).toBeLessThanOrEqual(960 - 32);
    expect(narrowDesktop.width / narrowDesktop.height).toBeCloseTo(4 / 3, 2);

    const mobile = computeFitPaperSize({ workspaceWidth: 390, workspaceHeight: 680, windowWidth: 390, windowHeight: 844 });
    expect(mobile.width).toBeGreaterThanOrEqual(280);
    expect(mobile.width).toBeLessThanOrEqual(390 - 42);

    const landscapePhone = computeFitPaperSize({ workspaceWidth: 568, workspaceHeight: 200, windowWidth: 568, windowHeight: 320 });
    expect(landscapePhone.width).toBeGreaterThanOrEqual(280);
  });

  it('steps and formats zoom levels cleanly within bounds', () => {
    expect(stepZoomIn(1)).toBe(1.1);
    expect(stepZoomIn(1.1)).toBe(1.25);
    expect(stepZoomIn(MAX_COLLAGE_ZOOM)).toBe(MAX_COLLAGE_ZOOM);
    expect(stepZoomOut(1)).toBe(0.9);
    expect(stepZoomOut(MIN_COLLAGE_ZOOM)).toBe(MIN_COLLAGE_ZOOM);
    expect(clampCollageZoom(99)).toBe(MAX_COLLAGE_ZOOM);
    expect(clampCollageZoom(0.1)).toBe(MIN_COLLAGE_ZOOM);
    expect(formatZoomPercent(1.25)).toBe('125%');
  });
});
