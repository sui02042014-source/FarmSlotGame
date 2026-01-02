import { _decorator, CCInteger, Color, Component, tween } from "cc";
import { GameConfig } from "../../data/config/game-config";
import { ISymbolData, SymbolData } from "../../data/models/symbol-data";
import { SymbolHighlightEffect } from "../../utils/effects/symbol-highlight-effect";
import { ReelContainer, SymbolContainer } from "./reel-container";
import { ReelStateMachine, ReelState } from "./reel-state-machine";
import { GameManager } from "../game/game-manager";
import { AudioManager } from "../audio/audio-manager";
import { Logger } from "../../utils/helpers/logger";

const { ccclass, property } = _decorator;
const logger = Logger.create("ReelController");

enum GridRow {
  TOP = 1,
  MIDDLE = 0,
  BOTTOM = -1,
}

const REEL_CONSTANTS = {
  POSITION_TOLERANCE: 30,
  HIGHLIGHT_DURATION: 1,
  HIGHLIGHT_BRIGHTNESS: 1.2,
  GLOW_INTENSITY: 1.5,
  GLOW_THRESHOLD: 1.3,
} as const;

const WHITE_COLOR = new Color(255, 255, 255, 255);

@ccclass("ReelController")
export class ReelController extends Component {
  @property({ type: CCInteger })
  private bufferSymbols: number = 2;

  private reelContainer!: ReelContainer;
  private stateMachine!: ReelStateMachine;

  // Dimensions
  private readonly symbolSpacing =
    GameConfig.SYMBOL_SIZE + GameConfig.SYMBOL_SPACING;
  private totalSymbols = 0;
  private topBoundary = 0;
  private wrapHeight = 0;
  private halfWrap = 0;

  // Spin state
  private currentSpeed = 0;
  private positionOffset = 0;
  private lastPositionOffset = 0;
  private finalOffset = 0;
  private tweenData = { offset: 0 };
  private activeTween: any = null;
  private isFinalizing = false;

  // Symbol tracking
  private originalPositions: Map<SymbolContainer, number> = new Map();
  private containerLaps: Map<SymbolContainer, number> = new Map();
  private containerByRow: Map<number, SymbolContainer> = new Map();
  private targetSymbols: string[] = [];

  // Cached data
  private cachedSymbols: ISymbolData[] = [];
  private cachedSymbolIds: string[] = [];

  // ==========================================
  // Lifecycle
  // ==========================================

  protected async onLoad(): Promise<void> {
    this.setupDimensions();
    this.setupComponents();
    this.cacheSymbols();
    await SymbolHighlightEffect.initialize();
  }

  protected onDestroy(): void {
    this.cleanup();
  }

  protected update(dt: number): void {
    if (!this.enabled) return;

    this.updateSpinLoop(dt);
  }

  // ==========================================
  // Public API - Reel Initialization
  // ==========================================

  public async initializeReel(): Promise<void> {
    const symbols = this.validateSymbols();
    this.resetReelState();
    await this.createAllSymbolContainers(symbols);
  }

  // ==========================================
  // Public API - Spin Control
  // ==========================================

  public startSpin(targetSymbols: string[] = [], delay = 0): void {
    if (!this.stateMachine.canSpin()) {
      logger.warn(
        "Reel cannot start spin in current state:",
        this.stateMachine.getState()
      );
      return;
    }

    this.targetSymbols = targetSymbols;
    this.isFinalizing = false;

    this.scheduleOnce(() => {
      this.stateMachine.startSpin();
      this.currentSpeed = 0;
      this.enabled = true;
      logger.debug("Reel spin started");
    }, delay);
  }

  public stopSpin(targetSymbols: string[] = []): void {
    if (!this.canStopReel()) {
      logger.warn(
        "Reel cannot stop in current state:",
        this.stateMachine.getState()
      );
      this.emitStoppedEventSafely();
      return;
    }

    if (targetSymbols.length > 0) {
      this.targetSymbols = this.validateAndNormalizeSymbols(targetSymbols);
    }

    this.stateMachine.startStopping();
    this.beginSmoothStop();
    logger.debug("Reel stop initiated with targets:", this.targetSymbols);
  }

  public forceStop(): void {
    logger.info("Force stopping reel");
    this.unscheduleAllCallbacks();
    this.stopActiveTween();
    this.enabled = false;
    this.currentSpeed = 0;
    this.isFinalizing = false;
    this.positionOffset = this.modulo(this.positionOffset, this.wrapHeight);
    this.lastPositionOffset = this.positionOffset;
    this.stateMachine.reset();
    this.syncSymbols();
  }

  // ==========================================
  // Public API - Symbol Access & Effects
  // ==========================================

  public getContainerAtRow(row: number): SymbolContainer | null {
    const cached = this.containerByRow.get(row);
    if (cached?.node?.isValid) {
      return cached;
    }

    const containers = this.reelContainer.getAllContainers();
    const targetY = this.getRowYPosition(row);

    const found =
      containers.find(
        (c) =>
          c?.node?.isValid &&
          Math.abs(c.node.position.y - targetY) <
            REEL_CONSTANTS.POSITION_TOLERANCE
      ) || null;

    if (found) {
      this.containerByRow.set(row, found);
    }

    return found;
  }

  /**
   * Highlight a symbol at a specific row with animation
   * @param row - Row index (0-2)
   */
  public highlightSymbol(row: number): void {
    const container = this.getContainerAtRow(row);
    if (!container) return;

    SymbolHighlightEffect.stop(container.node);

    if (container.spine && container.spine.skeletonData) {
      container.sprite.node.active = false;
      container.spine.node.active = true;
      container.spine.setAnimation(0, "win", true);
    } else {
      SymbolHighlightEffect.play({
        targetNode: container.node,
        duration: REEL_CONSTANTS.HIGHLIGHT_DURATION,
        loop: true,
        brightness: REEL_CONSTANTS.HIGHLIGHT_BRIGHTNESS,
      });
    }
  }

  /**
   * Reset all symbols to normal state (remove highlights)
   */
  public resetSymbolsScale(): void {
    this.reelContainer.getAllContainers().forEach((container) => {
      SymbolHighlightEffect.stop(container.node);
      container.node.setScale(1, 1, 1);
      container.sprite.color = WHITE_COLOR;

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
  // Private - Initialization
  // ==========================================

  private setupDimensions(): void {
    const visibleHeight = GameConfig.SYMBOL_PER_REEL * this.symbolSpacing;
    this.topBoundary =
      visibleHeight / 2 + this.symbolSpacing * this.bufferSymbols;
    this.wrapHeight = this.topBoundary * 2;
    this.halfWrap = this.wrapHeight / 2;
    this.totalSymbols = GameConfig.SYMBOL_PER_REEL + this.bufferSymbols * 2;
  }

  private setupComponents(): void {
    this.reelContainer =
      this.getComponent(ReelContainer) ?? this.addComponent(ReelContainer)!;

    this.stateMachine =
      this.getComponent(ReelStateMachine) ??
      this.addComponent(ReelStateMachine)!;

    this.stateMachine.initialize({
      onStateChanged: (oldState, newState) => {
        if (newState === ReelState.SPINNING) {
          this.currentSpeed = 0;
        }
      },
    });
  }

  private cacheSymbols(): void {
    this.cachedSymbols = SymbolData.getAllSymbols();
    this.cachedSymbolIds = this.cachedSymbols.map((s) => s.id);
  }

  private refreshSymbolCache(): void {
    if (
      !this.cachedSymbols.length ||
      this.cachedSymbols.length !== SymbolData.getAllSymbols().length
    ) {
      this.cacheSymbols();
    }
  }

  private validateSymbols(): ISymbolData[] {
    if (!this.cachedSymbols || this.cachedSymbols.length === 0) {
      throw new Error("No symbols available for initialization");
    }
    return this.cachedSymbols;
  }

  private resetReelState(): void {
    this.originalPositions.clear();
    this.containerLaps.clear();
    this.containerByRow.clear();
    this.reelContainer.clearContainers();
  }

  private async createAllSymbolContainers(
    symbols: ISymbolData[]
  ): Promise<void> {
    const centerIndex = Math.floor(this.totalSymbols / 2);

    const createPromises = Array.from({ length: this.totalSymbols }, (_, i) =>
      this.createSingleSymbolContainer(symbols, i, centerIndex)
    );

    await Promise.all(createPromises);
  }

  private async createSingleSymbolContainer(
    symbols: ISymbolData[],
    index: number,
    centerIndex: number
  ): Promise<void> {
    const randomSymbol = this.getRandomSymbol(symbols);
    const container = await this.reelContainer.createSymbolContainer(
      randomSymbol.id
    );

    if (container) {
      const posY = (centerIndex - index) * this.symbolSpacing;
      this.setupContainer(container, posY);
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
  // Private - Spin Loop
  // ==========================================

  private updateSpinLoop(dt: number): void {
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

  private updateSpeed(dt: number): void {
    if (!this.stateMachine.isSpinning()) {
      return;
    }

    const wasMaxSpeed = this.currentSpeed >= GameConfig.SPIN_SPEED_MAX;

    this.currentSpeed = Math.min(
      this.currentSpeed + GameConfig.REEL_PARAMS.ACCELERATION * dt,
      GameConfig.SPIN_SPEED_MAX
    );

    if (!wasMaxSpeed && this.currentSpeed >= GameConfig.SPIN_SPEED_MAX) {
      this.reelContainer.setUseBlur(true);
    }
  }

  // ==========================================
  // Private - Stopping Mechanics
  // ==========================================

  private canStopReel(): boolean {
    return this.stateMachine.isSpinning() && !this.isFinalizing;
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
            if (this.node?.isValid) {
              this.positionOffset = this.tweenData.offset;
            }
          },
        }
      )
      .call(() => {
        if (this.node?.isValid) {
          this.activeTween = null;
          this.onStopComplete();
        }
      })
      .start();
  }

  private onStopComplete(): void {
    this.positionOffset = this.finalOffset;
    this.lastPositionOffset = this.finalOffset;
    this.currentSpeed = 0;
    this.isFinalizing = false;
    this.enabled = false;

    const gameManager = GameManager.getInstance();
    if (gameManager && !gameManager.isGamePaused()) {
      this.reelContainer.setUseBlur(false);
    }

    this.playReelStopSound();

    this.stateMachine.setResult();
    this.node.emit(GameConfig.EVENTS.REEL_STOPPED);
  }

  // ==========================================
  // Private - Symbol Synchronization
  // ==========================================

  private syncSymbols(): void {
    const containers = this.reelContainer.getAllContainers();
    this.lastPositionOffset = this.positionOffset;

    this.containerByRow.clear();

    for (const container of containers) {
      this.updateSymbolPosition(container);
      this.handleSymbolWrapping(container);
      this.cacheContainerRow(container);
    }
  }

  private updateSymbolPosition(container: SymbolContainer): void {
    if (!this.originalPositions.has(container)) {
      return;
    }

    const originY = this.originalPositions.get(container)!;

    const y =
      this.modulo(
        originY - this.positionOffset + this.halfWrap,
        this.wrapHeight
      ) - this.halfWrap;
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

    const currentLap = Math.floor(
      (originY - this.positionOffset + this.halfWrap) / this.wrapHeight
    );

    const finalLap = Math.floor(
      (originY - this.finalOffset + this.halfWrap) / this.wrapHeight
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

  private cacheContainerRow(container: SymbolContainer): void {
    if (!container?.node?.isValid) {
      return;
    }

    const y = container.node.position.y;

    for (let row = 0; row < GameConfig.SYMBOL_PER_REEL; row++) {
      const rowY = this.getRowYPosition(row);
      if (Math.abs(y - rowY) < REEL_CONSTANTS.POSITION_TOLERANCE) {
        this.containerByRow.set(row, container);
        break;
      }
    }
  }

  // ==========================================
  // Private - Symbol Assignment
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

  private assignRandomSymbol(container: SymbolContainer): void {
    const randomSymbolId = this.getRandomSymbolId();
    this.reelContainer.updateSymbolContainer(container, randomSymbolId);
  }

  private calculateFinalGridRow(originY: number): number {
    const finalY =
      this.modulo(originY - this.finalOffset + this.halfWrap, this.wrapHeight) -
      this.halfWrap;

    return Math.round(finalY / this.symbolSpacing);
  }

  private getTargetSymbolForRow(gridRow: number): string | null {
    if (gridRow === GridRow.TOP) return this.targetSymbols[0] || null;
    if (gridRow === GridRow.MIDDLE) return this.targetSymbols[1] || null;
    if (gridRow === GridRow.BOTTOM) return this.targetSymbols[2] || null;
    return null;
  }

  private getRandomSymbolId(): string {
    this.refreshSymbolCache();
    return this.cachedSymbolIds[
      Math.floor(Math.random() * this.cachedSymbolIds.length)
    ];
  }

  private getRandomSymbol(symbols: ISymbolData[]): ISymbolData {
    return symbols[Math.floor(Math.random() * symbols.length)];
  }

  // ==========================================
  // Private - Validation & Helpers
  // ==========================================

  private validateAndNormalizeSymbols(symbols: string[]): string[] {
    const expected = GameConfig.SYMBOL_PER_REEL;

    const validatedSymbols = symbols.map((symbolId) => {
      const symbolData = SymbolData.getSymbol(symbolId);
      if (!symbolData) {
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

  // ==========================================
  // Private - Audio
  // ==========================================

  private playReelStopSound(): void {
    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.playSFX(GameConfig.SOUNDS.REEL_STOP);
    }
  }

  // ==========================================
  // Private - Utility
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
    if (m === 0) {
      return 0;
    }
    return ((v % m) + m) % m;
  }

  private cleanup(): void {
    this.unscheduleAllCallbacks();
    this.stopActiveTween();
    this.enabled = false;
    this.originalPositions.clear();
    this.containerLaps.clear();
    this.containerByRow.clear();
    this.cachedSymbols = [];
    this.cachedSymbolIds = [];
    this.currentSpeed = 0;
    this.isFinalizing = false;

    if (this.reelContainer) {
      this.reelContainer.destroyAllContainers();
    }
  }
}
