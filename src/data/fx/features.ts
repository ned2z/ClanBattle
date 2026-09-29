import type { Feature } from './types';

/**
 * Signature flourishes for individual skills. A feature borrows a base recipe
 * and layers extra steps / feel on top, so a skill can feel like its own thing
 * without forking the whole choreography.
 *
 * Enabled from a skill via `feature: '<id>'`.
 */
export const FEATURES: Record<string, Feature> = {
  y_meteorstorm: {
    id: 'y_meteorstorm', name: 'พายุอุกกาบ', base: 'meteor',
    add: [
      { at: 1, prim: 'shockwaveCentre', args: { size: 6, dur: 0.8 } },
    ],
    feel: { hitstop: 0.14, shake: 0.8, shakeDur: 0.6 },
    callout: { text: 'พายุอุกกาบ!', sub: 'ท้องฟ้าร่วง' },
  },
  y_absolutezero: {
    id: 'y_absolutezero', name: 'ศูนย์สมบูรณ์', base: 'blizzard',
    add: [{ at: 1, prim: 'eachTarget', args: { steps: [{ prim: 'iceSpikes', args: { size: 1.6 } }] } }],
    feel: { hitstop: 0.12, shake: 0.5, shakeDur: 0.45 },
    callout: { text: 'ศูนย์สมบูรณ์!', sub: 'ทุกอย่างหยุดนิ่ง' },
  },
  y_phoenix: {
    id: 'y_phoenix', name: 'ฟื้นคืนเพลิง', base: 'healall',
    add: [{ at: 1, prim: 'lightCentre', args: { color: 0xffb020, power: 30 } }],
    feel: { flash: 0.4 },
    callout: { text: 'ฟื้นคืนเพลิง!' },
  },
  y_judgmentday: {
    id: 'y_judgmentday', name: 'วันพิพิธภัจจัย', base: 'holy',
    add: [{ at: 1, prim: 'lightCentre', args: { color: 0xffffff, power: 55 } }],
    feel: { hitstop: 0.13, shake: 0.6, shakeDur: 0.5 },
    callout: { text: 'วันพิพิธภัจจัย!', sub: 'แสงจากสวรรค์' },
  },
  y_blackhole: {
    id: 'y_blackhole', name: 'หลุดดำ', base: 'dark',
    add: [{ at: 1, prim: 'eachTarget', args: { steps: [{ prim: 'voidOrb' }] } }],
    feel: { hitstop: 0.12, shake: 0.55, shakeDur: 0.5 },
    callout: { text: 'หลุดดำ!', sub: 'ชั่วงเวลาถูกกลืน' },
  },
};
