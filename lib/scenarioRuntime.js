import { SharedArray } from 'k6/data';

export function loadProfile(path) {
  return JSON.parse(open(path));
}

export function loadSharedRecords(name, path) {
  return new SharedArray(name, () => JSON.parse(open(path)));
}

export function ensureUniqueField(records, pathLabel, fieldName) {
  const seen = new Set();

  for (const record of records) {
    const value = record?.[fieldName];

    if (value == null) {
      continue;
    }

    if (seen.has(value)) {
      throw new Error(`Duplicate ${fieldName}="${value}" found in ${pathLabel}. Each VU must use a unique record.`);
    }

    seen.add(value);
  }
}

export function createPerVuState(createState) {
  const stateByVu = {};

  return function getState() {
    if (!stateByVu[__VU]) {
      stateByVu[__VU] = createState();
    }

    return stateByVu[__VU];
  };
}

export function getVuRecord(records, pathLabel) {
  if (__VU > records.length) {
    throw new Error(`Not enough records in ${pathLabel}: need at least ${__VU}, got ${records.length}`);
  }

  return records[__VU - 1];
}

export function buildOptions(profile) {
  return {
    vus: profile.vus,
    duration: profile.duration,
    thresholds: profile.thresholds,
  };
}

export function secondsPerDayEvent(eventsPerDay, timeCompression) {
  return 86400 / eventsPerDay / timeCompression;
}
