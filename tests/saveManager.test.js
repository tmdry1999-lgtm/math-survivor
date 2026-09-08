import { describe, it, expect, beforeEach } from 'vitest';
import { getSave, saveStageResult } from '../src/systems/SaveManager.js';

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
});
