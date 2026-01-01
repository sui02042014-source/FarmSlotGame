import { _decorator, CCInteger, Color, Component, tween } from "cc";
import { GameConfig } from "../../data/config/game-config";
import { SymbolData } from "../../data/models/symbol-data";
import { SymbolHighlightEffect } from "../../utils/effects/symbol-highlight-effect";
import { WinGlowHelper } from "../../utils/effects/win-glow-effect";
import { ReelContainer, SymbolContainer } from "./reel-container";
import { ReelStateMachine } from "./reel-state-machine";
import { GameManager } from "../game/game-manager";
import { AudioManager } from "../audio/audio-manager";

const { ccclass, property } = _decorator;

enum GridRow {
  TOP = 1,
  MIDDLE = 0,
  BOTTOM = -1,
}

const REEL_CONSTANTS = {
  FRAME_TIME: 0.016,
  POSITION_TOLERANCE: 30,
  VISIBILITY_TOLERANCE: 10,
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
  private activeTween: any = null;

  private originalPositions: Map<SymbolContainer, number> = new Map();
  private containerLaps: Map<SymbolContainer, number> = new Map();
  private targetSymbols: string[] = [];
  private isFinalizing = false;

  // ==========================================
  // Lifecycle Methods
  // ==========================================

  protected async onLoad(): Promise<void> {
    this.setupDimensions();
    this.setupComponents();

    try {
      await SymbolHighlightEffect.initialize();
    } catch (error) {
      console.error(
        "[ReelController] Failed to initialize SymbolHighlightEffect:",
        error
      );
      // Continue even if highlight effect fails - it's not critical
    }
  }

  protected onDestroy(): void {
    this.unscheduleAllCallbacks();
    this.stopActiveTween();
    this.originalPositions.clear();
    this.containerLaps.clear();
    this.currentSpeed = 0;
    this.isFinalizing = false;
  }

  protected update(dt: number): void {
    if (this.stateMachine.isSpinning() || this.stateMachine.isStopping()) {
      if (!this.isFinalizing) {
        this.updateSpeed(dt);
        this.positionOffset += this.currentSpeed * dt;
      }

      const positionDelta = Math.abs(
        this.positionOffset - this.lastPositionOffset
      );
      if (positionDelta >= GameConfig.REEL_PARAMS.SYNC_THRESHOLD) {
        this.syncSymbols();
      }
    }
  }

  // ==========================================
  // Public API - Spin Control
  // ==========================================

  public startSpin(targetSymbols: string[] = [], delay = 0): void {
    if (!this.stateMachine.canSpin()) return;

    this.targetSymbols = targetSymbols;
    this.isFinalizing = false;

    this.scheduleOnce(() => {
      this.stateMachine.startSpin();
      this.currentSpeed = 0;
    }, delay);
  }

  public stopSpin(targetSymbols: string[] = []): void {
    if (!this.canStopReel()) {
      this.emitStoppedEventSafely();
      return;
    }

    if (targetSymbols.length > 0) {
      this.targetSymbols = this.validateAndNormalizeSymbols(targetSymbols);
    }

    this.stateMachine.startStopping();
    this.beginSmoothStop();
  }

  private canStopReel(): boolean {
    return this.stateMachine.isSpinning() && !this.isFinalizing;
  }

  private validateAndNormalizeSymbols(symbols: string[]): string[] {
    const expected = GameConfig.SYMBOL_PER_REEL;

    // Validate each symbol ID exists, replace invalid ones
    const validatedSymbols = symbols.map((symbolId) => {
      const symbolData = SymbolData.getSymbol(symbolId);
      if (!symbolData) {
        console.warn(
          `Invalid symbol ID received: ${symbolId}, using random symbol`
        );
        return this.getRandomSymbolId();
      }
      return symbolId;
    });

    if (validatedSymbols.length === expected) {
      return validatedSymbols;
    }

    const normalized = [...validatedSymbols];
    while (normalized.length < expected) {
      normalized.push(this.getRandomSymbolId());
    }

    return normalized.slice(0, expected);
  }

  private emitStoppedEventSafely(): void {
    this.scheduleOnce(() => {
      this.node.emit(GameConfig.EVENTS.REEL_STOPPED);
    }, 0);
  }

  private getRandomSymbolId(): string {
    const allSymbols = SymbolData.getAllSymbols();
    return allSymbols[Math.floor(Math.random() * allSymbols.length)].id;
  }

  public forceStop(): void {
    this.unscheduleAllCallbacks();
    this.stopActiveTween();
    this.currentSpeed = 0;
    this.isFinalizing = false;
    this.stateMachine.reset();
  }

  // ==========================================
  // Spin Control - Internal
  // ==========================================

  private updateSpeed(dt: number): void {
    const wasMaxSpeed = this.currentSpeed >= GameConfig.SPIN_SPEED_MAX;

    this.currentSpeed = Math.min(
      this.currentSpeed + GameConfig.REEL_PARAMS.ACCELERATION * dt,
      GameConfig.SPIN_SPEED_MAX
    );

    if (!wasMaxSpeed && this.currentSpeed >= GameConfig.SPIN_SPEED_MAX) {
      this.reelContainer.setUseBlur(true);
    }
  }

  private beginSmoothStop(): void {
    this.isFinalizing = true;
    this.lastPositionOffset = this.positionOffset;

    const currentSnap = this.positionOffset % this.symbolSpacing;
    const distToSnap = this.symbolSpacing - currentSnap;

    const idealDistance =
      (this.currentSpeed * GameConfig.REEL_PARAMS.STOP_DURATION) / 4;
    let extraDistance = Math.max(
      idealDistance - distToSnap,
      this.wrapHeight * GameConfig.REEL_PARAMS.EXTRA_WRAP_MULTIPLIER
    );

    extraDistance =
      Math.ceil(extraDistance / this.symbolSpacing) * this.symbolSpacing;

    this.finalOffset = this.positionOffset + distToSnap + extraDistance;

    this.tweenData.offset = this.positionOffset;
    this.reelContainer.setUseBlur(false);

    this.stopActiveTween();

    this.activeTween = tween(this.tweenData)
      .to(
        GameConfig.REEL_PARAMS.STOP_DURATION,
        { offset: this.finalOffset },
        {
          easing: "quartOut",
          onUpdate: () => {
            this.positionOffset = this.tweenData.offset;
          },
        }
      )
      .call(() => {
        this.activeTween = null;
        this.onStopComplete();
      })
      .start();
  }

  private onStopComplete(): void {
    this.positionOffset = this.finalOffset;
    this.lastPositionOffset = this.finalOffset;
    this.currentSpeed = 0;
    this.isFinalizing = false;

    const gameManager = GameManager.getInstance();
    if (gameManager && !gameManager.isGamePaused()) {
      this.reelContainer.setUseBlur(false);
    }

    // Play reel stop sound exactly when reel finishes stopping
    this.playReelStopSound();

    this.stateMachine.setResult();
    this.node.emit(GameConfig.EVENTS.REEL_STOPPED);
  }

  // ==========================================
  // Audio
  // ==========================================

  private playReelStopSound(): void {
    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.playSFX(GameConfig.SOUNDS.REEL_STOP);
    }
  }

  // ==========================================
  // Symbol Synchronization
  // ==========================================

  private syncSymbols(): void {
    const containers = this.reelContainer.getAllContainers();
    this.lastPositionOffset = this.positionOffset;

    for (const container of containers) {
      this.updateSymbolPosition(container);
      this.handleSymbolWrapping(container);
    }
  }

  private updateSymbolPosition(container: SymbolContainer): void {
    if (!this.originalPositions.has(container)) {
      return;
    }

    const originY = this.originalPositions.get(container)!;
    const halfWrap = this.wrapHeight / 2;

    const y =
      this.modulo(originY - this.positionOffset + halfWrap, this.wrapHeight) -
      halfWrap;
    container.node.setPosition(0, y);

    const visibleHalfHeight =
      (GameConfig.SYMBOL_PER_REEL * this.symbolSpacing) / 2;
    const isVisible = Math.abs(y) <= visibleHalfHeight + this.symbolSpacing;
    if (container.node.active !== isVisible) {
      container.node.active = isVisible;
    }
  }

  private handleSymbolWrapping(container: SymbolContainer): void {
    if (!this.originalPositions.has(container)) {
      return;
    }

    const originY = this.originalPositions.get(container)!;
    const halfWrap = this.wrapHeight / 2;

    const currentLap = Math.floor(
      (originY - this.positionOffset + halfWrap) / this.wrapHeight
    );

    const finalLap = Math.floor(
      (originY - this.finalOffset + halfWrap) / this.wrapHeight
    );

    const lastLap = this.containerLaps.get(container);

    const hasWrapped =
      this.isFinalizing && lastLap !== undefined && lastLap !== currentLap;

    if (hasWrapped) {
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

    SymbolHighlightEffect.stop(container.node);

    if (container.spine && container.spine.skeletonData) {
      container.sprite.node.active = false;
      container.spine.node.active = true;
      container.spine.setAnimation(0, "win", true);
    } else {
      // Apply both highlight effect and glow shader
      SymbolHighlightEffect.play({
        targetNode: container.node,
        duration: 1,
        loop: true,
        brightness: 1.2,
      });

      // Apply win glow effect for enhanced visual feedback
      WinGlowHelper.applyGlow(container.sprite.node, 1.5, 1.3);
    }
  }

  public resetSymbolsScale(): void {
    this.reelContainer.getAllContainers().forEach((container) => {
      SymbolHighlightEffect.stop(container.node);
      WinGlowHelper.removeGlow(container.sprite.node);
      container.node.setScale(1, 1, 1);
      container.sprite.color = new Color(255, 255, 255, 255);

      if (container.spine) {
        container.spine.node.active = false;
        container.sprite.node.active = true;
      }
    });
  }

  public setBlur(enable: boolean): void {
    this.reelContainer.setUseBlur(enable);
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

  public async initializeReel(): Promise<void> {
    try {
      const symbols = SymbolData.getAllSymbols();

      if (!symbols || symbols.length === 0) {
        console.error(
          "[ReelController] No symbols available for initialization"
        );
        return;
      }

      // Clear old references to prevent memory leaks
      this.originalPositions.clear();
      this.containerLaps.clear();
      this.reelContainer.clearContainers();

      const centerIndex = Math.floor(this.totalSymbols / 2);

      for (let i = 0; i < this.totalSymbols; i++) {
        const randomSymbol =
          symbols[Math.floor(Math.random() * symbols.length)];
        const container = await this.reelContainer.createSymbolContainer(
          randomSymbol.id
        );

        if (container) {
          const posY = (centerIndex - i) * this.symbolSpacing;
          this.setupContainer(container, posY);
        }
      }
    } catch (error) {
      console.error("[ReelController] Failed to initialize reel:", error);
      throw error; // Re-throw so caller can handle
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

  private stopActiveTween(): void {
    if (this.activeTween) {
      this.activeTween.stop();
      this.activeTween = null;
    }
  }

  private getRowYPosition(row: number): number {
    return (1 - row) * this.symbolSpacing;
  }

  private modulo(v: number, m: number): number {
    return ((v % m) + m) % m;
  }
}
