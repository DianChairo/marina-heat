// traffic.js — lane-following civilian traffic.
// Cars pick a road, a lane and a direction, cruise along it, slow for the
// car ahead, and turn at intersections. They flee when shot at.
import { randomRoadPoint } from './city.js';
import { createCar, drawCar } from './vehicles.js';

export function spawnTraffic(G, n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(G.city, G.rng);
    const angle = p.vertical ? (G.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2)
      : (G.rng.chance(0.5) ? 0 : Math.PI);
    const car = createCar(p.x, p.y, angle);
    car.driver = 'traffic';
    car.cruise = G.rng.range(90, 150);
    car.road = p;
    G.cars.push(car);
  }
}

function carAhead(G, car) {
  const fx = Math.cos(car.angle); const fy = Math.sin(car.angle);
  let best = Infinity;
  for (const o of G.cars) {
    if (o === car || o.wrecked) continue;
    const dx = o.x - car.x; const dy = o.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < 90 && side < 26) best = Math.min(best, along);
  }
  return best;
}

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.driver !== 'traffic' || car.wrecked) continue;
    const ahead = carAhead(G, car);
    const want = ahead < 70 ? 0 : car.cruise;
    car.speed += (want - car.speed) * 1.6 * dt;
    // Stay glued to the lane: steer toward the road centre line.
    const road = car.road;
    let targetAngle = car.angle;
    if (road.vertical) {
      const laneX = road.x + (Math.sin(car.angle) > 0 ? 11 : -11);
      const err = laneX - car.x;
      targetAngle = Math.sin(car.angle) > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.x += Math.max(-60 * dt, Math.min(60 * dt, err * 2 * dt));
      car.y += Math.sin(car.angle) * car.speed * dt;
    } else {
      const laneY = road.y + (Math.cos(car.angle) > 0 ? 11 : -11);
      const err = laneY - car.y;
      targetAngle = Math.cos(car.angle) > 0 ? 0 : Math.PI;
      car.y += Math.max(-60 * dt, Math.min(60 * dt, err * 2 * dt));
      car.x += Math.cos(car.angle) * car.speed * dt;
    }
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += diff * 2.2 * dt;
    // Turn at an intersection: pick a new road when reaching one.
    const onV = G.city.roadsV.some((rx) => Math.abs(car.x - rx) < 4);
    const onH = G.city.roadsH.some((ry) => Math.abs(car.y - ry) < 4);
    if ((onV && onH) || car.x < 330 || car.x > 3180 || car.y < 330 || car.y > 3180) {
      if (G.rng.chance(0.5)) {
        const np = randomRoadPoint(G.city, G.rng);
        car.road = np;
        car.x = np.x; car.y = np.y;
        car.angle = np.vertical ? (G.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2)
          : (G.rng.chance(0.5) ? 0 : Math.PI);
      }
    }
    if (G.player.onFoot === false && G.player.car === car) car.driver = 'player';
  }
}

export function drawTraffic(ctx, G) {
  for (const car of G.cars) drawCar(ctx, car);
}
