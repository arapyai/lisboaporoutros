/** Horizontal tabs deliberately leave Up/Down available for page scrolling. */
export function nextTabCode(codes: string[], current: string, key: string): string | undefined {
  if (!codes.length) return undefined;
  const index = Math.max(0, codes.indexOf(current));
  if (key === 'Home') return codes[0];
  if (key === 'End') return codes[codes.length - 1];
  if (key === 'ArrowRight') return codes[(index + 1) % codes.length];
  if (key === 'ArrowLeft') return codes[(index + codes.length - 1) % codes.length];
  return undefined;
}
