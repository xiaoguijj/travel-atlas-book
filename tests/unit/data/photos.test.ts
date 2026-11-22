import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataError, MAX_PHOTO_SOURCE_BYTES } from '../../../src/data/contracts';
import { TravelAtlasDatabase } from '../../../src/data/db';
import {
  calculateScaledSize,
  detectImageMime,
  type PhotoProcessor,
} from '../../../src/data/photos';
import { createPhotoRepository, type PhotoRepository } from '../../../src/data/photos';
import {
  createClock,
  createGifBlob,
  createJpegBlob,
  createPngBlob,
  createTestDatabase,
  createWebpBlob,
  destroyTestDatabase,
} from '../helpers';

function createStubProcessor(width = 800, height = 600): PhotoProcessor {
  return {
    process: vi.fn(async (source) => ({
      blob: source.blob,
      mime: source.sourceMime,
      width,
      height,
    })),
  };
}

async function blobBytes(blob: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

describe('photo repository', () => {
  let database: TravelAtlasDatabase;
  let repository: PhotoRepository;
  let clock: ReturnType<typeof createClock>;
  let processor: PhotoProcessor;

  beforeEach(() => {
    database = createTestDatabase();
    clock = createClock();
    processor = createStubProcessor();
    repository = createPhotoRepository(database, { processor, now: clock.now });
  });

  afterEach(async () => {
    await destroyTestDatabase(database);
  });

  it('stores a photo blob with a stable photo: asset id and restores it', async () => {
    const source = createPngBlob();
    const imported = await repository.importPhoto('nanjing', source);

    expect(imported.id.startsWith('photo:')).toBe(true);
    expect(imported.cityId).toBe('nanjing');
    expect(imported.mime).toBe('image/png');
    expect(imported.width).toBe(800);
    expect(imported.height).toBe(600);
    expect(imported.size).toBe(source.size);
    expect(imported.createdAt).toBe(clock.now());

    const restored = await repository.getPhoto(imported.id);
    expect(restored).toBeDefined();
    expect(await blobBytes(restored!.blob)).toEqual(await blobBytes(source));
    expect(restored?.mime).toBe('image/png');
  });

  it('keeps photo lists isolated by city and ordered newest first', async () => {
    const first = await repository.importPhoto('nanjing', createPngBlob());
    clock.advance();
    const second = await repository.importPhoto('nanjing', createJpegBlob());
    clock.advance();
    const other = await repository.importPhoto('shanghai', createWebpBlob());

    const nanjing = await repository.listPhotosByCity('nanjing');
    expect(nanjing.map((photo) => photo.id)).toEqual([second.id, first.id]);
    const shanghai = await repository.listPhotosByCity('shanghai');
    expect(shanghai.map((photo) => photo.id)).toEqual([other.id]);
    expect(await repository.getPhoto('sticker:anything')).toBeUndefined();
    expect(await repository.getPhoto('photo:missing')).toBeUndefined();
  });

  it('rejects invalid cities, empty files and unsupported formats', async () => {
    await expect(repository.importPhoto('atlantis', createPngBlob())).rejects.toMatchObject({
      code: 'INVALID_CITY',
    });
    expect(processor.process).not.toHaveBeenCalled();

    await expect(repository.importPhoto('nanjing', new Blob([]))).rejects.toMatchObject({
      code: 'INVALID_PHOTO',
    });
    await expect(repository.importPhoto('nanjing', createGifBlob())).rejects.toMatchObject({
      code: 'UNSUPPORTED_IMAGE_TYPE',
    });
    expect(processor.process).not.toHaveBeenCalled();
    await expect(database.photos.count()).resolves.toBe(0);
  });

  it('rejects files over 10 MB before decoding', async () => {
    const oversized = new Blob([createPngBlob(), new Uint8Array(MAX_PHOTO_SOURCE_BYTES)], {
      type: 'image/png',
    });
    await expect(repository.importPhoto('nanjing', oversized)).rejects.toMatchObject({
      code: 'PHOTO_TOO_LARGE',
    });
    expect(processor.process).not.toHaveBeenCalled();
  });

  it('surfaces processor failures as explicit data errors', async () => {
    const decodeFailure = createPhotoRepository(database, {
      now: clock.now,
      processor: {
        process: async () => {
          throw new DataError('IMAGE_DECODE_FAILED', '损坏的图片');
        },
      },
    });
    await expect(decodeFailure.importPhoto('nanjing', createPngBlob())).rejects.toMatchObject({
      code: 'IMAGE_DECODE_FAILED',
    });

    const unexpectedFailure = createPhotoRepository(database, {
      now: clock.now,
      processor: {
        process: async () => {
          throw new Error('canvas exploded');
        },
      },
    });
    await expect(unexpectedFailure.importPhoto('nanjing', createPngBlob())).rejects.toMatchObject({
      code: 'PHOTO_PROCESSING_FAILED',
    });

    const badMime = createPhotoRepository(database, {
      now: clock.now,
      processor: {
        process: async (source) => ({
          blob: source.blob,
          mime: 'image/gif' as never,
          width: 10,
          height: 10,
        }),
      },
    });
    await expect(badMime.importPhoto('nanjing', createPngBlob())).rejects.toMatchObject({
      code: 'PHOTO_PROCESSING_FAILED',
    });
    await expect(database.photos.count()).resolves.toBe(0);
  });

  it('keeps the photo blob after closing and reopening the database', async () => {
    const source = createJpegBlob();
    const imported = await repository.importPhoto('nanjing', source);
    const databaseName = database.name;

    database.close();
    database = new TravelAtlasDatabase(databaseName);
    repository = createPhotoRepository(database, { processor, now: clock.now });

    const restored = await repository.getPhoto(imported.id);
    expect(restored?.blob.type).toBe('image/jpeg');
    expect(await blobBytes(restored!.blob)).toEqual(await blobBytes(source));
    expect((await repository.listPhotosByCity('nanjing')).map((photo) => photo.id)).toEqual([
      imported.id,
    ]);
  });
});

describe('photo image helpers', () => {
  it('detects supported formats from file headers', async () => {
    const readHeader = async (blob: Blob) => new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    expect(detectImageMime(await readHeader(createPngBlob()))).toBe('image/png');
    expect(detectImageMime(await readHeader(createJpegBlob()))).toBe('image/jpeg');
    expect(detectImageMime(await readHeader(createWebpBlob()))).toBe('image/webp');
    expect(detectImageMime(await readHeader(createGifBlob()))).toBeUndefined();
    expect(detectImageMime(new Uint8Array([1, 2, 3]))).toBeUndefined();
  });

  it('scales the longest edge to 1600 px without upscaling', () => {
    expect(calculateScaledSize(3200, 2400)).toEqual({ width: 1600, height: 1200 });
    expect(calculateScaledSize(1000, 2000)).toEqual({ width: 800, height: 1600 });
    expect(calculateScaledSize(1200, 800)).toEqual({ width: 1200, height: 800 });
    expect(calculateScaledSize(1600, 1600)).toEqual({ width: 1600, height: 1600 });
    expect(() => calculateScaledSize(0, 100)).toThrow(DataError);
  });
});