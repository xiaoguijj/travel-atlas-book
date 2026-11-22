import {
  COLLAGE_CANVAS_HEIGHT,
  COLLAGE_CANVAS_WIDTH,
  type CollageCanvas,
  type JournalContent,
  type LocalDate,
  type TravelPlan,
} from '../../src/data/contracts';
import { TravelAtlasDatabase } from '../../src/data/db';
import { createStableId } from '../../src/data/ids';

export function createTestDatabase(): TravelAtlasDatabase {
  return new TravelAtlasDatabase(`travel-atlas-test-${createStableId()}`);
}

export async function destroyTestDatabase(database: TravelAtlasDatabase): Promise<void> {
  database.close();
  await database.delete();
}

export function createClock(start = '2026-11-22T00:00:00.000Z') {
  let current = Date.parse(start);
  return {
    now: () => new Date(current).toISOString(),
    advance(milliseconds = 1000) {
      current += milliseconds;
    },
  };
}

export function createJournal(assetId = 'photo:test-asset'): JournalContent {
  return {
    doc: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '南京的秋天' }] },
        { type: 'atlasMedia', attrs: { assetId, caption: '梧桐' } },
      ],
    },
  };
}

export function createCollage(assetId = 'photo:test-asset'): CollageCanvas {
  return {
    width: COLLAGE_CANVAS_WIDTH,
    height: COLLAGE_CANVAS_HEIGHT,
    items: [
      {
        id: 'item-photo',
        kind: 'photo',
        assetId,
        x: 40,
        y: 60,
        width: 400,
        height: 300,
        rotation: 4,
      },
      {
        id: 'item-sticker',
        kind: 'sticker',
        assetId: 'sticker:test-sticker',
        x: 500,
        y: 80,
        width: 120,
        height: 120,
        rotation: -8,
      },
      {
        id: 'item-text',
        kind: 'text',
        text: '一路向暖',
        x: 120,
        y: 900,
        width: 360,
        height: 80,
        rotation: 0,
        style: { fontSize: 42, color: '#3E5C5A' },
      },
    ],
  };
}

export function createPlan(overrides: Partial<TravelPlan> = {}): TravelPlan {
  const startDate: LocalDate = '2026-12-01';
  const endDate: LocalDate = '2026-12-02';
  return {
    id: createStableId(),
    title: '南京两日',
    cityIds: ['nanjing'],
    startDate,
    endDate,
    days: [],
    createdAt: '2026-11-22T00:00:00.000Z',
    updatedAt: '2026-11-22T00:00:00.000Z',
    ...overrides,
  };
}

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
const WEBP_HEADER = [
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
];
const GIF_HEADER = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

function bytesWithHeader(header: number[], payloadLength = 8): Uint8Array {
  const payload = new Uint8Array(payloadLength);
  for (let index = 0; index < payload.length; index += 1) {
    payload[index] = (index * 7 + 1) & 0xff;
  }
  const bytes = new Uint8Array(header.length + payload.length);
  bytes.set(header, 0);
  bytes.set(payload, header.length);
  return bytes;
}

export function createPngBlob(): Blob {
  return new Blob([bytesWithHeader(PNG_HEADER)], { type: 'image/png' });
}

export function createJpegBlob(): Blob {
  return new Blob([bytesWithHeader(JPEG_HEADER)], { type: 'image/jpeg' });
}

export function createWebpBlob(): Blob {
  return new Blob([bytesWithHeader(WEBP_HEADER)], { type: 'image/webp' });
}

export function createGifBlob(): Blob {
  return new Blob([bytesWithHeader(GIF_HEADER)], { type: 'image/gif' });
}