import {
  _decorator,
  Component,
  Label,
  math,
  Node,
  Sprite,
  SpriteFrame,
  tween,
  Vec3,
} from "cc";
import { SceneManager } from "../../core/scene-manager/SceneManager";
import {
  AssetBundleManager,
  BundleName,
} from "../../core/asset-manager/AssetBundleManager";

const { ccclass, property } = _decorator;

@ccclass("LoadingScreen")
export class LoadingScreen extends Component {
  @property(Sprite) loadingBarSprite: Sprite = null!;
  @property(Label) progressLabel: Label = null!;
  @property(Label) messageLabel: Label = null!;
  @property(Node) playButton: Node = null!;

  @property smoothingSpeed: number = 0.1;

  private _loadingBarFrames: SpriteFrame[] = [];
  private _targetProgress: number = 0;
  private _visualProgress: number = 0;
  private _onComplete: (() => void) | null = null;
  private _isFinished: boolean = false;

  protected onLoad(): void {
    if (this.playButton) {
      this.playButton.active = false;
      this.playButton.setScale(Vec3.ZERO);
    }
    this.progressLabel.string = "0%";
  }

  protected start() {
    this.initLoadingAnimation().then(() => {
      SceneManager.instance.bootstrapApp();
    });
  }

  private async initLoadingAnimation() {
    const manager = AssetBundleManager.getInstance();

    await manager.loadBundle(BundleName.GAME);

    const frames = await manager.loadDir<SpriteFrame>(
      BundleName.GAME,
      "ui/loading_bar",
      SpriteFrame
    );

    if (frames && frames.length > 0) {
      this._loadingBarFrames = frames.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );
      this.loadingBarSprite.spriteFrame = this._loadingBarFrames[0];
    } else {
    }
  }

  public startLoading(onComplete?: () => void) {
    this._targetProgress = 0;
    this._visualProgress = 0;
    this._isFinished = false;
    this._onComplete = onComplete || null;
  }

  public updateProgress(progress: number) {
    this._targetProgress = math.clamp01(progress);
  }

  public setOnComplete(cb: () => void) {
    this._onComplete = cb;
  }

  protected update(dt: number) {
    if (this._isFinished) return;

    if (
      this._visualProgress < this._targetProgress ||
      this._targetProgress === 1
    ) {
      this._visualProgress = math.lerp(
        this._visualProgress,
        this._targetProgress,
        this.smoothingSpeed
      );

      if (this._targetProgress >= 0.99 && this._visualProgress >= 0.99) {
        this._visualProgress = 1;
        this.syncUI();
        this.onLoadDataFinished();
      } else {
        this.syncUI();
      }
    }
  }

  private syncUI() {
    const percent = Math.floor(this._visualProgress * 100);
    this.progressLabel.string = `${percent}%`;

    if (this._loadingBarFrames.length > 0 && this.loadingBarSprite) {
      const frameIdx = Math.floor(
        this._visualProgress * (this._loadingBarFrames.length - 1)
      );
      const targetFrame =
        this._loadingBarFrames[
          math.clamp(frameIdx, 0, this._loadingBarFrames.length - 1)
        ];

      if (this.loadingBarSprite.spriteFrame !== targetFrame) {
        this.loadingBarSprite.spriteFrame = targetFrame;
      }
    }
  }

  private onLoadDataFinished() {
    this._isFinished = true;
    if (this.playButton) {
      this.messageLabel.string = "READY TO FARM!";
      this.playButtonAnimationShow();
    } else {
      this.onUserClickPlay();
    }
  }

  // ==========================================
  // BUTTON ANIMATIONS
  // ==========================================

  private playButtonAnimationShow() {
    this.playButton.active = true;
    this.playButton.setScale(Vec3.ZERO);

    tween(this.playButton)
      .to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
      .call(() => {
        this.playButtonAnimationPulse();
      })
      .start();
  }

  private playButtonAnimationPulse() {
    tween(this.playButton)
      .to(0.8, { scale: new Vec3(1.1, 1.1, 1) }, { easing: "sineInOut" })
      .to(0.8, { scale: new Vec3(1, 1, 1) }, { easing: "sineInOut" })
      .union()
      .repeatForever()
      .start();
  }

  public onUserClickPlay() {
    const btn = this.playButton.getComponent("cc.Button") as any;
    if (btn) btn.interactable = false;

    tween(this.playButton).stop();

    if (this._onComplete) {
      this._onComplete();
      this._onComplete = null;
    }
  }
}
