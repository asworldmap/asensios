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
  'murcia/palm_tree', 'murcia/stone_wall', 'murcia/fountain',
  'common/street_lamp', 'common/park_bench', 'common/planter', 'common/signpost',
  'murcia_v2/sierra_backdrop', 'murcia_v2/notice_board', 'murcia_v2/olive_tree', 'europe_v2/station_building',
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
      'europe_v2/station_building', 'europe_v2/station_canopy', 'europe_v2/platform_paving',
      'europe_v2/signal_box', 'europe_v2/alps_backdrop', 'europe_v2/birch_tree',
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
      'europe_v2/station_building', 'europe_v2/hedgerow', 'maritime_v2/harbour_office', 'maritime_v2/dock_clutter',
      'common/park_bench',
      'common/street_lamp',
    ],
    load: () => import('./europe-bus.js'),
  },
  flight: {
    id: 'flight', order: 5, vehicle: 'airplane', status: 'playable',
    label: 'world.leg.flight.label', title: 'world.leg.flight.label',
    assets: [
      'asia/runway_light', 'asia/baggage_cart', 'asia_v2/control_tower', 'asia_v2/terminal_hall',
      'asia_v2/windsock', 'asia_v2/apron_tile', 'asia_v2/rain_tree', 'chile_v2/cordillera_backdrop',
      'journey/cloud_bank', 'journey/cloud_sea',
    ],
    load: () => import('./flight.js'),
  },
  "japan": {
    id: 'japan', order: 4, vehicle: 'ship', status: 'playable',
    label: 'world.leg.japan.label', title: 'world.leg.japan.label',
    assets: [
      'maritime/quay_section',
      'maritime/harbour_light',
      'maritime/cargo_crate',
      'maritime/mooring_buoy',
      'maritime_v2/harbour_office', 'maritime_v2/lighthouse', 'maritime_v2/breakwater',
      'maritime_v2/dock_clutter', 'maritime_v2/fishing_boat', 'maritime_v2/horizon_islands',
    ],
    load: () => import('./japan.js'),
  },
  chile: {
    id: 'chile', order: 6, vehicle: 'bicycle', status: 'playable',
    label: 'world.leg.chile.label', title: 'world.leg.chile.label',
    assets: [
      'chile/rock_outcrop', 'chile/araucaria', 'chile/tussock_grass', 'common/park_bench', 'common/signpost',
      'chile_v2/lookout_terrace', 'chile_v2/espino_tree', 'chile_v2/vineyard_rows', 'chile_v2/poplar_row',
      'chile_v2/cordillera_backdrop', 'chile_v2/foothill_ridge', 'chile_v2/city_basin_backdrop',
    ],
    load: () => import('./chile.js'),
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

export const JOURNEY = Object.values(CHAPTERS).filter((chapter) => !chapter.lab).sort((a, b) => a.order - b.order);
