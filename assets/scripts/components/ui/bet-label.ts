import { _decorator, Component, Label } from "cc";
import { GameConfig } from "../../data/config/game-config";
import { EventManager } from "../../core/events/event-manager";
import { WalletService } from "../../services/wallet-service";

const { ccclass, property } = _decorator;

@ccclass("BetLabel")
export class BetLabel extends Component {
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

    EventManager.on(GameConfig.EVENTS.BET_CHANGED, this.updateBet, this);
  }

  protected start(): void {
    const wallet = WalletService.getInstance();
    this.updateBet(wallet.currentBet);
  }

  protected onDestroy(): void {
    EventManager.off(GameConfig.EVENTS.BET_CHANGED, this.updateBet, this);
  }

  private updateBet(bet: number): void {
    if (this.label) {
      this.label.string = `${this.prefix}${bet.toFixed(this.decimalPlaces)}`;
    }
  }
}
