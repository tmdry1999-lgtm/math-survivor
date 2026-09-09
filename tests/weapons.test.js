import { describe, it, expect } from 'vitest';
import { WEAPON_DEFS, WEAPON_IDS, MAX_WEAPON_LEVEL, getWeaponStats } from '../src/data/weapons.js';

describe('weapon data', () => {
  it('defines exactly 8 weapons', () => {
    expect(WEAPON_IDS).toHaveLength(8);
  });

  it('covers exactly the 4 supported behaviors, 2 weapons each', () => {
    const counts = {};
    WEAPON_IDS.forEach((id) => {
      const behavior = WEAPON_DEFS[id].behavior;
      counts[behavior] = (counts[behavior] ?? 0) + 1;
    });
    expect(counts).toEqual({ homing: 2, pierce: 2, aoe: 2, orbit: 2 });
  });

  it('every weapon has a label, icon, and color', () => {
    WEAPON_IDS.forEach((id) => {
      const def = WEAPON_DEFS[id];
      expect(typeof def.label).toBe('string');
      expect(def.label.length).toBeGreaterThan(0);
      expect(typeof def.icon).toBe('string');
      expect(typeof def.color).toBe('number');
    });
  });
});

describe('getWeaponStats', () => {
  it('level 1 returns exactly the base stats', () => {
    WEAPON_IDS.forEach((id) => {
      const stats = getWeaponStats(id, 1);
      expect(stats).toEqual(WEAPON_DEFS[id].base);
    });
  });

  it('interval strictly decreases with each level up to the max level', () => {
    WEAPON_IDS.forEach((id) => {
      let previous = getWeaponStats(id, 1).interval;
      for (let level = 2; level <= MAX_WEAPON_LEVEL; level += 1) {
        const current = getWeaponStats(id, level).interval;
        expect(current).toBeLessThanOrEqual(previous);
        previous = current;
      }
    });
  });

  it('interval never drops below the configured floor', () => {
    WEAPON_IDS.forEach((id) => {
      const def = WEAPON_DEFS[id];
      for (let level = 1; level <= MAX_WEAPON_LEVEL + 5; level += 1) {
        expect(getWeaponStats(id, level).interval).toBeGreaterThanOrEqual(def.min.interval);
      }
    });
  });

  it('range/radius/corridor grow (never shrink) with level for weapons that have them', () => {
    WEAPON_IDS.forEach((id) => {
      const def = WEAPON_DEFS[id];
      Object.keys(def.base)
        .filter((key) => key !== 'interval')
        .forEach((key) => {
          let previous = getWeaponStats(id, 1)[key];
          for (let level = 2; level <= MAX_WEAPON_LEVEL; level += 1) {
            const current = getWeaponStats(id, level)[key];
            expect(current).toBeGreaterThanOrEqual(previous);
            previous = current;
          }
        });
    });
  });
});
