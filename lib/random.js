import { sleep } from 'k6';

export function chance(probability) {
  return Math.random() < probability;
}

export function randomBetween(minSeconds, maxSeconds) {
  return minSeconds + Math.random() * (maxSeconds - minSeconds);
}

export function think(minSeconds, maxSeconds) {
  sleep(randomBetween(minSeconds, maxSeconds));
}
