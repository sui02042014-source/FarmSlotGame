import { _decorator, Component, AudioClip, AudioSource } from "cc";
import { AssetBundleManager } from "./AssetBundleManager";
const { ccclass } = _decorator;

@ccclass("AudioManager")
export class AudioManager extends Component {
  private static instance: AudioManager = null!;

  private bgmSource: AudioSource = null!;
  private sfxSource: AudioSource = null!;
  private spinSoundSource: AudioSource = null!;

  private bgmVolume: number = 0.5;
  private sfxVolume: number = 0.8;
  private isMuted: boolean = false;

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

    this.bgmSource = this.node.addComponent(AudioSource);
    this.bgmSource.loop = true;
    this.bgmSource.volume = this.bgmVolume;

    this.sfxSource = this.node.addComponent(AudioSource);
    this.sfxSource.loop = false;
    this.sfxSource.volume = this.sfxVolume;

    this.spinSoundSource = this.node.addComponent(AudioSource);
    this.spinSoundSource.loop = true;
    this.spinSoundSource.volume = this.sfxVolume;

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

  protected onDestroy(): void {
    if (AudioManager.instance === this) {
      AudioManager.instance = null!;
    }
    this.audioCache.clear();
    this.audioLoading.clear();
  }

  public playBGM(path: string): void {
    if (this.isMuted) return;
    this.getOrLoadClip(path).then((clip) => {
      if (!clip || this.isMuted) return;
      this.bgmSource.clip = clip;
      this.bgmSource.play();
    });
  }

  public stopBGM(): void {
    this.bgmSource.stop();
  }

  public playSFX(path: string): void {
    if (this.isMuted) return;
    this.getOrLoadClip(path).then((clip) => {
      if (!clip || this.isMuted) return;
      this.sfxSource.playOneShot(clip, this.sfxVolume);
    });
  }

  public playSpinSound(path: string): void {
    if (this.isMuted) return;
    this.getOrLoadClip(path).then((clip) => {
      if (!clip || this.isMuted) return;
      this.spinSoundSource.clip = clip;
      this.spinSoundSource.play();
    });
  }

  public stopSpinSound(): void {
    this.spinSoundSource.stop();
  }

  private getOrLoadClip(path: string): Promise<AudioClip | null> {
    const cacheKey = `audio:${path}`;

    const cached = this.audioCache.get(cacheKey);
    if (cached) return Promise.resolve(cached);

    const existing = this.audioLoading.get(cacheKey);
    if (existing) return existing;

    const loader = new Promise<AudioClip | null>(async (resolve) => {
      const bundleManager = AssetBundleManager.getInstance();
      const clip = await bundleManager.load("audio", path, AudioClip);

      if (!clip) {
        resolve(null);
        return;
      }

      this.audioCache.set(cacheKey, clip);
      resolve(clip);
    });

    this.audioLoading.set(cacheKey, loader);
    loader.then(
      () => this.audioLoading.delete(cacheKey),
      () => this.audioLoading.delete(cacheKey)
    );
    return loader;
  }

  public setBGMVolume(volume: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
    localStorage.setItem("bgmVolume", this.bgmVolume.toString());
  }

  public setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
    localStorage.setItem("sfxVolume", this.sfxVolume.toString());
  }

  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    this.updateVolumes();
    localStorage.setItem("audioMuted", this.isMuted.toString());

    if (this.isMuted) {
      this.bgmSource.pause();
    } else {
      if (this.bgmSource.clip) this.bgmSource.play();
    }
  }

  private updateVolumes(): void {
    if (this.isMuted) {
      this.bgmSource.volume = 0;
      this.sfxSource.volume = 0;
      this.spinSoundSource.volume = 0;
    } else {
      this.bgmSource.volume = this.bgmVolume;
      this.sfxSource.volume = this.sfxVolume;
      this.spinSoundSource.volume = this.sfxVolume;
    }
  }

  public isMutedState(): boolean {
    return this.isMuted;
  }
}
