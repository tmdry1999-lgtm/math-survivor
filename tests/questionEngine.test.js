import { describe, it, expect } from 'vitest';
import {
  generateCountObjectsQuestion,
  generateNumberToCountQuestion,
  generateShapeMatchQuestion,
  generateOddOneOutQuestion,
  generateAddSubQuestion,
  generateMissingPartQuestion,
  generateComparisonQuestion,
  generateCompareThreeQuestion,
  generateNumberSequenceQuestion,
  generateCompareNumbersQuestion,
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

  it('difficulty 0 keeps promptCount to 5 or below (easy)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateCountObjectsQuestion(0);
      expect(question.promptCount).toBeLessThanOrEqual(5);
    }
  });

  it('difficulty 2 tightens distractors to +-1 (hard)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateCountObjectsQuestion(2);
      question.choices
        .filter((choice) => !choice.isCorrect)
        .forEach((choice) => {
          expect(Math.abs(choice.value - question.promptCount)).toBeLessThanOrEqual(1);
        });
    }
  });
});

describe('generateNumberToCountQuestion', () => {
  it('returns exactly 3 choices with exactly one correct answer', () => {
    const question = generateNumberToCountQuestion();
    expect(question.choices).toHaveLength(3);
    expect(question.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
  });

  it('the correct choice value matches targetNumber', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateNumberToCountQuestion();
      const correct = question.choices.find((choice) => choice.isCorrect);
      expect(correct.value).toBe(question.targetNumber);
    }
  });

  it('targetNumber stays within 1 and 9', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateNumberToCountQuestion();
      expect(question.targetNumber).toBeGreaterThanOrEqual(1);
      expect(question.targetNumber).toBeLessThanOrEqual(9);
    }
  });

  it('difficulty 0 keeps targetNumber to 5 or below (easy)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateNumberToCountQuestion(0);
      expect(question.targetNumber).toBeLessThanOrEqual(5);
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

describe('generateOddOneOutQuestion', () => {
  it('returns exactly 4 choices with exactly one correct answer', () => {
    const question = generateOddOneOutQuestion();
    expect(question.choices).toHaveLength(4);
    expect(question.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
  });

  it('the three wrong choices all share the same shape, distinct from the correct one', () => {
    for (let i = 0; i < 30; i += 1) {
      const question = generateOddOneOutQuestion();
      const wrongShapes = question.choices.filter((choice) => !choice.isCorrect).map((choice) => choice.value);
      const correctShape = question.choices.find((choice) => choice.isCorrect).value;
      expect(new Set(wrongShapes).size).toBe(1);
      expect(wrongShapes[0]).not.toBe(correctShape);
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

  it('difficulty 0 only produces addition with a sum of 5 or below (easy)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateAddSubQuestion(0);
      expect(question.promptText).toContain('+');
      const correct = question.choices.find((choice) => choice.isCorrect);
      expect(correct.value).toBeLessThanOrEqual(5);
    }
  });
});

describe('generateMissingPartQuestion', () => {
  it('returns exactly 3 choices with exactly one correct answer', () => {
    const question = generateMissingPartQuestion();
    expect(question.choices).toHaveLength(3);
    expect(question.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
  });

  it('the correct choice equals total - knownPart', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateMissingPartQuestion();
      const correct = question.choices.find((choice) => choice.isCorrect);
      expect(correct.value).toBe(question.total - question.knownPart);
    }
  });

  it('knownPart is always strictly between 0 and total (a real missing-part puzzle)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateMissingPartQuestion();
      expect(question.knownPart).toBeGreaterThan(0);
      expect(question.knownPart).toBeLessThan(question.total);
    }
  });

  it('difficulty 0 keeps total to 5 or below (easy)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateMissingPartQuestion(0);
      expect(question.total).toBeLessThanOrEqual(5);
    }
  });
});

describe('generateComparisonQuestion', () => {
  it('returns exactly 2 choices with exactly one correct answer', () => {
    const question = generateComparisonQuestion();
    expect(question.choices).toHaveLength(2);
    expect(question.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
  });

  it('marks the side matching askMore (more when true, fewer when false)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateComparisonQuestion();
      const correct = question.choices.find((choice) => choice.isCorrect);
      const leftWins = question.askMore
        ? question.leftCount > question.rightCount
        : question.leftCount < question.rightCount;
      expect(correct.value).toBe(leftWins ? 'left' : 'right');
    }
  });

  it('never generates two equal counts (always a clear answer)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateComparisonQuestion();
      expect(question.leftCount).not.toBe(question.rightCount);
    }
  });

  it('difficulty 0 forces a gap of at least 3 (easy, obviously different)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateComparisonQuestion(0);
      expect(Math.abs(question.leftCount - question.rightCount)).toBeGreaterThanOrEqual(3);
    }
  });

  it('difficulty 2 forces a gap of exactly 1 (hard, must look closely)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateComparisonQuestion(2);
      expect(Math.abs(question.leftCount - question.rightCount)).toBe(1);
    }
  });
});

describe('generateCompareThreeQuestion', () => {
  it('returns exactly 3 choices with exactly one correct answer', () => {
    const question = generateCompareThreeQuestion();
    expect(question.choices).toHaveLength(3);
    expect(question.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
  });

  it('all three counts are distinct', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateCompareThreeQuestion();
      const counts = question.choices.map((choice) => choice.count);
      expect(new Set(counts).size).toBe(3);
    }
  });

  it('marks the max count correct when askMore, the min count correct otherwise', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateCompareThreeQuestion();
      const counts = question.choices.map((choice) => choice.count);
      const target = question.askMore ? Math.max(...counts) : Math.min(...counts);
      const correct = question.choices.find((choice) => choice.isCorrect);
      expect(correct.count).toBe(target);
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

  it('difficulty 0 keeps sequenceStart to 15 or below (easy, smaller numbers)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateNumberSequenceQuestion(0);
      expect(question.sequenceStart).toBeLessThanOrEqual(15);
    }
  });
});

describe('generateCompareNumbersQuestion', () => {
  it('returns exactly 2 choices with exactly one correct answer', () => {
    const question = generateCompareNumbersQuestion();
    expect(question.choices).toHaveLength(2);
    expect(question.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
  });

  it('never generates two equal numbers', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateCompareNumbersQuestion();
      expect(question.leftNumber).not.toBe(question.rightNumber);
    }
  });

  it('marks the side matching askMore (more when true, fewer when false)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateCompareNumbersQuestion();
      const correct = question.choices.find((choice) => choice.isCorrect);
      const leftWins = question.askMore
        ? question.leftNumber > question.rightNumber
        : question.leftNumber < question.rightNumber;
      expect(correct.value).toBe(leftWins ? 'left' : 'right');
    }
  });

  it('difficulty 0 keeps both numbers to 20 or below (easy)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateCompareNumbersQuestion(0);
      expect(question.leftNumber).toBeLessThanOrEqual(20);
      expect(question.rightNumber).toBeLessThanOrEqual(20);
    }
  });

  it('stays within 1-50 at the default difficulty', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateCompareNumbersQuestion();
      expect(question.leftNumber).toBeLessThanOrEqual(50);
      expect(question.rightNumber).toBeLessThanOrEqual(50);
    }
  });
});

describe('generateQuestionForUnit', () => {
  const unitTypes = {
    nums_within_9: ['count_objects', 'number_to_count'],
    shapes_2d: ['shape_match', 'odd_one_out'],
    add_sub_within_9: ['equation', 'missing_part'],
    comparison: ['comparison', 'compare_three'],
    nums_within_50: ['number_sequence', 'compare_numbers'],
  };

  Object.entries(unitTypes).forEach(([unitId, validTypes]) => {
    it(`routes ${unitId} to one of its known question types every time, and uses more than one`, () => {
      const seenTypes = new Set();
      for (let i = 0; i < 40; i += 1) {
        const question = generateQuestionForUnit(unitId);
        expect(validTypes).toContain(question.type);
        seenTypes.add(question.type);
      }
      // 40번 뽑았는데 한 유형만 나왔다면 사실상 무작위 선택이 아니라는 뜻이므로 실패해야 한다.
      expect(seenTypes.size).toBeGreaterThan(1);
    });
  });

  it('falls back to count_objects for an unknown unit id', () => {
    const question = generateQuestionForUnit('does_not_exist');
    expect(question.type).toBe('count_objects');
  });

  it('forwards the difficulty argument to whichever generator is chosen for nums_within_9', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateQuestionForUnit('nums_within_9', 0);
      const value = question.type === 'count_objects' ? question.promptCount : question.targetNumber;
      expect(value).toBeLessThanOrEqual(5);
    }
  });
});
