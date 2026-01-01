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
import { SpriteFrameCache } from "../../utils/helpers/sprite-frame-cache";
import { BaseModal } from "./base-modal";
import { BundleName } from "../../core/assets/asset-bundle-manager";
import { SymbolData } from "../../data/models/symbol-data";
import { Logger } from "../../utils/helpers/logger";

const { ccclass, property } = _decorator;

const logger = Logger.create("PaytableModal");

const PAYTABLE_CONSTANTS = {
  ITEM_HEIGHT: 120,
  ICON_SIZE: 80,
  ICON_X_POSITION: -250,
  LABEL_X_POSITION: -200,
  LABEL_FONT_SIZE: 24,
  LABEL_LINE_HEIGHT: 30,
  SCROLL_DURATION: 0,
  CONTENT_ANCHOR_Y: 1,
  CONTENT_ANCHOR_X: 0.5,
} as const;

const LAYER_NAMES = {
  ICONS: "IconsLayer",
  LABELS: "LabelsLayer",
} as const;

const NODE_NAMES = {
  ICON: "Icon",
  LABEL: "Label",
} as const;

interface PaytableData {
  currentBet?: number;
}

@ccclass("PaytableModal")
export class PaytableModal extends BaseModal {
  @property(ScrollView)
  scrollView: ScrollView = null!;

  @property(Node)
  contentContainer: Node = null!;

  private currentBet: number = 1.0;
  private iconPool: Node[] = [];
  private labelPool: Node[] = [];
  private activeIcons: Node[] = [];
  private activeLabels: Node[] = [];
  private iconsLayer!: Node;
  private labelsLayer!: Node;
  private spriteFrameCache!: SpriteFrameCache;
  private isLayersSetup: boolean = false;

  protected onLoad(): void {
    super.onLoad();
    this.cacheInstances();
    this.setupLayers();
  }

  private cacheInstances(): void {
    const cache = SpriteFrameCache.getInstance();
    if (!cache) {
      logger.error("SpriteFrameCache not initialized");
      return;
    }
    this.spriteFrameCache = cache;
  }

  private setupLayers(): void {
    if (!this.contentContainer || this.isLayersSetup) return;

    this.disableLayoutComponents();
    this.createLayers();
    this.setupContentAnchor();
    this.isLayersSetup = true;
  }

  private disableLayoutComponents(): void {
    const layout = this.contentContainer.getComponent(Layout);
    if (layout) layout.enabled = false;

    const widget = this.contentContainer.getComponent(Widget);
    if (widget) widget.enabled = false;
  }

  private createLayers(): void {
    this.iconsLayer = new Node(LAYER_NAMES.ICONS);
    this.iconsLayer.addComponent(UITransform);
    this.contentContainer.addChild(this.iconsLayer);

    this.labelsLayer = new Node(LAYER_NAMES.LABELS);
    this.labelsLayer.addComponent(UITransform);
    this.contentContainer.addChild(this.labelsLayer);
  }

  private setupContentAnchor(): void {
    const ui = this.contentContainer.getComponent(UITransform);
    if (ui) {
      ui.setAnchorPoint(
        PAYTABLE_CONSTANTS.CONTENT_ANCHOR_X,
        PAYTABLE_CONSTANTS.CONTENT_ANCHOR_Y
      );
    }
  }

  protected onDataSet(data: unknown): void {
    const paytableData = data as PaytableData;
    if (paytableData?.currentBet) {
      this.currentBet = paytableData.currentBet;
    }
  }

  protected onBeforeShow(): void {
    if (this.scrollView && !this.scrollView.content) {
      this.scrollView.content = this.contentContainer;
    }
    this.renderPaytable();
  }

  // ==========================================
  // Object Pooling
  // ==========================================

  private getIconFromPool(): Node {
    let node = this.iconPool.pop();
    if (!node) {
      node = this.createIconNode();
    }
    node.active = true;
    return node;
  }

  private createIconNode(): Node {
    const node = new Node(NODE_NAMES.ICON);
    node
      .addComponent(UITransform)
      .setContentSize(
        PAYTABLE_CONSTANTS.ICON_SIZE,
        PAYTABLE_CONSTANTS.ICON_SIZE
      );

    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = false;

    return node;
  }

  private getLabelFromPool(): Node {
    let node = this.labelPool.pop();
    if (!node) {
      node = this.createLabelNode();
    }
    node.active = true;
    return node;
  }

  private createLabelNode(): Node {
    const node = new Node(NODE_NAMES.LABEL);
    node.addComponent(UITransform).setAnchorPoint(0, 0.5);

    const label = node.addComponent(Label);
    label.fontSize = PAYTABLE_CONSTANTS.LABEL_FONT_SIZE;
    label.lineHeight = PAYTABLE_CONSTANTS.LABEL_LINE_HEIGHT;
    label.cacheMode = Label.CacheMode.CHAR;

    return node;
  }

  private returnToPool(node: Node, pool: Node[]): void {
    node.active = false;
    node.removeFromParent();
    pool.push(node);
  }

  // ==========================================
  // Rendering
  // ==========================================

  private async renderPaytable(): Promise<void> {
    if (!this.contentContainer) return;

    this.clearActiveNodes();

    const symbols = SymbolData.getAllSymbols();
    this.updateContentHeight(symbols.length);

    let currentY = -PAYTABLE_CONSTANTS.ITEM_HEIGHT / 2;

    for (const symbolInfo of symbols) {
      this.renderSymbolIcon(symbolInfo, currentY);
      this.renderSymbolLabel(symbolInfo, currentY);
      currentY -= PAYTABLE_CONSTANTS.ITEM_HEIGHT;
    }

    this.scrollToTop();
  }

  private clearActiveNodes(): void {
    this.activeIcons.forEach((node) => this.returnToPool(node, this.iconPool));
    this.activeLabels.forEach((node) =>
      this.returnToPool(node, this.labelPool)
    );
    this.activeIcons.length = 0;
    this.activeLabels.length = 0;
  }

  private updateContentHeight(symbolCount: number): void {
    const totalHeight = symbolCount * PAYTABLE_CONSTANTS.ITEM_HEIGHT;
    const contentUI = this.contentContainer.getComponent(UITransform);
    if (contentUI) {
      contentUI.height = totalHeight;
    }
  }

  private renderSymbolIcon(
    symbolInfo: ReturnType<typeof SymbolData.getAllSymbols>[0],
    yPosition: number
  ): void {
    const iconNode = this.getIconFromPool();
    this.iconsLayer.addChild(iconNode);
    this.activeIcons.push(iconNode);
    iconNode.setPosition(PAYTABLE_CONSTANTS.ICON_X_POSITION, yPosition);

    const sprite = iconNode.getComponent(Sprite);
    if (sprite) {
      const sf = this.spriteFrameCache.getSpriteFrame(
        BundleName.SYMBOLS,
        symbolInfo.spritePath
      );
      if (sf) {
        sprite.spriteFrame = sf;
      }
    }
  }

  private renderSymbolLabel(
    symbolInfo: ReturnType<typeof SymbolData.getAllSymbols>[0],
    yPosition: number
  ): void {
    const labelNode = this.getLabelFromPool();
    this.labelsLayer.addChild(labelNode);
    this.activeLabels.push(labelNode);
    labelNode.setPosition(PAYTABLE_CONSTANTS.LABEL_X_POSITION, yPosition);

    const label = labelNode.getComponent(Label);
    if (label) {
      label.string = this.formatPayoutText(symbolInfo);
    }
  }

  private formatPayoutText(
    symbolInfo: ReturnType<typeof SymbolData.getAllSymbols>[0]
  ): string {
    const payouts = symbolInfo.paytable;
    const x3 = (payouts[3] * this.currentBet).toFixed(2);
    const x4 = (payouts[4] * this.currentBet).toFixed(2);
    const x5 = (payouts[5] * this.currentBet).toFixed(2);

    return `${symbolInfo.name}\n5x: ${x5} | 4x: ${x4} | 3x: ${x3}`;
  }

  private scrollToTop(): void {
    if (this.scrollView) {
      this.scrollView.scrollToTop(PAYTABLE_CONSTANTS.SCROLL_DURATION);
    }
  }

  // ==========================================
  // Lifecycle
  // ==========================================

  protected onDisable(): void {
    this.clearActiveNodes();
  }
}
