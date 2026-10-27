import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cropSelectionImage } from './crop-selection-image';

describe('cropping a screen selection', () => {
  const drawImage = vi.fn();
  const decode = vi.fn();

  beforeEach(() => {
    drawImage.mockReset();
    decode.mockReset().mockResolvedValue(undefined);

    vi.stubGlobal(
      'Image',
      class {
        src = '';
        naturalWidth = 1920;
        naturalHeight = 1080;
        decode = decode;
      },
    );

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,cropped',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test.each([
    {
      name: 'standard density',
      viewport: [1920, 1080],
      bounds: [50, 40, 100, 80],
      pixels: [50, 40, 100, 80],
    },
    {
      name: 'high density',
      viewport: [960, 540],
      bounds: [50, 40, 100, 80],
      pixels: [100, 80, 200, 160],
    },
    {
      name: 'fractional density',
      viewport: [1536, 864],
      bounds: [51, 41, 101, 81],
      pixels: [63, 51, 127, 102],
    },
    {
      name: 'independent axis scales',
      viewport: [960, 720],
      bounds: [50, 40, 100, 80],
      pixels: [100, 60, 200, 120],
    },
    {
      name: 'full viewport',
      viewport: [960, 540],
      bounds: [0, 0, 960, 540],
      pixels: [0, 0, 1920, 1080],
    },
    {
      name: 'floating-point edge rounding',
      viewport: [337, 532],
      bounds: [0, 0, 337, 532],
      pixels: [0, 0, 1920, 1080],
    },
  ])(
    'copies native source pixels for $name',
    async ({ viewport, bounds, pixels }) => {
      const [left, top, width, height] = bounds;

      const result = await cropSelectionImage(
        'data:image/png;base64,source',
        { left, top, width, height },
        { width: viewport[0], height: viewport[1] },
      );

      expect(drawImage).toHaveBeenCalledExactlyOnceWith(
        expect.any(Image),
        ...pixels,
        0,
        0,
        pixels[2],
        pixels[3],
      );

      expect(
        HTMLCanvasElement.prototype.toDataURL,
      ).toHaveBeenCalledExactlyOnceWith('image/png');

      const canvas = vi.mocked(HTMLCanvasElement.prototype.toDataURL).mock
        .contexts[0] as HTMLCanvasElement;

      expect([canvas.width, canvas.height]).toEqual(pixels.slice(2));
      expect(result).toBe('data:image/png;base64,cropped');
    },
  );

  test('reports an unavailable canvas context', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);

    await expect(
      cropSelectionImage(
        'source',
        { left: 0, top: 0, width: 20, height: 20 },
        { width: 100, height: 100 },
      ),
    ).rejects.toThrow('Failed to get canvas context');
  });

  test('reports image decoding failures before drawing', async () => {
    decode.mockRejectedValue(new Error('invalid image'));

    await expect(
      cropSelectionImage(
        'source',
        { left: 0, top: 0, width: 20, height: 20 },
        { width: 100, height: 100 },
      ),
    ).rejects.toThrow('invalid image');

    expect(drawImage).not.toHaveBeenCalled();
  });
});
