type DurationUnit = "s" | "m" | "h" | "d";

const UNIT_SECONDS: Record<DurationUnit, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** Parses simple durations like "15m", "7d", "30s" into seconds. */
export function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration format: "${value}" (expected e.g. "15m", "7d")`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_SECONDS[unit as DurationUnit];
}
