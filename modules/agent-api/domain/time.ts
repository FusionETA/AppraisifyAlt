/**
 * Malaysia-time calendar helpers for the agent API. Pure — no Prisma, no
 * server-only.
 *
 * MYT is a fixed UTC+8 with no daylight saving, so a plain offset is exact
 * and no timezone database is needed. Calendar days are handled as "day
 * numbers" (whole days since 1970-01-01 in MYT), which makes ranges, week
 * starts and bucket walks simple integer arithmetic.
 */

export const MYT_TIMEZONE = "Asia/Kuala_Lumpur"

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** The MYT calendar day an instant falls on. */
export function mytDayNumber(instant: Date): number {
  return Math.floor((instant.getTime() + MYT_OFFSET_MS) / DAY_MS)
}

/** `YYYY-MM-DD` → day number, or null if malformed or not a real date (e.g. 2026-02-30). */
export function parseCalendarDate(value: string): number | null {
  const match = CALENDAR_DATE.exec(value)
  if (!match) return null

  const [, year, month, day] = match
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day))
  const dayNumber = utc / DAY_MS

  return formatCalendarDate(dayNumber) === value ? dayNumber : null
}

/** Day number → `YYYY-MM-DD`. */
export function formatCalendarDate(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10)
}

/** The UTC instant at which an MYT calendar day begins (00:00 MYT). */
export function startOfMytDay(dayNumber: number): Date {
  return new Date(dayNumber * DAY_MS - MYT_OFFSET_MS)
}

/** The Monday on or before the given day — weeks run Monday to Sunday. */
export function mytWeekStart(dayNumber: number): number {
  const weekday = new Date(dayNumber * DAY_MS).getUTCDay() // 0 = Sunday
  return dayNumber - ((weekday + 6) % 7)
}

/** `YYYY-MM` for the MYT month the day falls in. */
export function mytMonthKey(dayNumber: number): string {
  return formatCalendarDate(dayNumber).slice(0, 7)
}

/** An instant as ISO 8601 in MYT, e.g. `2026-10-12T09:30:00.000+08:00`. */
export function formatMyt(instant: Date): string {
  return new Date(instant.getTime() + MYT_OFFSET_MS).toISOString().replace("Z", "+08:00")
}

/** Whole and fractional days between two instants, to one decimal place. */
export function daysBetween(earlier: Date, later: Date): number {
  return Math.round(((later.getTime() - earlier.getTime()) / DAY_MS) * 10) / 10
}
