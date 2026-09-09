// Shared "chunky button" look: a solid dark rectangle offset behind a panel/button
// gives pixel-art UI a sense of depth without needing new art assets. Add the shadow
// first, then draw the real panel/button on top at the same position.
export function addPanelShadow(scene, x, y, width, height, offset = 5) {
  return scene.add.rectangle(x + offset, y + offset, width, height, 0x000000, 0.4);
}
