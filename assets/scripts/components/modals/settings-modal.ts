import { _decorator, Slider, Toggle, sys } from "cc";
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

  private onMusicToggle(toggle: Toggle): void {
    const enabled = toggle.isChecked;
    sys.localStorage.setItem("musicEnabled", enabled.toString());

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.setMusicEnabled(enabled);
    }
  }

  private onSoundToggle(toggle: Toggle): void {
    const enabled = toggle.isChecked;
    sys.localStorage.setItem("soundEnabled", enabled.toString());

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.setSoundEnabled(enabled);
    }
  }

  private onSoundVolumeChange(slider: Slider): void {
    const volume = slider.progress;
    sys.localStorage.setItem("soundVolume", volume.toString());

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.setSFXVolume(volume);
    }
  }

  private onMusicVolumeChange(slider: Slider): void {
    const volume = slider.progress;
    sys.localStorage.setItem("musicVolume", volume.toString());

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.setBGMVolume(volume);
    }
  }
}
