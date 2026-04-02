import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseDurationToMinutes(value: string): number | null {
  const input = value.trim().toLowerCase();
  if (!input) return null;

  const regex = /^(\d+)(m|h|d)$/;
  const match = input.match(regex);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];

  if (Number.isNaN(amount) || amount < 0) return null;

  if (unit === "m") return amount;
  if (unit === "h") return amount * 60;
  return amount * 60 * 8;
}

export function formatDurationFromMinutes(minutes: number | null): string {
  if (!minutes && minutes !== 0) return "-";
  if (minutes % (60 * 8) === 0) return `${minutes / (60 * 8)}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}
