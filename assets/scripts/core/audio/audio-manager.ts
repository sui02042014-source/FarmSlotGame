import {
  _decorator,
  Component,
  AudioClip,
  AudioSource,
  math,
  sys,
  game,
} from "cc";
import { AssetBundleManager } from "../assets/asset-bundle-manager";
import { Logger } from "../../utils/helpers/logger";

const { ccclass } = _decorator;

const logger = Logger.create("AudioManager");

// ==========================================
// Constants & Types
// ==========================================

const STORAGE_KEYS = {
  BGM_VOLUME: "audio_bgm_vol",
  SFX_VOLUME: "audio_sfx_vol",
  MUTED: "audio_muted",
  MUSIC_ENABLED: "musicEnabled",
  SOUND_ENABLED: "soundEnabled",
} as const;

const AUDIO_CONSTANTS = {
  BUNDLE: "audio",
  DEFAULT_BGM_VOLUME: 0.5,
  DEFAULT_SFX_VOLUME: 0.8,
} as const;

interface AudioSettings {
  bgmVolume: number;
  sfxVolume: number;
  isMuted: boolean;
  isMusicEnabled: boolean;
  isSoundEnabled: boolean;
}

@ccclass("AudioManager")
export class AudioManager extends Component {
  private static _instance: AudioManager | null = null;

  // Audio Sources
  private _bgmSource!: AudioSource;
  private _sfxSource!: AudioSource;
  private _loopingSfxSource!: AudioSource;

  // Settings
  private _settings: AudioSettings = {
    bgmVolume: AUDIO_CONSTANTS.DEFAULT_BGM_VOLUME,
    sfxVolume: AUDIO_CONSTANTS.DEFAULT_SFX_VOLUME,
    isMuted: false,
    isMusicEnabled: true,
    isSoundEnabled: true,
  };

  // State
  private _currentBGM: string = "";
  private _isLoopingSfxPlaying: boolean = false;

  // Resources
  private _audioCache = new Map<string, AudioClip>();
  private _loadingPromises = new Map<string, Promise<AudioClip | null>>();
  private _assetBundleManager!: AssetBundleManager;

  public static getInstance(): AudioManager | null {
    return this._instance;
  }

  protected onLoad(): void {
    if (AudioManager._instance && AudioManager._instance !== this) {
      logger.warn("Duplicate AudioManager detected, destroying...");
      this.node.destroy();
      return;
    }

    AudioManager._instance = this;
    game.addPersistRootNode(this.node);

    this.init();
  }

  protected onDestroy(): void {
    this.cleanup();

    if (AudioManager._instance === this) {
      AudioManager._instance = null;
    }
  }

  // ==========================================
  // Initialization
  // ==========================================

  private init(): void {
    if (!this.cacheManagers()) {
      logger.error(
        "Failed to initialize AudioManager: AssetBundleManager not available"
      );
      return;
    }

    this.initAudioSources();
    this.loadSettings();
    this.updateVolumes();
  }

  private cacheManagers(): boolean {
    const bundleManager = AssetBundleManager.getInstance();
    if (!bundleManager) {
      logger.error("AssetBundleManager not initialized");
      return false;
    }
    this._assetBundleManager = bundleManager;
    return true;
  }

  private initAudioSources(): void {
    this._bgmSource = this.createAudioSource(true);
    this._sfxSource = this.createAudioSource(false);
    this._loopingSfxSource = this.createAudioSource(true);
  }

  private createAudioSource(loop: boolean): AudioSource {
    const source = this.node.addComponent(AudioSource);
    source.loop = loop;
    return source;
  }

  private loadSettings(): void {
    this._settings = {
      bgmVolume: this.getFromStorage(
        STORAGE_KEYS.BGM_VOLUME,
        AUDIO_CONSTANTS.DEFAULT_BGM_VOLUME
      ),
      sfxVolume: this.getFromStorage(
        STORAGE_KEYS.SFX_VOLUME,
        AUDIO_CONSTANTS.DEFAULT_SFX_VOLUME
      ),
      isMuted: this.getFromStorage(STORAGE_KEYS.MUTED, false),
      isMusicEnabled: this.getFromStorage(STORAGE_KEYS.MUSIC_ENABLED, true),
      isSoundEnabled: this.getFromStorage(STORAGE_KEYS.SOUND_ENABLED, true),
    };
  }

  // ==========================================
  // Public API - BGM
  // ==========================================

  public async playBGM(path: string): Promise<void> {
    if (!this.isAudioSourceValid(this._bgmSource)) return;
    if (!this.canPlayMusic()) return;
    if (this._currentBGM === path && this._bgmSource.playing) return;

    await this.playLoopingAudio(this._bgmSource, path);
    this._currentBGM = path;
  }

  public stopBGM(): void {
    if (!this._bgmSource) return;
    this.stopSource(this._bgmSource, true);
    this._currentBGM = "";
  }

  // ==========================================
  // Public API - SFX
  // ==========================================

  public async playSFX(path: string): Promise<void> {
    if (!this.isAudioSourceValid(this._sfxSource)) return;
    if (!this.canPlaySound()) return;

    const clip = await this.loadClip(path);
    if (!clip) return;

    const volume = this.getEffectiveVolume(this._settings.sfxVolume);
    this._sfxSource.playOneShot(clip, volume);
  }

  // ==========================================
  // Public API - Looping SFX (Spin Sound)
  // ==========================================

  public async playSpinSound(path: string): Promise<void> {
    if (!this.isAudioSourceValid(this._loopingSfxSource)) return;
    if (!this.canPlaySound()) return;
    if (this._isLoopingSfxPlaying && this._loopingSfxSource.playing) return;

    await this.playLoopingAudio(this._loopingSfxSource, path);
    this._isLoopingSfxPlaying = true;
  }

  public stopSpinSound(): void {
    if (!this._loopingSfxSource) return;
    this.stopSource(this._loopingSfxSource, true);
    this._isLoopingSfxPlaying = false;
  }

  // ==========================================
  // Public API - Settings
  // ==========================================

  public setBGMVolume(volume: number): void {
    this._settings.bgmVolume = math.clamp01(volume);
    this.saveToStorage(STORAGE_KEYS.BGM_VOLUME, this._settings.bgmVolume);
    this.updateVolumes();
  }

  public setSFXVolume(volume: number): void {
    this._settings.sfxVolume = math.clamp01(volume);
    this.saveToStorage(STORAGE_KEYS.SFX_VOLUME, this._settings.sfxVolume);
    this.updateVolumes();
  }

  public setMusicEnabled(enabled: boolean): void {
    this._settings.isMusicEnabled = enabled;
    this.saveToStorage(STORAGE_KEYS.MUSIC_ENABLED, enabled);

    if (this._bgmSource) {
      enabled ? this.resumeBGM() : this.pauseBGM();
    }
  }

  public setSoundEnabled(enabled: boolean): void {
    this._settings.isSoundEnabled = enabled;
    this.saveToStorage(STORAGE_KEYS.SOUND_ENABLED, enabled);

    if (!enabled && this._loopingSfxSource) {
      this.stopSpinSound();
    }
  }

  // ==========================================
  // Public API - Getters
  // ==========================================

  public getSettings(): Readonly<AudioSettings> {
    return { ...this._settings };
  }

  // ==========================================
  // Private Helpers - Playback
  // ==========================================

  private isAudioSourceValid(source: AudioSource): boolean {
    return source?.isValid ?? false;
  }

  private canPlayMusic(): boolean {
    return !this._settings.isMuted && this._settings.isMusicEnabled;
  }

  private canPlaySound(): boolean {
    return !this._settings.isMuted && this._settings.isSoundEnabled;
  }

  private getEffectiveVolume(baseVolume: number): number {
    return this._settings.isMuted ? 0 : baseVolume;
  }

  private async playLoopingAudio(
    source: AudioSource,
    path: string
  ): Promise<void> {
    if (!this.isAudioSourceValid(source)) return;

    const clip = await this.loadClip(path);
    if (!clip) return;

    this.stopSource(source, true);
    source.clip = clip;
    source.play();
  }

  private stopSource(source: AudioSource, clearClip: boolean): void {
    if (!this.isAudioSourceValid(source)) return;

    if (source.playing) {
      source.stop();
    }

    if (clearClip) {
      source.clip = null;
    }
  }

  private pauseBGM(): void {
    if (!this._bgmSource) return;
    if (this.isAudioSourceValid(this._bgmSource) && this._bgmSource.playing) {
      this._bgmSource.pause();
    }
  }

  private resumeBGM(): void {
    if (!this._bgmSource) return;
    if (
      this.isAudioSourceValid(this._bgmSource) &&
      this._bgmSource.clip &&
      !this._bgmSource.playing &&
      this.canPlayMusic()
    ) {
      this._bgmSource.play();
    }
  }

  private updateVolumes(): void {
    const muteFactor = this._settings.isMuted ? 0 : 1;

    if (this.isAudioSourceValid(this._bgmSource)) {
      this._bgmSource.volume = this._settings.bgmVolume * muteFactor;
    }
    if (this.isAudioSourceValid(this._sfxSource)) {
      this._sfxSource.volume = this._settings.sfxVolume * muteFactor;
    }
    if (this.isAudioSourceValid(this._loopingSfxSource)) {
      this._loopingSfxSource.volume = this._settings.sfxVolume * muteFactor;
    }
  }

  // ==========================================
  // Private Helpers - Resource Loading
  // ==========================================

  private async loadClip(path: string): Promise<AudioClip | null> {
    if (this._audioCache.has(path)) {
      return this._audioCache.get(path)!;
    }

    if (this._loadingPromises.has(path)) {
      return this._loadingPromises.get(path)!;
    }

    const loadPromise = this.loadClipFromBundle(path);
    this._loadingPromises.set(path, loadPromise);

    return loadPromise;
  }

  private async loadClipFromBundle(path: string): Promise<AudioClip | null> {
    try {
      if (!this._assetBundleManager) {
        logger.error("AssetBundleManager not available");
        return null;
      }

      const clip = await this._assetBundleManager.load(
        AUDIO_CONSTANTS.BUNDLE,
        path,
        AudioClip
      );

      if (clip) {
        this._audioCache.set(path, clip);
        return clip;
      }

      logger.warn(`Failed to load audio clip: ${path}`);
      return null;
    } catch (error) {
      logger.warn(`Exception loading audio: ${path}`, error);
      return null;
    } finally {
      this._loadingPromises.delete(path);
    }
  }

  // ==========================================
  // Private Helpers - Storage
  // ==========================================

  private getFromStorage<T extends number | boolean>(
    key: string,
    defaultValue: T
  ): T {
    const value = sys.localStorage.getItem(key);
    if (value === null) return defaultValue;

    if (typeof defaultValue === "boolean") {
      return (value === "true") as T;
    }
    return parseFloat(value) as T;
  }

  private saveToStorage(key: string, value: number | boolean): void {
    sys.localStorage.setItem(key, value.toString());
  }

  // ==========================================
  // Cleanup
  // ==========================================

  private cleanup(): void {
    if (this._bgmSource) {
      this.stopSource(this._bgmSource, true);
    }
    if (this._sfxSource) {
      this.stopSource(this._sfxSource, false);
    }
    if (this._loopingSfxSource) {
      this.stopSource(this._loopingSfxSource, true);
    }

    this._audioCache.clear();
    this._loadingPromises.clear();

    this._currentBGM = "";
    this._isLoopingSfxPlaying = false;
  }

  // ==========================================
  // Public API - Resource Management
  // ==========================================

  public clearCache(): void {
    this._audioCache.clear();
    this._loadingPromises.clear();
  }

  public getCacheStats(): { cachedClips: number; loadingClips: number } {
    return {
      cachedClips: this._audioCache.size,
      loadingClips: this._loadingPromises.size,
    };
  }
}
