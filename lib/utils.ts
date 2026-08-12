import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * First two letters of a person's name, uppercased — used for avatar fallbacks.
 * Splits on whitespace so "John Doe" → "JD", "John" → "JO" via .slice(0, 2).
 */
export function buildInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}
