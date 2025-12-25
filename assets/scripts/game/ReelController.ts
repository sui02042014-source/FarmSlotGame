import {
  _decorator,
  Component,
  Node,
  tween,
  Vec3,
  UIOpacity,
  CCInteger,
  v3,
  Tween,
} from "cc";
import { GameConfig } from "../data/GameConfig";
import { SymbolData } from "../data/SymbolData";
import { ReelContainer, SymbolContainer } from "./ReelContainer";
import { ReelState, ReelStateMachine } from "./ReelStateMachine";

const { ccclass, property } = _decorator;

@ccclass("ReelController")
export class ReelController extends Component {
  @property({ type: CCInteger, tooltip: "Extra symbols for smooth wrapping" })
  private bufferSymbols: number = 2;

  @property({ type: CCInteger, tooltip: "Wrap threshold in symbols" })
  private wrapThreshold: number = 1;

  private reelContainer!: ReelContainer;
  private stateMachine!: ReelStateMachine;

  private readonly symbolSpacing =
    GameConfig.SYMBOL_SIZE + GameConfig.SYMBOL_SPACING;
  private readonly symbolSize = GameConfig.SYMBOL_SIZE;
  private totalSymbols = 0;

  private topBoundary = 0;
  private bottomBoundary = 0;
  private wrapHeight = 0;

  private currentSpeed = 0;
  private targetSpeed = 0;
  private acceleration = 0;
  private isAccelerating = false;

  private targetSymbols: string[] = [];
  private readonly allSymbols = SymbolData.getAllSymbols();

  private stopDeceleration = 0;
  private isStoppingByTarget = false;
  private highlightedContainers: Set<SymbolContainer> = new Set();
  private activeTweens: Tween<Node>[] = [];

  // Track position offsets for smooth infinite scroll
  private positionOffset = 0;
  private previousOffset = 0;
  private wrapCount = 0;

  // ============================================================================
  // Lifecycle
  // ============================================================================

  protected onLoad(): void {
    this.setupDimensions();
    this.setupComponents();
    this.initializeReel();
  }

  protected onDestroy(): void {
    this.stopAllTweens();
    this.reelContainer.clearContainers();
  }

  protected update(dt: number): void {
    if (this.stateMachine.isIdle() || this.stateMachine.isResult()) return;

    this.updateSpeed(dt);

    if (this.currentSpeed > 0) {
      this.updateReelMovement(dt);
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  public spin(targetSymbols: string[], delay = 0): void {
    if (!this.stateMachine.canSpin()) return;

    this.targetSymbols = targetSymbols;
    this.clearHighlight();
    this.resetMovementState();

    delay > 0
      ? this.scheduleOnce(() => this.stateMachine.startSpin(), delay)
      : this.stateMachine.startSpin();
  }

  public async stop(): Promise<void> {
    if (!this.stateMachine.canStop() || this.isStoppingByTarget) return;

    this.isStoppingByTarget = true;
    this.stateMachine.startStopping();
    this.prepareStopByTarget();
  }

  public getVisibleSymbols(): string[] {
    const containers = this.reelContainer.getAllContainers();
    const visible = GameConfig.SYMBOL_PER_REEL;
    const symbols: string[] = new Array(visible);

    // Find the symbol closest to center position (0)
    let closestIndex = 0;
    let closestDistance = Infinity;

    for (let i = 0; i < containers.length; i++) {
      const distance = Math.abs(containers[i].node.position.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    // Get symbols around the center
    const startIndex = closestIndex - Math.floor(visible / 2);
    for (let i = 0; i < visible; i++) {
      const idx = (startIndex + i + containers.length) % containers.length;
      symbols[i] = containers[idx].symbolId;
    }

    return symbols;
  }

  public highlightSymbols(rows: Set<number>): void {
    this.clearHighlight();

    const visibleSymbols = this.getVisibleSymbols();
    const containers = this.reelContainer.getAllContainers();
    const visible = GameConfig.SYMBOL_PER_REEL;

    for (let row = 0; row < visible; row++) {
      if (rows.has(row)) {
        const symbolId = visibleSymbols[row];
        const container = containers.find(
          (c) =>
            c.symbolId === symbolId &&
            Math.abs(c.node.position.y + row * this.symbolSpacing) <
              this.symbolSpacing / 2
        );

        if (container) {
          this.applyHighlight(container);
          this.highlightedContainers.add(container);
        }
      }
    }
  }

  public clearHighlight(): void {
    this.highlightedContainers.forEach((container) => {
      if (container.node?.isValid) {
        this.removeHighlight(container);
      }
    });
    this.highlightedContainers.clear();
  }

  // ============================================================================
  // Setup
  // ============================================================================

  private setupDimensions(): void {
    const visibleHeight = GameConfig.SYMBOL_PER_REEL * this.symbolSpacing;
    this.topBoundary =
      visibleHeight / 2 + this.symbolSpacing * this.bufferSymbols;
    this.bottomBoundary = -this.topBoundary;
    this.wrapHeight = this.topBoundary - this.bottomBoundary;
    this.totalSymbols = GameConfig.SYMBOL_PER_REEL + this.bufferSymbols * 2;
  }

  private setupComponents(): void {
    this.reelContainer =
      this.getComponent(ReelContainer) || this.addComponent(ReelContainer);
    this.stateMachine =
      this.getComponent(ReelStateMachine) ||
      this.addComponent(ReelStateMachine);

    this.stateMachine.initialize({
      onStateEnter: (state) => this.onStateEnter(state),
    });
  }

  private async initializeReel(): Promise<void> {
    const symbols = [...this.allSymbols];
    this.shuffleArray(symbols);

    this.reelContainer.clearContainers();
    this.stopAllTweens();

    const centerIndex = Math.floor(this.totalSymbols / 2);

    for (let i = 0; i < this.totalSymbols; i++) {
      const symbol = symbols[i % symbols.length];
      const container = await this.reelContainer.createSymbolContainer(
        symbol.id,
        this.symbolSize
      );

      if (!container) continue;

      container.node.setParent(this.node);
      const positionY = (centerIndex - i) * this.symbolSpacing;
      container.node.setPosition(0, positionY);
      this.reelContainer.addContainer(container);
    }

    this.sortContainers();
  }

  // ============================================================================
  // State Management
  // ============================================================================

  private onStateEnter(state: ReelState): void {
    switch (state) {
      case ReelState.SPINNING_ACCEL:
        this.startAcceleration();
        break;

      case ReelState.SPINNING_CONST:
        this.startConstantSpin();
        break;

      case ReelState.STOPPING:
        this.startStopping();
        break;

      case ReelState.RESULT:
        this.finalizeStop();
        break;
    }
  }

  private startAcceleration(): void {
    this.currentSpeed = 0;
    const minSpeed = GameConfig.SPIN_SPEED_MIN;
    const maxSpeed = GameConfig.SPIN_SPEED_MAX;
    this.targetSpeed = minSpeed + Math.random() * (maxSpeed - minSpeed);

    // Non-linear acceleration for more natural feel
    this.acceleration = this.targetSpeed / 0.4;
    this.isAccelerating = true;

    this.scheduleOnce(() => {
      if (this.stateMachine.isState(ReelState.SPINNING_ACCEL)) {
        this.stateMachine.startConstantSpin();
      }
    }, 0.4);
  }

  private startConstantSpin(): void {
    this.isAccelerating = false;
    this.acceleration = 0;
  }

  private startStopping(): void {
    this.stopDeceleration = this.currentSpeed;
    // Gentle deceleration curve
    this.acceleration = -(this.currentSpeed / 0.6);
  }

  private finalizeStop(): void {
    this.scheduleOnce(() => {
      // Check again after animations complete
      this.checkTargetSymbolMatch();
      this.isStoppingByTarget = false;
      this.stateMachine.reset();
    }, 0.2);
  }

  // ============================================================================
  // Movement & Wrapping
  // ============================================================================

  private resetMovementState(): void {
    this.positionOffset = 0;
    this.previousOffset = 0;
    this.wrapCount = 0;
  }

  private updateSpeed(dt: number): void {
    if (this.stateMachine.isStopping()) {
      this.currentSpeed += this.acceleration * dt;

      // Ease out at the end
      if (this.currentSpeed < 50) {
        this.currentSpeed = Math.max(0, this.currentSpeed - 100 * dt);
      }

      if (this.currentSpeed <= 0) {
        this.currentSpeed = 0;
        this.acceleration = 0;
        this.snapToFinalPositions();
        this.checkTargetSymbolMatch();
        this.stateMachine.setResult();
      }
    } else if (this.isAccelerating) {
      this.currentSpeed += this.acceleration * dt;
      this.currentSpeed = Math.min(this.currentSpeed, this.targetSpeed);

      // Apply easing at the end of acceleration
      if (this.currentSpeed > this.targetSpeed * 0.8) {
        this.acceleration *= 0.9;
      }
    }
  }

  private updateReelMovement(dt: number): void {
    const deltaY = this.currentSpeed * dt;
    this.positionOffset += deltaY;

    // Check if we need to wrap symbols
    const wrapDelta =
      Math.floor(this.positionOffset / this.symbolSpacing) -
      Math.floor(this.previousOffset / this.symbolSpacing);

    if (Math.abs(wrapDelta) > 0) {
      this.wrapSymbols(wrapDelta);
      this.previousOffset = this.positionOffset;
    }

    // Update all symbol positions based on offset
    this.updateSymbolPositions();
  }

  private updateSymbolPositions(): void {
    const containers = this.reelContainer.getAllContainers();

    for (const container of containers) {
      const baseY = container.node.position.y;
      const wrappedY =
        this.modulo(baseY - this.positionOffset, this.wrapHeight) -
        this.wrapHeight / 2;
      container.node.setPosition(0, wrappedY);
    }
  }

  private wrapSymbols(wrapDelta: number): void {
    const containers = this.reelContainer.getAllContainers();
    this.wrapCount += wrapDelta;

    // Wrap symbols that are out of bounds
    for (const container of containers) {
      const currentY = container.node.position.y;

      // If symbol has wrapped around
      if (Math.abs(wrapDelta) > 0) {
        if (this.stateMachine.isSpinning() && !this.stateMachine.isStopping()) {
          const randomSymbol =
            this.allSymbols[Math.floor(Math.random() * this.allSymbols.length)];
          this.reelContainer.updateSymbolContainer(container, randomSymbol.id);
        }
      }
    }

    this.sortContainers();
  }

  private sortContainers(): void {
    const containers = this.reelContainer.getAllContainers();
    containers.sort((a, b) => b.node.position.y - a.node.position.y);
  }

  // ============================================================================
  // Stop Logic
  // ============================================================================

  private prepareStopByTarget(): void {
    const containers = this.reelContainer.getAllContainers();
    const visible = GameConfig.SYMBOL_PER_REEL;

    // Sort by current Y position
    const sorted = [...containers].sort(
      (a, b) => b.node.position.y - a.node.position.y
    );

    // Apply target symbols to visible positions
    for (let i = 0; i < visible; i++) {
      const idx = Math.floor(sorted.length / 2) - Math.floor(visible / 2) + i;
      if (idx >= 0 && idx < sorted.length && i < this.targetSymbols.length) {
        this.reelContainer.updateSymbolContainer(
          sorted[idx],
          this.targetSymbols[i]
        );
      }
    }
  }

  private snapToFinalPositions(): void {
    const containers = this.reelContainer.getAllContainers();
    const visible = GameConfig.SYMBOL_PER_REEL;

    // Calculate target positions for each symbol
    const targetPositions: Map<SymbolContainer, number> = new Map();

    // Sort containers by current Y position
    const sorted = [...containers].sort(
      (a, b) => b.node.position.y - a.node.position.y
    );

    // Determine center index for alignment
    const centerIndex = Math.floor(sorted.length / 2);

    for (let i = 0; i < sorted.length; i++) {
      const container = sorted[i];
      const offset = i - centerIndex;
      const targetY = -offset * this.symbolSpacing;
      targetPositions.set(container, targetY);
    }

    // Animate to final positions with rubber band effect
    this.stopAllTweens();

    for (const container of containers) {
      const currentY = container.node.position.y;
      const targetY = targetPositions.get(container) || 0;
      const distance = Math.abs(currentY - targetY);

      if (distance > 0.1) {
        // Calculate animation parameters
        const overshoot = Math.min(distance / 100, 0.3);
        const duration = Math.min(0.4 + distance / 200, 0.8);

        const tweenInstance = tween(container.node)
          .to(
            duration * 0.7,
            {
              position: v3(
                0,
                targetY + (currentY > targetY ? overshoot : -overshoot),
                0
              ),
            },
            { easing: "backOut" }
          )
          .to(
            duration * 0.3,
            { position: v3(0, targetY, 0) },
            { easing: "backIn" }
          )
          .start();

        this.activeTweens.push(tweenInstance);
      } else {
        container.node.setPosition(0, targetY);
      }
    }
  }

  // ============================================================================
  // Debug & Validation
  // ============================================================================

  private checkTargetSymbolMatch(): void {
    const visibleSymbols = this.getVisibleSymbols();
    const matches: boolean[] = [];
    const maxLength = Math.max(
      visibleSymbols.length,
      this.targetSymbols.length
    );

    for (let i = 0; i < maxLength; i++) {
      const visible = visibleSymbols[i] || "N/A";
      const target = this.targetSymbols[i] || "N/A";
      const match = visible === target;
      matches.push(match);
    }

    const allMatch = matches.every((m) => m);
    const matchCount = matches.filter((m) => m).length;

    console.log(
      `[ReelController] Target Symbol Match Check:\n` +
        `  Target: [${this.targetSymbols.join(", ")}]\n` +
        `  Visible: [${visibleSymbols.join(", ")}]\n` +
        `  Matches: ${matchCount}/${maxLength} - ${
          allMatch ? "✓ ALL MATCH" : "✗ MISMATCH"
        }`
    );

    if (!allMatch) {
      console.warn(
        `[ReelController] Symbol mismatch detected! Check reel alignment logic.`
      );
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private modulo(value: number, modulus: number): number {
    return ((value % modulus) + modulus) % modulus;
  }

  private stopAllTweens(): void {
    this.activeTweens.forEach((tween) => {
      if (tween && typeof tween.stop === "function") {
        tween.stop();
      }
    });
    this.activeTweens = [];
  }

  private applyHighlight(container: SymbolContainer): void {
    if (!container.node?.isValid) return;

    const originalScale = container.node.scale.clone();

    tween(container.node)
      .repeatForever(
        tween(container.node)
          .to(0.3, { scale: v3(1.2, 1.2, 1) }, { easing: "sineOut" })
          .to(0.3, { scale: v3(1.1, 1.1, 1) }, { easing: "sineIn" })
      )
      .start();

    // Add glow effect with UIOpacity
    let uiOpacity = container.node.getComponent(UIOpacity);
    if (!uiOpacity) {
      uiOpacity = container.node.addComponent(UIOpacity);
      uiOpacity.opacity = 255;
    }
  }

  private removeHighlight(container: SymbolContainer): void {
    if (!container.node?.isValid) return;

    tween(container.node).stop();

    const uiOpacity = container.node.getComponent(UIOpacity);
    if (uiOpacity) {
      uiOpacity.destroy();
    }

    // Return to original scale
    tween(container.node)
      .to(0.2, { scale: v3(1, 1, 1) }, { easing: "sineIn" })
      .start();
  }

  private shuffleArray<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
