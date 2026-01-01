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

const { ccclass } = _decorator;

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

const AUDIO_BUNDLE = "audio";
const DEFAULT_BGM_VOLUME = 0.5;
const DEFAULT_SFX_VOLUME = 0.8;

enum AudioType {
  BGM = "bgm",
  SFX = "sfx",
  SPIN = "spin",
}

interface AudioSettings {
  bgmVolume: number;
  sfxVolume: number;
  isMuted: boolean;
  isMusicEnabled: boolean;
  isSoundEnabled: boolean;
}

// ==========================================
// AudioManager Class
// ==========================================

@ccclass("AudioManager")
export class AudioManager extends Component {
  private static _instance: AudioManager | null = null;

  // Audio Sources
  private _bgmSource!: AudioSource;
  private _sfxSource!: AudioSource;
  private _spinSource!: AudioSource;

  // Settings State
  private _settings: AudioSettings = {
    bgmVolume: DEFAULT_BGM_VOLUME,
    sfxVolume: DEFAULT_SFX_VOLUME,
    isMuted: false,
    isMusicEnabled: true,
    isSoundEnabled: true,
  };

  // Playback State
  private _currentBGM: string = "";
  private _isSpinPlaying: boolean = false;

  // Resource Management
  private _audioCache = new Map<string, AudioClip>();
  private _loadingPromises = new Map<string, Promise<AudioClip | null>>();

  // ==========================================
  // Singleton
  // ==========================================

  public static getInstance(): AudioManager | null {
    return this._instance;
  }

  // ==========================================
  // Lifecycle
  // ==========================================

  protected onLoad(): void {
    if (AudioManager._instance) {
      this.cleanup();
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
    this.initAudioSources();
    this.loadSettings();
    this.applySettings();
  }

  private initAudioSources(): void {
    // BGM Source
    this._bgmSource = this.node.addComponent(AudioSource);
    this._bgmSource.loop = true;

    // SFX Source
    this._sfxSource = this.node.addComponent(AudioSource);
    this._sfxSource.loop = false;

    // Spin Source (looping effect)
    this._spinSource = this.node.addComponent(AudioSource);
    this._spinSource.loop = true;
  }

  private loadSettings(): void {
    this._settings = {
      bgmVolume: this.getStoredNumber(
        STORAGE_KEYS.BGM_VOLUME,
        DEFAULT_BGM_VOLUME
      ),
      sfxVolume: this.getStoredNumber(
        STORAGE_KEYS.SFX_VOLUME,
        DEFAULT_SFX_VOLUME
      ),
      isMuted: this.getStoredBoolean(STORAGE_KEYS.MUTED, false),
      isMusicEnabled: this.getStoredBoolean(STORAGE_KEYS.MUSIC_ENABLED, true),
      isSoundEnabled: this.getStoredBoolean(STORAGE_KEYS.SOUND_ENABLED, true),
    };
  }

  private applySettings(): void {
    this.updateVolumes();
  }

  // ==========================================
  // Public API - BGM
  // ==========================================

  public async playBGM(path: string): Promise<void> {
    // Skip if same BGM is already playing
    if (this._currentBGM === path && this._bgmSource.playing) {
      return;
    }

    // Check if music is enabled
    if (!this.canPlayMusic()) {
      return;
    }

    const clip = await this.loadClip(path);
    if (!clip) return;

    this.stopAudioSource(this._bgmSource, AudioType.BGM);
    this._bgmSource.clip = clip;
    this._bgmSource.play();
    this._currentBGM = path;
  }

  public stopBGM(): void {
    this.stopAudioSource(this._bgmSource, AudioType.BGM);
    this._currentBGM = "";
  }

  public pauseBGM(): void {
    if (this._bgmSource.playing) {
      this._bgmSource.pause();
    }
  }

  public resumeBGM(): void {
    if (
      this._bgmSource.clip &&
      !this._bgmSource.playing &&
      this.canPlayMusic()
    ) {
      this._bgmSource.play();
    }
  }

  // ==========================================
  // Public API - SFX
  // ==========================================

  public async playSFX(path: string): Promise<void> {
    if (!this.canPlaySound()) return;

    const clip = await this.loadClip(path);
    if (clip) {
      this._sfxSource.playOneShot(clip, this._settings.sfxVolume);
    }
  }

  // ==========================================
  // Public API - Spin Sound
  // ==========================================

  public async playSpinSound(path: string): Promise<void> {
    // Prevent duplicate plays
    if (this._isSpinPlaying && this._spinSource.playing) {
      return;
    }

    if (!this.canPlaySound()) return;

    const clip = await this.loadClip(path);
    if (!clip) return;

    this._spinSource.clip = clip;
    this._spinSource.play();
    this._isSpinPlaying = true;
  }

  public stopSpinSound(): void {
    this.stopAudioSource(this._spinSource, AudioType.SPIN);
    this._isSpinPlaying = false;
  }

  // ==========================================
  // Public API - Settings
  // ==========================================

  public setBGMVolume(volume: number): void {
    this._settings.bgmVolume = math.clamp01(volume);
    this.updateVolumes();
    this.saveToStorage(STORAGE_KEYS.BGM_VOLUME, this._settings.bgmVolume);
  }

  public setSFXVolume(volume: number): void {
    this._settings.sfxVolume = math.clamp01(volume);
    this.updateVolumes();
    this.saveToStorage(STORAGE_KEYS.SFX_VOLUME, this._settings.sfxVolume);
  }

  public toggleMute(): void {
    this._settings.isMuted = !this._settings.isMuted;
    this.saveToStorage(STORAGE_KEYS.MUTED, this._settings.isMuted);

    if (this._settings.isMuted) {
      this.pauseBGM();
      this.stopSpinSound();
    } else {
      this.resumeBGM();
    }

    this.updateVolumes();
  }

  public setMusicEnabled(enabled: boolean): void {
    this._settings.isMusicEnabled = enabled;
    this.saveToStorage(STORAGE_KEYS.MUSIC_ENABLED, enabled);

    if (enabled) {
      this.resumeBGM();
    } else {
      this.pauseBGM();
    }
  }

  public setSoundEnabled(enabled: boolean): void {
    this._settings.isSoundEnabled = enabled;
    this.saveToStorage(STORAGE_KEYS.SOUND_ENABLED, enabled);

    if (!enabled) {
      this.stopSpinSound();
    }
  }

  // ==========================================
  // Public API - Getters
  // ==========================================

  public getBGMVolume(): number {
    return this._settings.bgmVolume;
  }

  public getSFXVolume(): number {
    return this._settings.sfxVolume;
  }

  public isMuted(): boolean {
    return this._settings.isMuted;
  }

  public isMusicEnabled(): boolean {
    return this._settings.isMusicEnabled;
  }

  public isSoundEnabled(): boolean {
    return this._settings.isSoundEnabled;
  }

  // ==========================================
  // Private Helpers - Playback
  // ==========================================

  private canPlayMusic(): boolean {
    return !this._settings.isMuted && this._settings.isMusicEnabled;
  }

  private canPlaySound(): boolean {
    return !this._settings.isMuted && this._settings.isSoundEnabled;
  }

  private stopAudioSource(source: AudioSource, type: AudioType): void {
    if (!source?.isValid) return;

    if (source.playing) {
      source.stop();
    }

    // Clear clip for looping sources to prevent auto-replay
    if (type !== AudioType.SFX) {
      source.clip = null;
    }
  }

  private updateVolumes(): void {
    const muteFactor = this._settings.isMuted ? 0 : 1;

    this._bgmSource.volume = this._settings.bgmVolume * muteFactor;
    this._sfxSource.volume = this._settings.sfxVolume * muteFactor;
    this._spinSource.volume = this._settings.sfxVolume * muteFactor;
  }

  // ==========================================
  // Private Helpers - Resource Loading
  // ==========================================

  private async loadClip(path: string): Promise<AudioClip | null> {
    // Return cached clip
    if (this._audioCache.has(path)) {
      return this._audioCache.get(path)!;
    }

    // Return ongoing load promise
    if (this._loadingPromises.has(path)) {
      return this._loadingPromises.get(path)!;
    }

    // Start new load
    const loadPromise = this.loadClipFromBundle(path);
    this._loadingPromises.set(path, loadPromise);

    return loadPromise;
  }

  private async loadClipFromBundle(path: string): Promise<AudioClip | null> {
    try {
      const bundleManager = AssetBundleManager.getInstance();
      const clip = await bundleManager.load(AUDIO_BUNDLE, path, AudioClip);

      if (clip) {
        this._audioCache.set(path, clip);
        return clip;
      } else {
        // Don't cache null results - allow retry on next attempt
        console.warn(`[AudioManager] Failed to load audio clip: ${path}`);
        return null;
      }
    } catch (error) {
      console.warn(`[AudioManager] Exception loading audio: ${path}`, error);
      // Don't cache error results - allow retry
      return null;
    } finally {
      this._loadingPromises.delete(path);
    }
  }

  // ==========================================
  // Private Helpers - Storage
  // ==========================================

  private getStoredNumber(key: string, defaultValue: number): number {
    const value = sys.localStorage.getItem(key);
    return value ? parseFloat(value) : defaultValue;
  }

  private getStoredBoolean(key: string, defaultValue: boolean): boolean {
    const value = sys.localStorage.getItem(key);
    return value === null ? defaultValue : value === "true";
  }

  private saveToStorage(key: string, value: number | boolean): void {
    sys.localStorage.setItem(key, value.toString());
  }

  // ==========================================
  // Cleanup
  // ==========================================

  private cleanup(): void {
    // Stop all audio sources
    this.stopAudioSource(this._bgmSource, AudioType.BGM);
    this.stopAudioSource(this._sfxSource, AudioType.SFX);
    this.stopAudioSource(this._spinSource, AudioType.SPIN);

    // Clear resources
    this._audioCache.clear();
    this._loadingPromises.clear();

    // Reset state
    this._currentBGM = "";
    this._isSpinPlaying = false;
  }

  // ==========================================
  // Public API - Resource Management
  // ==========================================

  /**
   * Clear all cached audio clips to free memory
   */
  public clearCache(): void {
    this._audioCache.clear();
    this._loadingPromises.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { cachedClips: number; loadingClips: number } {
    return {
      cachedClips: this._audioCache.size,
      loadingClips: this._loadingPromises.size,
    };
  }
}
