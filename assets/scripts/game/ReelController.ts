import { _decorator, Component, Node, tween, Tween, Vec3 } from "cc";
import { GameConfig } from "../data/GameConfig";
import { ReelContainer } from "./ReelContainer";
const { ccclass, property } = _decorator;

@ccclass("ReelController")
export class ReelController extends Component {
  @property reelIndex: number = 0;
  @property(Node) reelContainerNode: Node = null!;

  private reelContainer: ReelContainer = null!;
  private readonly symbolSpacing: number =
    GameConfig.SYMBOL_SIZE + GameConfig.SYMBOL_SPACING;

  private isSpinning = false;
  private isStartScheduled = false;
  private spinSpeed = 0;
  private targetSymbols: string[] = [];

  private readonly startSpinCallback = () => {
    this.isStartScheduled = false;
    this.isSpinning = true;
  };

  protected start(): void {
    this.ensureReelContainer();
    this.reelContainer.init();
  }

  protected update(dt: number): void {
    if (!this.isSpinning) return;
    this.moveSymbolsDown(dt);
  }

  private ensureReelContainer(): void {
    if (this.reelContainer) return;
    if (!this.reelContainerNode?.isValid) {
      throw new Error(
        "[ReelController] reelContainerNode is not assigned/valid"
      );
    }

    this.reelContainer = this.reelContainerNode.getComponent(ReelContainer);
    if (!this.reelContainer) {
      this.reelContainer = this.reelContainerNode.addComponent(ReelContainer);
    }
  }

  private getSymbolNodes(): Node[] {
    if (!this.reelContainer) return [];
    return this.reelContainer.getSymbolNodes().filter((n) => n?.isValid);
  }

  private getVisibleSymbolNodes(): Node[] {
    if (!this.reelContainer) return [];
    return this.reelContainer.getVisibleSymbolNodes();
  }

  private cancelScheduledStart(): void {
    if (!this.isStartScheduled) return;
    this.unschedule(this.startSpinCallback);
    this.isStartScheduled = false;
  }

  // Di chuyển symbols xuống (infinite scroll)
  private moveSymbolsDown(dt: number): void {
    const nodes = this.getSymbolNodes();
    if (!nodes.length) return;

    const distance = this.spinSpeed * dt;

    // Di chuyển tất cả xuống
    nodes.forEach((node) => {
      node.setPosition(
        node.position.x,
        node.position.y - distance,
        node.position.z
      );
    });

    // Tìm vị trí cao nhất
    let maxY = nodes.reduce(
      (acc, n) => (n.position.y > acc ? n.position.y : acc),
      Number.NEGATIVE_INFINITY
    );

    // Đưa symbol xuống quá thấp lên trên cùng
    const threshold = -this.symbolSpacing * (nodes.length / 2 + 1);
    nodes.forEach((node) => {
      if (node.position.y < threshold) {
        maxY += this.symbolSpacing;
        node.setPosition(node.position.x, maxY, node.position.z);
      }
    });
  }

  private computeSnapOffsetY(nodes: Node[]): number {
    if (!nodes.length) return 0;

    // Tìm symbol gần tâm nhất
    const closest = nodes.reduce((prev, curr) =>
      Math.abs(curr.position.y) < Math.abs(prev.position.y) ? curr : prev
    );

    const nearestGrid =
      Math.round(closest.position.y / this.symbolSpacing) * this.symbolSpacing;
    return nearestGrid - closest.position.y;
  }

  private applyOffsetY(nodes: Node[], offsetY: number): void {
    if (Math.abs(offsetY) < 0.001) return;
    nodes.forEach((node) => {
      node.setPosition(
        node.position.x,
        node.position.y + offsetY,
        node.position.z
      );
    });
  }

  private tweenOffsetY(
    nodes: Node[],
    offsetY: number,
    duration: number,
    easing: any
  ): Promise<void> {
    if (!nodes.length || Math.abs(offsetY) < 0.001) return Promise.resolve();

    return new Promise((resolve) => {
      let remaining = nodes.length;

      nodes.forEach((node) => {
        const targetPos = new Vec3(
          node.position.x,
          node.position.y + offsetY,
          node.position.z
        );

        Tween.stopAllByTarget(node);
        tween(node)
          .to(duration, { position: targetPos }, { easing })
          .call(() => {
            remaining--;
            if (remaining <= 0) resolve();
          })
          .start();
      });
    });
  }

  // Animation "bounce" khi dừng: snap về grid nhưng có tween để mượt hơn
  private animateSnapToGrid(): Promise<void> {
    const nodes = this.getSymbolNodes();
    const offsetY = this.computeSnapOffsetY(nodes);
    return this.tweenOffsetY(
      nodes,
      offsetY,
      GameConfig.BOUNCE_DURATION,
      "backOut"
    );
  }

  // Bắt đầu quay
  public spin(targetSymbols: string[], delay: number = 0): void {
    this.ensureReelContainer();
    if (this.isSpinning || this.isStartScheduled) return;

    // Store target symbols for when we stop
    this.targetSymbols = targetSymbols;

    this.spinSpeed =
      GameConfig.SPIN_SPEED_MIN +
      Math.random() * (GameConfig.SPIN_SPEED_MAX - GameConfig.SPIN_SPEED_MIN);

    if (delay > 0) {
      this.unschedule(this.startSpinCallback);
      this.isStartScheduled = true;
      this.scheduleOnce(this.startSpinCallback, delay);
    } else {
      this.isSpinning = true;
    }
  }

  public async stop(): Promise<void> {
    // Nếu reel chưa bắt đầu (đang schedule), cần huỷ để tránh "spin lại" sau khi đã stop.
    this.cancelScheduledStart();

    if (!this.isSpinning) return;

    this.isSpinning = false;
    this.spinSpeed = 0;

    if (this.targetSymbols?.length) {
      this.reelContainer.setVisibleSymbols(this.targetSymbols);
    }

    await this.animateSnapToGrid();
  }

  public getVisibleSymbols(): string[] {
    this.ensureReelContainer();
    return this.reelContainer.getVisibleSymbols();
  }

  public highlightWinSymbols(rows: number[]): void {
    this.ensureReelContainer();
    const visibleNodes = this.getVisibleSymbolNodes();

    rows.forEach((row) => {
      if (row >= 0 && row < visibleNodes.length) {
        const node = visibleNodes[row];
        if (node?.isValid) {
          node.setScale(1, 1, 1);
          tween(node)
            .to(0.25, { scale: new Vec3(1.2, 1.2, 1) }, { easing: "backOut" })
            .to(0.25, { scale: new Vec3(1.0, 1.0, 1) }, { easing: "backIn" })
            .union()
            .repeat(5)
            .start();
        }
      }
    });
  }

  // Reset
  public reset(): void {
    this.ensureReelContainer();
    this.cancelScheduledStart();

    this.isSpinning = false;
    this.spinSpeed = 0;

    if (this.reelContainer) {
      // Dừng tween để tránh giật khi reset
      this.getSymbolNodes().forEach((n) => Tween.stopAllByTarget(n));
      this.reelContainer.reset();
      this.reelContainer.init();

      // Đảm bảo snap đúng grid sau khi init lại
      const nodes = this.getSymbolNodes();
      const offsetY = this.computeSnapOffsetY(nodes);
      this.applyOffsetY(nodes, offsetY);
    }
  }
}
