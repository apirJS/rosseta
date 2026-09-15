import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function maskApiKey(value: string, visibleChars = 8): string {
  if (value.length <= visibleChars) return value;
  return `${value.slice(0, visibleChars)}••••`;
}
