import { _decorator, Node, Component, instantiate, Prefab } from "cc";

const { ccclass } = _decorator;

export interface IPoolable {
  onSpawn?(): void;
  onDespawn?(): void;
}

/**
 * ObjectPool - Generic object pooling system for performance optimization
 *
 * Use cases:
 * - Symbol reuse in slot reels
 * - Particle effects
 * - Coin animations
 * - Toast messages
 *
 * Benefits:
 * - Reduces garbage collection
 * - Improves performance
 * - Prevents memory spikes
 */
@ccclass("ObjectPool")
export class ObjectPool<T extends Component> {
  private _pool: T[] = [];
  private _active: Set<T> = new Set();
  private _prefab: Prefab | Node;
  private _parent: Node | null;
  private _initialSize: number;
  private _maxSize: number;

  constructor(
    prefab: Prefab | Node,
    parent: Node | null = null,
    initialSize: number = 10,
    maxSize: number = 100
  ) {
    this._prefab = prefab;
    this._parent = parent;
    this._initialSize = initialSize;
    this._maxSize = maxSize;

    this.prewarm();
  }

  // ==========================================
  // Initialization
  // ==========================================

  private prewarm(): void {
    for (let i = 0; i < this._initialSize; i++) {
      const obj = this.createObject();
      if (obj) {
        this.returnToPool(obj);
      }
    }
  }

  private createObject(): T | null {
    let node: Node;

    if (this._prefab instanceof Prefab) {
      node = instantiate(this._prefab);
    } else {
      node = instantiate(this._prefab);
    }

    if (!node) return null;

    if (this._parent) {
      node.setParent(this._parent);
    }

    const component = node.getComponent(Component) as T;
    return component;
  }

  // ==========================================
  // Public API
  // ==========================================

  /**
   * Get an object from the pool
   */
  public spawn(): T | null {
    let obj: T | null = null;

    if (this._pool.length > 0) {
      obj = this._pool.pop()!;
    } else {
      obj = this.createObject();
    }

    if (!obj) return null;

    this._active.add(obj);
    obj.node.active = true;

    // Call onSpawn callback if it exists
    const poolable = obj as unknown as IPoolable;
    if (poolable.onSpawn) {
      poolable.onSpawn();
    }

    return obj;
  }

  /**
   * Return an object to the pool
   */
  public despawn(obj: T): void {
    if (!obj || !obj.isValid) return;

    // Call onDespawn callback if it exists
    const poolable = obj as unknown as IPoolable;
    if (poolable.onDespawn) {
      poolable.onDespawn();
    }

    obj.node.active = false;
    this._active.delete(obj);

    // Only add back if under max size
    if (this._pool.length < this._maxSize) {
      this.returnToPool(obj);
    } else {
      // Destroy if pool is full
      obj.node.destroy();
    }
  }

  /**
   * Despawn all active objects
   */
  public despawnAll(): void {
    const activeArray = Array.from(this._active);
    activeArray.forEach((obj) => this.despawn(obj));
  }

  /**
   * Clear the entire pool
   */
  public clear(): void {
    this.despawnAll();

    this._pool.forEach((obj) => {
      if (obj && obj.node && obj.node.isValid) {
        obj.node.destroy();
      }
    });

    this._pool = [];
    this._active.clear();
  }

  /**
   * Get the number of available objects in the pool
   */
  public get availableCount(): number {
    return this._pool.length;
  }

  /**
   * Get the number of active objects
   */
  public get activeCount(): number {
    return this._active.size;
  }

  /**
   * Get total objects (active + pooled)
   */
  public get totalCount(): number {
    return this._pool.length + this._active.size;
  }

  // ==========================================
  // Internal Methods
  // ==========================================

  private returnToPool(obj: T): void {
    if (this._parent) {
      obj.node.setParent(this._parent);
    }
    obj.node.active = false;
    this._pool.push(obj);
  }
}
