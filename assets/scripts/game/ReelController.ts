import { _decorator, Component, CCInteger, tween, Node, Vec3, Color } from "cc";
import { GameConfig } from "../data/GameConfig";
import { SymbolData } from "../data/SymbolData";
import { ReelContainer, SymbolContainer } from "./ReelContainer";
import { ReelStateMachine, ReelState } from "./ReelStateMachine";

const { ccclass, property } = _decorator;

enum GridRow {
  TOP = 1,
  MIDDLE = 0,
  BOTTOM = -1,
}

const REEL_CONSTANTS = {
  ACCELERATION: 3500,
  BLUR_THRESHOLD: 800,
  STOP_DURATION: 2.5,
  FRAME_TIME: 0.016,
  POSITION_TOLERANCE: 30,
  VISIBILITY_TOLERANCE: 10,
  EXTRA_WRAP_MULTIPLIER: 2,
} as const;

@ccclass("ReelController")
export class ReelController extends Component {
  @property({ type: CCInteger })
  private bufferSymbols: number = 2;

  @property({ type: ReelContainer })
  private reelContainer!: ReelContainer;

  private stateMachine!: ReelStateMachine;
  private readonly symbolSpacing =
    GameConfig.SYMBOL_SIZE + GameConfig.SYMBOL_SPACING;

  private totalSymbols = 0;
  private topBoundary = 0;
  private wrapHeight = 0;

  private currentSpeed = 0;
  private positionOffset = 0;
  private lastPositionOffset = 0;
  private finalOffset = 0;
  private tweenData = { offset: 0 };

  private originalPositions: Map<SymbolContainer, number> = new Map();
  private containerLaps: Map<SymbolContainer, number> = new Map();
  private targetSymbols: string[] = [];
  private isFinalizing = false;

  // ==========================================
  // Lifecycle Methods
  // ==========================================

  protected onLoad(): void {
    this.setupDimensions();
    this.setupComponents();
    this.initializeReel();
  }

  protected update(dt: number): void {
    if (this.stateMachine.isSpinning() && !this.isFinalizing) {
      this.updateSpeed(dt);
      this.positionOffset += this.currentSpeed * dt;
      this.syncSymbols(dt);
    }
  }

  // ==========================================
  // Public API - Spin Control
  // ==========================================

  public startSpin(targetSymbols: string[], delay = 0): void {
    if (!this.stateMachine.canSpin()) return;

    this.targetSymbols = targetSymbols;
    this.isFinalizing = false;

    this.scheduleOnce(() => {
      this.stateMachine.startSpin();
      this.currentSpeed = 0;
    }, delay);
  }

  public stopSpin(): void {
    if (this.stateMachine.isSpinning() && !this.isFinalizing) {
      this.stateMachine.startStopping();
      this.beginSmoothStop();
    }
  }

  // ==========================================
  // Spin Control - Internal
  // ==========================================

  private updateSpeed(dt: number): void {
    this.currentSpeed = Math.min(
      this.currentSpeed + REEL_CONSTANTS.ACCELERATION * dt,
      GameConfig.SPIN_SPEED_MAX
    );
  }

  private beginSmoothStop(): void {
    this.isFinalizing = true;
    this.lastPositionOffset = this.positionOffset;

    const currentSnap = this.positionOffset % this.symbolSpacing;
    const distToSnap = this.symbolSpacing - currentSnap;

    const extraDistance =
      this.wrapHeight * REEL_CONSTANTS.EXTRA_WRAP_MULTIPLIER;
    this.finalOffset = this.positionOffset + distToSnap + extraDistance;

    this.tweenData.offset = this.positionOffset;

    tween(this.tweenData)
      .to(
        REEL_CONSTANTS.STOP_DURATION,
        { offset: this.finalOffset },
        {
          easing: "quartOut",
          onUpdate: () => {
            this.positionOffset = this.tweenData.offset;
            this.syncSymbols(REEL_CONSTANTS.FRAME_TIME);
          },
        }
      )
      .call(() => {
        this.onStopComplete();
      })
      .start();
  }

  private onStopComplete(): void {
    this.positionOffset = this.finalOffset;
    this.currentSpeed = 0;
    this.isFinalizing = false;
    this.stateMachine.setResult();
    this.forceShowNormalSymbols();
    this.node.emit("REEL_STOPPED");
  }

  // ==========================================
  // Symbol Synchronization
  // ==========================================

  private syncSymbols(dt: number): void {
    const containers = this.reelContainer.getAllContainers();
    const shouldBlur = this.shouldApplyBlurEffect(dt);

    for (const container of containers) {
      this.updateSymbolPosition(container);
      this.handleSymbolWrapping(container);
      this.updateBlurEffect(container, shouldBlur);
    }
  }

  private shouldApplyBlurEffect(dt: number): boolean {
    if (dt === 0) return false;

    const instantSpeed =
      Math.abs(this.positionOffset - this.lastPositionOffset) / dt;
    this.lastPositionOffset = this.positionOffset;

    return instantSpeed > REEL_CONSTANTS.BLUR_THRESHOLD;
  }

  private updateSymbolPosition(container: SymbolContainer): void {
    const originY = this.originalPositions.get(container) ?? 0;
    const halfWrap = this.wrapHeight / 2;

    const y =
      this.modulo(originY - this.positionOffset + halfWrap, this.wrapHeight) -
      halfWrap;
    container.node.setPosition(0, y);
  }

  private handleSymbolWrapping(container: SymbolContainer): void {
    const originY = this.originalPositions.get(container) ?? 0;
    const halfWrap = this.wrapHeight / 2;

    const currentLap = Math.floor(
      (originY - this.positionOffset + halfWrap) / this.wrapHeight
    );
    const finalLap = Math.floor(
      (originY - this.finalOffset + halfWrap) / this.wrapHeight
    );

    const lastLap = this.containerLaps.get(container);

    if (this.isFinalizing && lastLap !== undefined && lastLap !== currentLap) {
      if (currentLap === finalLap) {
        this.applyTargetSymbolToContainer(container, originY);
      } else {
        this.assignRandomSymbol(container);
      }
    }

    this.containerLaps.set(container, currentLap);
  }

  // ==========================================
  // Symbol Assignment
  // ==========================================

  private applyTargetSymbolToContainer(
    container: SymbolContainer,
    originY: number
  ): void {
    const gridRow = this.calculateFinalGridRow(originY);
    const targetId = this.getTargetSymbolForRow(gridRow);

    if (targetId) {
      this.reelContainer.updateSymbolContainer(container, targetId);
    } else {
      this.assignRandomSymbol(container);
    }
  }

  private calculateFinalGridRow(originY: number): number {
    const halfWrap = this.wrapHeight / 2;
    const finalY =
      this.modulo(originY - this.finalOffset + halfWrap, this.wrapHeight) -
      halfWrap;

    return Math.round(finalY / this.symbolSpacing);
  }

  private getTargetSymbolForRow(gridRow: number): string | null {
    if (gridRow === GridRow.TOP) return this.targetSymbols[0] || null;
    if (gridRow === GridRow.MIDDLE) return this.targetSymbols[1] || null;
    if (gridRow === GridRow.BOTTOM) return this.targetSymbols[2] || null;
    return null;
  }

  private assignRandomSymbol(container: SymbolContainer): void {
    const allSymbols = SymbolData.getAllSymbols();
    const randomSymbol =
      allSymbols[Math.floor(Math.random() * allSymbols.length)];
    this.reelContainer.updateSymbolContainer(container, randomSymbol.id);
  }

  // ==========================================
  // Public API - Symbol Access
  // ==========================================

  public getContainerAtRow(row: number): SymbolContainer | null {
    const containers = this.reelContainer.getAllContainers();
    const targetY = this.getRowYPosition(row);

    const found =
      containers.find(
        (c) =>
          Math.abs(c.node.position.y - targetY) <
          REEL_CONSTANTS.POSITION_TOLERANCE
      ) || null;

    return found;
  }

  public highlightSymbol(row: number): void {
    const container = this.getContainerAtRow(row);
    if (!container) return;

    this.stopContainerTweens(container);
    this.startPulseAnimation(container);
  }

  public resetSymbolsScale(): void {
    this.reelContainer.getAllContainers().forEach((container) => {
      container.node.setScale(1, 1, 1);
      container.sprite.color = new Color(255, 255, 255, 255);
    });
  }

  // ==========================================
  // Animation Helpers
  // ==========================================

  private stopContainerTweens(container: SymbolContainer): void {
    tween(container.node).stop();
    tween(container.sprite).stop();
  }

  private startPulseAnimation(container: SymbolContainer): void {
    const pulseScale = 1.15;
    const pulseDuration = 0.25;
    const pulseRepeat = 2;

    tween(container.node)
      .to(
        pulseDuration,
        { scale: new Vec3(pulseScale, pulseScale, 1) },
        { easing: "quadOut" }
      )
      .to(pulseDuration, { scale: new Vec3(1.0, 1.0, 1) }, { easing: "quadIn" })
      .union()
      .repeat(pulseRepeat)
      .start();
  }

  // ==========================================
  // Visual Effects
  // ==========================================

  private forceShowNormalSymbols(): void {
    this.reelContainer
      .getAllContainers()
      .forEach((container) => this.updateBlurEffect(container, false));
  }

  private updateBlurEffect(container: SymbolContainer, isBlur: boolean): void {
    if (container.isBlurred === isBlur) return;

    container.isBlurred = isBlur;
    const spriteFrame = isBlur
      ? container.blurSpriteFrame || container.normalSpriteFrame
      : container.normalSpriteFrame;

    if (spriteFrame) {
      container.sprite.spriteFrame = spriteFrame;
    }
  }

  // ==========================================
  // Initialization
  // ==========================================

  private setupDimensions(): void {
    const visibleHeight = GameConfig.SYMBOL_PER_REEL * this.symbolSpacing;
    this.topBoundary =
      visibleHeight / 2 + this.symbolSpacing * this.bufferSymbols;
    this.wrapHeight = this.topBoundary * 2;
    this.totalSymbols = GameConfig.SYMBOL_PER_REEL + this.bufferSymbols * 2;
  }

  private setupComponents(): void {
    this.reelContainer =
      this.getComponent(ReelContainer) || this.addComponent(ReelContainer);
    this.stateMachine =
      this.getComponent(ReelStateMachine) ||
      this.addComponent(ReelStateMachine);
    this.stateMachine.initialize({});
  }

  private async initializeReel(): Promise<void> {
    const symbols = SymbolData.getAllSymbols();
    this.reelContainer.clearContainers();
    const centerIndex = Math.floor(this.totalSymbols / 2);

    for (let i = 0; i < this.totalSymbols; i++) {
      const symbol = symbols[i % symbols.length];
      const container = await this.reelContainer.createSymbolContainer(
        symbol.id
      );

      if (container) {
        const posY = (centerIndex - i) * this.symbolSpacing;
        this.setupContainer(container, posY);
      }
    }
  }

  private setupContainer(container: SymbolContainer, posY: number): void {
    container.node.setParent(this.node);
    container.node.setPosition(0, posY);
    this.originalPositions.set(container, posY);
    this.containerLaps.set(container, 0);
    this.reelContainer.addContainer(container);
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  private getRowYPosition(row: number): number {
    return (1 - row) * this.symbolSpacing;
  }

  private modulo(v: number, m: number): number {
    return ((v % m) + m) % m;
  }
}
