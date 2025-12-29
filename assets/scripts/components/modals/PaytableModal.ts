import {
  _decorator,
  instantiate,
  Label,
  Node,
  Prefab,
  ScrollView,
  Sprite,
  UITransform,
} from "cc";
import { GameConfig } from "../../data/config/GameConfig";
import { SpriteFrameCache } from "../../utils/helpers/SpriteFrameCache";
import { BaseModal } from "./BaseModal";
import { BundleName } from "../../core/asset-manager/AssetBundleManager";
import { SymbolData } from "../../data/models/SymbolData";

const { ccclass, property } = _decorator;

@ccclass("PaytableModal")
export class PaytableModal extends BaseModal {
  @property(ScrollView)
  scrollView: ScrollView = null!;

  @property(Node)
  contentContainer: Node = null!;

  @property(Prefab)
  itemPrefab: Prefab = null!;

  private _currentBet: number = 1.0;
  private _itemPool: Node[] = [];
  private _activeItems: Node[] = [];

  public setData(data: any): void {
    if (data && data.currentBet) {
      this._currentBet = data.currentBet;
    }
    this.renderPaytable();
  }

  private getFromPool(): Node {
    let node = this._itemPool.pop();
    if (!node) {
      node = instantiate(this.itemPrefab);
    }
    node.active = true;
    return node;
  }

  private returnToPool(node: Node) {
    node.active = false;
    node.removeFromParent();
    this._itemPool.push(node);
  }

  private async renderPaytable() {
    if (!this.contentContainer || !this.itemPrefab) return;

    this._activeItems.forEach((item) => this.returnToPool(item));
    this._activeItems = [];

    const paytableData = GameConfig.PAYTABLE;
    const cache = SpriteFrameCache.getInstance();

    for (const symbolKey in paytableData) {
      const payouts = paytableData[symbolKey as keyof typeof paytableData];
      const itemNode = this.getFromPool();
      this.contentContainer.addChild(itemNode);
      this._activeItems.push(itemNode);

      const symbolInfo = SymbolData.getSymbol(symbolKey);
      const spritePath = symbolInfo?.spritePath || symbolKey;

      const iconSprite = itemNode.getChildByName("Icon")?.getComponent(Sprite);
      if (iconSprite) {
        const sf = cache.getSpriteFrame(BundleName.SYMBOLS, spritePath);

        if (sf && iconSprite.isValid) {
          // Optimization: Enable packable to allow batching with labels in dynamic atlas
          sf.packable = true;

          iconSprite.spriteFrame = sf;
          iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
          iconSprite.trim = false;
          const ui = iconSprite.getComponent(UITransform);
          if (ui) ui.setContentSize(80, 80);
        }
      }

      const labelComp = itemNode.getChildByName("Label")?.getComponent(Label);
      if (labelComp) {
        // Optimization: Use BITMAP cache mode to batch labels into dynamic atlas
        labelComp.cacheMode = Label.CacheMode.BITMAP;

        const x3 = payouts[3] * this._currentBet;
        const x4 = (payouts as any)[4] * this._currentBet;
        const x5 = (payouts as any)[5] * this._currentBet;

        labelComp.string = `${
          symbolInfo?.name || symbolKey
        }\n\nx5: ${x5.toFixed(2)} | x4: ${x4.toFixed(2)} | x3: ${x3.toFixed(
          2
        )}`;
      }
    }

    this.scrollView.scrollToTop(0);
  }

  protected onDisable(): void {
    this._activeItems.forEach((item) => this.returnToPool(item));
    this._activeItems = [];
  }
}
