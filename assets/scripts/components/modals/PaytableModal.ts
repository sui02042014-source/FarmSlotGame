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

const { ccclass, property } = _decorator;

const SYMBOL_NAME_MAP: Record<string, string> = {
  pig: "9_Pig",
  cow: "10_Cow",
  chicken: "7_Hen",
  rabbit: "8_Rabbit",
  hay: "6_Cart_with_hay",
  truck: "11_Truck",
  barn: "13_Bonus_Mill",
  symbol_a: "5_Tomato",
  symbol_k: "2_Carrot",
  symbol_q: "4_Eggplant",
  symbol_j: "3_Watermelon",
  symbol_10: "1_Pumpkin",
  wild: "12_Wild_Girl",
  scatter: "Experience_star",
};

@ccclass("PaytableModal")
export class PaytableModal extends BaseModal {
  @property(ScrollView)
  scrollView: ScrollView = null!;

  @property(Node)
  contentContainer: Node = null!;

  @property(Prefab)
  itemPrefab: Prefab = null!;

  private _currentBet: number = 1.0;

  public setData(data: any): void {
    if (data && data.currentBet) {
      this._currentBet = data.currentBet;
    }
    this.renderPaytable();
  }

  private async renderPaytable() {
    if (!this.contentContainer || !this.itemPrefab) return;

    this.contentContainer.removeAllChildren();
    const paytableData = GameConfig.PAYTABLE;
    const cache = SpriteFrameCache.getInstance();

    for (const symbolKey in paytableData) {
      const payouts = paytableData[symbolKey as keyof typeof paytableData];
      const itemNode = instantiate(this.itemPrefab);
      this.contentContainer.addChild(itemNode);

      const iconSprite = itemNode.getChildByName("Icon")?.getComponent(Sprite);
      if (iconSprite) {
        const actualName = SYMBOL_NAME_MAP[symbolKey] || symbolKey;
        const sf = cache.getSpriteFrame(BundleName.SYMBOLS, actualName);

        if (sf && iconSprite.isValid) {
          iconSprite.spriteFrame = sf;
          iconSprite.getComponent(UITransform).setContentSize(80, 80);
        }
      }

      const labelComp = itemNode.getChildByName("Label")?.getComponent(Label);
      if (labelComp) {
        labelComp.string = `${symbolKey} x ${payouts[3]} x ${
          this._currentBet
        } = ${payouts[3] * this._currentBet}`;
      }
    }

    this.scrollView.scrollToTop(0);
  }
}
