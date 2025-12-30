import {
  _decorator,
  Label,
  Layout,
  Node,
  ScrollView,
  Sprite,
  UITransform,
  Widget,
} from "cc";
import { GameConfig } from "../../data/config/game-config";
import { SpriteFrameCache } from "../../utils/helpers/sprite-frame-cache";
import { BaseModal } from "./base-modal";
import { BundleName } from "../../core/assets/asset-bundle-manager";
import { SymbolData } from "../../data/models/symbol-data";

const { ccclass, property } = _decorator;

@ccclass("PaytableModal")
export class PaytableModal extends BaseModal {
  @property(ScrollView)
  scrollView: ScrollView = null!;

  @property(Node)
  contentContainer: Node = null!;

  private _currentBet: number = 1.0;
  private _iconPool: Node[] = [];
  private _labelPool: Node[] = [];
  private _activeIcons: Node[] = [];
  private _activeLabels: Node[] = [];

  private readonly ITEM_HEIGHT = 120;
  private readonly ICON_SIZE = 80;
  private readonly LABEL_X_OFFSET = 120;

  private _iconsLayer: Node = null!;
  private _labelsLayer: Node = null!;

  protected onLoad(): void {
    super.onLoad();
    this.setupLayers();
  }

  private setupLayers(): void {
    if (!this.contentContainer) return;

    const layout = this.contentContainer.getComponent(Layout);
    if (layout) {
      layout.enabled = false;
    }

    const widget = this.contentContainer.getComponent(Widget);
    if (widget) {
      widget.enabled = false;
    }

    if (!this._iconsLayer) {
      this._iconsLayer = new Node("IconsLayer");
      this._iconsLayer.addComponent(UITransform);
      this.contentContainer.addChild(this._iconsLayer);
    }

    if (!this._labelsLayer) {
      this._labelsLayer = new Node("LabelsLayer");
      this._labelsLayer.addComponent(UITransform);
      this.contentContainer.addChild(this._labelsLayer);
    }

    const ui = this.contentContainer.getComponent(UITransform);
    if (ui) {
      ui.setAnchorPoint(0.5, 1);
    }
  }

  public setData(data: any): void {
    if (data && data.currentBet) {
      this._currentBet = data.currentBet;
    }

    if (this.scrollView && !this.scrollView.content) {
      this.scrollView.content = this.contentContainer;
    }

    this.renderPaytable();
  }

  private getIconFromPool(): Node {
    let node = this._iconPool.pop();
    if (!node) {
      node = new Node("Icon");
      node
        .addComponent(UITransform)
        .setContentSize(this.ICON_SIZE, this.ICON_SIZE);
      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.trim = false;
    }
    node.active = true;
    return node;
  }

  private getLabelFromPool(): Node {
    let node = this._labelPool.pop();
    if (!node) {
      node = new Node("Label");
      node.addComponent(UITransform).setAnchorPoint(0, 0.5);
      const label = node.addComponent(Label);
      label.fontSize = 24;
      label.lineHeight = 30;
      label.cacheMode = Label.CacheMode.CHAR; // Better for batching dynamic text
    }
    node.active = true;
    return node;
  }

  private returnToPool(node: Node, pool: Node[]) {
    node.active = false;
    node.removeFromParent();
    pool.push(node);
  }

  private async renderPaytable() {
    if (!this.contentContainer) return;

    this.setupLayers();

    this._activeIcons.forEach((node) =>
      this.returnToPool(node, this._iconPool)
    );
    this._activeLabels.forEach((node) =>
      this.returnToPool(node, this._labelPool)
    );
    this._activeIcons = [];
    this._activeLabels = [];

    const paytableData = GameConfig.PAYTABLE;
    const cache = SpriteFrameCache.getInstance();
    const symbols = Object.keys(paytableData);

    const totalHeight = symbols.length * this.ITEM_HEIGHT;
    const contentUI = this.contentContainer.getComponent(UITransform);
    if (contentUI) {
      contentUI.height = totalHeight;
    }

    let currentY = -this.ITEM_HEIGHT / 2;

    for (const symbolKey of symbols) {
      const payouts = paytableData[symbolKey as keyof typeof paytableData];
      const symbolInfo = SymbolData.getSymbol(symbolKey);
      const spritePath = symbolInfo?.spritePath || symbolKey;

      if (this._iconsLayer) {
        const iconNode = this.getIconFromPool();
        this._iconsLayer.addChild(iconNode);
        this._activeIcons.push(iconNode);
        iconNode.setPosition(-250, currentY);

        const sprite = iconNode.getComponent(Sprite);
        if (sprite) {
          const sf = cache.getSpriteFrame(BundleName.SYMBOLS, spritePath);
          if (sf) {
            sprite.spriteFrame = sf;
          }
        }
      }

      if (this._labelsLayer) {
        const labelNode = this.getLabelFromPool();
        this._labelsLayer.addChild(labelNode);
        this._activeLabels.push(labelNode);
        labelNode.setPosition(-200, currentY);

        const label = labelNode.getComponent(Label);
        if (label) {
          const x3 = payouts[3] * this._currentBet;
          const x4 = (payouts as any)[4] * this._currentBet;
          const x5 = (payouts as any)[5] * this._currentBet;

          label.string = `${symbolInfo?.name || symbolKey}\n5x: ${x5.toFixed(
            2
          )} | 4x: ${x4.toFixed(2)} | 3x: ${x3.toFixed(2)}`;
        }
      }

      currentY -= this.ITEM_HEIGHT;
    }

    if (this.scrollView) {
      this.scrollView.scrollToTop(0);
    }
  }

  protected onDisable(): void {
    this._activeIcons.forEach((node) =>
      this.returnToPool(node, this._iconPool)
    );
    this._activeLabels.forEach((node) =>
      this.returnToPool(node, this._labelPool)
    );
    this._activeIcons = [];
    this._activeLabels = [];
  }
}
