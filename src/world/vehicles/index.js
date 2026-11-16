// Vehicle registry and interface.
//
// A chapter names its vehicle ("bicycle", "train", …). The engine creates it
// through this registry and from then on only speaks the interface below, so
// adding the bus, the airplane or the ship means adding one file here — the
// engine, the chapters and the UI do not change.
//
//   definition = {
//     id, assets: ['pack/id', …]      hero assets to preload
//     onRails: boolean                 true = cannot leave the route
//     actions: { a, b }                ids for the two action buttons (or null)
//     create({ assets, tier }) -> vehicle
//   }
//
//   vehicle = {
//     object            THREE.Object3D added to the scene
//     radius            collision radius, metres
//     storyScale        multiplier for a chapter's authored camera distances
//     focusHeight       where the camera and the see-through effect aim
//     reset?()          clear optional vehicle-specific modes on travel / mode changes
//     place(st, world)  put the model where the state says it is
//     animate({ dt, time, st, calm })   pose wheels, limbs, cars…
//     drive(dt, input, world, st, fx)   free movement (Explore); mutates st
//     chase(st, cam, want, env)         the camera it wants in Explore
//     action(id, st, fx)                hop, bell, horn…
//     setTheme(dark) · setCargo(n) · setShadowBlob(on) · dispose()
//   }
//
// `st` is the engine state (x, y, z, yaw, speed, t, …); `fx` gives a vehicle
// the few engine services it may use: respawn(reason), splash(x, z),
// bump(collider, st), sound(kind), feedback(id), snapCamera().

import { bicycle } from './bicycle.js';
import { train } from './train.js';
import { bus } from './bus.js';
import { airplane } from './airplane.js';
import { ship } from './ship.js';

export const VEHICLES = { bicycle, train, bus, airplane, ship };

export function getVehicle(id) {
  const def = VEHICLES[id];
  if (!def) throw new Error(`vehicle "${id}" is not implemented`);
  return def;
}
