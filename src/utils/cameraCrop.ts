/**
 * The viewfinder shows the photo scaled to cover the screen ("cover"), so the
 * saved image is larger than what is visible. Maps the on-screen guide frame
 * back to pixel coordinates of the captured photo, so exactly what is inside
 * the frame is analysed and nothing else.
 */
export type Rect = { x: number; y: number; width: number; height: number };

export function frameToPhotoCrop(frame: Rect, view: { width: number; height: number }, photo: { width: number; height: number }): Rect | null {
  if (![frame.width, frame.height, view.width, view.height, photo.width, photo.height].every(v => Number.isFinite(v) && v > 0)) return null;
  const scale = Math.max(view.width / photo.width, view.height / photo.height);
  const offsetX = (view.width - photo.width * scale) / 2;
  const offsetY = (view.height - photo.height * scale) / 2;
  const x = Math.max(0, Math.floor((frame.x - offsetX) / scale));
  const y = Math.max(0, Math.floor((frame.y - offsetY) / scale));
  const right = Math.min(photo.width, Math.ceil((frame.x + frame.width - offsetX) / scale));
  const bottom = Math.min(photo.height, Math.ceil((frame.y + frame.height - offsetY) / scale));
  const width = right - x;
  const height = bottom - y;
  // A frame that covers almost the whole photo is not worth a second encode.
  if (width < 200 || height < 200) return null;
  return { x, y, width, height };
}
