import { _decorator, Component, Node, tween, Tween, Vec3 } from "cc";
import { GameConfig } from "../data/GameConfig";
import { ReelContainer } from "./ReelContainer";

const { ccclass, property } = _decorator;

@ccclass("ReelController")
export class ReelController extends Component {
  @property(Node) reelContainerNode: Node = null!;

  private reelContainer: ReelContainer = null!;
  private readonly symbolSpacing: number =
    GameConfig.SYMBOL_SIZE + GameConfig.SYMBOL_SPACING;

  private isSpinning = false;
  private isStartScheduled = false;
  private spinSpeed = 0;
  private targetSymbols: string[] = [];

  protected start(): void {
    this.ensureReelContainer();
    this.reelContainer.init();
  }

  protected update(dt: number): void {
    if (!this.isSpinning || !this.reelContainer) return;
    this.updateReelPositions(dt);
  }

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
      this.reelContainer.setVisibleSymbols(this.targetSymbols);
    }

    await this.snapToGrid();
  }

  public getVisibleSymbols(): string[] {
    this.ensureReelContainer();
    return this.reelContainer.getVisibleSymbols();
  }

  public highlightWinSymbols(rows: number[]): void {
    this.ensureReelContainer();
    const visibleNodes = this.reelContainer.getVisibleSymbolNodes();

    rows.forEach((row) => {
      if (row < 0 || row >= visibleNodes.length) {
        return;
      }

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

  private ensureReelContainer(): void {
    if (this.reelContainer) return;
    this.reelContainer =
      this.reelContainerNode.getComponent(ReelContainer) ||
      this.reelContainerNode.addComponent(ReelContainer);
  }

  private getNodes(): Node[] {
    return this.reelContainer?.getSymbolNodes().filter((n) => n?.isValid) || [];
  }

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
}
