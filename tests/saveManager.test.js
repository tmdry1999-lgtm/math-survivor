import { describe, it, expect, beforeEach } from 'vitest';
import { getSave, saveStageResult, purchaseCosmetic, equipCosmetic } from '../src/systems/SaveManager.js';
import { UNIT_SEQUENCE } from '../src/data/units.js';

describe('SaveManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a fresh save with the first stage unlocked when none exists', () => {
    const save = getSave();
    expect(save.currency).toBe(0);
    expect(save.unlockedStages).toEqual(['nums_within_9']);
    expect(save.stageProgress).toEqual({});
    expect(save.ownedCosmetics).toEqual([]);
    expect(save.equippedCosmetics).toEqual({});
  });

  it('falls back to a fresh save when localStorage holds corrupted JSON', () => {
    localStorage.setItem('mathSurvivorSave', '{not valid json');
    const save = getSave();
    expect(save.currency).toBe(0);
    expect(save.unlockedStages).toEqual(['nums_within_9']);
  });

  it('adds currency and records stage progress after a clear', () => {
    const save = saveStageResult({ unitId: 'nums_within_9', accuracy: 0.8, currencyEarned: 16 });
    expect(save.currency).toBe(16);
    expect(save.stageProgress.nums_within_9).toEqual({
      cleared: true,
      bestAccuracy: 0.8,
      attempts: 1,
    });
  });

  it('keeps the best accuracy and accumulates currency across repeated attempts', () => {
    saveStageResult({ unitId: 'nums_within_9', accuracy: 0.5, currencyEarned: 10 });
    const save = saveStageResult({ unitId: 'nums_within_9', accuracy: 0.9, currencyEarned: 18 });
    expect(save.stageProgress.nums_within_9.bestAccuracy).toBe(0.9);
    expect(save.stageProgress.nums_within_9.attempts).toBe(2);
    expect(save.currency).toBe(28);
  });

  it('persists across getSave calls (backed by localStorage)', () => {
    saveStageResult({ unitId: 'nums_within_9', accuracy: 1, currencyEarned: 20 });
    const reloaded = getSave();
    expect(reloaded.currency).toBe(20);
  });

  it('unlocks the next unit in sequence after clearing a stage', () => {
    const save = saveStageResult({ unitId: 'nums_within_9', accuracy: 0.5, currencyEarned: 10 });
    expect(save.unlockedStages).toEqual(['nums_within_9', 'shapes_2d']);
  });

  it('does not add the next unit twice on repeated clears', () => {
    saveStageResult({ unitId: 'nums_within_9', accuracy: 0.5, currencyEarned: 10 });
    const save = saveStageResult({ unitId: 'nums_within_9', accuracy: 0.9, currencyEarned: 18 });
    expect(save.unlockedStages).toEqual(['nums_within_9', 'shapes_2d']);
  });

  it('does not unlock anything past the last unit in the sequence', () => {
    const lastUnitId = UNIT_SEQUENCE[UNIT_SEQUENCE.length - 1];
    const save = saveStageResult({ unitId: lastUnitId, accuracy: 1, currencyEarned: 20 });
    expect(save.unlockedStages).toEqual(['nums_within_9']);
  });

  it('purchaseCosmetic deducts currency, records ownership, and equips it', () => {
    saveStageResult({ unitId: 'nums_within_9', accuracy: 1, currencyEarned: 20 });
    const save = purchaseCosmetic('skin_coral', 20);
    expect(save.currency).toBe(0);
    expect(save.ownedCosmetics).toEqual(['skin_coral']);
    expect(save.equippedCosmetics.playerColor).toBe('skin_coral');
  });

  it('purchaseCosmetic does nothing when currency is insufficient', () => {
    const save = purchaseCosmetic('skin_coral', 20);
    expect(save.currency).toBe(0);
    expect(save.ownedCosmetics).toEqual([]);
    expect(save.equippedCosmetics.playerColor).toBeUndefined();
  });

  it('purchaseCosmetic does not charge again for an already-owned cosmetic', () => {
    saveStageResult({ unitId: 'nums_within_9', accuracy: 1, currencyEarned: 40 });
    purchaseCosmetic('skin_coral', 20);
    const save = purchaseCosmetic('skin_coral', 20);
    expect(save.currency).toBe(20);
    expect(save.ownedCosmetics).toEqual(['skin_coral']);
  });

  it('equipCosmetic switches the equipped cosmetic without charging currency', () => {
    saveStageResult({ unitId: 'nums_within_9', accuracy: 1, currencyEarned: 60 });
    purchaseCosmetic('skin_coral', 20);
    purchaseCosmetic('skin_violet', 40);
    const save = equipCosmetic('skin_coral');
    expect(save.currency).toBe(0);
    expect(save.equippedCosmetics.playerColor).toBe('skin_coral');
  });

  it('equipCosmetic refuses to equip a cosmetic that was never purchased', () => {
    const save = equipCosmetic('skin_violet');
    expect(save.equippedCosmetics.playerColor).toBeUndefined();
  });
});
