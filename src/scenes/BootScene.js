import Phaser from 'phaser';
import playerUrl from '../assets/sprites/player.png';
import enemySlimeUrl from '../assets/sprites/enemy-slime.png';
import enemyGhostUrl from '../assets/sprites/enemy-ghost.png';
import enemyOrcUrl from '../assets/sprites/enemy-orc.png';
import floorUrl from '../assets/sprites/floor.png';
import wallUrl from '../assets/sprites/wall.png';
import decorCoinUrl from '../assets/sprites/decor-coin.png';
import decorRubbleUrl from '../assets/sprites/decor-rubble.png';
import decorTorchUrl from '../assets/sprites/decor-torch.png';
import decorChestUrl from '../assets/sprites/decor-chest.png';
import decorDresserUrl from '../assets/sprites/decor-dresser.png';
import weaponDaggerUrl from '../assets/sprites/weapon-dagger.png';
import weaponGemUrl from '../assets/sprites/weapon-gem.png';
import weaponSwordUrl from '../assets/sprites/weapon-sword.png';
import weaponSword2Url from '../assets/sprites/weapon-sword2.png';
import weaponPotionRedUrl from '../assets/sprites/weapon-potion-red.png';
import weaponPotionWhiteUrl from '../assets/sprites/weapon-potion-white.png';
import weaponAxeDoubleUrl from '../assets/sprites/weapon-axe-double.png';
import weaponAxeSingleUrl from '../assets/sprites/weapon-axe-single.png';

// 게임이 켜지자마자 가장 먼저 실행되는 "준비 화면"입니다.
// 캐릭터, 적, 무기 등 게임에 필요한 그림 파일들을 미리 전부 불러온 뒤
// 준비가 끝나면 바로 제목 화면(TitleScene)으로 넘어갑니다.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  // 필요한 모든 이미지 파일을 불러와 이름표('player', 'enemySlime' 등)를 붙여둔다.
  // 이렇게 붙여둔 이름표는 다른 화면에서 this.add.image(x, y, '이름표')처럼 사용된다.
  preload() {
    this.load.image('player', playerUrl);
    this.load.image('enemySlime', enemySlimeUrl);
    this.load.image('enemyGhost', enemyGhostUrl);
    this.load.image('enemyOrc', enemyOrcUrl);
    this.load.image('floor', floorUrl);
    this.load.image('wall', wallUrl);
    this.load.image('decorCoin', decorCoinUrl);
    this.load.image('decorRubble', decorRubbleUrl);
    this.load.image('decorTorch', decorTorchUrl);
    this.load.image('decorChest', decorChestUrl);
    this.load.image('decorDresser', decorDresserUrl);
    this.load.image('weaponDagger', weaponDaggerUrl);
    this.load.image('weaponGem', weaponGemUrl);
    this.load.image('weaponSword', weaponSwordUrl);
    this.load.image('weaponSword2', weaponSword2Url);
    this.load.image('weaponPotionRed', weaponPotionRedUrl);
    this.load.image('weaponPotionWhite', weaponPotionWhiteUrl);
    this.load.image('weaponAxeDouble', weaponAxeDoubleUrl);
    this.load.image('weaponAxeSingle', weaponAxeSingleUrl);
  }

  // 이미지 불러오기가 끝난 뒤 실행된다.
  create() {
    // 작은 동그라미 그림을 코드로 직접 그려서 만든다(그림 파일 없이도 사용 가능).
    // 나중에 적을 물리쳤을 때 튀는 반짝이 효과(파티클)로 재사용된다.
    this.createCircleTexture('xpOrb', 6, 0xf6e05e);
    // 준비가 끝났으니 제목 화면으로 이동한다.
    this.scene.start('Title');
  }

  // 지정한 색과 크기의 동그란 이미지를 즉석에서 만들어주는 도우미 함수.
  createCircleTexture(key, radius, color) {
    const graphics = this.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillCircle(radius, radius, radius);
    graphics.generateTexture(key, radius * 2, radius * 2);
    graphics.destroy();
  }
}
