import type { SelectionBounds, SelectionViewport } from './selection-bounds';

export async function cropSelectionImage(
  sourceUrl: string,
  bounds: SelectionBounds,
  viewport: SelectionViewport,
): Promise<string> {
  const image = new Image();

  image.src = sourceUrl;
  await image.decode();

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Failed to get canvas context');

  const scaleX = image.naturalWidth / viewport.width;
  const scaleY = image.naturalHeight / viewport.height;
  const sourceX = Math.floor(bounds.left * scaleX);
  const sourceY = Math.floor(bounds.top * scaleY);

  const sourceWidth =
    Math.min(
      image.naturalWidth,
      Math.ceil((bounds.left + bounds.width) * scaleX),
    ) - sourceX;

  const sourceHeight =
    Math.min(
      image.naturalHeight,
      Math.ceil((bounds.top + bounds.height) * scaleY),
    ) - sourceY;

  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  );

  return canvas.toDataURL('image/png');
}
