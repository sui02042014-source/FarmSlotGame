import { Node, NodePool, instantiate, Prefab, Tween } from "cc";
import { Logger } from "../helpers/logger";

const logger = Logger.create("SymbolPool");

interface PoolStats {
  symbolId: string;
  poolSize: number;
  inUse: number;
  created: number;
}

export class SymbolPool {
  private static instance: SymbolPool | null = null;

  private pools: Map<string, NodePool> = new Map();

  private prefabCache: Map<string, Prefab> = new Map();

  private nodesInUse: Map<string, Set<Node>> = new Map();

  private stats: Map<string, { created: number; reused: number }> = new Map();

  public static getInstance(): SymbolPool {
    if (!this.instance) {
      this.instance = new SymbolPool();
    }
    return this.instance;
  }

  // ==========================================
  // Initialization
  // ==========================================

  public initialize(
    symbolPrefabs: Map<string, Prefab>,
    prewarmCount: number = 10
  ): void {
    this.prefabCache = symbolPrefabs;

    symbolPrefabs.forEach((prefab, symbolId) => {
      this.createPool(symbolId, prefab, prewarmCount);
    });
  }

  private createPool(
    symbolId: string,
    prefab: Prefab,
    prewarmCount: number
  ): void {
    const pool = new NodePool();

    for (let i = 0; i < prewarmCount; i++) {
      const node = instantiate(prefab);
      this.resetNode(node);
      pool.put(node);
    }

    this.pools.set(symbolId, pool);
    this.nodesInUse.set(symbolId, new Set());
    this.stats.set(symbolId, { created: prewarmCount, reused: 0 });
  }

  // ==========================================
  // Public API - Get/Put
  // ==========================================

  public get(symbolId: string): Node | null {
    const pool = this.pools.get(symbolId);
    if (!pool) {
      logger.error(`Pool not found for symbol: ${symbolId}`);
      return null;
    }

    let node: Node;
    const stats = this.stats.get(symbolId)!;

    if (pool.size() > 0) {
      node = pool.get()!;
      stats.reused++;
    } else {
      const prefab = this.prefabCache.get(symbolId);
      if (!prefab) {
        logger.error(`Prefab not found for symbol: ${symbolId}`);
        return null;
      }

      node = instantiate(prefab);
      stats.created++;
      logger.warn(
        `Pool exhausted for ${symbolId}, created new instance (total: ${stats.created})`
      );
    }

    this.nodesInUse.get(symbolId)!.add(node);

    this.resetNode(node);
    node.active = true;

    return node;
  }

  public put(symbolId: string, node: Node): void {
    if (!node || !node.isValid) {
      logger.warn(`Attempted to return invalid node to pool: ${symbolId}`);
      return;
    }

    const pool = this.pools.get(symbolId);
    if (!pool) {
      logger.error(`Pool not found for symbol: ${symbolId}`);
      node.destroy();
      return;
    }

    const inUse = this.nodesInUse.get(symbolId);
    if (inUse) {
      inUse.delete(node);
    }

    this.resetNode(node);

    pool.put(node);
  }

  // ==========================================
  // Batch Operations
  // ==========================================

  public putBatch(items: Array<{ symbolId: string; node: Node }>): void {
    items.forEach(({ symbolId, node }) => {
      this.put(symbolId, node);
    });
  }

  public prewarm(symbolId: string, count: number): void {
    const pool = this.pools.get(symbolId);
    const prefab = this.prefabCache.get(symbolId);

    if (!pool || !prefab) {
      logger.error(`Cannot prewarm: pool or prefab not found for ${symbolId}`);
      return;
    }

    for (let i = 0; i < count; i++) {
      const node = instantiate(prefab);
      this.resetNode(node);
      pool.put(node);
    }

    const stats = this.stats.get(symbolId)!;
    stats.created += count;
  }

  // ==========================================
  // Pool Management
  // ==========================================

  public clearPool(symbolId: string): void {
    const pool = this.pools.get(symbolId);
    if (!pool) return;

    pool.clear();
    this.nodesInUse.get(symbolId)?.clear();
  }

  public clearAll(): void {
    this.pools.forEach((pool, symbolId) => {
      pool.clear();
    });

    this.nodesInUse.clear();
    this.stats.clear();
  }

  public destroy(): void {
    this.clearAll();
    this.pools.clear();
    this.prefabCache.clear();
    this.nodesInUse.clear();
    this.stats.clear();
  }

  // ==========================================
  // Statistics & Debugging
  // ==========================================

  public getStats(): PoolStats[] {
    const stats: PoolStats[] = [];

    this.pools.forEach((pool, symbolId) => {
      const symbolStats = this.stats.get(symbolId)!;
      const inUseCount = this.nodesInUse.get(symbolId)?.size || 0;

      stats.push({
        symbolId,
        poolSize: pool.size(),
        inUse: inUseCount,
        created: symbolStats.created,
      });
    });

    return stats;
  }

  public getSymbolStats(symbolId: string): PoolStats | null {
    const pool = this.pools.get(symbolId);
    if (!pool) return null;

    const symbolStats = this.stats.get(symbolId)!;
    const inUseCount = this.nodesInUse.get(symbolId)?.size || 0;

    return {
      symbolId,
      poolSize: pool.size(),
      inUse: inUseCount,
      created: symbolStats.created,
    };
  }

  public printStats(): void {
    logger.info("========== Symbol Pool Statistics ==========");

    const stats = this.getStats();
    stats.forEach((stat) => {
      logger.info(
        `${stat.symbolId}: Pool=${stat.poolSize}, InUse=${stat.inUse}, Created=${stat.created}`
      );
    });

    const totalInUse = stats.reduce((sum, s) => sum + s.inUse, 0);
    const totalPooled = stats.reduce((sum, s) => sum + s.poolSize, 0);
    const totalCreated = stats.reduce((sum, s) => sum + s.created, 0);

    logger.info(`Total In Use: ${totalInUse}`);
    logger.info(`Total Pooled: ${totalPooled}`);
    logger.info(`Total Created: ${totalCreated}`);
    logger.info("=============================================");
  }

  /**
   * Check if a node is currently in use
   */
  public isNodeInUse(symbolId: string, node: Node): boolean {
    return this.nodesInUse.get(symbolId)?.has(node) || false;
  }

  /**
   * Get current pool size for a symbol
   */
  public getPoolSize(symbolId: string): number {
    return this.pools.get(symbolId)?.size() || 0;
  }

  /**
   * Get number of nodes in use for a symbol
   */
  public getInUseCount(symbolId: string): number {
    return this.nodesInUse.get(symbolId)?.size || 0;
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  /**
   * Reset a node to default state
   */
  private resetNode(node: Node): void {
    node.setPosition(0, 0, 0);
    node.setRotationFromEuler(0, 0, 0);
    node.setScale(1, 1, 1);
    node.active = false;

    Tween.stopAllByTarget(node);

    if (node.parent) {
      node.removeFromParent();
    }
  }
}
