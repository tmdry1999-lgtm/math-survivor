// 이 파일은 게임을 켜는 "전원 버튼" 같은 파일입니다.
// 화면 크기, 배경색 같은 기본 설정을 정하고, 게임에 등장하는 모든 화면(장면)을
// Phaser 엔진에 등록해서 실제로 게임을 실행시킵니다.
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js'; // 그림/이미지를 미리 불러오는 준비 화면
import { TitleScene } from './scenes/TitleScene.js'; // 맨 처음 보이는 제목 화면
import { HubScene } from './scenes/HubScene.js'; // 단원을 고르고 꾸미기를 하는 "나의 방" 화면
import { StageScene } from './scenes/StageScene.js'; // 실제로 적과 싸우는 게임 화면
import { QuestionScene } from './scenes/QuestionScene.js'; // 수학 문제가 뜨는 팝업 화면
import { PauseScene } from './scenes/PauseScene.js'; // 일시정지 메뉴 화면
import { ResultScene } from './scenes/ResultScene.js'; // 게임이 끝난 뒤 결과를 보여주는 화면

// 게임의 기본 설정값 (화면 크기, 물리 효과 등)
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  backgroundColor: '#2b2b40',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    // Centering is handled by #app's own flexbox in index.html. Phaser's autoCenter
    // positions the canvas with its own absolute/margin styles, and combining that with
    // a flex-centered parent made the canvas land off-center on some window sizes.
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  // 게임에 등장하는 화면들을 순서대로 등록. 실제 진행 순서는 각 화면 코드 안에서
  // scene.start(...)로 정해지며, 여기 나열된 순서와는 무관하다.
  scene: [BootScene, TitleScene, HubScene, StageScene, QuestionScene, PauseScene, ResultScene],
};

// 위 설정으로 실제 게임을 만들어 화면에 띄운다.
// eslint-disable-next-line no-new
new Phaser.Game(config);
