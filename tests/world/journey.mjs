/* global window, document, console, performance */
import assert from 'node:assert/strict';
import { URL } from 'node:url';
import { open } from './lib.mjs';

const stages = [
  { id: 'europe', model: 'train_cab', part: 'PART_wheelset_front1', card: 'ch5' },
  { id: 'europe-bus', model: 'coach_bus', part: 'PART_wheel_fl', card: 'ch7' },
  { id: 'asia', model: 'airliner', part: 'PART_gear_main_l', card: 'ch4' },
  { id: 'japan', model: 'passenger_ship', part: 'PART_propeller', card: 'ch8' },
  { id: 'chile', model: 'city_bike', part: 'PART_wheel_front', card: 'ch10' },
];

const { b, p, errs, wait } = await open({ reduced: true, quality: 1 });
try {
  const stats = () => p.evaluate(() => window.__pw.game.stats());
  const chapter = (id) => p.waitForFunction((target) => window.__pw.game.chapter === target, id);
  const select = async (id) => {
    await p.click('[data-menu-open]');
    await p.click('[data-chapter-id="' + id + '"]');
    await chapter(id);
    await p.waitForFunction(() => document.querySelector('[data-chapter-loading]').hidden);
    const url = new URL(p.url());
    assert.equal(url.searchParams.get('chapter') || 'murcia', id);
  };
  const city = await stats();
  const initial = await p.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name));
  assert.ok(initial.some((url) => url.endsWith('/vehicles/city_bike.glb')));
  assert.ok(!initial.some((url) => /\/(train_cab|coach_bus|airliner|passenger_ship)\.glb$/.test(url)));

  // Arrival in Murcia continues into the same journey, without a reload.
  await p.click('[data-menu-open]');
  await p.locator('[data-travel] button').last().click();
  await p.locator('[data-chapter-next]').click();
  await chapter('europe');

  for (const stage of stages) {
    assert.equal(await p.evaluate(() => window.__pw.game.state.mode), 'story');
    assert.ok(await p.evaluate((name) => window.__pw.game.vehicle.object.getObjectByName(name)?.name, stage.model));
    await p.waitForFunction(() => Boolean(window.__pw.game.state.beat));
    assert.ok((await p.locator('[data-cap-title]').textContent())?.trim());
    await p.click('[data-mode="explore"]');
    const pose = () => p.evaluate((part) => window.__pw.game.vehicle.object.getObjectByName(part).quaternion.toArray(), stage.part);
    const before = await pose();
    await p.keyboard.down('KeyW');
    await p.waitForFunction(() => window.__pw.game.state.speed > 2);
    await p.keyboard.up('KeyW');
    if (stage.id === 'europe') {
      const cars = await p.evaluate(() => {
        const g = window.__pw.game, [front, coach, rear] = g.vehicle.object.children;
        const anchor = (car, name) => car.getObjectByName('ANCHOR_coupler_' + name).getWorldPosition(car.position.clone());
        return [front.name, coach.name, rear.name, anchor(front, 'rear').distanceTo(anchor(coach, 'front')), g.world.nearest(g.state.x, g.state.z).d];
      });
      assert.deepEqual(cars.slice(0, 3), ['train_cab', 'train_coach', 'train_cab']);
      assert.ok(cars[3] < 0.06 && cars[4] < 0.05);
      // Drive the last approach under power and watch the platform-side doors.
      const closed = await p.evaluate(() => {
        const g = window.__pw.game;
        g.state.t = g.state.tTarget = 0.93;
        g.state.speed = 8;
        return g.vehicle.object.getObjectByName('PART_door_l1').position.z;
      });
      await p.keyboard.down('KeyW');
      await p.waitForFunction(() => window.__pw.game.state.t === 1 && window.__pw.game.state.speed === 0);
      await p.keyboard.up('KeyW');
      await p.waitForFunction((z) => Math.abs(window.__pw.game.vehicle.object.getObjectByName('PART_door_l1').position.z - z) > 0.6, closed);
    }
    if (stage.id === 'asia') {
      await p.waitForFunction(() => window.__pw.game.state.y > 28);
      const oldYaw = await p.evaluate(() => window.__pw.game.state.yaw);
      await p.keyboard.press('Space');
      await p.keyboard.down('KeyA');
      await wait(0.9);
      await p.keyboard.up('KeyA');
      assert.ok(await p.evaluate((yaw) => Math.abs(window.__pw.game.state.yaw - yaw) > 0.14, oldYaw));
      await p.keyboard.press('Space');
      await p.waitForFunction(() => window.__pw.game.state.t > 0.86);
    }
    assert.notDeepEqual(await pose(), before, stage.part);

    if (stage.id === 'europe-bus') {
      await p.evaluate(() => window.__pw.game.travel('europe-bus_start'));
      await p.waitForFunction(() => {
        const g = window.__pw.game;
        return g.state.lock === 0 && Math.abs(g.vehicle.object.getObjectByName('PART_door_front').quaternion.y) > 0.4;
      });
      await p.keyboard.press('KeyB');
      await p.waitForFunction(() => Math.abs(window.__pw.game.vehicle.object.getObjectByName('PART_door_front').quaternion.y) < 0.15);
      const oldYaw = await p.evaluate(() => window.__pw.game.state.yaw);
      await p.keyboard.down('KeyW');
      await p.keyboard.down('KeyA');
      await wait(1.15);
      await p.keyboard.up('KeyW');
      await p.keyboard.up('KeyA');
      assert.ok(await p.evaluate((yaw) => window.__pw.game.state.yaw > yaw + 0.18, oldYaw));
      await p.evaluate(() => {
        const g = window.__pw.game, c = g.world.colliders[0];
        Object.assign(g.state, { x: c.x - 8, z: c.z, yaw: Math.PI / 2, speed: 0, steer: 0 });
      });
      await p.keyboard.down('KeyW');
      await p.waitForFunction(() => window.__pw.game.state.stuck > 0.3 && window.__pw.game.state.speed === 0);
      await p.waitForFunction(() => window.__pw.game.state.lock > 0);
      await p.keyboard.up('KeyW');
      await p.waitForFunction(() => {
        const g = window.__pw.game;
        return g.world.nearest(g.state.x, g.state.z).d < 0.3;
      });
    }

    if (stage.id === 'japan') {
      const eye = () => p.evaluate(() => {
        const g = window.__pw.game, pos = g.vehicle.object.position.clone();
        g.vehicle.chase(g.state, { yaw: g.state.yaw }, { pos, look: pos.clone() }, { dt: 0.016, calm: true });
        return pos.toArray();
      });
      await p.keyboard.press('Space');
      assert.ok(await p.evaluate(() => window.__pw.game.vehicle.walking));
      const oldEye = await eye();
      await p.keyboard.down('KeyW');
      await wait(0.5);
      await p.keyboard.up('KeyW');
      assert.ok(Math.hypot(...(await eye()).map((v, i) => v - oldEye[i])) > 0.6);
      await p.keyboard.press('Space');
      assert.equal(await p.evaluate(() => window.__pw.game.vehicle.walking), false);
    }

    await p.click('[data-mode="story"]');
    await p.click('[data-menu-open]');
    await p.locator('[data-travel] button').last().click();
    await p.locator('[data-open]').click();
    assert.equal(await p.getAttribute('[data-card-link]', 'href'), '/trajectory/#' + stage.card);
    assert.ok((await p.getAttribute('[data-card-img]', 'src')).endsWith('.webp'));
    await p.keyboard.press('Escape');
    const current = stages.indexOf(stage);
    if (current < stages.length - 1) {
      await p.locator('[data-chapter-next]').click();
      await chapter(stages[current + 1].id);
    } else {
      assert.equal(await p.getAttribute('[data-cap-link]', 'href'), '/trajectory/');
      assert.equal(await p.locator('[data-chapter-next]').isVisible(), false);
    }
    console.log('PASS ' + stage.id + ' · model, driving, story, card');
  }

  await select('murcia');
  await wait(0.4);
  const again = await stats();
  assert.equal(again.assets, city.assets);
  assert.equal(again.assetBytes, city.assetBytes);
  assert.ok(again.geometries <= city.geometries + 2 && again.textures <= city.textures + 2,
    JSON.stringify({ city, again }));

  const fail = '**/vehicles/airliner.glb';
  await p.route(fail, (request) => request.fulfill({ status: 503, body: 'test load failure' }));
  await p.click('[data-menu-open]');
  await p.click('[data-chapter-id="asia"]');
  await p.waitForFunction(() => document.querySelector('[data-chapter-loading]').hidden);
  assert.equal((await stats()).chapter, 'murcia');
  assert.equal((await stats()).assets, city.assets);
  assert.ok((await p.locator('[data-toast]').textContent()).includes('Reintenta'));
  await p.unroute(fail);
  await select('asia');
  assert.ok(errs.every((error) => error.includes('503')), errs.join('\n'));
  console.log('PASS chapter memory, failed load and retry');
} finally {
  await b.close();
}

const mobile = await open({ device: 'iPhone 13', reduced: true, quality: 0 });
try {
  const { p: phone } = mobile;
  await phone.tap('[data-menu-open]');
  await phone.tap('[data-chapter-id="japan"]');
  await phone.waitForFunction(() => window.__pw.game.chapter === 'japan');
  await phone.tap('[data-mode="explore"]');
  await phone.tap('[data-hop]');
  assert.ok(await phone.evaluate(() => window.__pw.game.vehicle.walking));
  assert.ok(await phone.locator('[data-joy]').isVisible());
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  assert.deepEqual(mobile.errs, []);
  console.log('PASS mobile chapter selection and ship deck action');
} finally {
  await mobile.b.close();
}

const fallback = await open({ query: '?chapter=japan&nowebgl', start: false });
try {
  const { p: no3D } = fallback;
  assert.equal(await no3D.locator('[data-index] .pw-index-journey a').count(), stages.length);
  assert.equal(await no3D.locator('[data-canvas]').isVisible(), false);
  assert.equal(await no3D.locator('[data-index] a[href="/trajectory/#ch8"]').isVisible(), true);
  assert.deepEqual(fallback.errs, []);
  console.log('PASS no-WebGL links to the journey');
} finally {
  await fallback.b.close();
}
