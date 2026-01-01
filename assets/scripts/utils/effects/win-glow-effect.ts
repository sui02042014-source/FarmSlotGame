import { _decorator, Component, Sprite, tween, Color } from "cc";

const { ccclass, property } = _decorator;

/**
 * WinGlowEffect - Applies a glowing/shining effect to winning symbols
 * Uses material properties to create a UV sliding shine effect
 */
@ccclass("WinGlowEffect")
export class WinGlowEffect extends Component {
  @property
  shineDuration: number = 1.5;

  @property
  shineIntensity: number = 1.5;

  @property(Color)
  glowColor: Color = new Color(255, 255, 100, 255);

  private sprite: Sprite | null = null;
  private originalColor: Color = Color.WHITE.clone();
  private isGlowing: boolean = false;

  protected onLoad(): void {
    this.sprite = this.node.getComponent(Sprite);
    if (this.sprite) {
      this.originalColor = this.sprite.color.clone();
    }
  }

  /**
   * Start the glow effect
   */
  public startGlow(): void {
    if (this.isGlowing || !this.sprite) return;

    this.isGlowing = true;
    this.animateGlow();
  }

  /**
   * Stop the glow effect and reset to original
   */
  public stopGlow(): void {
    if (!this.isGlowing || !this.sprite) return;

    this.isGlowing = false;
    tween(this.sprite).stop();

    // Fade back to original color
    tween(this.sprite).to(0.3, { color: this.originalColor }).start();
  }

  private animateGlow(): void {
    if (!this.sprite || !this.isGlowing) return;

    const glowData = { brightness: 1.0 };

    tween(glowData)
      .to(
        this.shineDuration / 2,
        { brightness: this.shineIntensity },
        {
          onUpdate: () => {
            if (this.sprite && this.isGlowing) {
              // Interpolate between original color and glow color
              const t =
                (glowData.brightness - 1.0) / (this.shineIntensity - 1.0);
              const r =
                this.originalColor.r +
                (this.glowColor.r - this.originalColor.r) * t;
              const g =
                this.originalColor.g +
                (this.glowColor.g - this.originalColor.g) * t;
              const b =
                this.originalColor.b +
                (this.glowColor.b - this.originalColor.b) * t;

              this.sprite.color = new Color(r, g, b, 255);
            }
          },
        }
      )
      .to(
        this.shineDuration / 2,
        { brightness: 1.0 },
        {
          onUpdate: () => {
            if (this.sprite && this.isGlowing) {
              const t =
                (glowData.brightness - 1.0) / (this.shineIntensity - 1.0);
              const r =
                this.originalColor.r +
                (this.glowColor.r - this.originalColor.r) * t;
              const g =
                this.originalColor.g +
                (this.glowColor.g - this.originalColor.g) * t;
              const b =
                this.originalColor.b +
                (this.glowColor.b - this.originalColor.b) * t;

              this.sprite.color = new Color(r, g, b, 255);
            }
          },
        }
      )
      .union()
      .repeatForever()
      .start();
  }

  protected onDestroy(): void {
    this.stopGlow();
  }
}

/**
 * Static helper to easily apply glow to any node
 */
export class WinGlowHelper {
  /**
   * Apply glow effect to a node
   */
  public static applyGlow(
    targetNode: any,
    duration: number = 2.0,
    intensity: number = 1.5
  ): WinGlowEffect | null {
    if (!targetNode?.isValid) return null;

    let effect = targetNode.getComponent(WinGlowEffect) as WinGlowEffect;
    if (!effect) {
      effect = targetNode.addComponent(WinGlowEffect) as WinGlowEffect;
      effect.shineDuration = duration;
      effect.shineIntensity = intensity;
    }

    effect.startGlow();
    return effect;
  }

  /**
   * Remove glow effect from a node
   */
  public static removeGlow(targetNode: any): void {
    if (!targetNode?.isValid) return;

    const effect = targetNode.getComponent(WinGlowEffect) as WinGlowEffect;
    if (effect) {
      effect.stopGlow();
      effect.scheduleOnce(() => {
        if (effect?.isValid) {
          effect.destroy();
        }
      }, 0.5);
    }
  }

  /**
   * Apply glow to multiple nodes
   */
  public static applyGlowToMultiple(
    nodes: any[],
    duration: number = 2.0,
    stagger: number = 0.1
  ): void {
    nodes.forEach((node, index) => {
      if (node?.isValid) {
        setTimeout(() => {
          WinGlowHelper.applyGlow(node, duration);
        }, index * stagger * 1000);
      }
    });
  }
}
