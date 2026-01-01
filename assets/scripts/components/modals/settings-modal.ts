import { _decorator, Slider, Toggle } from "cc";
import { AudioManager } from "../../core/audio/audio-manager";
import { BaseModal } from "./base-modal";
const { ccclass, property } = _decorator;

@ccclass("SettingsModal")
export class SettingsModal extends BaseModal {
  @property(Toggle)
  musicToggle: Toggle = null!;

  @property(Slider)
  musicVolumeSlider: Slider = null!;

  @property(Toggle)
  soundToggle: Toggle = null!;

  @property(Slider)
  soundVolumeSlider: Slider = null!;

  protected onLoad(): void {
    super.onLoad();

    if (this.musicToggle) {
      this.musicToggle.node.on("toggle", this.onMusicToggle, this);
    }

    if (this.musicVolumeSlider) {
      this.musicVolumeSlider.node.on("slide", this.onMusicVolumeChange, this);
    }

    if (this.soundToggle) {
      this.soundToggle.node.on("toggle", this.onSoundToggle, this);
    }

    if (this.soundVolumeSlider) {
      this.soundVolumeSlider.node.on("slide", this.onSoundVolumeChange, this);
    }
  }

  protected onDestroy(): void {
    super.onDestroy();

    if (this.musicToggle?.isValid) {
      this.musicToggle.node.off("toggle", this.onMusicToggle, this);
    }

    if (this.musicVolumeSlider?.isValid) {
      this.musicVolumeSlider.node.off("slide", this.onMusicVolumeChange, this);
    }

    if (this.soundToggle?.isValid) {
      this.soundToggle.node.off("toggle", this.onSoundToggle, this);
    }

    if (this.soundVolumeSlider?.isValid) {
      this.soundVolumeSlider.node.off("slide", this.onSoundVolumeChange, this);
    }
  }

  protected onBeforeShow(): void {
    this.loadCurrentSettings();
  }

  private loadCurrentSettings(): void {
    const audioManager = AudioManager.getInstance();
    if (!audioManager) return;

    if (this.musicToggle) {
      this.musicToggle.isChecked = audioManager.isMusicEnabled();
    }

    if (this.soundToggle) {
      this.soundToggle.isChecked = audioManager.isSoundEnabled();
    }

    if (this.musicVolumeSlider) {
      this.musicVolumeSlider.progress = audioManager.getBGMVolume();
    }

    if (this.soundVolumeSlider) {
      this.soundVolumeSlider.progress = audioManager.getSFXVolume();
    }
  }

  private onMusicToggle(toggle: Toggle): void {
    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.setMusicEnabled(toggle.isChecked);
    }
  }

  private onSoundToggle(toggle: Toggle): void {
    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.setSoundEnabled(toggle.isChecked);
    }
  }

  private onSoundVolumeChange(slider: Slider): void {
    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.setSFXVolume(slider.progress);
    }
  }

  private onMusicVolumeChange(slider: Slider): void {
    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.setBGMVolume(slider.progress);
    }
  }
}
