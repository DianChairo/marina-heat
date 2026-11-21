// Marina Heat — world constants and palette. Coral Marina is a 3200x3200
// seeded city: a road grid, a marina and water along the south edge, palms
// on the boulevards, and a causeway down to the docks.
export const WORLD = 3200;
export const ROAD_STEP = 400;
export const ROAD_HALF = 34;
export const WATER_TOP = 2840;
export const CAUSEWAY_X = 1600;
export const CAUSEWAY_HALF = 60;

export const PLAYER_WALK_SPEED = 190;
export const PLAYER_RUN_SPEED = 260;
export const CAR_MAX_SPEED = 520;
export const CAR_ACCEL = 420;
export const BULLET_SPEED = 780;
export const BULLET_RANGE = 560;

export const COLORS = {
  grass: '#4d8a4f',
  grassDark: '#3f7a44',
  sand: '#d9c08a',
  road: '#3a3a40',
  roadLine: '#d8d8c8',
  sidewalk: '#8a8a86',
  water: '#1d6f8e',
  waterDeep: '#155a75',
  building: ['#b5654a', '#c98a4b', '#7a6a9e', '#5a8a7a', '#a85a6a', '#8a7a5a', '#6a7a9e', '#9e8a5a'],
  roof: ['#8a4a3a', '#a86a3a', '#5a4a7e', '#3a6a5a', '#884a58'],
  palmTrunk: '#7a5a3a',
  palmLeaf: '#2e7a34',
  car: ['#d43a2a', '#2a6ad4', '#e8b81a', '#e8e8e8', '#2a2a2e', '#7a3ad4', '#2ad4a8', '#d47a2a'],
  police: '#1a2a4a',
  player: '#e8d81a',
  ped: ['#e8a8a8', '#a8c8e8', '#e8d8a8', '#c8a8e8', '#a8e8c8'],
};

export const MISSION_REWARDS = [500, 800, 1200, 1500, 2000];

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function rectHit(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
