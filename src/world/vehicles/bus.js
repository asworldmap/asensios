import { clamp, damp } from '../kit.js';
import { touches } from './collision.js';
import { chaseCamera, vehicleModel } from './rig.js';

const BUS = 'vehicles/coach_bus';

export const bus = {
  id: 'bus',
  assets: [BUS],
  onRails: false,
  actions: { a: 'horn', b: 'doors' },

  create({ assets }) {
    const model = vehicleModel(assets, BUS);
    const { object, parts } = model;
    const wheelbase = model.entry.meta.wheelbase;
    let roll = 0;
    let doors = 0;
    let waitingAtStop = false;
    let opening = true;
    const view = { back: 16, side: 3.5, up: 6, lift: 2.7, ahead: 5 };
    const probes = [-4.7, -2.35, 0, 2.35, 4.9];

    return {
      ...model, id: 'bus', radius: 1.7, onRails: false, storyScale: 1, focusHeight: 2.5,
      place(st, world) {
        waitingAtStop = Math.abs(st.speed) < 0.25 && world.stops.some((stop) =>
          Math.hypot(st.x - stop.x, st.z - stop.z) < stop.radius
        );
        if (!waitingAtStop) opening = true;
        object.position.set(st.x, st.y, st.z);
        object.rotation.y = st.yaw;
      },
      animate({ dt, st }) {
        roll = (roll + st.speed * dt / model.entry.meta.wheel_radius) % (2 * Math.PI);
        doors = damp(doors, waitingAtStop && opening ? 1 : 0, 4, dt);
        for (const part of parts) {
          if (part.role === 'wheel') part.turn(roll);
          if (part.role === 'steer') part.turn(st.steer * part.limit);
          if (part.role === 'steering_wheel') part.turn(-st.steer * 2.1);
          if (part.role === 'door') part.turn(part.limit * doors);
        }
      },
      drive(dt, input, world, st, fx) {
        if (st.lock > 0) return;
        const gas = clamp(input.up - input.down + input.joyY, -1, 1);
        const steer = clamp(input.left - input.right - input.joyX, -1, 1);
        st.steer = damp(st.steer, steer * (1 - clamp(Math.abs(st.speed) / 21) * 0.55), 5, dt);
        const road = world.groundAt(st.x, st.z);
        const acceleration = gas >= 0 ? 4.9 : st.speed > 0.2 ? 9 : 2.4;
        st.speed = clamp(st.speed + (gas * acceleration - st.speed * (road.onRoad ? 0.24 : 0.85)) * dt, -4.5, road.onRoad ? 18 : 7);
        const yaw = st.yaw + Math.tan(st.steer * 0.66) * st.speed * dt / wheelbase;
        const sx = Math.sin(yaw);
        const sz = Math.cos(yaw);
        const x = st.x + sx * st.speed * dt;
        const z = st.z + sz * st.speed * dt;
        if (Math.abs(x) > world.bounds || Math.abs(z) > world.bounds || world.nearest(x, z).d > 32) {
          st.speed = 0;
          fx.respawn('edge');
          return;
        }
        const collision = world.colliders.find((c) =>
          probes.some((d) => touches(c, x + sx * d, z + sz * d, 1.66))
        );
        if (collision) {
          if (Math.abs(st.speed) > 1) fx.bump(collision, st);
          st.speed = 0;
          if (Math.abs(gas) > 0.1) st.stuck += dt;
          if (st.stuck > 1.35) fx.respawn('stuck');
          return;
        }
        st.stuck = 0;
        Object.assign(st, { x, z, yaw, y: road.y, t: world.nearest(x, z).t, slope: 0 });
      },
      chase(st, cam, want, env) {
        chaseCamera(st, cam, want, env, view);
      },
      action(id, st, fx) {
        if (id === 'horn') fx.sound('horn');
        if (id === 'doors') {
          if (waitingAtStop) opening = !opening;
          fx.feedback(waitingAtStop ? (opening ? 'doorsOpen' : 'doorsClosed') : 'doorsStop');
        }
      },
    };
  },
};
