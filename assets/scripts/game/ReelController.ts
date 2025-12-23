import { _decorator, Component, Node, tween, Tween, Vec3, Sprite } from "cc";
import { GameConfig } from "../data/GameConfig";
import { ReelContainer } from "./ReelContainer";
import { SpriteFrameCache } from "../utils/SpriteFrameCache";
import { SymbolData } from "../data/SymbolData";
const { ccclass, property } = _decorator;

@ccclass("ReelController")
export class ReelController extends Component {
  @property(Node) reelContainerNode: Node = null!;

  private static readonly SYMBOL_NAME_PREFIX = "Symbol_";

  private reelContainer: ReelContainer = null!;
  private readonly symbolSpacing: number =
    GameConfig.SYMBOL_SIZE + GameConfig.SYMBOL_SPACING;
  private readonly spriteFrameCache = SpriteFrameCache.getInstance();

  private isSpinning = false;
  private isStartScheduled = false;
  private spinSpeed = 0;
  private targetSymbols: string[] = [];

  // ==================== Lifecycle ====================

  protected start(): void {
    this.ensureReelContainer();
    this.reelContainer.init();
  }

  protected update(dt: number): void {
    if (!this.isSpinning || !this.reelContainer) return;
    this.updateReelPositions(dt);
  }

  // ==================== Public API ====================

  public spin(targetSymbols: string[], delay: number = 0): void {
    this.ensureReelContainer();
    if (this.isSpinning || this.isStartScheduled) return;

    this.targetSymbols = targetSymbols;
    this.spinSpeed = this.getRandomSpinSpeed();

    if (delay > 0) {
      this.isStartScheduled = true;
      this.scheduleOnce(() => this.beginSpin(), delay);
    } else {
      this.beginSpin();
    }
  }

  public async stop(): Promise<void> {
    if (this.isStartScheduled) {
      this.unscheduleAllCallbacks();
      this.isStartScheduled = false;
    }
    if (!this.isSpinning) return;

    this.isSpinning = false;
    this.spinSpeed = 0;

    if (this.targetSymbols?.length) {
      this.ensureReelContainer();
      this.updateVisibleSymbols(this.targetSymbols);
    }

    await this.snapToGrid();
  }

  public getVisibleSymbols(): string[] {
    const visibleNodes = this.getVisibleSymbolNodes();
    if (!visibleNodes.length) return [];

    return visibleNodes
      .map((node) => this.extractSymbolIdFromNode(node))
      .filter((id) => id !== "");
  }

  public getVisibleSymbolNodes(): Node[] {
    const validNodes = this.getValidSymbolNodes();
    if (!validNodes.length) return [];

    const targetPositions = this.calculateVisiblePositions();
    const selectedNodes = this.selectClosestNodes(validNodes, targetPositions);

    return selectedNodes.sort((a, b) => b.position.y - a.position.y);
  }

  public highlightWinSymbols(rows: number[]): void {
    const visibleNodes = this.getVisibleSymbolNodes();

    rows.forEach((row) => {
      if (row < 0 || row >= visibleNodes.length) return;

      const node = visibleNodes[row];
      if (!node?.isValid) return;

      node.setScale(1, 1, 1);
      tween(node)
        .to(0.25, { scale: new Vec3(1.2, 1.2, 1) }, { easing: "backOut" })
        .to(0.25, { scale: new Vec3(1, 1, 1) }, { easing: "backIn" })
        .union()
        .repeat(5)
        .start();
    });
  }

  public reset(): void {
    this.ensureReelContainer();

    if (this.isStartScheduled) {
      this.unscheduleAllCallbacks();
      this.isStartScheduled = false;
    }

    this.isSpinning = false;
    this.spinSpeed = 0;

    if (this.reelContainer) {
      this.getNodes().forEach((n) => Tween.stopAllByTarget(n));
      this.reelContainer.reset();
      this.reelContainer.init();
      this.snapToGrid(false);
    }
  }

  // ==================== Spin Logic ====================

  private beginSpin(): void {
    this.isStartScheduled = false;
    this.isSpinning = true;
  }

  private getRandomSpinSpeed(): number {
    return (
      GameConfig.SPIN_SPEED_MIN +
      Math.random() * (GameConfig.SPIN_SPEED_MAX - GameConfig.SPIN_SPEED_MIN)
    );
  }

  private updateReelPositions(dt: number): void {
    const nodes = this.getNodes();
    if (!nodes.length) return;

    const distance = this.spinSpeed * dt;
    let maxY = Number.NEGATIVE_INFINITY;

    nodes.forEach((node) => {
      const y = node.position.y - distance;
      node.setPosition(node.position.x, y, node.position.z);
      if (y > maxY) {
        maxY = y;
      }
    });

    this.recycleOffscreenNodes(nodes, maxY);
  }

  private recycleOffscreenNodes(nodes: Node[], currentMaxY: number): void {
    let maxY = currentMaxY;
    const threshold = -this.symbolSpacing * (nodes.length / 2 + 1);

    nodes.forEach((node) => {
      if (node.position.y < threshold) {
        maxY += this.symbolSpacing;
        node.setPosition(node.position.x, maxY, node.position.z);
      }
    });
  }

  // ==================== Stop Logic ====================

  private updateVisibleSymbols(symbols: string[]): void {
    const visibleNodes = this.getVisibleSymbolNodes();
    if (!visibleNodes.length || !symbols.length) return;

    const updateCount = Math.min(symbols.length, visibleNodes.length);

    for (let i = 0; i < updateCount; i++) {
      const node = visibleNodes[i];
      const symbolId = symbols[i];

      if (node?.isValid && symbolId) {
        this.updateNodeSymbol(node, symbolId);
      }
    }
  }

  private updateNodeSymbol(node: Node, symbolId: string): void {
    node.name = `${ReelController.SYMBOL_NAME_PREFIX}${symbolId}`;
    this.loadSpriteFrame(node, symbolId);
  }

  private async loadSpriteFrame(node: Node, symbolId: string): Promise<void> {
    const sprite = node.getComponent(Sprite);
    const symbolData = SymbolData.getSymbol(symbolId);

    if (!sprite || !symbolData) {
      console.warn(
        `Failed to load sprite for symbol ${symbolId}: missing sprite or symbol data`
      );
      return;
    }

    try {
      const path = `${symbolData.spritePath}/spriteFrame`;
      const spriteFrame = await this.spriteFrameCache.getSpriteFrameFromBundle(
        "symbols",
        path
      );

      if (spriteFrame && node?.isValid && sprite?.isValid) {
        sprite.spriteFrame = spriteFrame;
      }
    } catch (error) {
      console.error(`Error loading sprite frame for ${symbolId}:`, error);
    }
  }

  private snapToGrid(animate: boolean = true): Promise<void> {
    const nodes = this.getNodes();
    if (!nodes.length) return Promise.resolve();

    const closest = nodes.reduce((prev, curr) =>
      Math.abs(curr.position.y) < Math.abs(prev.position.y) ? curr : prev
    );

    const snappedY =
      Math.round(closest.position.y / this.symbolSpacing) * this.symbolSpacing;
    const offsetY = snappedY - closest.position.y;

    if (Math.abs(offsetY) < 0.001) return Promise.resolve();

    if (!animate) {
      nodes.forEach((node) => {
        node.setPosition(
          node.position.x,
          node.position.y + offsetY,
          node.position.z
        );
      });
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      let remaining = nodes.length;

      nodes.forEach((node) => {
        Tween.stopAllByTarget(node);
        tween(node)
          .to(
            GameConfig.BOUNCE_DURATION,
            {
              position: new Vec3(
                node.position.x,
                node.position.y + offsetY,
                node.position.z
              ),
            },
            { easing: "backOut" }
          )
          .call(() => {
            if (--remaining <= 0) {
              resolve();
            }
          })
          .start();
      });
    });
  }

  // ==================== Helper Methods ====================

  private ensureReelContainer(): void {
    if (this.reelContainer) return;
    this.reelContainer =
      this.reelContainerNode.getComponent(ReelContainer) ||
      this.reelContainerNode.addComponent(ReelContainer);
  }

  private getNodes(): Node[] {
    return this.reelContainer?.getSymbolNodes().filter((n) => n?.isValid) || [];
  }

  private getValidSymbolNodes(): Node[] {
    return (
      this.reelContainer?.getSymbolNodes().filter((node) => node?.isValid) || []
    );
  }

  private calculateVisiblePositions(): number[] {
    const visibleCount = GameConfig.SYMBOL_PER_REEL;
    const half = (visibleCount - 1) / 2;
    const positions: number[] = [];

    for (let row = 0; row < visibleCount; row++) {
      positions.push((half - row) * this.symbolSpacing);
    }

    return positions;
  }

  private selectClosestNodes(nodes: Node[], targetPositions: number[]): Node[] {
    const remaining = [...nodes];
    const selected: Node[] = [];

    for (const targetY of targetPositions) {
      if (remaining.length === 0) break;

      const closestIndex = this.findClosestNodeIndex(remaining, targetY);
      selected.push(remaining.splice(closestIndex, 1)[0]);
    }

    return selected;
  }

  private findClosestNodeIndex(nodes: Node[], targetY: number): number {
    let closestIndex = 0;
    let minDistance = Math.abs(nodes[0].position.y - targetY);

    for (let i = 1; i < nodes.length; i++) {
      const distance = Math.abs(nodes[i].position.y - targetY);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  private extractSymbolIdFromNode(node: Node): string {
    const name = node.name;
    if (!name.startsWith(ReelController.SYMBOL_NAME_PREFIX)) {
      return "";
    }
    return name.slice(ReelController.SYMBOL_NAME_PREFIX.length);
  }
}
