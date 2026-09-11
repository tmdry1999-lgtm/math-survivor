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

// maxOffset controls how close wrong answers are to the correct one — 2 allows a
// clearly-different-looking distractor, 1 forces a much harder near-miss.
function buildChoices(correctValue, minValue, maxValue, maxOffset = 2) {
  const values = new Set([correctValue]);

  // A tight maxOffset near the edge of the range (e.g. correctValue at the max with
  // maxOffset 1) can have only one reachable distinct candidate. Widen gradually
  // instead of jumping straight to the arbitrary minValue-fill safety net below, so
  // edge-of-range values still get plausible near-miss distractors.
  for (let offsetLimit = maxOffset; values.size < 3 && offsetLimit <= maxOffset + 2; offsetLimit += 1) {
    let guard = 0;
    while (values.size < 3 && guard < 50) {
      guard += 1;
      const offset = randomInt(1, offsetLimit) * (Math.random() < 0.5 ? -1 : 1);
      const candidate = correctValue + offset;
      if (candidate >= minValue && candidate <= maxValue) {
        values.add(candidate);
      }
    }
  }

  // 그래도 3개를 못 채운 극단적인 경우(값의 범위 자체가 너무 좁은 경우)를 위한 최후의 안전망
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

// difficulty: 0 = easy, 1 = medium (default, matches the original tuning), 2 = hard.
// StageScene raises this as the player levels up within a single run.
export function generateCountObjectsQuestion(difficulty = 1) {
  // 어려움에서는 9를 제외해 정답의 양옆 이웃(±1)이 항상 0-9 범위 안에 존재하도록 보장한다 -
  // 그래야 "가까운 오답만 나온다"는 난이도 약속이 경계값에서도 실제로 지켜진다.
  const promptRangeMax = difficulty === 0 ? 5 : difficulty === 2 ? 8 : 9;
  const maxOffset = difficulty === 2 ? 1 : 2;
  const promptCount = randomInt(1, promptRangeMax);
  return {
    type: 'count_objects',
    promptCount,
    choices: buildChoices(promptCount, 0, 9, maxOffset),
  };
}

// 반대 방향 문제: 숫자를 먼저 보여주고 그 개수만큼인 그림 묶음을 고르게 한다.
export function generateNumberToCountQuestion(difficulty = 1) {
  const promptRangeMax = difficulty === 0 ? 5 : difficulty === 2 ? 8 : 9;
  const maxOffset = difficulty === 2 ? 1 : 2;
  const targetNumber = randomInt(1, promptRangeMax);
  return {
    type: 'number_to_count',
    targetNumber,
    choices: buildChoices(targetNumber, 0, 9, maxOffset),
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

// 모양 4개 중 다른 하나(홀로 다른 모양)를 찾는 유형 - 같은 모양 찾기의 반대 방향.
export function generateOddOneOutQuestion() {
  const majorityShape = SHAPE_TYPES[randomInt(0, SHAPE_TYPES.length - 1)];
  const oddOptions = SHAPE_TYPES.filter((shape) => shape !== majorityShape);
  const oddShape = oddOptions[randomInt(0, oddOptions.length - 1)];
  const choices = shuffle([
    { value: majorityShape, isCorrect: false },
    { value: majorityShape, isCorrect: false },
    { value: majorityShape, isCorrect: false },
    { value: oddShape, isCorrect: true },
  ]);
  return { type: 'odd_one_out', choices };
}

export function generateAddSubQuestion(difficulty = 1) {
  const maxOffset = difficulty === 2 ? 1 : 2;
  let a;
  let b;
  let correct;
  let promptText;

  if (difficulty === 0) {
    // 쉬움: 덧셈만, 합이 5 이하
    a = randomInt(1, 4);
    b = randomInt(1, 5 - a);
    correct = a + b;
    promptText = `${a} + ${b}`;
  } else if (Math.random() < 0.5) {
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
    choices: buildChoices(correct, 0, 9, maxOffset),
  };
}

// 가르기: 전체와 한 부분을 보여주고 나머지 부분(빈칸)을 찾게 한다 - 덧셈식의 뒤집힌 형태.
export function generateMissingPartQuestion(difficulty = 1) {
  const maxOffset = difficulty === 2 ? 1 : 2;
  const totalMax = difficulty === 0 ? 5 : 9;
  const total = randomInt(2, totalMax);
  const knownPart = randomInt(1, total - 1);
  const missingPart = total - knownPart;
  return {
    type: 'missing_part',
    total,
    knownPart,
    choices: buildChoices(missingPart, 0, 9, maxOffset),
  };
}

export function generateComparisonQuestion(difficulty = 1) {
  // 쉬움은 두 수 차이가 커서 한눈에 비교되고, 어려움은 차이가 1이라 자세히 세어봐야 한다.
  const minGap = difficulty === 0 ? 3 : difficulty === 2 ? 1 : 1;
  const maxGap = difficulty === 2 ? 1 : 8;

  let leftCount = randomInt(1, 9);
  let rightCount = randomInt(1, 9);
  let gap = Math.abs(leftCount - rightCount);
  let guard = 0;
  while ((gap < minGap || gap > maxGap) && guard < 100) {
    guard += 1;
    leftCount = randomInt(1, 9);
    rightCount = randomInt(1, 9);
    gap = Math.abs(leftCount - rightCount);
  }

  // 항상 "더 많은 쪽"만 묻지 않고 절반은 "더 적은 쪽"을 물어 다양성을 준다.
  const askMore = Math.random() < 0.5;
  const leftWins = askMore ? leftCount > rightCount : leftCount < rightCount;

  return {
    type: 'comparison',
    askMore,
    leftCount,
    rightCount,
    choices: shuffle([
      { value: 'left', isCorrect: leftWins },
      { value: 'right', isCorrect: !leftWins },
    ]),
  };
}

// 세 묶음 중 가장 많은(또는 가장 적은) 것을 고르는 3지선다 비교 - 2지선다 비교하기의 확장판.
export function generateCompareThreeQuestion() {
  const counts = [];
  while (counts.length < 3) {
    const candidate = randomInt(1, 9);
    if (!counts.includes(candidate)) counts.push(candidate);
  }
  const askMore = Math.random() < 0.5;
  const targetValue = askMore ? Math.max(...counts) : Math.min(...counts);
  const choices = shuffle(
    counts.map((count, index) => ({
      value: ['a', 'b', 'c'][index],
      count,
      isCorrect: count === targetValue,
    })),
  );
  return { type: 'compare_three', askMore, choices };
}

export function generateNumberSequenceQuestion(difficulty = 1) {
  const rangeMax = difficulty === 0 ? 15 : 47;
  const maxOffset = difficulty === 2 ? 1 : 2;
  const sequenceStart = randomInt(1, rangeMax);
  const correct = sequenceStart + 2;
  return {
    type: 'number_sequence',
    sequenceStart,
    choices: buildChoices(correct, 1, 50, maxOffset),
  };
}

// 50까지의 수 범위에서 숫자 그 자체(그림이 아닌 두 자리 수)를 비교하는 유형.
export function generateCompareNumbersQuestion(difficulty = 1) {
  const rangeMax = difficulty === 0 ? 20 : 50;
  let leftNumber = randomInt(1, rangeMax);
  let rightNumber = randomInt(1, rangeMax);
  while (rightNumber === leftNumber) {
    rightNumber = randomInt(1, rangeMax);
  }
  const askMore = Math.random() < 0.5;
  const leftWins = askMore ? leftNumber > rightNumber : leftNumber < rightNumber;

  return {
    type: 'compare_numbers',
    askMore,
    leftNumber,
    rightNumber,
    choices: shuffle([
      { value: 'left', isCorrect: leftWins },
      { value: 'right', isCorrect: !leftWins },
    ]),
  };
}

const QUESTION_GENERATORS = {
  nums_within_9: [generateCountObjectsQuestion, generateNumberToCountQuestion],
  shapes_2d: [generateShapeMatchQuestion, generateOddOneOutQuestion],
  add_sub_within_9: [generateAddSubQuestion, generateMissingPartQuestion],
  comparison: [generateComparisonQuestion, generateCompareThreeQuestion],
  nums_within_50: [generateNumberSequenceQuestion, generateCompareNumbersQuestion],
};

export function generateQuestionForUnit(unitId, difficulty = 1) {
  const generators = QUESTION_GENERATORS[unitId] ?? [generateCountObjectsQuestion];
  const generator = generators[randomInt(0, generators.length - 1)];
  return generator(difficulty);
}
