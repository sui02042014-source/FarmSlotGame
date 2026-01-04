import { Color, Graphics, Node, tween, UITransform, Vec3 } from "cc";
import { WinLine } from "../../types";

const LINE_COLORS = [
  new Color(255, 215, 0, 255),
  new Color(138, 43, 226, 255),
  new Color(0, 191, 255, 255),
  new Color(50, 205, 50, 255),
  new Color(255, 69, 0, 255),
  new Color(255, 20, 147, 255),
  new Color(255, 165, 0, 255),
  new Color(0, 255, 255, 255),
] as const;

const CONFIG = {
  LINE_WIDTH: 8,
  GLOW_WIDTH: 12,
  GLOW_ALPHA: 0.3,
  ANIM_DURATION: 0.5,
  FADE_DURATION: 0.3,
  CURVE_TENSION: 0.3,
  CANVAS_SIZE: 2000,
} as const;

export class WinLineDrawer {
  private parentNode: Node;
  private lineNodes: Node[] = [];
  private currentLineIndex: number = 0;

  constructor(parent: Node) {
    this.parentNode = parent;
  }

  public drawWinLines(
    winLines: WinLine[],
    getWorldPosition: (col: number, row: number) => Vec3 | null
  ): void {
    this.clearAllLines();

    winLines.forEach((winLine, index) => {
      const positions = winLine.positions
        .map((pos) => getWorldPosition(pos.col, pos.row))
        .filter((pos): pos is Vec3 => pos !== null);

      if (positions.length >= 2) {
        this.drawLine(positions, this.getLineColor(index));
      }
    });
  }

  private drawLine(positions: Vec3[], color: Color): void {
    const container = new Node(`WinLine_${this.currentLineIndex++}`);
    container.setParent(this.parentNode);
    container.layer = this.parentNode.layer;
    container.setPosition(0, 0, 0);

    this.createGlowLayer(container, positions, color);
    const mainGraphics = this.createMainLayer(container, color);
    this.animateLineDraw(mainGraphics, positions);

    this.lineNodes.push(container);
  }

  private createGlowLayer(parent: Node, positions: Vec3[], color: Color): void {
    const node = new Node("Glow");
    node.setParent(parent);
    node.layer = parent.layer;

    const transform = node.addComponent(UITransform);
    transform.setAnchorPoint(0, 0);
    transform.setContentSize(CONFIG.CANVAS_SIZE, CONFIG.CANVAS_SIZE);

    const graphics = node.addComponent(Graphics);
    graphics.lineWidth = CONFIG.GLOW_WIDTH;
    graphics.strokeColor = new Color(
      color.r,
      color.g,
      color.b,
      color.a * CONFIG.GLOW_ALPHA
    );

    this.drawCurve(graphics, positions, 1);
  }

  private createMainLayer(parent: Node, color: Color): Graphics {
    const node = new Node("Line");
    node.setParent(parent);
    node.layer = parent.layer;

    const transform = node.addComponent(UITransform);
    transform.setAnchorPoint(0, 0);
    transform.setContentSize(CONFIG.CANVAS_SIZE, CONFIG.CANVAS_SIZE);

    const graphics = node.addComponent(Graphics);
    graphics.lineWidth = CONFIG.LINE_WIDTH;
    graphics.strokeColor = color;

    return graphics;
  }

  private drawCurve(
    graphics: Graphics,
    positions: Vec3[],
    progress: number = 1
  ): void {
    if (positions.length < 2) return;

    graphics.clear();

    const drawLength = Math.floor(positions.length * progress);
    if (drawLength < 2) return;

    graphics.moveTo(positions[0].x, positions[0].y);

    for (let i = 0; i < drawLength - 1; i++) {
      const p0 = i > 0 ? positions[i - 1] : positions[i];
      const p1 = positions[i];
      const p2 = positions[i + 1];
      const p3 = i + 2 < positions.length ? positions[i + 2] : p2;

      const t = CONFIG.CURVE_TENSION;
      const cp1x = p1.x + (p2.x - p0.x) * t;
      const cp1y = p1.y + (p2.y - p0.y) * t;
      const cp2x = p2.x - (p3.x - p1.x) * t;
      const cp2y = p2.y - (p3.y - p1.y) * t;

      graphics.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }

    graphics.stroke();
  }

  private animateLineDraw(graphics: Graphics, positions: Vec3[]): void {
    const animData = { progress: 0 };

    tween(animData)
      .to(
        CONFIG.ANIM_DURATION,
        { progress: 1 },
        {
          onUpdate: () =>
            this.drawCurve(graphics, positions, animData.progress),
        }
      )
      .start();
  }

  public clearAllLines(): void {
    this.lineNodes.forEach((node) => {
      if (node?.isValid) {
        tween(node)
          .to(CONFIG.FADE_DURATION, { scale: new Vec3(0, 0, 1) })
          .call(() => node.destroy())
          .start();
      }
    });

    this.reset();
  }

  public clearLinesImmediate(): void {
    this.lineNodes.forEach((node) => {
      if (node?.isValid) node.destroy();
    });

    this.reset();
  }

  private reset(): void {
    this.lineNodes = [];
    this.currentLineIndex = 0;
  }

  private getLineColor(index: number): Color {
    return LINE_COLORS[index % LINE_COLORS.length].clone();
  }

  public destroy(): void {
    this.clearLinesImmediate();
  }
}
