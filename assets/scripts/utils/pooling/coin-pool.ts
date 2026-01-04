import { Node, NodePool, instantiate, Sprite, Tween, UITransform } from "cc";
import { Logger } from "../helpers/logger";

const logger = Logger.create("CoinPool");

const COIN_POOL_CONSTANTS = {
  INITIAL_POOL_SIZE: 150,
  MAX_POOL_SIZE: 250,
  WARNING_THRESHOLD: 180,
} as const;

export class CoinPool {
  private static instance: CoinPool | null = null;
  private pool: NodePool = new NodePool();
  private coinTemplate: Node | null = null;
  private nodesInUse: Set<Node> = new Set();

  // Statistics
  private totalCreated: number = 0;
  private totalReused: number = 0;
  private peakUsage: number = 0;

  private constructor() {}

  public static getInstance(): CoinPool {
    if (!this.instance) {
      this.instance = new CoinPool();
    }
    return this.instance;
  }

  // ==========================================
  // Initialization
  // ==========================================

  /**
   * Initialize pool with a coin node template
   * @param coinTemplate - Template node for coins
   * @param prewarmCount - Number of coins to pre-create
   */
  public initialize(
    coinTemplate: Node,
    prewarmCount: number = COIN_POOL_CONSTANTS.INITIAL_POOL_SIZE
  ): void {
    if (this.coinTemplate) {
      logger.warn("CoinPool already initialized, skipping");
      return;
    }

    this.coinTemplate = coinTemplate;

    // Pre-create coins
    for (let i = 0; i < prewarmCount; i++) {
      const coin = this.createCoin();
      this.pool.put(coin);
    }

    this.totalCreated = prewarmCount;
  }

  /**
   * Quick initialize with simple coin node
   */
  public quickInitialize(size: number = 60): void {
    if (this.coinTemplate) {
      logger.warn("CoinPool already initialized, skipping");
      return;
    }

    // Create simple coin template
    const coin = new Node("CoinTemplate");
    coin.addComponent(UITransform)?.setContentSize(size, size);
    coin.addComponent(Sprite);

    this.initialize(coin);
  }

  // ==========================================
  // Public API - Get/Put
  // ==========================================

  /**
   * Get a coin from the pool
   * @returns Coin node or null if initialization failed
   */
  public get(): Node | null {
    if (!this.coinTemplate) {
      logger.error("CoinPool not initialized! Call initialize() first");
      return null;
    }

    let coin: Node;

    if (this.pool.size() > 0) {
      coin = this.pool.get()!;
      this.totalReused++;
    } else {
      coin = this.createCoin();
      this.totalCreated++;

      if (this.totalCreated > COIN_POOL_CONSTANTS.WARNING_THRESHOLD) {
        logger.warn(
          `CoinPool size exceeded ${COIN_POOL_CONSTANTS.WARNING_THRESHOLD}. Consider increasing initial pool size.`
        );
      }
    }

    this.nodesInUse.add(coin);

    if (this.nodesInUse.size > this.peakUsage) {
      this.peakUsage = this.nodesInUse.size;
    }

    this.resetCoin(coin);
    coin.active = true;

    return coin;
  }

  /**
   * Return a coin to the pool
   * @param coin - Coin node to return
   */
  public put(coin: Node): void {
    if (!coin || !coin.isValid) {
      logger.warn("Attempted to return invalid coin to pool");
      return;
    }

    this.nodesInUse.delete(coin);

    if (this.pool.size() >= COIN_POOL_CONSTANTS.MAX_POOL_SIZE) {
      coin.destroy();
      logger.debug("Pool full, destroyed coin instead of returning");
      return;
    }

    this.resetCoin(coin);
    this.pool.put(coin);
  }

  // ==========================================
  // Batch Operations
  // ==========================================

  /**
   * Get multiple coins at once
   * @param count - Number of coins to get
   * @returns Array of coin nodes
   */
  public getBatch(count: number): Node[] {
    const coins: Node[] = [];

    for (let i = 0; i < count; i++) {
      const coin = this.get();
      if (coin) {
        coins.push(coin);
      }
    }

    return coins;
  }

  /**
   * Return multiple coins at once
   * @param coins - Array of coin nodes to return
   */
  public putBatch(coins: Node[]): void {
    coins.forEach((coin) => {
      this.put(coin);
    });
  }

  // ==========================================
  // Pool Management
  // ==========================================

  /**
   * Clear all coins from pool
   */
  public clear(): void {
    // Return all in-use coins
    this.nodesInUse.forEach((coin) => {
      if (coin && coin.isValid) {
        coin.destroy();
      }
    });
    this.nodesInUse.clear();

    // Clear pool
    this.pool.clear();
  }

  /**
   * Destroy pool and cleanup
   */
  public destroy(): void {
    this.clear();
    this.coinTemplate = null;
    this.totalCreated = 0;
    this.totalReused = 0;
    this.peakUsage = 0;
  }

  // ==========================================
  // Statistics
  // ==========================================

  /**
   * Get pool statistics
   */
  public getStats(): {
    poolSize: number;
    inUse: number;
    totalCreated: number;
    totalReused: number;
    peakUsage: number;
    reuseRate: number;
  } {
    const totalOperations = this.totalCreated + this.totalReused;
    const reuseRate =
      totalOperations > 0 ? this.totalReused / totalOperations : 0;

    return {
      poolSize: this.pool.size(),
      inUse: this.nodesInUse.size,
      totalCreated: this.totalCreated,
      totalReused: this.totalReused,
      peakUsage: this.peakUsage,
      reuseRate: Math.round(reuseRate * 100) / 100,
    };
  }

  /**
   * Print statistics to console
   */
  public printStats(): void {
    const stats = this.getStats();

    logger.info("========== Coin Pool Statistics ==========");
    logger.info(`Pool Size: ${stats.poolSize}`);
    logger.info(`In Use: ${stats.inUse}`);
    logger.info(`Total Created: ${stats.totalCreated}`);
    logger.info(`Total Reused: ${stats.totalReused}`);
    logger.info(`Peak Usage: ${stats.peakUsage}`);
    logger.info(`Reuse Rate: ${(stats.reuseRate * 100).toFixed(1)}%`);
    logger.info("===========================================");
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.totalCreated = this.pool.size() + this.nodesInUse.size;
    this.totalReused = 0;
    this.peakUsage = this.nodesInUse.size;
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  /**
   * Create a new coin node
   */
  private createCoin(): Node {
    if (!this.coinTemplate) {
      throw new Error("Coin template not set");
    }

    return instantiate(this.coinTemplate);
  }

  /**
   * Reset a coin to default state
   */
  private resetCoin(coin: Node): void {
    coin.setPosition(0, 0, 0);
    coin.setRotationFromEuler(0, 0, 0);
    coin.setScale(1, 1, 1);
    coin.active = false;

    Tween.stopAllByTarget(coin);

    if (coin.parent) {
      coin.removeFromParent();
    }

    const uiOpacity = coin.getComponent("cc.UIOpacity");
    if (uiOpacity) {
      (uiOpacity as any).opacity = 255;
    }
  }
}
