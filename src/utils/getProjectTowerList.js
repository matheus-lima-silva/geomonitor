import { compareTowerNumbers } from '../features/projects/utils/kmlUtils';

/**
 * Canonical source of truth for "which towers does a project have?"
 * Returns a sorted array of tower number strings.
 *
 * Priority:
 * 1. torresCoordenadas array (from KML import) — extracts `numero` from each entry
 * 2. torres string count — generates ["1", "2", ..., "N"]
 * 3. Empty array
 */
export function getProjectTowerList(project) {
  const coords = Array.isArray(project?.torresCoordenadas) ? project.torresCoordenadas : [];

  if (coords.length > 0) {
    const numbers = coords
      .map((item) => {
        const raw = String(item?.numero ?? '').trim();
        if (!raw) return '';
        // Normalize purely numeric strings: "001" → "1", but keep "163A" as-is
        if (/^\d+$/.test(raw)) return String(Number(raw));
        // Normalize alphanumeric: "001A" → "1A"
        const match = raw.match(/^(\d+)([A-Za-z].*)$/);
        if (match) return String(Number(match[1])) + match[2].toUpperCase();
        return raw;
      })
      .filter(Boolean);
    const unique = [...new Set(numbers)];
    return unique.sort(compareTowerNumbers);
  }

  const total = Number(project?.torres || 0);
  if (Number.isInteger(total) && total > 0 && total <= 5000) {
    return Array.from({ length: total }, (_, i) => String(i + 1));
  }

  return [];
}

/**
 * Extracts the numeric base from a tower string.
 * "163A" -> 163, "0" -> 0, "abc" -> NaN
 */
function towerBaseNumber(tower) {
  const match = String(tower || '').match(/^(\d+)/);
  return match ? Number(match[1]) : NaN;
}

/**
 * Returns true if the tower list has enough numeric towers to show a range slider.
 * Allows some alphanumeric towers (like "163A") as long as there are numeric ones.
 */
export function hasNumericRange(towers) {
  if (towers.length === 0) return false;
  const numericCount = towers.filter((t) => /^\d+$/.test(t)).length;
  return numericCount >= 2;
}

/**
 * Returns the numeric min and max from a tower list.
 * Works with mixed lists — extracts base number from alphanumeric towers.
 */
export function getNumericTowerRange(towers) {
  if (towers.length === 0) return { min: 0, max: 0 };
  const nums = towers.map(towerBaseNumber).filter(Number.isFinite);
  if (nums.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/**
 * Given a tower list and a numeric range [lo, hi], returns all towers
 * whose base number falls within that range (inclusive).
 * This includes alphanumeric towers like "163A" when 163 is in range.
 */
export function towersInRange(towers, lo, hi) {
  return towers.filter((t) => {
    const base = towerBaseNumber(t);
    return Number.isFinite(base) && base >= lo && base <= hi;
  });
}

// Keep for backward compatibility but prefer hasNumericRange
export function isNumericTowerList(towers) {
  return towers.length > 0 && towers.every((t) => /^\d+$/.test(t));
}
