import { clamp, damp, dampAngle, smooth } from '../kit.js';
import { chaseCamera, vehicleModel } from './rig.js';

const PLANE = 'vehicles/airliner';

export const airplane = {
  id: 'airplane',
  assets: [PLANE],
  onRails: false,
  actions: { a: 'flight', b: null },

  create({ assets }) {
    const model = vehicleModel(assets, PLANE);
    const { object, parts } = model;
    const anchor = object.getObjectByName('ANCHOR_chase').position;
    const view = { back: Math.max(42, -anchor.z), side: anchor.x || 11, up: Math.max(13, anchor.y), lift: 4, ahead: 6 };
    let flyingFree = false;
    let fan = 0;
    let wheel = 0;
    let bank = 0;
    let pitch = 0;
    let retract = 0;

    return {
      ...model, id: 'airplane', radius: 17, onRails: false, storyScale: 1, focusHeight: 4,
      reset() { flyingFree = false; },
      place(st) {
        object.position.set(st.x, st.y, st.z);
        object.rotation.y = st.yaw;
      },
      animate({ st, dt, calm }) {
        const height = st.y;
        const moving = Math.abs(st.speed);
        const pitchTarget = clamp(st.slope, -0.18, 0.24) * smooth(0, 5, height);
        bank = damp(bank, calm ? 0 : st.steer * 0.28 * smooth(0, 16, height), 4, dt);
        pitch = damp(pitch, pitchTarget, 4, dt);
        object.rotation.set(-pitch, st.yaw, bank, 'YXZ');
        fan = (fan + (3 + Math.min(moving, 65) * 0.65) * dt) % (2 * Math.PI);
        wheel += moving * dt * (1 - smooth(0, 6, height));
        retract = damp(retract, smooth(8, 21, height), 3, dt);
        for (const part of parts) {
          const left = part.pivot[0] > 0;
          if (part.role === 'fan') part.turn(fan);
          if (part.role === 'wheel') part.turn(wheel / part.radius);
          if (part.role === 'landing_gear') part.turn((part.axis === 'x' || left ? -1 : 1) * part.limit * retract);
          if (part.role === 'flap') part.turn((left ? 1 : -1) * part.limit * 0.5 * (1 - retract) * smooth(4, 24, moving));
          if (part.role === 'aileron') part.turn(-bank);
          if (part.role === 'elevator') part.turn((left ? 1 : -1) * pitch);
          if (part.role === 'rudder') part.turn(st.steer * 0.25);
        }
      },
      drive(dt, input, world, st, fx) {
        if (st.lock > 0) return;
        const throttle = clamp(input.up - input.down + input.joyY, -1, 1);
        if (!st.speed && throttle <= 0.1 && st.y < 2) return;
        const rollLimit = st.t > 0.89 && !flyingFree ? 0 : 44;
        st.speed = rollLimit === 0 ? damp(st.speed, 0, 2.8, dt) : Math.min(rollLimit, st.speed + dt * 16);
        if (st.speed < 0.05) st.speed = 0;
        if (flyingFree) {
          st.steer = damp(st.steer, input.left - input.right - input.joyX, 4, dt);
          st.slope = damp(st.slope, throttle * 0.24, 3, dt);
          st.yaw += st.steer * 0.51 * dt;
          st.x += Math.sin(st.yaw) * st.speed * dt;
          st.z += Math.cos(st.yaw) * st.speed * dt;
          st.y = clamp(st.y + Math.sin(st.slope) * st.speed * dt, 21, 108);
          const nearest = world.nearest(st.x, st.z);
          st.t = nearest.t;
          if (nearest.d > 130 || Math.abs(st.x) > world.bounds || Math.abs(st.z) > world.bounds) {
            flyingFree = false;
            fx.respawn('edge', Math.min(st.t, 0.8));
          }
        } else {
          const t = clamp(st.t + st.speed * dt / world.route.length, 0, 0.96);
          const p = world.pointAt(t);
          const next = world.pointAt(t + 0.004);
          const yaw = Math.atan2(p.tx, p.tz);
          st.steer = clamp(Math.sin(yaw - st.yaw) * 5, -1, 1);
          st.yaw = dampAngle(st.yaw, yaw, 5, dt);
          if (t === st.t) st.slope = 0;
          else st.slope = Math.atan2(next.y - p.y, world.route.length * 0.004);
          Object.assign(st, { t, x: p.x, y: p.y, z: p.z });
        }
        st.airborne = st.y > 1;
      },
      chase(st, cam, want, env) {
        chaseCamera(st, cam, want, env, view);
      },
      action(id, st, fx) {
        if (id !== 'flight' || st.mode !== 'explore' || st.y < 21) return;
        flyingFree = !flyingFree;
        fx.feedback(flyingFree ? 'flightFree' : 'flightGuided');
      },
    };
  },
};
