/** Deterministic placeholder artwork colours from a string (used where no image exists). */
export function placeholderGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const hue2 = (hue + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${hue2} 60% 22%))`;
}
