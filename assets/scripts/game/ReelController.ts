import { _decorator, Component, Node, tween, Vec3 } from "cc";
import { GameConfig } from "../data/GameConfig";
import { SymbolData } from "../data/SymbolData";
import { ReelContainer, SymbolContainer } from "./ReelContainer";
import { ReelState, ReelStateMachine } from "./ReelStateMachine";

const { ccclass } = _decorator;

@ccclass("ReelController")
export class ReelController extends Component {
  private reelContainer!: ReelContainer;
  private stateMachine!: ReelStateMachine;

  private readonly symbolSpacing =
    GameConfig.SYMBOL_SIZE + GameConfig.SYMBOL_SPACING;
  private readonly symbolSize = GameConfig.SYMBOL_SIZE;
  private readonly minSymbolCount = 5;

  private bottomThreshold = 0;

  private currentSpeed = 0;
  private targetSpeed = 0;
  private acceleration = 0;

  private targetSymbols: string[] = [];
  private readonly allSymbols = SymbolData.getAllSymbols();

  private stopDeceleration = 0;
  private isStoppingByTarget = false;

  // ============================================================================
  // Lifecycle
  // ============================================================================

  protected onLoad(): void {
    this.setupThresholds();
    this.setupComponents();
    this.initializeSymbols();
  }

  protected onDestroy(): void {
    this.reelContainer.clearContainers();
  }

  protected update(dt: number): void {
    if (this.stateMachine.isIdle() || this.stateMachine.isResult()) return;

    this.updateSpeed(dt);
    this.updateSymbolPositions(dt);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  public spin(targetSymbols: string[], delay = 0): void {
    if (!this.stateMachine.canSpin()) return;

    this.targetSymbols = targetSymbols;

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

  // ============================================================================
  // Setup
  // ============================================================================

  private setupThresholds(): void {
    const halfVisible = (GameConfig.SYMBOL_PER_REEL * this.symbolSpacing) / 2;
    this.bottomThreshold = -halfVisible - this.symbolSpacing;
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

  private async initializeSymbols(): Promise<void> {
    const shuffled = this.shuffleArray([...SymbolData.getAllSymbols()]);
    const count = Math.max(this.minSymbolCount, GameConfig.SYMBOL_PER_REEL + 2);

    const topY = ((GameConfig.SYMBOL_PER_REEL - 1) / 2) * this.symbolSpacing;

    this.reelContainer.clearContainers();

    for (let i = 0; i < count; i++) {
      const c = await this.reelContainer.createSymbolContainer(
        shuffled[i % shuffled.length].id,
        this.symbolSize
      );
      if (!c) continue;

      c.node.setParent(this.node);
      c.node.setPosition(0, topY - i * this.symbolSpacing);
      this.reelContainer.addContainer(c);
    }
  }

  // ============================================================================
  // State
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
        this.scheduleOnce(() => {
          this.isStoppingByTarget = false;
          this.stateMachine.reset();
        }, 0.1);
        break;
    }
  }

  private startAcceleration(): void {
    this.currentSpeed = 0;
    const minSpeed = GameConfig.SPIN_SPEED_MIN;
    const maxSpeed = GameConfig.SPIN_SPEED_MAX;
    this.targetSpeed = minSpeed + Math.random() * (maxSpeed - minSpeed);
    this.acceleration = this.targetSpeed / 0.3;

    this.scheduleOnce(() => {
      if (this.stateMachine.isState(ReelState.SPINNING_ACCEL)) {
        this.stateMachine.startConstantSpin();
      }
    }, 0.3);
  }

  private startConstantSpin(): void {
    this.currentSpeed = this.targetSpeed;
    this.acceleration = 0;
  }

  private startStopping(): void {
    this.stopDeceleration = this.currentSpeed;
    this.acceleration = -this.stopDeceleration;
  }

  // ============================================================================
  // Update
  // ============================================================================

  private updateSpeed(dt: number): void {
    if (this.stateMachine.isStopping()) {
      this.currentSpeed += this.acceleration * dt;

      if (this.currentSpeed <= 0) {
        this.currentSpeed = 0;
        this.acceleration = 0;
        this.snapFinal();
        this.stateMachine.setResult();
      }
      return;
    }

    if (this.acceleration !== 0) {
      this.currentSpeed += this.acceleration * dt;
      this.currentSpeed = Math.min(this.currentSpeed, this.targetSpeed);
    }
  }

  private updateSymbolPositions(dt: number): void {
    if (this.currentSpeed <= 0) return;

    const move = this.currentSpeed * dt;

    for (const c of this.reelContainer.getAllContainers()) {
      const y = c.node.position.y - move;
      c.node.setPosition(0, y);

      if (y < this.bottomThreshold) {
        this.handleInfiniteScroll(c);
      }
    }
  }

  // ============================================================================
  // Stop logic
  // ============================================================================

  private prepareStopByTarget(): void {
    const sorted = this.reelContainer.getSortedContainers();
    const visible = GameConfig.SYMBOL_PER_REEL;
    const centerIndex = Math.floor((sorted.length - visible) / 2);

    for (let i = 0; i < visible; i++) {
      this.reelContainer.updateSymbolContainer(
        sorted[centerIndex + i],
        this.targetSymbols[i]
      );
    }
  }

  private snapFinal(): void {
    const sorted = this.reelContainer.getSortedContainers();
    const visible = GameConfig.SYMBOL_PER_REEL;
    const centerIndex = Math.floor((sorted.length - visible) / 2);
    const middleVisibleIndex = centerIndex + Math.floor((visible - 1) / 2);
    const centerY = 0;

    for (let i = 0; i < sorted.length; i++) {
      const container = sorted[i];
      const offset = i - middleVisibleIndex;
      const targetY = centerY - offset * this.symbolSpacing;
      const currentY = container.node.position.y;
      const distance = Math.abs(currentY - targetY);

      if (distance > 0.05) {
        const duration = Math.min(0.5 + distance / 120, 0.8);
        tween(container.node)
          .to(
            duration,
            { position: new Vec3(0, targetY, container.node.position.z) },
            { easing: "quartOut" }
          )
          .start();
      } else {
        container.node.setPosition(0, targetY);
      }
    }
  }

  // ============================================================================
  // Infinite scroll
  // ============================================================================

  private handleInfiniteScroll(container: SymbolContainer): void {
    let highest = -Infinity;

    for (const c of this.reelContainer.getAllContainers()) {
      if (c !== container) {
        highest = Math.max(highest, c.node.position.y);
      }
    }

    container.node.setPosition(0, highest + this.symbolSpacing);

    this.reelContainer.updateSymbolContainer(
      container,
      this.allSymbols[Math.floor(Math.random() * this.allSymbols.length)].id
    );
  }

  // ============================================================================
  // Utils
  // ============================================================================

  private shuffleArray<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
