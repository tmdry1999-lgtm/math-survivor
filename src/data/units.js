// Order matches the 1학기 curriculum sequence in docs/design/02-단원별-문제설계.md.
// New units get appended here as their question generators land in QuestionEngine.
export const UNIT_SEQUENCE = ['nums_within_9', 'shapes_2d'];

export const UNIT_LABELS = {
  nums_within_9: '9까지의 수',
  shapes_2d: '여러 가지 모양',
};

export function getNextUnitId(unitId) {
  const index = UNIT_SEQUENCE.indexOf(unitId);
  if (index === -1 || index === UNIT_SEQUENCE.length - 1) {
    return null;
  }
  return UNIT_SEQUENCE[index + 1];
}
