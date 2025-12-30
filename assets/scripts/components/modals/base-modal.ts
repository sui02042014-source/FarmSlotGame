import {
  _decorator,
  Button,
  Component,
  Node,
  tween,
  UIOpacity,
  Vec3,
  BlockInputEvents,
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

  @property({
    tooltip: "Nếu bật, modal sẽ chặn mọi tương tác chuột/touch xuống phía dưới",
  })
  blockInputUnderneath: boolean = true;

  protected modalData: any = {};
  protected closeCallback: (() => void) | null = null;
  private isClosing: boolean = false;

  protected onLoad(): void {
    if (this.blockInputUnderneath) {
      if (!this.getComponent(BlockInputEvents)) {
        this.addComponent(BlockInputEvents);
      }
    }

    // 2. Setup Close Button
    if (this.closeButton) {
      this.closeButton.on(
        Button.EventType.CLICK,
        this.onCloseButtonClick,
        this
      );
    }

    // 3. Setup Background Click
    if (this.background && this.enableBackgroundClose) {
      let button = this.background.getComponent(Button);
      if (!button) {
        button = this.background.addComponent(Button);
        button.transition = Button.Transition.NONE;
      }
      this.background.on(Button.EventType.CLICK, this.onBackgroundClick, this);
    }

    this.node.active = false;
  }

  protected onDestroy(): void {
    if (this.closeButton?.isValid) {
      this.closeButton.off(
        Button.EventType.CLICK,
        this.onCloseButtonClick,
        this
      );
    }

    if (this.background?.isValid) {
      this.background.off(Button.EventType.CLICK, this.onBackgroundClick, this);
    }
  }

  // --- Public API ---

  public setData(data: any): void {
    this.modalData = data;
    this.onDataSet(data);
  }

  public show(closeCallback?: () => void): void {
    if (this.isClosing) return;

    this.closeCallback = closeCallback || null;
    this.isClosing = false;
    this.node.active = true;

    this.onBeforeShow();

    if (this.enableAnimation) {
      this.playShowAnimation(() => this.onAfterShow());
    } else {
      this.onAfterShow();
    }
  }

  public hide(): void {
    if (this.isClosing || !this.node.active) return;
    this.isClosing = true;

    this.unscheduleAllCallbacks();
    this.onBeforeHide();

    const finishHide = () => {
      this.node.active = false;
      this.isClosing = false;
      this.onAfterHide();

      if (this.closeCallback) {
        this.closeCallback();
        this.closeCallback = null;
      }
    };

    if (this.enableAnimation) {
      this.playHideAnimation(finishHide);
    } else {
      finishHide();
    }
  }

  // --- Animation Logic ---

  protected playShowAnimation(callback?: () => void): void {
    if (this.background) {
      const opacity =
        this.background.getComponent(UIOpacity) ||
        this.background.addComponent(UIOpacity);
      opacity.opacity = 0;
      tween(opacity).to(this.animationDuration, { opacity: 200 }).start();
    }

    // Animation cho nội dung (Scale Up + Back Out)
    if (this.modalContent) {
      this.modalContent.setScale(new Vec3(0.5, 0.5, 1));
      tween(this.modalContent)
        .to(
          this.animationDuration,
          { scale: new Vec3(1, 1, 1) },
          { easing: "backOut" }
        )
        .call(() => callback?.())
        .start();
    } else {
      callback?.();
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
        .call(() => callback?.())
        .start();
    } else {
      callback?.();
    }
  }

  // --- Event Handlers ---

  protected onCloseButtonClick(): void {
    this.hide();
  }

  protected onBackgroundClick(): void {
    if (this.enableBackgroundClose) this.hide();
  }

  protected onDataSet(data: any): void {}
  protected onBeforeShow(): void {}
  protected onAfterShow(): void {}
  protected onBeforeHide(): void {}
  protected onAfterHide(): void {}
}
