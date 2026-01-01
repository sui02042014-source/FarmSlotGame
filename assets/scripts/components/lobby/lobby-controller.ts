import { _decorator, Button, Component, Node, sys, tween, Vec3 } from "cc";
import { AudioManager } from "../../core/audio/audio-manager";
import { SceneManager } from "../../core/scenes/scene-manager";

const { ccclass, property } = _decorator;

@ccclass("LobbyController")
export class LobbyController extends Component {
  @property(Node)
  playButton: Node = null!;

  @property(Node)
  settingsButton: Node = null!;

  @property(Node)
  quitButton: Node = null!;

  @property(Node)
  logoNode: Node = null!;

  // ==========================================
  // Lifecycle Methods
  // ==========================================

  protected onLoad(): void {
    this.setupButtons();
    this.initAudio();
  }

  protected onDestroy(): void {
    this.cleanupButtons();
  }

  // ==========================================
  // Initialization
  // ==========================================

  private setupButtons(): void {
    if (this.playButton) {
      this.playButton.on(Button.EventType.CLICK, this.onPlayButtonClick, this);
      this.setupButtonAnimation(this.playButton);
    }

    if (this.settingsButton) {
      this.settingsButton.on(
        Button.EventType.CLICK,
        this.onSettingsButtonClick,
        this
      );
      this.setupButtonAnimation(this.settingsButton);
    }

    if (this.quitButton) {
      this.quitButton.on(Button.EventType.CLICK, this.onQuitButtonClick, this);
      this.setupButtonAnimation(this.quitButton);
    }
  }

  private cleanupButtons(): void {
    if (this.playButton?.isValid) {
      this.playButton.off(Button.EventType.CLICK, this.onPlayButtonClick, this);
    }
    if (this.settingsButton?.isValid) {
      this.settingsButton.off(
        Button.EventType.CLICK,
        this.onSettingsButtonClick,
        this
      );
    }
    if (this.quitButton?.isValid) {
      this.quitButton.off(Button.EventType.CLICK, this.onQuitButtonClick, this);
    }
  }

  private async initAudio(): Promise<void> {
    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      await audioManager.playBGM("lobby_bgm").catch(() => {});
    }
  }

  // ==========================================
  // Animations
  // ==========================================

  private setupButtonAnimation(button: Node): void {
    button.on(
      Node.EventType.TOUCH_START,
      () => {
        tween(button)
          .to(0.1, { scale: new Vec3(0.9, 0.9, 1) })
          .start();
      },
      this
    );

    button.on(
      Node.EventType.TOUCH_END,
      () => {
        tween(button)
          .to(0.1, { scale: new Vec3(1, 1, 1) })
          .start();
      },
      this
    );

    button.on(
      Node.EventType.TOUCH_CANCEL,
      () => {
        tween(button)
          .to(0.1, { scale: new Vec3(1, 1, 1) })
          .start();
      },
      this
    );
  }

  // ==========================================
  // Button Handlers
  // ==========================================

  private onPlayButtonClick(): void {
    if (this.playButton) {
      tween(this.playButton).stop();
    }

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.playSFX("button_click");
    }

    this.animateOutAndTransition();
  }

  private onSettingsButtonClick(): void {
    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.playSFX("button_click");
    }

    // TODO: Show settings modal
  }

  private onQuitButtonClick(): void {
    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.playSFX("button_click");
    }

    if (!sys.isBrowser) {
      // On native platforms, could implement exit logic here
    }
  }

  // ==========================================
  // Scene Transition
  // ==========================================

  private animateOutAndTransition(): void {
    const buttons = [this.playButton, this.settingsButton, this.quitButton];

    buttons.forEach((btn) => {
      if (btn) {
        const buttonComp = btn.getComponent(Button);
        if (buttonComp) {
          buttonComp.interactable = false;
        }
      }
    });

    buttons.forEach((btn, index) => {
      if (btn) {
        tween(btn)
          .delay(index * 0.05)
          .to(0.3, { scale: Vec3.ZERO }, { easing: "backIn" })
          .start();
      }
    });

    if (this.logoNode) {
      tween(this.logoNode)
        .delay(0.1)
        .to(0.4, { scale: Vec3.ZERO }, { easing: "backIn" })
        .start();
    }

    this.scheduleOnce(() => {
      SceneManager.instance.loadGameSceneFromLobby();
    }, 0.5);
  }
}
