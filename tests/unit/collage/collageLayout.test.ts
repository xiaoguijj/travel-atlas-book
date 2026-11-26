import { describe, expect, it } from 'vitest';
import {
  COLLAGE_CANVAS_HEIGHT,
  COLLAGE_CANVAS_WIDTH,
  LEGACY_COLLAGE_CANVAS_WIDTH,
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
import { normalizeCollageItems } from '../../../src/components/collage/useCollageEditor';

describe('collage wide canvas layout, zoom and legacy compatibility', () => {
  it('widens the logical canvas by 50% while keeping height unchanged', () => {
    expect(LEGACY_COLLAGE_CANVAS_WIDTH).toBe(1200);
    expect(COLLAGE_CANVAS_WIDTH).toBe(1800);
    expect(COLLAGE_CANVAS_HEIGHT).toBe(1600);
    expect(COLLAGE_ASPECT_RATIO).toBe(1.125);
  });

  it('centers legacy 1200x1600 items onto 1800x1600 without deforming dimensions or text size', () => {
    const legacy: CollageCanvas = {
      width: 1200,
      height: 1600,
      items: [
        { id: 'p1', kind: 'photo', assetId: 'photo:1', x: 100, y: 120, width: 360, height: 280, rotation: -4 },
        { id: 's1', kind: 'sticker', assetId: 'sticker:stamp-nanjing', x: 600, y: 300, width: 240, height: 240, rotation: 8 },
        { id: 't1', kind: 'text', text: '金陵', x: 200, y: 800, width: 450, height: 120, rotation: 0, style: { fontSize: 48 } },
      ],
    };

    const normalized = normalizeCollageItems(legacy);
    expect(normalized).toEqual([
      { ...legacy.items[0], x: 400, y: 120 },
      { ...legacy.items[1], x: 900, y: 300 },
      { ...legacy.items[2], x: 500, y: 800 },
    ]);

    const current: CollageCanvas = { width: 1800, height: 1600, items: normalized };
    expect(normalizeCollageItems(current)).toBe(current.items);
    expect(normalizeCollageItems(undefined)).toEqual([]);
  });

  it('validates both 1800x1600 and legacy 1200x1600 canvases while rejecting arbitrary sizes', () => {
    expect(() => assertCollageCanvas({ width: 1800, height: 1600, items: [] })).not.toThrow();
    expect(() => assertCollageCanvas({ width: 1200, height: 1600, items: [] })).not.toThrow();
    expect(() => assertCollageCanvas({ width: 1000, height: 1600, items: [] })).toThrow();
    expect(() => assertCollageCanvas({ width: 1800, height: 1200, items: [] })).toThrow();
  });

  it('computes adaptive fit sizes without overlapping toolbars or clipping across viewports', () => {
    const desktop = computeFitPaperSize({ workspaceWidth: 1440, workspaceHeight: 800, windowWidth: 1440, windowHeight: 900 });
    expect(desktop.width).toBeGreaterThan(750);
    expect(desktop.width).toBeLessThanOrEqual(1440 - 232);
    expect(desktop.height).toBeLessThanOrEqual(800 - 112);
    expect(desktop.width / desktop.height).toBeCloseTo(9 / 8, 2);

    const narrowDesktop = computeFitPaperSize({ workspaceWidth: 960, workspaceHeight: 820, windowWidth: 960, windowHeight: 900 });
    expect(narrowDesktop.width).toBeLessThanOrEqual(960 - 232);
    expect(narrowDesktop.width / narrowDesktop.height).toBeCloseTo(9 / 8, 2);

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
