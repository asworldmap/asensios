import { Vector3 } from 'three';
import { clamp, dampAngle } from '../kit.js';

const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

export function rig(instance) {
  return instance.entry.rig.map((spec) => {
    const node = instance.nodes[spec.name.slice(5)];
    const axis = new Vector3(...(spec.hinge || AXES[spec.axis])).normalize();
    const rest = node.quaternion.clone();
    const pos = node.position.clone();
    const limit = (spec.limit_deg ?? Infinity) * Math.PI / 180;
    return {
      ...spec, node, limit,
      turn(angle) {
        node.quaternion.copy(rest);
        node.rotateOnAxis(axis, clamp(angle, -limit, limit));
      },
      slide(fraction) {
        node.position.copy(pos).addScaledVector(axis, spec.travel * spec.opens * fraction);
      },
    };
  });
}

export function chaseCamera(st, cam, want, { portrait, dt, calm }, view) {
  cam.yaw = dampAngle(cam.yaw, st.yaw, 2.8, dt);
  const x = Math.sin(cam.yaw);
  const z = Math.cos(cam.yaw);
  const back = view.back * (portrait ? 1.3 : 1);
  const side = calm ? 0 : view.side;
  want.pos.set(st.x - x * back + z * side, st.y + view.up, st.z - z * back - x * side);
  want.look.set(st.x + x * (view.ahead || 0), st.y + view.lift, st.z + z * (view.ahead || 0));
  want.fov = portrait ? 58 : 46;
}

export function vehicleModel(assets, key) {
  const model = assets.instance(key);
  return {
    object: model.scene,
    parts: rig(model),
    entry: model.entry,
    setTheme() {},
    setCargo() {},
    setShadowBlob() {},
    dispose() {},
  };
}
