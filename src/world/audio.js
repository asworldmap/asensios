import { clamp, smooth } from './kit.js';

// Filtered noise, quiet machinery and brief non-musical cues.
const MIX = {
  murcia: { filter: 'bandpass', hz: 1150, wind: 0.047, motion: 0.019, tide: 0.28, motor: 44 },
  europe: { filter: 'lowpass', hz: 300, wind: 0.029, motion: 0.061, tide: 0.42, motor: 48 },
  'europe-bus': { filter: 'lowpass', hz: 440, wind: 0.026, motion: 0.054, tide: 0.4, motor: 57 },
  japan: { filter: 'lowpass', hz: 640, wind: 0.077, motion: 0.026, tide: 0.23, motor: 33 },
  flight: { filter: 'lowpass', hz: 590, wind: 0.041, motion: 0.072, tide: 0.7, motor: 71 },
  chile: { filter: 'bandpass', hz: 850, wind: 0.052, motion: 0.011, tide: 0.31 },
  'lab-rail': { filter: 'lowpass', hz: 300, wind: 0.029, motion: 0.061, tide: 0.42, motor: 48 },
};

export function createJourneyAudio() {
  let context;
  let master;
  let noise;
  let current;
  let chapter;
  let enabled = true;
  let quiet = false;
  let lastMix = -Infinity;
  const beds = new Set();

  function syncVolume() {
    if (!master) return;
    master.gain.setTargetAtTime(enabled && !quiet ? 0.68 : 0, context.currentTime, 0.045);
  }

  function unlock() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    try {
      if (!context) {
        context = new Context();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        const length = context.sampleRate * 2;
        noise = context.createBuffer(1, length, context.sampleRate);
        const samples = noise.getChannelData(0);
        for (let i = 0; i < length; i++) samples[i] = 2 * Math.random() - 1;
        change(chapter);
        syncVolume();
      }
      if (context.state === 'suspended') void context.resume().catch(() => {});
    } catch {
      // Audio is optional when the browser or output device is unavailable.
    }
  }

  function change(id) {
    chapter = id;
    const profile = MIX[id];
    if (!context || !profile || current?.id === id) return;
    const now = context.currentTime;
    if (current) {
      current.bus.gain.setTargetAtTime(0, now, 0.24);
      for (const source of current.sources) source.stop(now + 1.25);
    }
    const bus = context.createGain();
    bus.gain.value = 0;
    bus.connect(master);
    bus.gain.setTargetAtTime(1, now, 0.24);

    const air = context.createBufferSource();
    air.buffer = noise;
    air.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = profile.filter;
    filter.frequency.value = profile.hz;
    filter.Q.value = 0.7;
    const wind = context.createGain();
    wind.gain.value = profile.wind;
    air.connect(filter).connect(wind).connect(bus);

    const tide = context.createOscillator();
    tide.frequency.value = profile.tide;
    const flutter = context.createGain();
    flutter.gain.value = profile.wind * 0.13;
    tide.connect(flutter).connect(wind.gain);
    const sources = [air, tide];
    const nodes = [bus, filter, wind, flutter];
    let engine, motor;
    if (profile.motor) {
      engine = context.createOscillator();
      engine.type = 'sine';
      engine.frequency.value = profile.motor;
      motor = context.createGain();
      motor.gain.value = 0;
      engine.connect(motor).connect(bus);
      sources.push(engine);
      nodes.push(motor);
    }
    const bed = { id, bus, profile, wind, filter, engine, motor, sources, nodes };
    current = bed;
    beds.add(bed);
    air.onended = () => {
      for (const node of [...nodes, ...sources]) node.disconnect();
      beds.delete(bed);
    };
    for (const source of sources) source.start(now);
    lastMix = -Infinity;
  }

  function tone(freq, gain, len, type = 'sine', partials = [1, 2.76]) {
    if (!enabled || quiet) return;
    unlock();
    if (!context || !master) return;
    const now = context.currentTime;
    partials.forEach((multiple, i) => {
      const wave = context.createOscillator();
      const envelope = context.createGain();
      wave.type = type;
      wave.frequency.value = freq * multiple;
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.linearRampToValueAtTime(gain / (i + 1), now + 0.018);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + len / (i + 1));
      wave.connect(envelope).connect(master);
      wave.start(now);
      wave.stop(now + len);
      wave.onended = () => { wave.disconnect(); envelope.disconnect(); };
    });
  }

  function update(speed, airborne, walking, progress) {
    if (!current || !context || context.state !== 'running') return;
    const now = context.currentTime;
    if (now - lastMix < 0.08) return;
    lastMix = now;
    const { profile, wind, filter, engine, motor, id } = current;
    const rate = clamp(Math.abs(speed) / (id === 'flight' ? 63 : 16));
    const town = id === 'murcia' ? smooth(0.51, 0.65, progress) * (1 - smooth(0.83, 0.97, progress)) : 1;
    const runwayRumble = id === 'flight' && !airborne ? smooth(0.81, 0.85, progress) * (1 - smooth(0.86, 0.94, progress)) : 0;
    wind.gain.setTargetAtTime(profile.wind + profile.motion * rate + runwayRumble * 0.023, now, 0.22);
    filter.frequency.setTargetAtTime(profile.hz * (1 + rate * 0.72 + (airborne && id === 'flight' ? 0.22 : 0)), now, 0.18);
    if (engine) {
      engine.frequency.setTargetAtTime(profile.motor * (1 + rate * 0.50), now, 0.26);
      motor.gain.setTargetAtTime(town * ((walking ? 0.002 : 0.005) + rate * 0.014), now, 0.18);
    }
  }

  return {
    unlock, change, tone, update,
    setEnabled(value) { enabled = value; syncVolume(); },
    setQuiet(value) { quiet = value; syncVolume(); },
    dispose() {
      for (const bed of beds) bed.bus.disconnect();
      if (context) void context.close().catch(() => {});
    },
  };
}
