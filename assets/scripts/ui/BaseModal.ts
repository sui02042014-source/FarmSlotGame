import {
  _decorator,
  Button,
  Component,
  Node,
  tween,
  UIOpacity,
  Vec3,
} from "cc";
const { ccclass, property } = _decorator;

@ccclass("BaseModal")
export class BaseModal extends Component {
  @property(Node)
  background: Node = null!;

  @property(Node)
  modalContent: Node = null!;

  @property(Node)
  closeButton: Node = null!;

  @property
  enableBackgroundClose: boolean = true;

  @property
  animationDuration: number = 0.3;

  @property
  enableAnimation: boolean = true;

  protected modalData: any = {};
  protected closeCallback: (() => void) | null = null;
  private readonly debugLogs: boolean = false;
  private isClosing: boolean = false;
  private boundCloseBtn: boolean = false;
  private boundBackground: boolean = false;

  protected onLoad(): void {
    if (this.closeButton) {
      const button = this.closeButton.getComponent(Button);
      if (button) {
        this.closeButton.on(
          Button.EventType.CLICK,
          this.onCloseButtonClick,
          this
        );
        this.boundCloseBtn = true;
      }
    }

    if (this.background && this.enableBackgroundClose) {
      const button = this.background.getComponent(Button);
      if (!button) {
        this.background.addComponent(Button);
      }
      this.background.on(Button.EventType.CLICK, this.onBackgroundClick, this);
      this.boundBackground = true;
    }

    this.node.active = false;
  }

  protected onDestroy(): void {
    try {
      if (this.boundCloseBtn && this.closeButton?.isValid) {
        this.closeButton.off(
          Button.EventType.CLICK,
          this.onCloseButtonClick,
          this
        );
      }
    } catch (e) {}

    try {
      if (this.boundBackground && this.background?.isValid) {
        this.background.off(
          Button.EventType.CLICK,
          this.onBackgroundClick,
          this
        );
      }
    } catch (e) {}
  }

  public setData(data: any): void {
    this.modalData = data;
    this.onDataSet(data);
  }

  public show(closeCallback?: () => void): void {
    if (closeCallback) {
      this.closeCallback = closeCallback;
    }

    this.isClosing = false;
    this.node.active = true;
    this.onBeforeShow();

    if (this.enableAnimation) {
      this.playShowAnimation(() => {
        this.onAfterShow();
      });
    } else {
      this.onAfterShow();
    }

    if (this.debugLogs)
      console.log(`[BaseModal] Showing modal: ${this.node.name}`);
  }

  public hide(): void {
    if (this.isClosing) return;
    this.isClosing = true;

    this.unscheduleAllCallbacks();

    this.onBeforeHide();

    if (this.enableAnimation) {
      this.playHideAnimation(() => {
        if (!this.node?.isValid) return;
        this.node.active = false;
        this.onAfterHide();
        const cb = this.closeCallback;
        this.closeCallback = null;
        if (cb) cb();
      });
    } else {
      if (!this.node?.isValid) return;
      this.node.active = false;
      this.onAfterHide();
      const cb = this.closeCallback;
      this.closeCallback = null;
      if (cb) cb();
    }

    if (this.debugLogs)
      console.log(`[BaseModal] Hiding modal: ${this.node.name}`);
  }

  protected playShowAnimation(callback?: () => void): void {
    if (this.background) {
      const bgOpacity = this.background.getComponent(UIOpacity);
      if (!bgOpacity) {
        this.background.addComponent(UIOpacity);
      }
      const opacity = this.background.getComponent(UIOpacity)!;
      opacity.opacity = 0;

      tween(opacity).to(this.animationDuration, { opacity: 200 }).start();
    }

    if (this.modalContent) {
      this.modalContent.setScale(new Vec3(0.5, 0.5, 1));

      tween(this.modalContent)
        .to(
          this.animationDuration,
          { scale: new Vec3(1, 1, 1) },
          { easing: "backOut" }
        )
        .call(() => {
          if (callback) callback();
        })
        .start();
    } else if (callback) {
      callback();
    }
  }

  protected playHideAnimation(callback?: () => void): void {
    if (this.background) {
      const opacity = this.background.getComponent(UIOpacity);
      if (opacity) {
        tween(opacity)
          .to(this.animationDuration * 0.5, { opacity: 0 })
          .start();
      }
    }

    if (this.modalContent) {
      tween(this.modalContent)
        .to(
          this.animationDuration * 0.5,
          { scale: new Vec3(0.5, 0.5, 1) },
          { easing: "backIn" }
        )
        .call(() => {
          if (callback) callback();
        })
        .start();
    } else if (callback) {
      callback();
    }
  }

  protected onCloseButtonClick(): void {
    this.hide();
  }

  protected onBackgroundClick(): void {
    if (this.enableBackgroundClose) {
      this.hide();
    }
  }

  protected onDataSet(data: any): void {}

  protected onBeforeShow(): void {}

  protected onAfterShow(): void {}

  protected onBeforeHide(): void {}

  protected onAfterHide(): void {}
}
