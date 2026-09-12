// 이 파일은 게임에 등장하는 "수학 단원" 목록을 정의합니다 (허브 화면의 스테이지 카드,
// 잠금 해제 순서, 화면에 보여줄 한글 이름이 모두 여기서 나옵니다).

// Order matches the 1학기 curriculum sequence in docs/design/02-단원별-문제설계.md.
// New units get appended here as their question generators land in QuestionEngine.
export const UNIT_SEQUENCE = [
  'nums_within_9',
  'shapes_2d',
  'add_sub_within_9',
  'comparison',
  'nums_within_50',
];

// 화면에 표시할 단원별 한글 이름.
export const UNIT_LABELS = {
  nums_within_9: '9까지의 수',
  shapes_2d: '여러 가지 모양',
  add_sub_within_9: '덧셈과 뺄셈',
  comparison: '비교하기',
  nums_within_50: '50까지의 수',
};

// 현재 클리어한 단원 바로 다음 단원의 id를 알려준다 (없으면 null).
// 스테이지 클리어 시 다음 단원을 자동으로 해금하는 데 사용된다.
export function getNextUnitId(unitId) {
  const index = UNIT_SEQUENCE.indexOf(unitId);
  if (index === -1 || index === UNIT_SEQUENCE.length - 1) {
    return null;
  }
  return UNIT_SEQUENCE[index + 1];
}
