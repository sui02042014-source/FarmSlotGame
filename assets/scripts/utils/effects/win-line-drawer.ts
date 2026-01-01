import {
  _decorator,
  Component,
  Node,
  Graphics,
  Color,
  Vec2,
  tween,
  UIOpacity,
  UITransform,
} from "cc";
import { GameConfig } from "../../data/config/game-config";

const { ccclass } = _decorator;

export interface WinLinePosition {
  col: number;
  row: number;
}

export interface WinLineData {
  positions: WinLinePosition[];
  lineIndex: number;
  color?: Color;
}

/**
 * WinLineDrawer - Draws animated lines connecting winning symbols
 * Features:
 * - Draws smooth bezier curves between symbols
 * - Animated drawing effect
 * - Multiple line colors for different win lines
 * - Pulsing/glowing effect
 */
@ccclass("WinLineDrawer")
export class WinLineDrawer extends Component {
  private static _instance: WinLineDrawer;

  private _lineNodes: Node[] = [];
  private _isDrawing: boolean = false;

  // Default colors for different win lines
  private readonly LINE_COLORS = [
    new Color(255, 50, 50, 255), // Red
    new Color(50, 255, 50, 255), // Green
    new Color(50, 50, 255, 255), // Blue
    new Color(255, 255, 50, 255), // Yellow
    new Color(255, 50, 255, 255), // Magenta
    new Color(50, 255, 255, 255), // Cyan
    new Color(255, 150, 50, 255), // Orange
    new Color(150, 50, 255, 255), // Purple
  ];

  public static getInstance(): WinLineDrawer {
    return this._instance;
  }

  protected onLoad(): void {
    if (WinLineDrawer._instance) {
      this.node.destroy();
      return;
    }
    WinLineDrawer._instance = this;
  }

  protected onDestroy(): void {
    if (WinLineDrawer._instance === this) {
      WinLineDrawer._instance = null!;
    }
    this.clearAllLines();
  }

  // ==========================================
  // Public API
  // ==========================================

  /**
   * Draw all win lines at once
   */
  public async drawWinLines(
    parent: Node,
    winLines: WinLineData[],
    sequential: boolean = false
  ): Promise<void> {
    this.clearAllLines();

    if (!winLines || winLines.length === 0) return;

    this._isDrawing = true;

    if (sequential) {
      // Draw lines one by one
      for (const lineData of winLines) {
        await this.drawSingleLine(parent, lineData);
        await this.delay(0.3);
      }
    } else {
      // Draw all lines simultaneously
      const promises = winLines.map((lineData) =>
        this.drawSingleLine(parent, lineData)
      );
      await Promise.all(promises);
    }

    this._isDrawing = false;
  }

  /**
   * Draw a single win line
   */
  public async drawSingleLine(
    parent: Node,
    lineData: WinLineData
  ): Promise<void> {
    if (!lineData.positions || lineData.positions.length < 2) return;

    const lineNode = this.createLineNode(parent);
    const graphics = lineNode.addComponent(Graphics);

    // Get color for this line
    const color =
      lineData.color ||
      this.LINE_COLORS[lineData.lineIndex % this.LINE_COLORS.length];

    // Calculate world positions for each symbol
    const points = this.calculateLinePoints(lineData.positions);

    // Draw the line with animation
    await this.animateLineDraw(graphics, points, color);

    // Add pulsing effect
    this.addPulsingEffect(lineNode);

    this._lineNodes.push(lineNode);
  }

  /**
   * Clear all drawn lines
   */
  public clearAllLines(): void {
    this._lineNodes.forEach((node) => {
      if (node && node.isValid) {
        node.destroy();
      }
    });
    this._lineNodes = [];
    this._isDrawing = false;
  }

  /**
   * Check if currently drawing
   */
  public isDrawing(): boolean {
    return this._isDrawing;
  }

  // ==========================================
  // Internal Methods
  // ==========================================

  private createLineNode(parent: Node): Node {
    const lineNode = new Node("WinLine");
    lineNode.setParent(parent);
    lineNode.layer = parent.layer;

    // Add UITransform for proper rendering
    const transform = lineNode.addComponent(UITransform);
    const parentTransform = parent.getComponent(UITransform);
    if (parentTransform) {
      transform.setContentSize(parentTransform.contentSize);
    }

    return lineNode;
  }

  private calculateLinePoints(positions: WinLinePosition[]): Vec2[] {
    const points: Vec2[] = [];
    const symbolSize = GameConfig.SYMBOL_SIZE;
    const spacing = GameConfig.SYMBOL_SPACING;
    const totalSize = symbolSize + spacing;

    // Calculate the offset to center the line grid
    const totalReels = GameConfig.REEL_COUNT;
    const totalRows = GameConfig.SYMBOL_PER_REEL;
    const gridWidth = totalReels * totalSize - spacing;
    const gridHeight = totalRows * totalSize - spacing;
    const offsetX = -gridWidth / 2 + symbolSize / 2;
    const offsetY = gridHeight / 2 - symbolSize / 2;

    positions.forEach((pos) => {
      const x = offsetX + pos.col * totalSize;
      const y = offsetY - pos.row * totalSize;
      points.push(new Vec2(x, y));
    });

    return points;
  }

  private async animateLineDraw(
    graphics: Graphics,
    points: Vec2[],
    color: Color
  ): Promise<void> {
    return new Promise((resolve) => {
      graphics.lineWidth = 8;
      graphics.strokeColor = color;
      const fillColor = color.clone();
      fillColor.a = 100;
      graphics.fillColor = fillColor;

      // Draw line segments progressively
      let currentSegment = 0;
      const totalSegments = points.length - 1;
      const segmentDuration = 0.15;

      const drawNextSegment = () => {
        if (currentSegment >= totalSegments) {
          resolve();
          return;
        }

        const start = points[currentSegment];
        const end = points[currentSegment + 1];

        // Draw with smooth curve
        if (currentSegment === 0) {
          graphics.moveTo(start.x, start.y);
          graphics.circle(start.x, start.y, 6);
          graphics.fill();
        }

        // Draw bezier curve for smooth lines
        if (currentSegment > 0) {
          const prev = points[currentSegment - 1];
          const controlX = (start.x + end.x) / 2;
          const controlY = start.y;
          graphics.bezierCurveTo(
            controlX,
            controlY,
            controlX,
            controlY,
            end.x,
            end.y
          );
        } else {
          graphics.lineTo(end.x, end.y);
        }

        graphics.circle(end.x, end.y, 6);
        graphics.fill();
        graphics.stroke();

        currentSegment++;
        setTimeout(drawNextSegment, segmentDuration * 1000);
      };

      drawNextSegment();
    });
  }

  private addPulsingEffect(lineNode: Node): void {
    const opacity = lineNode.addComponent(UIOpacity);
    opacity.opacity = 255;

    tween(opacity)
      .to(0.5, { opacity: 180 }, { easing: "sineInOut" })
      .to(0.5, { opacity: 255 }, { easing: "sineInOut" })
      .union()
      .repeatForever()
      .start();
  }

  private delay(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      this.scheduleOnce(() => resolve(), seconds);
    });
  }

  // ==========================================
  // Border Highlight (Alternative Method)
  // ==========================================

  /**
   * Draw borders around winning symbols instead of lines
   * This is an alternative visualization method
   */
  public drawWinningBorders(
    parent: Node,
    positions: WinLinePosition[],
    color?: Color
  ): void {
    const borderColor = color || new Color(255, 215, 0, 255); // Gold

    positions.forEach((pos, index) => {
      this.scheduleOnce(() => {
        this.drawSymbolBorder(parent, pos, borderColor);
      }, index * 0.1);
    });
  }

  private drawSymbolBorder(
    parent: Node,
    position: WinLinePosition,
    color: Color
  ): void {
    const borderNode = this.createLineNode(parent);
    const graphics = borderNode.addComponent(Graphics);

    // Calculate position
    const points = this.calculateLinePoints([position]);
    const center = points[0];
    const size = GameConfig.SYMBOL_SIZE;
    const halfSize = size / 2;

    // Draw rounded rectangle border
    graphics.lineWidth = 6;
    graphics.strokeColor = color;

    const cornerRadius = 15;
    graphics.roundRect(
      center.x - halfSize,
      center.y - halfSize,
      size,
      size,
      cornerRadius
    );
    graphics.stroke();

    // Add pulsing effect
    this.addPulsingEffect(borderNode);

    this._lineNodes.push(borderNode);
  }
}
