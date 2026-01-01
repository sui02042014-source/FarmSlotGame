import { _decorator, Component, director, Director, game } from "cc";

const { ccclass, property } = _decorator;

/**
 * PersistRootNode - Component that keeps a node alive across scene transitions.
 * Perfect for:
 * - Background music that shouldn't cut off when changing scenes
 * - Global managers that need to persist
 * - Loading overlays
 *
 * Usage: Attach this to a node you want to persist across scenes.
 */
@ccclass("PersistRootNode")
export class PersistRootNode extends Component {
  private static _persistedNodes: Set<string> = new Set();

  @property({
    tooltip: "Unique identifier for this persistent node",
  })
  persistId: string = "persist_node";

  @property({
    tooltip:
      "If true, this node will be destroyed when returning to a specific scene",
  })
  destroyOnSceneLoad: boolean = false;

  @property({
    visible() {
      return this.destroyOnSceneLoad;
    },
    tooltip: "Scene name to destroy this node on (e.g., 'LobbyScene')",
  })
  destroyOnScene: string = "";

  protected onLoad(): void {
    // Check if a node with this persistId already exists
    if (PersistRootNode._persistedNodes.has(this.persistId)) {
      // Another instance already exists, destroy this one
      this.node.destroy();
      return;
    }

    // Mark this node as persisted
    game.addPersistRootNode(this.node);
    PersistRootNode._persistedNodes.add(this.persistId);

    // Listen for scene changes if we need to destroy on specific scene
    if (this.destroyOnSceneLoad && this.destroyOnScene) {
      director.on(Director.EVENT_AFTER_SCENE_LAUNCH, this.onSceneLoaded, this);
    }
  }

  protected onDestroy(): void {
    // Remove from persisted nodes set
    PersistRootNode._persistedNodes.delete(this.persistId);

    // Clean up event listener
    if (this.destroyOnSceneLoad && this.destroyOnScene) {
      director.off(Director.EVENT_AFTER_SCENE_LAUNCH, this.onSceneLoaded, this);
    }
  }

  private onSceneLoaded(): void {
    const currentScene = director.getScene();
    if (currentScene && currentScene.name === this.destroyOnScene) {
      // We've loaded the target scene, destroy this persistent node
      this.node.destroy();
    }
  }

  /**
   * Manually remove this node from persistence and destroy it
   */
  public removePersistence(): void {
    game.removePersistRootNode(this.node);
    PersistRootNode._persistedNodes.delete(this.persistId);
    this.node.destroy();
  }

  /**
   * Clear all persisted nodes (useful for debugging or hard resets)
   */
  public static clearAllPersisted(): void {
    PersistRootNode._persistedNodes.clear();
  }
}
