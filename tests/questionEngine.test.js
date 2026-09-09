import { describe, it, expect } from 'vitest';
import {
  generateCountObjectsQuestion,
  generateShapeMatchQuestion,
  generateQuestionForUnit,
} from '../src/systems/QuestionEngine.js';

describe('generateCountObjectsQuestion', () => {
  it('returns exactly 3 choices with exactly one correct answer', () => {
    const question = generateCountObjectsQuestion();
    expect(question.choices).toHaveLength(3);
    expect(question.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
  });

  it('the correct choice value matches promptCount', () => {
    const question = generateCountObjectsQuestion();
    const correct = question.choices.find((choice) => choice.isCorrect);
    expect(correct.value).toBe(question.promptCount);
  });

  it('promptCount stays within 1 and 9 (9까지의 수 범위)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateCountObjectsQuestion();
      expect(question.promptCount).toBeGreaterThanOrEqual(1);
      expect(question.promptCount).toBeLessThanOrEqual(9);
    }
  });

  it('choice values contain no duplicates', () => {
    const question = generateCountObjectsQuestion();
    const values = question.choices.map((choice) => choice.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('all choice values stay within the valid 0-9 display range', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateCountObjectsQuestion();
      question.choices.forEach((choice) => {
        expect(choice.value).toBeGreaterThanOrEqual(0);
        expect(choice.value).toBeLessThanOrEqual(9);
      });
    }
  });

  it('wrong-answer distractors are within +-2 of the correct count (plausible near-misses)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateCountObjectsQuestion();
      question.choices
        .filter((choice) => !choice.isCorrect)
        .forEach((choice) => {
          expect(Math.abs(choice.value - question.promptCount)).toBeLessThanOrEqual(2);
        });
    }
  });
});

describe('generateShapeMatchQuestion', () => {
  it('returns exactly 3 choices with exactly one correct answer', () => {
    const question = generateShapeMatchQuestion();
    expect(question.choices).toHaveLength(3);
    expect(question.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
  });

  it('the correct choice value matches targetShape', () => {
    const question = generateShapeMatchQuestion();
    const correct = question.choices.find((choice) => choice.isCorrect);
    expect(correct.value).toBe(question.targetShape);
  });

  it('choices cover exactly the three known shape types with no duplicates', () => {
    for (let i = 0; i < 20; i += 1) {
      const question = generateShapeMatchQuestion();
      const values = question.choices.map((choice) => choice.value).sort();
      expect(values).toEqual(['circle', 'square', 'triangle']);
    }
  });
});

describe('generateQuestionForUnit', () => {
  it('routes nums_within_9 to a count_objects question', () => {
    const question = generateQuestionForUnit('nums_within_9');
    expect(question.type).toBe('count_objects');
  });

  it('routes shapes_2d to a shape_match question', () => {
    const question = generateQuestionForUnit('shapes_2d');
    expect(question.type).toBe('shape_match');
  });

  it('falls back to count_objects for an unknown unit id', () => {
    const question = generateQuestionForUnit('does_not_exist');
    expect(question.type).toBe('count_objects');
  });
});
