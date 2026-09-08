export const DEFAULT_COSMETIC_ID = 'skin_teal';

export const COSMETIC_CATALOG = [
  { id: 'skin_teal', label: '하늘색', color: 0x4fd1c5, cost: 0 },
  { id: 'skin_coral', label: '산호색', color: 0xf6ad55, cost: 20 },
  { id: 'skin_violet', label: '보라색', color: 0x9f7aea, cost: 40 },
];

export function getCosmeticColor(cosmeticId) {
  const entry = COSMETIC_CATALOG.find((item) => item.id === cosmeticId);
  return entry ? entry.color : COSMETIC_CATALOG[0].color;
}
