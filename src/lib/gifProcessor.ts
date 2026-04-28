import { parseGIF, decompressFrames, ParsedGif, ParsedFrame } from 'gifuct-js';

export interface GifFrameData {
  imageData: ImageData;
  delay: number;
}

export async function extractGifFrames(buffer: ArrayBuffer): Promise<GifFrameData[]> {
  const gif = parseGIF(buffer);
  const frames = decompressFrames(gif, true);
  const lsd = gif.lsd;
  
  const canvas = document.createElement('canvas');
  canvas.width = lsd.width;
  canvas.height = lsd.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Could not create canvas context");

  const disposalCanvas = document.createElement('canvas');
  disposalCanvas.width = lsd.width;
  disposalCanvas.height = lsd.height;
  const disposalCtx = disposalCanvas.getContext('2d')!;

  const tmpCanvas = document.createElement('canvas');
  
  const fullFrames: GifFrameData[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    // Handle disposal of PREVIOUS frame
    if (i > 0) {
      const prev = frames[i - 1];
      if (prev.disposalType === 2) {
        ctx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
      } else if (prev.disposalType === 3) {
        ctx.putImageData(disposalCtx.getImageData(0, 0, lsd.width, lsd.height), 0, 0);
      }
    }

    // Save state for NEXT frame's disposal if current is disposalType 3
    if (frame.disposalType === 3) {
      disposalCtx.putImageData(ctx.getImageData(0, 0, lsd.width, lsd.height), 0, 0);
    }

    // Draw current patch
    tmpCanvas.width = frame.dims.width;
    tmpCanvas.height = frame.dims.height;
    const tmpCtx = tmpCanvas.getContext('2d')!;
    const patchData = new ImageData(
      new Uint8ClampedArray(frame.patch),
      frame.dims.width,
      frame.dims.height
    );
    tmpCtx.putImageData(patchData, 0, 0);

    // Apply blending if transparency matches 
    // (Wait, putImageData overwrites, we need to draw image to respect transparency)
    ctx.drawImage(tmpCanvas, frame.dims.left, frame.dims.top);

    // Extract the composited frame
    fullFrames.push({
      imageData: ctx.getImageData(0, 0, lsd.width, lsd.height),
      delay: frame.delay || 100 // fallback to 100ms if delay is 0
    });
  }

  return fullFrames;
}
