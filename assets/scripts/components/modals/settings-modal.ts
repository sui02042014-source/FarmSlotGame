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

  private audioManager: AudioManager | null = null;

  protected onLoad(): void {
    super.onLoad();

    this.audioManager = AudioManager.getInstance();

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
    if (!this.audioManager) return;

    const settings = this.audioManager.getSettings();

    if (this.musicToggle) {
      this.musicToggle.isChecked = settings.isMusicEnabled;
    }

    if (this.soundToggle) {
      this.soundToggle.isChecked = settings.isSoundEnabled;
    }

    if (this.musicVolumeSlider) {
      this.musicVolumeSlider.progress = settings.bgmVolume;
    }

    if (this.soundVolumeSlider) {
      this.soundVolumeSlider.progress = settings.sfxVolume;
    }
  }

  private onMusicToggle(toggle: Toggle): void {
    this.audioManager?.setMusicEnabled(toggle.isChecked);
  }

  private onSoundToggle(toggle: Toggle): void {
    this.audioManager?.setSoundEnabled(toggle.isChecked);
  }

  private onSoundVolumeChange(slider: Slider): void {
    this.audioManager?.setSFXVolume(slider.progress);
  }

  private onMusicVolumeChange(slider: Slider): void {
    this.audioManager?.setBGMVolume(slider.progress);
  }
}
