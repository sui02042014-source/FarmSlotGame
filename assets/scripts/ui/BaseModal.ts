import {
  _decorator,
  Component,
  Node,
  UIOpacity,
  tween,
  Vec3,
  Button,
  UITransform,
} from "cc";
const { ccclass, property } = _decorator;

@ccclass("BaseModal")
export class BaseModal extends Component {
  @property(Node)
  background: Node = null!; // Background overlay (dimmed)

  @property(Node)
  modalContent: Node = null!; // Modal content container

  @property(Node)
  closeButton: Node = null!; // Close button (X)

  @property
  enableBackgroundClose: boolean = true; // Click background to close

  @property
  animationDuration: number = 0.3; // Animation duration

  @property
  enableAnimation: boolean = true; // Enable show/hide animation

  protected modalData: any = {}; // Data passed to modal
  protected closeCallback: (() => void) | null = null;
  private readonly debugLogs: boolean = false;
  private isClosing: boolean = false;
  private boundCloseBtn: boolean = false;
  private boundBackground: boolean = false;

  protected onLoad(): void {
    // Setup close button
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

    // Setup background click to close
    if (this.background && this.enableBackgroundClose) {
      const button = this.background.getComponent(Button);
      if (!button) {
        this.background.addComponent(Button);
      }
      this.background.on(Button.EventType.CLICK, this.onBackgroundClick, this);
      this.boundBackground = true;
    }

    // Initial state - hidden
    this.node.active = false;
  }

  protected onDestroy(): void {
    // Defensive: during node destruction, event processor may already be disposed.
    try {
      if (this.boundCloseBtn && this.closeButton?.isValid) {
        this.closeButton.off(
          Button.EventType.CLICK,
          this.onCloseButtonClick,
          this
        );
      }
    } catch (e) {
      // ignore
    }

    try {
      if (this.boundBackground && this.background?.isValid) {
        this.background.off(
          Button.EventType.CLICK,
          this.onBackgroundClick,
          this
        );
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * Set modal data
   */
  public setData(data: any): void {
    this.modalData = data;
    this.onDataSet(data);
  }

  /**
   * Show modal
   */
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

  /**
   * Hide modal
   */
  public hide(): void {
    if (this.isClosing) return;
    this.isClosing = true;

    // Prevent scheduled callbacks (e.g. WinModal auto-close) from firing again.
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

  /**
   * Play show animation
   */
  protected playShowAnimation(callback?: () => void): void {
    // Fade in background
    if (this.background) {
      const bgOpacity = this.background.getComponent(UIOpacity);
      if (!bgOpacity) {
        this.background.addComponent(UIOpacity);
      }
      const opacity = this.background.getComponent(UIOpacity)!;
      opacity.opacity = 0;

      tween(opacity).to(this.animationDuration, { opacity: 200 }).start();
    }

    // Scale up modal content
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

  /**
   * Play hide animation
   */
  protected playHideAnimation(callback?: () => void): void {
    // Fade out background
    if (this.background) {
      const opacity = this.background.getComponent(UIOpacity);
      if (opacity) {
        tween(opacity)
          .to(this.animationDuration * 0.5, { opacity: 0 })
          .start();
      }
    }

    // Scale down modal content
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

  /**
   * Called when close button is clicked
   */
  protected onCloseButtonClick(): void {
    this.hide();
  }

  /**
   * Called when background is clicked
   */
  protected onBackgroundClick(): void {
    if (this.enableBackgroundClose) {
      this.hide();
    }
  }

  // Lifecycle hooks for derived classes
  protected onDataSet(data: any): void {
    // Override in derived classes
  }

  protected onBeforeShow(): void {
    // Override in derived classes
  }

  protected onAfterShow(): void {
    // Override in derived classes
  }

  protected onBeforeHide(): void {
    // Override in derived classes
  }

  protected onAfterHide(): void {
    // Override in derived classes
  }
}
