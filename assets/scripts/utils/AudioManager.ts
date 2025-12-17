import { _decorator, Component, AudioClip, AudioSource, resources } from "cc";
const { ccclass } = _decorator;

/**
 * Audio Manager - Quản lý âm thanh toàn bộ game
 * Singleton pattern
 */
@ccclass("AudioManager")
export class AudioManager extends Component {
  private static instance: AudioManager = null!;

  private bgmSource: AudioSource = null!;
  private sfxSource: AudioSource = null!;

  private bgmVolume: number = 0.5;
  private sfxVolume: number = 0.8;
  private isMuted: boolean = false;

  private readonly debugLogs: boolean = false;

  private audioCache: Map<string, AudioClip> = new Map();
  private audioLoading: Map<string, Promise<AudioClip | null>> = new Map();

  public static getInstance(): AudioManager {
    return this.instance;
  }

  protected onLoad(): void {
    if (AudioManager.instance) {
      this.node.destroy();
      return;
    }

    AudioManager.instance = this;

    // Don't destroy on load
    // game.addPersistRootNode(this.node);

    this.initAudioSources();
    this.loadSettings();
  }

  protected onDestroy(): void {
    if (AudioManager.instance === this) {
      AudioManager.instance = null!;
    }
    this.audioCache.clear();
    this.audioLoading.clear();
  }

  /**
   * Initialize audio sources
   */
  private initAudioSources(): void {
    // BGM source
    this.bgmSource = this.node.addComponent(AudioSource);
    this.bgmSource.loop = true;
    this.bgmSource.volume = this.bgmVolume;

    // SFX source
    this.sfxSource = this.node.addComponent(AudioSource);
    this.sfxSource.loop = false;
    this.sfxSource.volume = this.sfxVolume;
  }

  /**
   * Load audio settings
   */
  private loadSettings(): void {
    const savedBgmVolume = localStorage.getItem("bgmVolume");
    if (savedBgmVolume) {
      this.bgmVolume = parseFloat(savedBgmVolume);
    }

    const savedSfxVolume = localStorage.getItem("sfxVolume");
    if (savedSfxVolume) {
      this.sfxVolume = parseFloat(savedSfxVolume);
    }

    const savedMuted = localStorage.getItem("audioMuted");
    if (savedMuted) {
      this.isMuted = savedMuted === "true";
    }

    this.updateVolumes();
  }

  /**
   * Save audio settings
   */
  private saveSettings(): void {
    localStorage.setItem("bgmVolume", this.bgmVolume.toString());
    localStorage.setItem("sfxVolume", this.sfxVolume.toString());
    localStorage.setItem("audioMuted", this.isMuted.toString());
  }

  /**
   * Play BGM
   */
  public playBGM(path: string): void {
    if (this.isMuted) return;

    this.getOrLoadClip(path).then((clip) => {
      if (!clip || this.isMuted) return;
      this.bgmSource.clip = clip;
      this.bgmSource.play();
    });
  }

  /**
   * Stop BGM
   */
  public stopBGM(): void {
    this.bgmSource.stop();
  }

  /**
   * Play SFX (Sound Effect)
   */
  public playSFX(path: string): void {
    if (this.isMuted) return;

    this.getOrLoadClip(path).then((clip) => {
      if (!clip || this.isMuted) return;
      this.sfxSource.playOneShot(clip, this.sfxVolume);
    });
  }

  private getOrLoadClip(path: string): Promise<AudioClip | null> {
    const cached = this.audioCache.get(path);
    if (cached) return Promise.resolve(cached);

    const existing = this.audioLoading.get(path);
    if (existing) return existing;

    const loader = new Promise<AudioClip | null>((resolve) => {
      resources.load(path, AudioClip, (err, clip) => {
        if (err || !clip) {
          if (this.debugLogs) {
            console.error(`Failed to load audio: ${path}`, err);
          }
          resolve(null);
          return;
        }
        this.audioCache.set(path, clip);
        resolve(clip);
      });
    });

    this.audioLoading.set(path, loader);
    loader.then(
      () => this.audioLoading.delete(path),
      () => this.audioLoading.delete(path)
    );
    return loader;
  }

  /**
   * Set BGM volume (0-1)
   */
  public setBGMVolume(volume: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
    this.saveSettings();
  }

  /**
   * Set SFX volume (0-1)
   */
  public setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
    this.saveSettings();
  }

  /**
   * Toggle mute
   */
  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    this.updateVolumes();
    this.saveSettings();

    if (this.isMuted) {
      this.bgmSource.pause();
    } else {
      // Resume only if there is a clip set.
      if (this.bgmSource.clip) this.bgmSource.play();
    }
  }

  /**
   * Update volumes
   */
  private updateVolumes(): void {
    if (this.isMuted) {
      this.bgmSource.volume = 0;
      this.sfxSource.volume = 0;
    } else {
      this.bgmSource.volume = this.bgmVolume;
      this.sfxSource.volume = this.sfxVolume;
    }
  }

  /**
   * Get mute state
   */
  public isMutedState(): boolean {
    return this.isMuted;
  }
}
