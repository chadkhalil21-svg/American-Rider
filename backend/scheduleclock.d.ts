export function pickupDate(epoch: number, zone: string): string;
export function pickupMinutes(epoch: number, zone: string): number;
export function nextDate(date: string, days?: number): string;
export function resolvePickupWall(date: string, time: string, period: 'AM'|'PM', zone: string):
  { ok: true; atMs: number } | { ok: false; code: string };
