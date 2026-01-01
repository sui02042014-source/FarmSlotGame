import { _decorator, Button, Component, Node, tween, Vec3 } from "cc";
import { AudioManager } from "../../core/audio/audio-manager";
import { SceneManager } from "../../core/scenes/scene-manager";
import {
  AssetBundleManager,
  BundleName,
} from "../../core/assets/asset-bundle-manager";
import { ModalManager } from "../modals/modal-manager";

const { ccclass, property } = _decorator;

const BUTTON_SCALE_DURATION = 0.1;
const BUTTON_SCALE_DOWN = 0.9;
const BUTTON_STAGGER_DELAY = 0.05;
const BUTTON_ANIM_DURATION = 0.3;
const LOGO_ANIM_DELAY = 0.1;
const LOGO_ANIM_DURATION = 0.4;
const TRANSITION_DELAY = 0.5;
const SFX_BUTTON_CLICK = "button_click";
const BGM_LOBBY = "lobby_bgm";

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

  protected onLoad(): void {
    this.initializeButtons();
  }

  protected start(): void {
    this.initializeAudio();
  }

  protected onDestroy(): void {
    this.cleanup();
  }

  private initializeButtons(): void {
    this.setupButton(this.playButton, this.onPlayButtonClick);
    this.setupButton(this.settingsButton, this.onSettingsButtonClick);
    this.setupButton(this.quitButton, this.onQuitButtonClick);
  }

  private setupButton(button: Node, clickHandler: () => void): void {
    if (!button) return;

    button.on(Button.EventType.CLICK, clickHandler, this);
    this.addButtonAnimation(button);
  }

  private addButtonAnimation(button: Node): void {
    button.on(
      Node.EventType.TOUCH_START,
      () => this.scaleButton(button, BUTTON_SCALE_DOWN),
      this
    );
    button.on(
      Node.EventType.TOUCH_END,
      () => this.scaleButton(button, 1),
      this
    );
    button.on(
      Node.EventType.TOUCH_CANCEL,
      () => this.scaleButton(button, 1),
      this
    );
  }

  private scaleButton(button: Node, scale: number): void {
    tween(button)
      .to(BUTTON_SCALE_DURATION, { scale: new Vec3(scale, scale, 1) })
      .start();
  }

  private cleanup(): void {
    this.removeButtonListeners(this.playButton, this.onPlayButtonClick);
    this.removeButtonListeners(this.settingsButton, this.onSettingsButtonClick);
    this.removeButtonListeners(this.quitButton, this.onQuitButtonClick);
  }

  private removeButtonListeners(button: Node, clickHandler: () => void): void {
    if (!button?.isValid) return;

    button.off(Button.EventType.CLICK, clickHandler, this);
    button.off(Node.EventType.TOUCH_START);
    button.off(Node.EventType.TOUCH_END);
    button.off(Node.EventType.TOUCH_CANCEL);
  }

  private async initializeAudio(): Promise<void> {
    try {
      await this.loadAudioBundle();
      await this.playLobbyMusic();
    } catch (error) {}
  }

  private async loadAudioBundle(): Promise<void> {
    const bundleManager = AssetBundleManager.getInstance();
    await bundleManager.loadBundle(BundleName.AUDIO);
  }

  private async playLobbyMusic(): Promise<void> {
    const audioManager = AudioManager.getInstance();
    if (audioManager && audioManager.isMusicEnabled()) {
      await audioManager.playBGM(BGM_LOBBY);
    }
  }

  private playSFX(soundName: string): void {
    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.playSFX(soundName).catch(() => {});
    }
  }

  private onPlayButtonClick(): void {
    if (this.playButton) {
      tween(this.playButton).stop();
    }

    this.playSFX(SFX_BUTTON_CLICK);
    this.transitionToGameScene();
  }

  private onSettingsButtonClick(): void {
    this.playSFX(SFX_BUTTON_CLICK);
    this.openSettingsModal();
  }

  private onQuitButtonClick(): void {
    this.playSFX(SFX_BUTTON_CLICK);
  }

  private openSettingsModal(): void {
    const modalManager = ModalManager.getInstance();
    if (modalManager) {
      modalManager.showSettingsModal();
    }
  }

  private transitionToGameScene(): void {
    this.disableAllButtons();
    this.animateButtonsOut();
    this.animateLogoOut();
    this.scheduleSceneTransition();
  }

  private disableAllButtons(): void {
    const buttons = [this.playButton, this.settingsButton, this.quitButton];
    buttons.forEach((btn) => this.disableButton(btn));
  }

  private disableButton(button: Node): void {
    if (!button) return;

    const buttonComp = button.getComponent(Button);
    if (buttonComp) {
      buttonComp.interactable = false;
    }
  }

  private animateButtonsOut(): void {
    const buttons = [this.playButton, this.settingsButton, this.quitButton];
    buttons.forEach((btn, index) => {
      if (btn) {
        tween(btn)
          .delay(index * BUTTON_STAGGER_DELAY)
          .to(BUTTON_ANIM_DURATION, { scale: Vec3.ZERO }, { easing: "backIn" })
          .start();
      }
    });
  }

  private animateLogoOut(): void {
    if (!this.logoNode) return;

    tween(this.logoNode)
      .delay(LOGO_ANIM_DELAY)
      .to(LOGO_ANIM_DURATION, { scale: Vec3.ZERO }, { easing: "backIn" })
      .start();
  }

  private scheduleSceneTransition(): void {
    this.scheduleOnce(() => {
      SceneManager.instance.loadGameSceneFromLobby();
    }, TRANSITION_DELAY);
  }
}
