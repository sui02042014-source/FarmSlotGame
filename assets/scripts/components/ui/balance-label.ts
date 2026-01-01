import { _decorator, Component, Label } from "cc";
import { GameConfig } from "../../data/config/game-config";
import { EventManager } from "../../core/events/event-manager";
import { WalletService } from "../../services/wallet-service";

const { ccclass, property } = _decorator;

/**
 * BalanceLabel automatically updates its string value when coins change.
 * This decouples UI labels from the GameManager's update loop.
 */
@ccclass("BalanceLabel")
export class BalanceLabel extends Component {
  @property(Label)
  label: Label = null!;

  @property
  prefix: string = "";

  @property
  decimalPlaces: number = 2;

  protected onLoad(): void {
    if (!this.label) {
      this.label = this.getComponent(Label)!;
    }

    EventManager.on(GameConfig.EVENTS.COINS_CHANGED, this.updateBalance, this);
  }

  protected start(): void {
    const wallet = WalletService.getInstance();
    this.updateBalance(wallet.coins);
  }

  protected onDestroy(): void {
    EventManager.off(GameConfig.EVENTS.COINS_CHANGED, this.updateBalance, this);
  }

  private updateBalance(coins: number): void {
    if (this.label) {
      this.label.string = `${this.prefix}${coins.toFixed(this.decimalPlaces)}`;
    }
  }
}
