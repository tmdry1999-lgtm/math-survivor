import { getNextUnitId } from '../data/units.js';

// 이 파일은 게임 진행 상황(보유 코인, 해금된 단원, 최고 기록, 꾸미기 아이템)을
// 브라우저의 localStorage(앱을 꺼도 남아있는 저장 공간)에 저장하고 불러오는 역할을 합니다.
// 별도의 서버 없이도 "다음에 게임을 켜면 이전 진행 상황이 그대로 남아있는" 이유가 이 파일 덕분입니다.
const SAVE_KEY = 'mathSurvivorSave';

// 저장된 데이터가 아예 없을 때(처음 실행) 사용할 기본값.
function defaultSave() {
  return {
    currency: 0,
    unlockedStages: ['nums_within_9'],
    stageProgress: {},
    ownedCosmetics: [],
    equippedCosmetics: {},
  };
}

// 저장된 진행 상황을 불러온다. 저장된 게 없거나 읽기에 실패하면 기본값을 준다.
export function getSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : defaultSave();
  } catch {
    return defaultSave();
  }
}

// 진행 상황을 브라우저 저장 공간에 실제로 기록한다.
function writeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // 저장에 실패해도 게임 진행에는 지장이 없도록 조용히 무시한다
  }
}

// 스테이지를 끝냈을 때 호출: 코인을 더하고, 이번 단원의 최고 정답률을 갱신하고,
// 다음 단원이 있다면 해금 목록에 추가한 뒤 저장한다.
export function saveStageResult({ unitId, accuracy, currencyEarned }) {
  const save = getSave();
  save.currency += currencyEarned;
  const existing = save.stageProgress[unitId] ?? { cleared: false, bestAccuracy: 0, attempts: 0 };
  save.stageProgress[unitId] = {
    cleared: true,
    bestAccuracy: Math.max(existing.bestAccuracy, accuracy),
    attempts: existing.attempts + 1,
  };
  const nextUnitId = getNextUnitId(unitId);
  if (nextUnitId && !save.unlockedStages.includes(nextUnitId)) {
    save.unlockedStages.push(nextUnitId);
  }
  writeSave(save);
  return save;
}

// 꾸미기 아이템을 코인으로 구매하고 바로 착용한다.
// 이미 보유했거나 재화가 부족하면 아무 변화 없이 현재 저장 데이터를 그대로 반환한다.
export function purchaseCosmetic(cosmeticId, cost) {
  const save = getSave();
  if (save.ownedCosmetics.includes(cosmeticId)) {
    return save;
  }
  if (save.currency < cost) {
    return save;
  }
  save.currency -= cost;
  save.ownedCosmetics.push(cosmeticId);
  save.equippedCosmetics.playerColor = cosmeticId;
  writeSave(save);
  return save;
}

// 이미 보유한 꾸미기 아이템을 착용(장착)한다. 보유하지 않은 코스메틱은 착용할 수 없다.
export function equipCosmetic(cosmeticId) {
  const save = getSave();
  if (!save.ownedCosmetics.includes(cosmeticId)) {
    return save;
  }
  save.equippedCosmetics.playerColor = cosmeticId;
  writeSave(save);
  return save;
}
