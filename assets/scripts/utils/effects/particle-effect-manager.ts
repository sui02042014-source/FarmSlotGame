import {
  _decorator,
  Component,
  Node,
  ParticleSystem2D,
  Vec2,
  Color,
  instantiate,
  Prefab,
  resources,
} from "cc";

const { ccclass } = _decorator;

export interface ParticleEffectConfig {
  position: Vec2;
  duration?: number;
  scale?: number;
  color?: Color;
  autoRemove?: boolean;
}

/**
 * ParticleEffectManager - Manages particle effects for celebrations and visual feedback
 * Handles:
 * - Win celebrations (coins, confetti, sparkles)
 * - Big win explosions
 * - Symbol effects
 * - Bonus trigger effects
 */
@ccclass("ParticleEffectManager")
export class ParticleEffectManager extends Component {
  private static _instance: ParticleEffectManager;

  private _particlePrefabs: Map<string, Prefab> = new Map();
  private _activeParticles: ParticleSystem2D[] = [];
  private _particlePool: Map<string, ParticleSystem2D[]> = new Map();

  public static getInstance(): ParticleEffectManager {
    return this._instance;
  }

  protected onLoad(): void {
    if (ParticleEffectManager._instance) {
      this.node.destroy();
      return;
    }
    ParticleEffectManager._instance = this;
  }

  protected onDestroy(): void {
    if (ParticleEffectManager._instance === this) {
      ParticleEffectManager._instance = null!;
    }
    this.clearAllParticles();
    this._particlePrefabs.clear();
    this._particlePool.clear();
  }

  // ==========================================
  // Particle Creation
  // ==========================================

  /**
   * Create a confetti explosion effect
   */
  public createConfettiExplosion(
    parent: Node,
    position: Vec2,
    intensity: number = 1.0
  ): void {
    const particleNode = this.createParticleNode(parent, position);
    const particle = particleNode.addComponent(ParticleSystem2D);

    // Configure confetti particles
    particle.duration = 2.0;
    particle.life = 1.5;
    particle.lifeVar = 0.5;
    particle.emissionRate = 100 * intensity;
    particle.startSize = 20;
    particle.startSizeVar = 10;
    particle.endSize = 5;
    particle.angle = 90;
    particle.angleVar = 360;
    particle.speed = 300;
    particle.speedVar = 100;
    particle.gravity = new Vec2(0, -500);
    particle.radialAccel = 0;
    particle.radialAccelVar = 0;
    particle.tangentialAccel = 0;
    particle.tangentialAccelVar = 0;
    particle.startColor = new Color(255, 215, 0, 255); // Gold
    particle.endColor = new Color(255, 215, 0, 0);

    particle.resetSystem();
    this.trackParticle(particle, particleNode);
  }

  /**
   * Create a sparkle effect at a position
   */
  public createSparkleEffect(
    parent: Node,
    position: Vec2,
    color?: Color
  ): void {
    const particleNode = this.createParticleNode(parent, position);
    const particle = particleNode.addComponent(ParticleSystem2D);

    // Configure sparkle particles
    particle.duration = 1.0;
    particle.life = 0.8;
    particle.lifeVar = 0.3;
    particle.emissionRate = 50;
    particle.startSize = 15;
    particle.startSizeVar = 5;
    particle.endSize = 0;
    particle.angle = 90;
    particle.angleVar = 360;
    particle.speed = 200;
    particle.speedVar = 50;
    particle.gravity = new Vec2(0, -100);
    particle.startColor = color || new Color(255, 255, 255, 255);
    particle.endColor = new Color(255, 255, 255, 0);

    particle.resetSystem();
    this.trackParticle(particle, particleNode);
  }

  /**
   * Create a coin burst effect
   */
  public createCoinBurst(
    parent: Node,
    position: Vec2,
    intensity: number = 1.0
  ): void {
    const particleNode = this.createParticleNode(parent, position);
    const particle = particleNode.addComponent(ParticleSystem2D);

    // Configure coin burst
    particle.duration = 1.5;
    particle.life = 1.2;
    particle.lifeVar = 0.4;
    particle.emissionRate = 80 * intensity;
    particle.startSize = 30;
    particle.startSizeVar = 10;
    particle.endSize = 10;
    particle.angle = -90; // Shoot upward
    particle.angleVar = 45;
    particle.speed = 400;
    particle.speedVar = 100;
    particle.gravity = new Vec2(0, -800);
    particle.startColor = new Color(255, 215, 0, 255); // Gold
    particle.endColor = new Color(255, 215, 0, 128);

    particle.resetSystem();
    this.trackParticle(particle, particleNode);
  }

  /**
   * Create a big win explosion (combination of effects)
   */
  public createBigWinExplosion(parent: Node, position: Vec2): void {
    // Multiple layered effects for big wins
    this.createCoinBurst(parent, position, 2.0);

    this.scheduleOnce(() => {
      this.createConfettiExplosion(parent, position, 1.5);
    }, 0.1);

    this.scheduleOnce(() => {
      this.createSparkleEffect(parent, position, new Color(255, 255, 0, 255));
    }, 0.2);

    // Add additional sparkles around the main position
    const offsets = [
      new Vec2(100, 0),
      new Vec2(-100, 0),
      new Vec2(0, 100),
      new Vec2(0, -100),
    ];

    offsets.forEach((offset, index) => {
      this.scheduleOnce(() => {
        const pos = new Vec2(position.x + offset.x, position.y + offset.y);
        this.createSparkleEffect(parent, pos, new Color(255, 200, 50, 255));
      }, 0.3 + index * 0.1);
    });
  }

  /**
   * Create a symbol glow effect (for winning symbols)
   */
  public createSymbolGlow(parent: Node, symbolNode: Node): void {
    const particleNode = this.createParticleNode(
      parent,
      new Vec2(symbolNode.position.x, symbolNode.position.y)
    );
    const particle = particleNode.addComponent(ParticleSystem2D);

    // Configure glow particles
    particle.duration = -1; // Infinite
    particle.life = 0.6;
    particle.lifeVar = 0.2;
    particle.emissionRate = 30;
    particle.startSize = 40;
    particle.startSizeVar = 10;
    particle.endSize = 60;
    particle.angle = 0;
    particle.angleVar = 360;
    particle.speed = 20;
    particle.speedVar = 10;
    particle.gravity = new Vec2(0, 0);
    particle.startColor = new Color(255, 255, 100, 200);
    particle.endColor = new Color(255, 255, 255, 0);

    particle.resetSystem();
    this._activeParticles.push(particle);

    // Auto-stop after 2 seconds
    this.scheduleOnce(() => {
      particle.stopSystem();
      this.scheduleOnce(() => {
        particleNode.destroy();
        this.removeParticleFromTracking(particle);
      }, 1.0);
    }, 2.0);
  }

  /**
   * Create a scatter symbol trigger effect
   */
  public createScatterTriggerEffect(parent: Node, position: Vec2): void {
    const particleNode = this.createParticleNode(parent, position);
    const particle = particleNode.addComponent(ParticleSystem2D);

    // Configure scatter trigger (explosive ring)
    particle.duration = 1.0;
    particle.life = 1.0;
    particle.lifeVar = 0.2;
    particle.emissionRate = 100;
    particle.startSize = 25;
    particle.startSizeVar = 5;
    particle.endSize = 5;
    particle.angle = 0;
    particle.angleVar = 360;
    particle.speed = 350;
    particle.speedVar = 50;
    particle.gravity = new Vec2(0, 0);
    particle.radialAccel = 200;
    particle.startColor = new Color(255, 50, 255, 255); // Purple/pink
    particle.endColor = new Color(255, 150, 255, 0);

    particle.resetSystem();
    this.trackParticle(particle, particleNode);
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  private createParticleNode(parent: Node, position: Vec2): Node {
    const node = new Node("Particle");
    node.setParent(parent);
    node.setPosition(position.x, position.y, 0);
    return node;
  }

  private trackParticle(particle: ParticleSystem2D, node: Node): void {
    this._activeParticles.push(particle);

    // Auto-remove after duration + life
    const totalTime = (particle.duration || 0) + (particle.life || 0) + 0.5;
    this.scheduleOnce(() => {
      if (node && node.isValid) {
        node.destroy();
      }
      this.removeParticleFromTracking(particle);
    }, totalTime);
  }

  private removeParticleFromTracking(particle: ParticleSystem2D): void {
    const index = this._activeParticles.indexOf(particle);
    if (index > -1) {
      this._activeParticles.splice(index, 1);
    }
  }

  /**
   * Stop all active particles
   */
  public stopAllParticles(): void {
    this._activeParticles.forEach((particle) => {
      if (particle && particle.isValid) {
        particle.stopSystem();
      }
    });
  }

  /**
   * Clear all particles immediately
   */
  public clearAllParticles(): void {
    this._activeParticles.forEach((particle) => {
      if (particle && particle.node && particle.node.isValid) {
        particle.node.destroy();
      }
    });
    this._activeParticles = [];
  }
}
