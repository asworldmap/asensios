import { Vector3 } from 'three';

const URL = '/world/journey/sequences.json';
const match = (id) => id === 'asia' ? 'flight' : id;
let catalog;

export async function findHandoff(from, to) {
  try {
    catalog ??= fetch(URL).then((response) => {
      if (!response.ok) throw new Error('Journey sequences unavailable');
      return response.json();
    });
    const { sequences } = await catalog;
    return sequences.find((item) => match(item.from.chapter) === from && match(item.to.chapter) === to);
  } catch {
    catalog = undefined;
    return null;
  }
}

function copy(shot) {
  return { pos: shot.pos.clone(), look: shot.look.clone(), fov: shot.fov };
}

function routeSpace(world, t, position, target, fov) {
  const p = world.pointAt(t);
  const at = ([x, y, z]) => new Vector3(p.x + p.tz * x + p.tx * z, p.y + y, p.z - p.tx * x + p.tz * z);
  return { pos: at(position), look: at(target), fov };
}

function wheel(object, name, offset, fov) {
  const pivot = object.getObjectByName(name);
  if (!pivot) return null;
  const look = pivot.getWorldPosition(new Vector3());
  // Offset in the vehicle frame so tire spin never rotates the camera.
  const rotation = pivot.parent.getWorldQuaternion(object.quaternion.clone());
  const pos = new Vector3(...offset).applyQuaternion(rotation).add(look);
  return { pos, look, fov };
}

function landmark(world, t, name, position, fov) {
  const shot = routeSpace(world, t, position, [0, 3, 20], fov);
  const mark = world.cineMarks?.[name];
  if (mark) shot.look.set(mark.x, mark.y, mark.z);
  return shot;
}

// The Blender coordinates describe separate reference sets. These offsets
// reframe each authored composition around the corresponding playable set.
export function matchShot(sequence, incoming, { world, vehicle, state }) {
  const cut = sequence.camera.findIndex((key) => key.ease === 'cut');
  const key = incoming ? sequence.camera[cut] : sequence.camera[cut - 1];
  const fov = key.fov;
  const t = state.t;
  switch (sequence.splice.type) {
    case 'match_cut_held_frame':
      return incoming
        ? wheel(vehicle.object, 'PART_wheelset_front1', [-5.77, 0.13, -0.16], fov)
        : wheel(vehicle.object, 'PART_wheel_rear', [-4.3, 0.48, -0.14], fov);
    case 'dark_doorway':
      return incoming
        ? routeSpace(world, t, [10, 2, -5], [0, 2, 1], fov)
        : landmark(world, t, 'stationDoor', [4.4, 2.55, -11], fov);
    case 'horizon_hold':
      return incoming
        ? routeSpace(world, t, [0, 21, -58], [0, 9, 242], fov)
        : routeSpace(world, t, [0, 15, -22], [0, 3, 278], fov);
    case 'light_flash_match':
      return incoming
        ? landmark(world, t, 'beacon', [41, 11, 27], fov)
        : landmark(world, t, 'lighthouse', [-12, 7, 15], fov);
    case 'white_out':
      return incoming
        ? routeSpace(world, t, [-31, 58, -93], [13, 23, 280], fov)
        : routeSpace(world, t, [9, 6, -26], [0, 2.5, 8], fov);
    default:
      return null;
  }
}

export function handoffTiming(type) {
  return {
    out: type === 'white_out' ? 0.78 : 0.88,
    mask: type === 'horizon_hold' ? 0.28 : 0.22,
    in: type === 'white_out' ? 1.20 : 0.91,
  };
}

export function playShot(from, to, seconds, set, skipped) {
  const a = copy(from);
  const b = copy(to);
  const shot = copy(from);
  const started = performance.now();
  set(shot);
  return new Promise((resolve) => {
    function step(now) {
      const t = skipped() ? 1 : Math.min(1, (now - started) / (seconds * 1000));
      const k = (1 - Math.cos(Math.PI * t)) / 2;
      shot.pos.lerpVectors(a.pos, b.pos, k);
      shot.look.lerpVectors(a.look, b.look, k);
      shot.fov = a.fov + (b.fov - a.fov) * k;
      set(shot);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}
