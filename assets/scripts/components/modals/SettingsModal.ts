import { _decorator, Label, Toggle, Slider } from "cc";
import { BaseModal } from "./BaseModal";
import { AudioManager } from "../../core/audio/AudioManager";
import { GameManager } from "../../core/game-manager/GameManager";
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

  @property(Toggle)
  pauseToggle: Toggle = null!;

  private didModalPauseGame: boolean = false;

  protected onLoad(): void {
    super.onLoad();

    if (this.musicToggle) {
      this.musicToggle.node.on("toggle", this.onMusicToggle, this);
    }

    if (this.musicVolumeSlider) {
      this.musicVolumeSlider.node.on("slide", this.onMusicVolumeChange, this);
    }

    // Setup Sound Controls
    if (this.soundToggle) {
      this.soundToggle.node.on("toggle", this.onSoundToggle, this);
    }

    if (this.soundVolumeSlider) {
      this.soundVolumeSlider.node.on("slide", this.onSoundVolumeChange, this);
    }

    // Setup Pause Controls
    if (this.pauseToggle) {
      this.pauseToggle.node.on("toggle", this.onPauseToggle, this);
    }
  }

  protected onDestroy(): void {
    super.onDestroy();

    // Cleanup Music Controls
    if (this.musicToggle?.isValid) {
      this.musicToggle.node.off("toggle", this.onMusicToggle, this);
    }

    if (this.musicVolumeSlider?.isValid) {
      this.musicVolumeSlider.node.off("slide", this.onMusicVolumeChange, this);
    }

    // Cleanup Sound Controls
    if (this.soundToggle?.isValid) {
      this.soundToggle.node.off("toggle", this.onSoundToggle, this);
    }

    if (this.soundVolumeSlider?.isValid) {
      this.soundVolumeSlider.node.off("slide", this.onSoundVolumeChange, this);
    }

    // Cleanup Pause Controls
    if (this.pauseToggle?.isValid) {
      this.pauseToggle.node.off("toggle", this.onPauseToggle, this);
    }
  }

  protected onBeforeShow(): void {
    super.onBeforeShow();
    this.loadSettings();

    // Reset flag
    this.didModalPauseGame = false;

    const pauseEnabled = localStorage.getItem("pauseEnabled") !== "false";
    if (pauseEnabled) {
      const gameManager = GameManager.getInstance();
      if (gameManager && !gameManager.isGamePaused()) {
        gameManager.pauseGame();
        this.didModalPauseGame = true;
      }
    }
  }

  protected onAfterHide(): void {
    super.onAfterHide();

    // Only resume if modal was the one who paused the game
    const gameManager = GameManager.getInstance();
    if (gameManager && this.didModalPauseGame && gameManager.isGamePaused()) {
      gameManager.resumeGame();
    }

    // Reset flag
    this.didModalPauseGame = false;
  }

  private loadSettings(): void {
    const audioManager = AudioManager.getInstance();
    if (!audioManager) return;

    // Load Music Settings
    if (this.musicToggle) {
      const musicEnabled = localStorage.getItem("musicEnabled") !== "false";
      this.musicToggle.isChecked = musicEnabled;
    }

    if (this.musicVolumeSlider) {
      const musicVolume = parseFloat(
        localStorage.getItem("musicVolume") || "1.0"
      );
      this.musicVolumeSlider.progress = musicVolume;
    }

    // Load Sound Settings
    if (this.soundToggle) {
      const soundEnabled = localStorage.getItem("soundEnabled") !== "false";
      this.soundToggle.isChecked = soundEnabled;
    }

    if (this.soundVolumeSlider) {
      const soundVolume = parseFloat(
        localStorage.getItem("soundVolume") || "1.0"
      );
      this.soundVolumeSlider.progress = soundVolume;
    }

    // Load Pause Settings
    if (this.pauseToggle) {
      const pauseEnabled = localStorage.getItem("pauseEnabled") !== "false";
      this.pauseToggle.isChecked = pauseEnabled;
    }
  }

  private onMusicToggle(toggle: Toggle): void {
    const enabled = toggle.isChecked;
    localStorage.setItem("musicEnabled", enabled.toString());

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.setMusicEnabled(enabled);
    }

    console.log(`[SettingsModal] Music ${enabled ? "enabled" : "disabled"}`);
  }

  private onSoundToggle(toggle: Toggle): void {
    const enabled = toggle.isChecked;
    localStorage.setItem("soundEnabled", enabled.toString());

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.setSoundEnabled(enabled);
    }

    console.log(`[SettingsModal] Sound ${enabled ? "enabled" : "disabled"}`);
  }

  private onPauseToggle(toggle: Toggle): void {
    const enabled = toggle.isChecked;
    localStorage.setItem("pauseEnabled", enabled.toString());

    this.didModalPauseGame = false;

    const gameManager = GameManager.getInstance();
    if (gameManager) {
      if (enabled) {
        gameManager.pauseGame();
      } else {
        gameManager.resumeGame();
      }
    }

    console.log(`[SettingsModal] Pause ${enabled ? "enabled" : "disabled"}`);
  }

  private onSoundVolumeChange(slider: Slider): void {
    const volume = slider.progress;
    localStorage.setItem("soundVolume", volume.toString());

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.setSFXVolume(volume);
    }

    console.log(`[SettingsModal] Sound volume: ${volume.toFixed(2)}`);
  }

  private onMusicVolumeChange(slider: Slider): void {
    const volume = slider.progress;
    localStorage.setItem("musicVolume", volume.toString());

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.setBGMVolume(volume);
    }

    console.log(`[SettingsModal] Music volume: ${volume.toFixed(2)}`);
  }
}
