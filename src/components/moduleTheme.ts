import type { CSSProperties } from 'react';

export function accentStyle(color: string): CSSProperties {
  return { '--accent': /^#[\da-f]{6}$/i.test(color) ? color : '#818cf8' } as CSSProperties;
}
