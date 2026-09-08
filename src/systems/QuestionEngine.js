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
