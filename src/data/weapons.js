// 이 파일은 게임에 등장하는 8가지 무기의 설정값(이름, 아이콘, 공격 방식, 발사 간격,
// 사거리 등)을 모아둔 데이터입니다. 4가지 공격 방식(유도탄/관통/폭발/회전)에
// 각각 2종씩 다른 그림과 색을 입혀 8종처럼 보이게 만들었습니다.
// 8 weapons built from 4 distinct attack behaviors (2 reskins each), so the combat code
// stays manageable while the player still sees real variety. No weapon does "damage" —
// every hit is a one-shot kill, matching the rest of the game's no-HP design; leveling a
// weapon makes it fire faster, reach further, or hit more enemies at once.
export const MAX_WEAPON_LEVEL = 3;

export const WEAPON_DEFS = {
  arrow: {
    label: '화살',
    icon: '🏹',
    texture: 'weaponDagger',
    behavior: 'homing',
    color: 0xf6e05e,
    base: { interval: 700, range: 90 },
    perLevel: { interval: -100, range: 20 },
    min: { interval: 400 },
  },
  magicOrb: {
    label: '마법 구슬',
    icon: '🔮',
    texture: 'weaponGem',
    behavior: 'homing',
    color: 0x9f7aea,
    base: { interval: 750, range: 100 },
    perLevel: { interval: -110, range: 22 },
    min: { interval: 420 },
  },
  spear: {
    label: '창',
    icon: '🔱',
    texture: 'weaponSword',
    behavior: 'pierce',
    color: 0xcbd5e0,
    base: { interval: 1000, range: 140, corridor: 24 },
    perLevel: { interval: -120, range: 20, corridor: 8 },
    min: { interval: 600 },
  },
  iceSpear: {
    label: '얼음창',
    icon: '❄️',
    texture: 'weaponSword2',
    behavior: 'pierce',
    color: 0x63b3ed,
    base: { interval: 1050, range: 150, corridor: 24 },
    perLevel: { interval: -130, range: 22, corridor: 8 },
    min: { interval: 620 },
  },
  fireball: {
    label: '불덩이',
    icon: '🔥',
    texture: 'weaponPotionRed',
    behavior: 'aoe',
    color: 0xffffff,
    base: { interval: 1100, range: 130, radius: 40 },
    perLevel: { interval: -130, range: 10, radius: 15 },
    min: { interval: 650 },
  },
  bomb: {
    label: '폭탄',
    icon: '💣',
    texture: 'weaponPotionWhite',
    behavior: 'aoe',
    color: 0x4a5568,
    base: { interval: 1200, range: 130, radius: 45 },
    perLevel: { interval: -140, range: 10, radius: 16 },
    min: { interval: 700 },
  },
  spinAxe: {
    label: '회전 도끼',
    icon: '🪓',
    texture: 'weaponAxeDouble',
    behavior: 'orbit',
    color: 0xffffff,
    base: { interval: 1400, radius: 70 },
    perLevel: { interval: -150, radius: 15 },
    min: { interval: 800 },
  },
  whirlwind: {
    label: '회오리',
    icon: '🌀',
    texture: 'weaponAxeSingle',
    behavior: 'orbit',
    color: 0x4fd1c5,
    base: { interval: 1500, radius: 75 },
    perLevel: { interval: -160, radius: 16 },
    min: { interval: 850 },
  },
};

// 위에 정의된 무기 id들만 모아둔 목록 (예: ['arrow', 'magicOrb', ...]).
export const WEAPON_IDS = Object.keys(WEAPON_DEFS);

// 무기의 현재 레벨에 맞는 실제 발사 간격/사거리 등을 계산해서 돌려준다.
// level 1 = base stats, each additional level adds one perLevel step, clamped at `min`.
export function getWeaponStats(weaponId, level) {
  const def = WEAPON_DEFS[weaponId];
  const steps = Math.max(0, level - 1);
  const stats = {};
  Object.keys(def.base).forEach((key) => {
    let value = def.base[key] + (def.perLevel[key] ?? 0) * steps;
    if (def.min && def.min[key] !== undefined) {
      value = Math.max(def.min[key], value);
    }
    stats[key] = value;
  });
  return stats;
}
