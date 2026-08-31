import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

export function utcToArgentinaInput(value: string | Date | null | undefined) {
  if (!value) return "";
  return formatInTimeZone(new Date(value), ARGENTINA_TIME_ZONE, "yyyy-MM-dd'T'HH:mm");
}

export function argentinaInputToUtc(value: string) {
  if (!value) return "";
  return fromZonedTime(value, ARGENTINA_TIME_ZONE).toISOString();
}
