function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildChoices(correctValue, minValue, maxValue) {
  const values = new Set([correctValue]);
  let guard = 0;
  while (values.size < 3 && guard < 100) {
    guard += 1;
    const offset = randomInt(1, 2) * (Math.random() < 0.5 ? -1 : 1);
    const candidate = correctValue + offset;
    if (candidate >= minValue && candidate <= maxValue) {
      values.add(candidate);
    }
  }
  // guard 초과로 3개를 못 채운 극단적인 경우(정답이 범위 경계)를 위한 안전망
  let filler = minValue;
  while (values.size < 3 && filler <= maxValue) {
    values.add(filler);
    filler += 1;
  }
  return shuffle([...values]).map((value) => ({
    value,
    isCorrect: value === correctValue,
  }));
}

export function generateCountObjectsQuestion() {
  const promptCount = randomInt(1, 9);
  return {
    type: 'count_objects',
    promptCount,
    choices: buildChoices(promptCount, 0, 9),
  };
}

const SHAPE_TYPES = ['triangle', 'square', 'circle'];

export function generateShapeMatchQuestion() {
  const targetShape = SHAPE_TYPES[randomInt(0, SHAPE_TYPES.length - 1)];
  const distractors = shuffle(SHAPE_TYPES.filter((shape) => shape !== targetShape));
  const choices = shuffle([
    { value: targetShape, isCorrect: true },
    { value: distractors[0], isCorrect: false },
    { value: distractors[1], isCorrect: false },
  ]);
  return {
    type: 'shape_match',
    targetShape,
    choices,
  };
}

export function generateAddSubQuestion() {
  const isAddition = Math.random() < 0.5;
  let a;
  let b;
  let correct;
  let promptText;

  if (isAddition) {
    a = randomInt(1, 8);
    b = randomInt(1, 9 - a);
    correct = a + b;
    promptText = `${a} + ${b}`;
  } else {
    a = randomInt(1, 9);
    b = randomInt(0, a);
    correct = a - b;
    promptText = `${a} - ${b}`;
  }

  return {
    type: 'equation',
    promptText,
    choices: buildChoices(correct, 0, 9),
  };
}

export function generateComparisonQuestion() {
  const leftCount = randomInt(1, 9);
  let rightCount = randomInt(1, 9);
  while (rightCount === leftCount) {
    rightCount = randomInt(1, 9);
  }
  const leftIsMore = leftCount > rightCount;

  return {
    type: 'comparison',
    leftCount,
    rightCount,
    choices: shuffle([
      { value: 'left', isCorrect: leftIsMore },
      { value: 'right', isCorrect: !leftIsMore },
    ]),
  };
}

export function generateNumberSequenceQuestion() {
  const sequenceStart = randomInt(1, 47);
  const correct = sequenceStart + 2;
  return {
    type: 'number_sequence',
    sequenceStart,
    choices: buildChoices(correct, 1, 50),
  };
}

const QUESTION_GENERATORS = {
  nums_within_9: generateCountObjectsQuestion,
  shapes_2d: generateShapeMatchQuestion,
  add_sub_within_9: generateAddSubQuestion,
  comparison: generateComparisonQuestion,
  nums_within_50: generateNumberSequenceQuestion,
};

export function generateQuestionForUnit(unitId) {
  const generator = QUESTION_GENERATORS[unitId] ?? generateCountObjectsQuestion;
  return generator();
}
