import { _decorator, Component, Label, math, Sprite, SpriteFrame } from "cc";
import {
  AssetBundleManager,
  BundleName,
} from "../../core/assets/asset-bundle-manager";
import { SceneManager } from "../../core/scenes/scene-manager";
import { Logger } from "../../utils/helpers/logger";

const { ccclass, property } = _decorator;

const logger = Logger.create("LoadingScreen");

const LOADING_CONSTANTS = {
  INITIAL_PROGRESS: "0%",
  READY_MESSAGE: "READY TO FARM!",
  LOADING_BAR_PATH: "ui/loading_bar",
  PROGRESS_THRESHOLD: 0.99,
  PROGRESS_COMPLETE: 1,
  PROGRESS_MIN: 0,
  PERCENT_MULTIPLIER: 100,
} as const;

@ccclass("LoadingScreen")
export class LoadingScreen extends Component {
  @property(Sprite) loadingBarSprite: Sprite = null!;
  @property(Label) progressLabel: Label = null!;
  @property(Label) messageLabel: Label = null!;

  @property smoothingSpeed: number = 0.1;
  @property autoTransitionDelay: number = 0.5;

  private loadingBarFrames: SpriteFrame[] = [];
  private targetProgress: number = 0;
  private visualProgress: number = 0;
  private onComplete: (() => void) | null = null;
  private isFinished: boolean = false;
  private bundleManager: AssetBundleManager | null = null;

  protected onLoad(): void {
    this.cacheManagers();
    this.initializeUI();
  }

  protected start() {
    SceneManager.instance.bootstrapApp();

    this.initLoadingAnimation().catch((error) => {
      logger.error("Failed to load loading bar animation:", error);
    });
  }

  private cacheManagers(): void {
    this.bundleManager = AssetBundleManager.getInstance();
  }

  private initializeUI(): void {
    this.progressLabel.string = LOADING_CONSTANTS.INITIAL_PROGRESS;
  }

  // ==========================================
  // Loading Animation Setup
  // ==========================================

  private async initLoadingAnimation(): Promise<void> {
    if (!this.bundleManager) {
      logger.error("AssetBundleManager not available");
      return;
    }

    try {
      await this.bundleManager.loadBundle(BundleName.GAME);
      await this.loadLoadingBarFrames();
    } catch (error) {
      logger.warn("Loading bar animation unavailable, using text only:", error);
    }
  }

  private async loadLoadingBarFrames(): Promise<void> {
    if (!this.bundleManager) return;

    const frames = await this.bundleManager.loadDir<SpriteFrame>(
      BundleName.GAME,
      LOADING_CONSTANTS.LOADING_BAR_PATH,
      SpriteFrame
    );

    if (frames && frames.length > 0) {
      this.loadingBarFrames = this.sortFrames(frames);
      this.setInitialFrame();
    } else {
      logger.warn("No loading bar frames found");
    }
  }

  private sortFrames(frames: SpriteFrame[]): SpriteFrame[] {
    return frames.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
  }

  private setInitialFrame(): void {
    if (this.loadingBarFrames.length > 0 && this.loadingBarSprite) {
      this.loadingBarSprite.spriteFrame = this.loadingBarFrames[0];
    }
  }

  // ==========================================
  // Public API
  // ==========================================

  public startLoading(onComplete?: () => void): void {
    this.targetProgress = LOADING_CONSTANTS.PROGRESS_MIN;
    this.visualProgress = LOADING_CONSTANTS.PROGRESS_MIN;
    this.isFinished = false;
    this.onComplete = onComplete || null;
  }

  public updateProgress(progress: number): void {
    this.targetProgress = math.clamp01(progress);
  }

  public setOnComplete(cb: () => void): void {
    this.onComplete = cb;
  }

  public showError(message: string): void {
    if (this.messageLabel?.isValid) {
      this.messageLabel.string = message;
      logger.error(message);
    }
  }

  // ==========================================
  // Update Loop
  // ==========================================

  protected update(dt: number): void {
    if (this.isFinished) return;

    if (this.shouldUpdateProgress()) {
      this.updateVisualProgress();
      this.syncUI();

      if (this.isProgressComplete()) {
        this.handleLoadComplete();
      }
    }
  }

  private shouldUpdateProgress(): boolean {
    return (
      this.visualProgress < this.targetProgress ||
      this.targetProgress === LOADING_CONSTANTS.PROGRESS_COMPLETE
    );
  }

  private updateVisualProgress(): void {
    this.visualProgress = math.lerp(
      this.visualProgress,
      this.targetProgress,
      this.smoothingSpeed
    );
  }

  private isProgressComplete(): boolean {
    return (
      this.targetProgress >= LOADING_CONSTANTS.PROGRESS_THRESHOLD &&
      this.visualProgress >= LOADING_CONSTANTS.PROGRESS_THRESHOLD
    );
  }

  private handleLoadComplete(): void {
    this.visualProgress = LOADING_CONSTANTS.PROGRESS_COMPLETE;
    this.syncUI();
    this.onLoadDataFinished();
  }

  // ==========================================
  // UI Sync
  // ==========================================

  private syncUI(): void {
    this.updateProgressLabel();
    this.updateLoadingBarFrame();
  }

  private updateProgressLabel(): void {
    const percent = Math.floor(
      this.visualProgress * LOADING_CONSTANTS.PERCENT_MULTIPLIER
    );
    this.progressLabel.string = `${percent}%`;
  }

  private updateLoadingBarFrame(): void {
    if (this.loadingBarFrames.length === 0 || !this.loadingBarSprite) return;

    const targetFrame = this.getFrameAtProgress();
    if (targetFrame && this.loadingBarSprite.spriteFrame !== targetFrame) {
      this.loadingBarSprite.spriteFrame = targetFrame;
    }
  }

  private getFrameAtProgress(): SpriteFrame | null {
    const maxIndex = this.loadingBarFrames.length - 1;
    const frameIdx = Math.floor(this.visualProgress * maxIndex);
    const clampedIdx = math.clamp(frameIdx, 0, maxIndex);
    return this.loadingBarFrames[clampedIdx] || null;
  }

  // ==========================================
  // Load Complete
  // ==========================================

  private onLoadDataFinished(): void {
    this.isFinished = true;
    this.messageLabel.string = LOADING_CONSTANTS.READY_MESSAGE;
    this.scheduleAutoTransition();
  }

  private scheduleAutoTransition(): void {
    this.scheduleOnce(() => {
      this.executeCompleteCallback();
    }, this.autoTransitionDelay);
  }

  private executeCompleteCallback(): void {
    if (this.onComplete) {
      this.onComplete();
      this.onComplete = null;
    }
  }
}
