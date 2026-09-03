export const PROJECT_START_YEAR = 2015
export const PROJECT_START_ISO = `${PROJECT_START_YEAR}-01-01`

export function getJourneyYearsSpan(referenceDate = new Date()) {
  return Math.max(1, referenceDate.getFullYear() - PROJECT_START_YEAR + 1)
}

export function clampJourneyStartYear(years: number[]) {
  const sane = years.filter((value) => Number.isFinite(value) && value >= 1900)
  if (!sane.length) return PROJECT_START_YEAR
  return Math.min(PROJECT_START_YEAR, ...sane)
}

export function getMinimumCompletedJourneyYears(referenceDate = new Date()) {
  return Math.max(1, referenceDate.getFullYear() - PROJECT_START_YEAR - 1)
}
