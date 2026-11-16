// Chapter registry.
//
// A chapter is a lazily imported module that exports
//
//   build({ scene, tier, step, assets, shared }) -> world
//
// and the engine only ever talks to the returned `world`:
//
//   id, atmosphere            light + sky (see atmosphere.js)
//   route { length, N, RX, RZ, closed }, pointAt(t), nearest(x, z)
//   heightAt(x, z), groundAt(x, z), waterY, bounds, rideHeight
//   colliders [{ type: 'circle' | 'segment', … }]
//   pois   [{ id, t, x, z, focus, radius, … }]          things to open
//   beats  [{ id, t, poi?, cine?, keys, place? }]       story stops
//   shots  [{ t, back, side, up, ahead, lift, fov }]    directed camera
//   cine   [[t0, t1], …]                                letterbox ranges
//   establishing { from: [x, y, z], look: [x, y, z] }   cover / intro camera
//   update(s) -> events, bump?(collider, st), heard?(kind, st), safeT?(x, z)
//   dispose()
//
// Each entry lists the assets it needs so the engine can load them before the
// build starts and free them when the chapter is left.

const MURCIA_ASSETS = [
  'murcia/bridge_segura', 'murcia/lemon_tree', 'murcia/lemon_tree_far',
  'murcia/townhouse_a', 'murcia/townhouse_b', 'murcia/townhouse_c', 'murcia/farmhouse',
];

export const CHAPTERS = {
  murcia: {
    id: 'murcia',
    order: 1,
    vehicle: 'bicycle',
    status: 'playable',
    label: 'world.chapter',
    title: 'world.ch1',
    assets: MURCIA_ASSETS,
    load: () => import('./murcia.js'),
  },
  europe: {
    id: 'europe', order: 2, vehicle: 'train', status: 'playable',
    label: 'world.leg.europe.label', title: 'world.leg.europe.label',
    assets: [
      'europe/rail_track_straight', 'europe/rail_platform', 'europe/station_shelter',
      'europe/rail_signal', 'europe/catenary_mast', 'europe/conifer', 'common/street_lamp',
    ],
    load: () => import('./europe.js'),
  },
  "europe-bus": {
    id: 'europe-bus', order: 3, vehicle: 'bus', status: 'playable',
    label: 'world.leg.europe-bus.label', title: 'world.leg.europe-bus.label',
    assets: [
      'europe/conifer',
      'europe/road_guardrail',
      'europe/road_sign',
      'common/park_bench',
      'common/street_lamp',
    ],
    load: () => import('./europe-bus.js'),
  },
  "asia": {
    id: 'asia', order: 4, vehicle: 'airplane', status: 'playable',
    label: 'world.leg.asia.label', title: 'world.leg.asia.label',
    assets: [
      'asia/runway_light',
      'asia/terminal_bay',
      'asia/jet_bridge',
      'asia/baggage_cart',
      'asia/bamboo_clump',
    ],
    load: () => import('./asia.js'),
  },
  "japan": {
    id: 'japan', order: 5, vehicle: 'ship', status: 'playable',
    label: 'world.leg.japan.label', title: 'world.leg.japan.label',
    assets: [
      'maritime/quay_section',
      'maritime/harbour_light',
      'maritime/cargo_crate',
      'maritime/mooring_buoy',
    ],
    load: () => import('./japan.js'),
  },
  // Technical test track for vehicles. Not part of the story and never linked
  // from the public interface: reachable only with ?chapter=lab-rail.
  'lab-rail': {
    id: 'lab-rail',
    order: 99,
    lab: true,
    vehicle: 'train',
    status: 'lab',
    label: 'world.lab.chapter',
    title: 'world.lab.title',
    assets: ['murcia/lemon_tree', 'murcia/farmhouse'],
    load: () => import('./lab-rail.js'),
  },
};

// The rest of the journey, as planned. Vehicles are design intent; the
// biographical content of each chapter is added only once it is verified.
export const PLANNED = [
  { id: 'europe', order: 2, title: 'world.ch2', vehicles: ['train', 'bus'] },
  { id: 'asia', order: 3, title: 'world.ch3', vehicles: ['airplane', 'ship'] },
  { id: 'chile', order: 4, title: 'world.ch4', vehicles: [] },
];

