import Phaser from 'phaser';
import { isMuted, setMuted, startBackgroundMusic, stopBackgroundMusic } from '../systems/SfxPlayer.js';
import { addPanelShadow } from '../ui/panelStyle.js';

const TEXT_FONT = 'sans-serif';

// 게임 중 ESC 키나 일시정지 버튼을 누르면 전투 화면 위에 뜨는 일시정지 메뉴입니다.
// "계속하기", 소리 켜기/끄기, "허브로 나가기" 버튼을 제공합니다.
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
    addPanelShadow(this, width / 2, height / 2, 320, 300, 5);
    this.add
      .rectangle(width / 2, height / 2, 320, 300, 0x1a1a2e, 1)
      .setStrokeStyle(4, 0xf6e05e);

    this.add
      .text(width / 2, height / 2 - 110, '일시정지', { fontSize: '26px', color: '#f6e05e', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    this.addButton(width / 2, height / 2 - 40, '계속하기', '#4fd1c5', () => this.resumeGame());
    this.muteButton = this.addButton(width / 2, height / 2 + 20, '', '#ffffff', () => this.toggleMute());
    this.updateMuteLabel();
    this.addButton(width / 2, height / 2 + 100, '허브로 나가기', '#f6ad55', () => this.exitToHub());

    this.input.keyboard.once('keydown-ESC', () => this.resumeGame());
  }

  toggleMute() {
    const nextMuted = !isMuted();
    setMuted(nextMuted);
    if (nextMuted) {
      stopBackgroundMusic();
    } else {
      startBackgroundMusic();
    }
    this.updateMuteLabel();
  }

  updateMuteLabel() {
    this.muteButton.label.setText(isMuted() ? '🔇 음소거 켬' : '🔊 음소거 끔');
  }

  // 전투 화면에 "다시 진행해도 돼" 신호를 보내고 일시정지 메뉴를 닫는다.
  resumeGame() {
    this.scene.get('Stage').events.emit('resume-game');
    this.scene.stop();
  }

  // 진행 중이던 전투를 완전히 그만두고 나의 방 화면으로 돌아간다.
  exitToHub() {
    this.scene.stop('Stage');
    this.scene.start('Hub');
  }

  // 메뉴에 들어가는 버튼(그림자+배경+글씨)을 만들어주는 공용 도우미 함수.
  addButton(x, y, label, color, onClick) {
    addPanelShadow(this, x, y, 220, 44, 4);
    const background = this.add
      .rectangle(x, y, 220, 44, 0x2b2b40)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(color).color)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, { fontSize: '17px', color, fontFamily: TEXT_FONT }).setOrigin(0.5);

    background.on('pointerover', () => background.setScale(1.05));
    background.on('pointerout', () => background.setScale(1));
    background.on('pointerdown', onClick);

    return { background, label: text };
  }
}
