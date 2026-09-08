export const DEFAULT_COSMETIC_ID = 'skin_teal';

// color is applied to the player sprite via Phaser's setTint(); 0xffffff (white)
// leaves the sprite's original pixel-art colors untouched, so the free default
// shows the knight sprite exactly as drawn.
export const COSMETIC_CATALOG = [
  { id: 'skin_teal', label: '기본 갑옷', color: 0xffffff, cost: 0 },
  { id: 'skin_coral', label: '산호색', color: 0xf6ad55, cost: 20 },
  { id: 'skin_violet', label: '보라색', color: 0x9f7aea, cost: 40 },
];

export function getCosmeticColor(cosmeticId) {
  const entry = COSMETIC_CATALOG.find((item) => item.id === cosmeticId);
  return entry ? entry.color : COSMETIC_CATALOG[0].color;
}
