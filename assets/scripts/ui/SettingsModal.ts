import { _decorator, Label, Toggle, Slider } from "cc";
import { BaseModal } from "./BaseModal";
import { AudioManager } from "../utils/AudioManager";
const { ccclass, property } = _decorator;

/**
 * Settings Modal - Hiển thị cài đặt game
 */
@ccclass("SettingsModal")
export class SettingsModal extends BaseModal {
  @property(Toggle)
  soundToggle: Toggle = null!;

  @property(Toggle)
  musicToggle: Toggle = null!;

  @property(Slider)
  soundVolumeSlider: Slider = null!;

  @property(Slider)
  musicVolumeSlider: Slider = null!;

  @property(Label)
  versionLabel: Label = null!;

  protected onLoad(): void {
    super.onLoad();

    // Setup toggle listeners
    if (this.soundToggle) {
      this.soundToggle.node.on("toggle", this.onSoundToggle, this);
    }

    if (this.musicToggle) {
      this.musicToggle.node.on("toggle", this.onMusicToggle, this);
    }

    // Setup slider listeners
    if (this.soundVolumeSlider) {
      this.soundVolumeSlider.node.on("slide", this.onSoundVolumeChange, this);
    }

    if (this.musicVolumeSlider) {
      this.musicVolumeSlider.node.on("slide", this.onMusicVolumeChange, this);
    }
  }

  protected onDestroy(): void {
    super.onDestroy();

    if (this.soundToggle) {
      this.soundToggle.node.off("toggle", this.onSoundToggle, this);
    }

    if (this.musicToggle) {
      this.musicToggle.node.off("toggle", this.onMusicToggle, this);
    }

    if (this.soundVolumeSlider) {
      this.soundVolumeSlider.node.off("slide", this.onSoundVolumeChange, this);
    }

    if (this.musicVolumeSlider) {
      this.musicVolumeSlider.node.off("slide", this.onMusicVolumeChange, this);
    }
  }

  protected onBeforeShow(): void {
    super.onBeforeShow();
    this.loadSettings();
  }

  /**
   * Load current settings
   */
  private loadSettings(): void {
    const audioManager = AudioManager.getInstance();
    if (!audioManager) return;

    // Load sound settings
    if (this.soundToggle) {
      const soundEnabled = localStorage.getItem("soundEnabled") !== "false";
      this.soundToggle.isChecked = soundEnabled;
    }

    if (this.musicToggle) {
      const musicEnabled = localStorage.getItem("musicEnabled") !== "false";
      this.musicToggle.isChecked = musicEnabled;
    }

    if (this.soundVolumeSlider) {
      const soundVolume = parseFloat(
        localStorage.getItem("soundVolume") || "1.0"
      );
      this.soundVolumeSlider.progress = soundVolume;
    }

    if (this.musicVolumeSlider) {
      const musicVolume = parseFloat(
        localStorage.getItem("musicVolume") || "1.0"
      );
      this.musicVolumeSlider.progress = musicVolume;
    }

    // Set version
    if (this.versionLabel) {
      this.versionLabel.string = "Version 1.0.0";
    }
  }

  /**
   * Called when sound toggle changes
   */
  private onSoundToggle(toggle: Toggle): void {
    const enabled = toggle.isChecked;
    localStorage.setItem("soundEnabled", enabled.toString());

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      // audioManager.setSoundEnabled(enabled);
    }

    console.log(`[SettingsModal] Sound ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Called when music toggle changes
   */
  private onMusicToggle(toggle: Toggle): void {
    const enabled = toggle.isChecked;
    localStorage.setItem("musicEnabled", enabled.toString());

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      // audioManager.setMusicEnabled(enabled);
    }

    console.log(`[SettingsModal] Music ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Called when sound volume slider changes
   */
  private onSoundVolumeChange(slider: Slider): void {
    const volume = slider.progress;
    localStorage.setItem("soundVolume", volume.toString());

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      // audioManager.setSoundVolume(volume);
    }

    console.log(`[SettingsModal] Sound volume: ${volume.toFixed(2)}`);
  }

  /**
   * Called when music volume slider changes
   */
  private onMusicVolumeChange(slider: Slider): void {
    const volume = slider.progress;
    localStorage.setItem("musicVolume", volume.toString());

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      // audioManager.setMusicVolume(volume);
    }

    console.log(`[SettingsModal] Music volume: ${volume.toFixed(2)}`);
  }

  /**
   * Called when Reset button is clicked
   */
  public onResetClick(): void {
    console.log("[SettingsModal] Reset clicked");
    // Reset to defaults
    localStorage.removeItem("soundEnabled");
    localStorage.removeItem("musicEnabled");
    localStorage.removeItem("soundVolume");
    localStorage.removeItem("musicVolume");
    this.loadSettings();
  }

  /**
   * Called when Privacy Policy button is clicked
   */
  public onPrivacyPolicyClick(): void {
    console.log("[SettingsModal] Privacy Policy clicked");
    // TODO: Open privacy policy URL
  }

  /**
   * Called when Terms button is clicked
   */
  public onTermsClick(): void {
    console.log("[SettingsModal] Terms clicked");
    // TODO: Open terms URL
  }
}
