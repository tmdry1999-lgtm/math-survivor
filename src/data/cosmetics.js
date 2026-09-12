// 이 파일은 허브 화면의 "꾸미기" 상점에서 살 수 있는 캐릭터 색상 목록입니다.
// 아무것도 사지 않아도 기본 색(cost 0)은 항상 사용할 수 있습니다.
export const DEFAULT_COSMETIC_ID = 'skin_teal';

// color is applied to the player sprite via Phaser's setTint(); 0xffffff (white)
// leaves the sprite's original pixel-art colors untouched, so the free default
// shows the knight sprite exactly as drawn.
export const COSMETIC_CATALOG = [
  { id: 'skin_teal', label: '기본 갑옷', color: 0xffffff, cost: 0 },
  { id: 'skin_coral', label: '산호색', color: 0xf6ad55, cost: 20 },
  { id: 'skin_violet', label: '보라색', color: 0x9f7aea, cost: 40 },
];

// 꾸미기 아이템 id로 실제 색상 값을 찾아준다. 못 찾으면 기본 색을 대신 준다.
export function getCosmeticColor(cosmeticId) {
  const entry = COSMETIC_CATALOG.find((item) => item.id === cosmeticId);
  return entry ? entry.color : COSMETIC_CATALOG[0].color;
}
