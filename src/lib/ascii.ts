const DEFAULT_CHARS = " .,:;+*?%S#@".split("");

export function pixelToChar(
  r: number,
  g: number,
  b: number,
  chars: string[] = DEFAULT_CHARS,
  invert: boolean = false,
  contrast: number = 0
): string {
  // Relative luminance
  let brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Apply contrast
  if (contrast !== 0) {
    brightness = (brightness - 0.5) * (1 + contrast) + 0.5;
  }
  
  brightness = Math.max(0, Math.min(1, brightness));

  if (invert) {
    brightness = 1 - brightness;
  }

  const charIndex = Math.floor(brightness * (chars.length - 1));
  return chars[charIndex];
}

export function imageDataToAscii(
  imageData: ImageData,
  chars: string[] = DEFAULT_CHARS,
  invert: boolean = false,
  contrast: number = 0
): string {
  let ascii = "";
  const data = imageData.data;
  const width = imageData.width;

  let line = "";
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    line += pixelToChar(r, g, b, chars, invert, contrast);

    if ((i / 4 + 1) % width === 0) {
      ascii += line + "\n";
      line = "";
    }
  }

  return ascii;
}

export function calculateAsciiDimensions(
  originalWidth: number,
  originalHeight: number,
  targetWidthColumns: number
): { width: number; height: number } {
  // Height must be adjusted because monospace characters are usually twice as tall as they are wide.
  const fontAspectRatio = 0.55; 
  const originalAspectRatio = originalWidth / originalHeight;
  const heightRows = Math.floor(
    (targetWidthColumns * fontAspectRatio) / originalAspectRatio
  );

  return { width: targetWidthColumns, height: heightRows };
}
