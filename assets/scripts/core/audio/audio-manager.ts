import { _decorator, Component, AudioClip, AudioSource, math, sys } from "cc";
import { AssetBundleManager } from "../assets/asset-bundle-manager";

const { ccclass } = _decorator;

const AUDIO_STORAGE_KEYS = {
  BGM_VOLUME: "audio_bgm_vol",
  SFX_VOLUME: "audio_sfx_vol",
  MUTED: "audio_muted",
};

const BUNDLE_NAME = "audio";

@ccclass("AudioManager")
export class AudioManager extends Component {
  private static _instance: AudioManager = null!;

  private _bgmSource: AudioSource = null!;
  private _sfxSource: AudioSource = null!;
  private _spinSource: AudioSource = null!;

  private _bgmVolume: number = 0.5;
  private _sfxVolume: number = 0.8;
  private _isMuted: boolean = false;
  private _isMusicEnabled: boolean = true;
  private _isSoundEnabled: boolean = true;

  private readonly _audioCache = new Map<string, AudioClip>();
  private readonly _loadingPromises = new Map<
    string,
    Promise<AudioClip | null>
  >();

  public static getInstance(): AudioManager {
    return this._instance;
  }

  protected onLoad(): void {
    if (AudioManager._instance) {
      this.node.destroy();
      return;
    }
    AudioManager._instance = this;

    this.initAudioSources();
    this.loadSettings();
    this.updateVolumes();
  }

  private initAudioSources(): void {
    this._bgmSource = this.node.addComponent(AudioSource);
    this._bgmSource.loop = true;

    this._sfxSource = this.node.addComponent(AudioSource);
    this._sfxSource.loop = false;

    this._spinSource = this.node.addComponent(AudioSource);
    this._spinSource.loop = true;
  }

  private loadSettings(): void {
    this._bgmVolume = parseFloat(
      sys.localStorage.getItem(AUDIO_STORAGE_KEYS.BGM_VOLUME) ?? "0.5"
    );
    this._sfxVolume = parseFloat(
      sys.localStorage.getItem(AUDIO_STORAGE_KEYS.SFX_VOLUME) ?? "0.8"
    );
    this._isMuted =
      sys.localStorage.getItem(AUDIO_STORAGE_KEYS.MUTED) === "true";
    this._isMusicEnabled = sys.localStorage.getItem("musicEnabled") !== "false";
    this._isSoundEnabled = sys.localStorage.getItem("soundEnabled") !== "false";
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  public async playBGM(path: string): Promise<void> {
    const clip = await this.getOrLoadClip(path);
    if (!clip || this._isMuted || !this._isMusicEnabled) return;

    this._bgmSource.clip = clip;
    this._bgmSource.play();
  }

  public stopBGM(): void {
    this._bgmSource.stop();
  }

  public async playSFX(path: string): Promise<void> {
    if (this._isMuted || !this._isSoundEnabled) return;
    const clip = await this.getOrLoadClip(path);
    if (clip) {
      this._sfxSource.playOneShot(clip, this._sfxVolume);
    }
  }

  public async playSpinSound(path: string): Promise<void> {
    if (this._isMuted || !this._isSoundEnabled) return;
    const clip = await this.getOrLoadClip(path);
    if (clip) {
      this._spinSource.clip = clip;
      this._spinSource.play();
    }
  }

  public stopSpinSound(): void {
    this._spinSource.stop();
  }

  // ==========================================
  // VOLUME CONTROL
  // ==========================================

  public setBGMVolume(volume: number): void {
    this._bgmVolume = math.clamp01(volume);
    this.updateVolumes();
    sys.localStorage.setItem(
      AUDIO_STORAGE_KEYS.BGM_VOLUME,
      this._bgmVolume.toString()
    );
  }

  public setSFXVolume(volume: number): void {
    this._sfxVolume = math.clamp01(volume);
    this.updateVolumes();
    sys.localStorage.setItem(
      AUDIO_STORAGE_KEYS.SFX_VOLUME,
      this._sfxVolume.toString()
    );
  }

  public toggleMute(): void {
    this._isMuted = !this._isMuted;
    this.updateVolumes();
    sys.localStorage.setItem(
      AUDIO_STORAGE_KEYS.MUTED,
      this._isMuted.toString()
    );

    if (this._isMuted) {
      this._bgmSource.pause();
      this._spinSource.pause();
    } else if (this._bgmSource.clip) {
      this._bgmSource.play();
    }
  }

  public setMusicEnabled(enabled: boolean): void {
    this._isMusicEnabled = enabled;
    sys.localStorage.setItem("musicEnabled", enabled.toString());

    if (enabled) {
      if (this._bgmSource.clip && !this._bgmSource.playing && !this._isMuted) {
        this._bgmSource.play();
      }
    } else {
      this._bgmSource.pause();
    }
  }

  public setSoundEnabled(enabled: boolean): void {
    this._isSoundEnabled = enabled;
    sys.localStorage.setItem("soundEnabled", enabled.toString());

    if (!enabled && this._spinSource.playing) {
      this._spinSource.stop();
    }
  }

  public getBGMVolume(): number {
    return this._bgmVolume;
  }

  public getSFXVolume(): number {
    return this._sfxVolume;
  }

  public isMusicEnabled(): boolean {
    return this._isMusicEnabled;
  }

  public isSoundEnabled(): boolean {
    return this._isSoundEnabled;
  }

  private updateVolumes(): void {
    const muteFactor = this._isMuted ? 0 : 1;
    this._bgmSource.volume = this._bgmVolume * muteFactor;
    this._sfxSource.volume = this._sfxVolume * muteFactor;
    this._spinSource.volume = this._sfxVolume * muteFactor;
  }

  // ==========================================
  // INTERNAL LOADING
  // ==========================================

  private async getOrLoadClip(path: string): Promise<AudioClip | null> {
    if (this._audioCache.has(path)) {
      return this._audioCache.get(path)!;
    }

    if (this._loadingPromises.has(path)) {
      return this._loadingPromises.get(path)!;
    }

    const loadPromise = (async () => {
      try {
        const bundleManager = AssetBundleManager.getInstance();
        const clip = await bundleManager.load(BUNDLE_NAME, path, AudioClip);

        if (clip) {
          this._audioCache.set(path, clip);
        }
        return clip;
      } catch (err) {
        return null;
      } finally {
        this._loadingPromises.delete(path);
      }
    })();

    this._loadingPromises.set(path, loadPromise);
    return loadPromise;
  }

  public get isMuted(): boolean {
    return this._isMuted;
  }

  protected onDestroy(): void {
    if (AudioManager._instance === this) {
      AudioManager._instance = null!;
    }
    this._audioCache.clear();
    this._loadingPromises.clear();
  }
}
