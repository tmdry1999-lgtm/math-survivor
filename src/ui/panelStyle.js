// 버튼이나 패널 뒤에 살짝 어긋난 어두운 사각형을 깔아 "그림자" 효과를 내는 함수.
// 이 함수로 그림자를 먼저 그린 뒤, 그 위에 진짜 버튼/패널을 같은 위치에 그리면
// 입체감 있는 청키 버튼 스타일이 완성된다.
// Shared "chunky button" look: a solid dark rectangle offset behind a panel/button
// gives pixel-art UI a sense of depth without needing new art assets. Add the shadow
// first, then draw the real panel/button on top at the same position.
export function addPanelShadow(scene, x, y, width, height, offset = 5) {
  return scene.add.rectangle(x + offset, y + offset, width, height, 0x000000, 0.4);
}
