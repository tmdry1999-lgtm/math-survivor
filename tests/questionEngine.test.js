import { describe, it, expect } from 'vitest';
import {
  generateCountObjectsQuestion,
  generateShapeMatchQuestion,
  generateAddSubQuestion,
  generateComparisonQuestion,
  generateNumberSequenceQuestion,
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

describe('generateAddSubQuestion', () => {
  it('returns exactly 3 choices with exactly one correct answer', () => {
    const question = generateAddSubQuestion();
    expect(question.choices).toHaveLength(3);
    expect(question.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
  });

  it('promptText correctly represents the equation matching the correct choice', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateAddSubQuestion();
      const correct = question.choices.find((choice) => choice.isCorrect);
      const [aText, operator, bText] = question.promptText.split(' ');
      const a = Number(aText);
      const b = Number(bText);
      const expected = operator === '+' ? a + b : a - b;
      expect(correct.value).toBe(expected);
    }
  });

  it('never produces a negative result or a sum above 9', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateAddSubQuestion();
      const correct = question.choices.find((choice) => choice.isCorrect);
      expect(correct.value).toBeGreaterThanOrEqual(0);
      expect(correct.value).toBeLessThanOrEqual(9);
    }
  });
});

describe('generateComparisonQuestion', () => {
  it('returns exactly 2 choices with exactly one correct answer', () => {
    const question = generateComparisonQuestion();
    expect(question.choices).toHaveLength(2);
    expect(question.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
  });

  it('marks "left" correct when leftCount is greater, "right" otherwise', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateComparisonQuestion();
      const correct = question.choices.find((choice) => choice.isCorrect);
      const expectedSide = question.leftCount > question.rightCount ? 'left' : 'right';
      expect(correct.value).toBe(expectedSide);
    }
  });

  it('never generates two equal counts (always a clear answer)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateComparisonQuestion();
      expect(question.leftCount).not.toBe(question.rightCount);
    }
  });
});

describe('generateNumberSequenceQuestion', () => {
  it('returns exactly 3 choices with exactly one correct answer', () => {
    const question = generateNumberSequenceQuestion();
    expect(question.choices).toHaveLength(3);
    expect(question.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
  });

  it('the correct choice is sequenceStart + 2 (the next number after two shown)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateNumberSequenceQuestion();
      const correct = question.choices.find((choice) => choice.isCorrect);
      expect(correct.value).toBe(question.sequenceStart + 2);
    }
  });

  it('stays within the 1-50 range (50까지의 수)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateNumberSequenceQuestion();
      expect(question.sequenceStart).toBeGreaterThanOrEqual(1);
      expect(question.sequenceStart + 2).toBeLessThanOrEqual(50);
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

  it('routes add_sub_within_9 to an equation question', () => {
    const question = generateQuestionForUnit('add_sub_within_9');
    expect(question.type).toBe('equation');
  });

  it('routes comparison to a comparison question', () => {
    const question = generateQuestionForUnit('comparison');
    expect(question.type).toBe('comparison');
  });

  it('routes nums_within_50 to a number_sequence question', () => {
    const question = generateQuestionForUnit('nums_within_50');
    expect(question.type).toBe('number_sequence');
  });

  it('falls back to count_objects for an unknown unit id', () => {
    const question = generateQuestionForUnit('does_not_exist');
    expect(question.type).toBe('count_objects');
  });
});
