import { _decorator, Slider, Toggle } from "cc";
import { AudioManager } from "../../core/audio/audio-manager";
import { BaseModal } from "./base-modal";
import { Logger } from "../../utils/helpers/logger";

const { ccclass, property } = _decorator;

const logger = Logger.create("SettingsModal");

const EVENT_NAMES = {
  TOGGLE: "toggle",
  SLIDE: "slide",
} as const;

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
    this.cacheAudioManager();
    this.setupEventListeners();
  }

  private cacheAudioManager(): void {
    this.audioManager = AudioManager.getInstance();
    if (!this.audioManager) {
      logger.error("AudioManager not available");
    }
  }

  private setupEventListeners(): void {
    this.registerToggleEvent(this.musicToggle, this.onMusicToggle);
    this.registerSliderEvent(this.musicVolumeSlider, this.onMusicVolumeChange);
    this.registerToggleEvent(this.soundToggle, this.onSoundToggle);
    this.registerSliderEvent(this.soundVolumeSlider, this.onSoundVolumeChange);
  }

  private registerToggleEvent(
    toggle: Toggle | null,
    handler: (toggle: Toggle) => void
  ): void {
    if (toggle) {
      toggle.node.on(EVENT_NAMES.TOGGLE, handler, this);
    }
  }

  private registerSliderEvent(
    slider: Slider | null,
    handler: (slider: Slider) => void
  ): void {
    if (slider) {
      slider.node.on(EVENT_NAMES.SLIDE, handler, this);
    }
  }

  protected onDestroy(): void {
    super.onDestroy();
    this.cleanupEventListeners();
  }

  private cleanupEventListeners(): void {
    this.unregisterToggleEvent(this.musicToggle, this.onMusicToggle);
    this.unregisterSliderEvent(
      this.musicVolumeSlider,
      this.onMusicVolumeChange
    );
    this.unregisterToggleEvent(this.soundToggle, this.onSoundToggle);
    this.unregisterSliderEvent(
      this.soundVolumeSlider,
      this.onSoundVolumeChange
    );
  }

  private unregisterToggleEvent(
    toggle: Toggle | null,
    handler: (toggle: Toggle) => void
  ): void {
    if (toggle?.isValid) {
      toggle.node.off(EVENT_NAMES.TOGGLE, handler, this);
    }
  }

  private unregisterSliderEvent(
    slider: Slider | null,
    handler: (slider: Slider) => void
  ): void {
    if (slider?.isValid) {
      slider.node.off(EVENT_NAMES.SLIDE, handler, this);
    }
  }

  // ==========================================
  // Lifecycle
  // ==========================================

  protected onBeforeShow(): void {
    this.loadCurrentSettings();
  }

  // ==========================================
  // Settings Management
  // ==========================================

  private loadCurrentSettings(): void {
    if (!this.audioManager) return;

    const settings = this.audioManager.getSettings();

    this.updateToggle(this.musicToggle, settings.isMusicEnabled);
    this.updateToggle(this.soundToggle, settings.isSoundEnabled);
    this.updateSlider(this.musicVolumeSlider, settings.bgmVolume);
    this.updateSlider(this.soundVolumeSlider, settings.sfxVolume);
  }

  private updateToggle(toggle: Toggle | null, value: boolean): void {
    if (toggle) {
      toggle.isChecked = value;
    }
  }

  private updateSlider(slider: Slider | null, value: number): void {
    if (slider) {
      slider.progress = value;
    }
  }

  // ==========================================
  // Event Handlers
  // ==========================================

  private onMusicToggle(toggle: Toggle): void {
    this.audioManager?.setMusicEnabled(toggle.isChecked);
  }

  private onSoundToggle(toggle: Toggle): void {
    this.audioManager?.setSoundEnabled(toggle.isChecked);
  }

  private onMusicVolumeChange(slider: Slider): void {
    this.audioManager?.setBGMVolume(slider.progress);
  }

  private onSoundVolumeChange(slider: Slider): void {
    this.audioManager?.setSFXVolume(slider.progress);
  }
}
