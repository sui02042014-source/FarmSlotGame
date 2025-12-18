import { _decorator, Label, Button } from "cc";
import { BaseModal } from "./BaseModal";
import { GameManager } from "../game/GameManager";
const { ccclass, property } = _decorator;

/**
 * Not Enough Coins Modal - Hiển thị khi người chơi không đủ tiền
 */
@ccclass("NotEnoughCoinsModal")
export class NotEnoughCoinsModal extends BaseModal {
  @property(Label)
  messageLabel: Label = null!;

  @property(Label)
  requiredAmountLabel: Label = null!;

  @property(Label)
  currentAmountLabel: Label = null!;

  @property(Button)
  buyCoinsButton: Button = null!;

  @property(Button)
  watchAdButton: Button = null!;

  private requiredAmount: number = 0;
  private currentAmount: number = 0;

  protected onLoad(): void {
    super.onLoad();

    // Setup button listeners
    if (this.buyCoinsButton) {
      this.buyCoinsButton.node.on(
        Button.EventType.CLICK,
        this.onBuyCoinsClick,
        this
      );
    }

    if (this.watchAdButton) {
      this.watchAdButton.node.on(
        Button.EventType.CLICK,
        this.onWatchAdClick,
        this
      );
    }
  }

  protected onDestroy(): void {
    super.onDestroy();

    if (this.buyCoinsButton) {
      this.buyCoinsButton.node.off(
        Button.EventType.CLICK,
        this.onBuyCoinsClick,
        this
      );
    }

    if (this.watchAdButton) {
      this.watchAdButton.node.off(
        Button.EventType.CLICK,
        this.onWatchAdClick,
        this
      );
    }
  }

  protected onDataSet(data: any): void {
    this.requiredAmount = data.requiredAmount || 0;
    this.currentAmount = data.currentAmount || 0;

    this.updateUI();
  }

  /**
   * Update UI with coin data
   */
  private updateUI(): void {
    if (this.messageLabel) {
      this.messageLabel.string = "Not enough coins to spin!";
    }

    if (this.requiredAmountLabel) {
      this.requiredAmountLabel.string = `Required: ${this.requiredAmount.toFixed(
        2
      )}`;
    }

    if (this.currentAmountLabel) {
      this.currentAmountLabel.string = `Your coins: ${this.currentAmount.toFixed(
        2
      )}`;
    }
  }

  /**
   * Called when Buy Coins button is clicked
   */
  private onBuyCoinsClick(): void {
    console.log("[NotEnoughCoinsModal] Buy Coins clicked");
    // TODO: Implement IAP (In-App Purchase) logic
    // For now, just give some coins for testing
    const gameManager = GameManager.getInstance();
    if (gameManager) {
      gameManager.addCoins(100);
    }
    this.hide();
  }

  /**
   * Called when Watch Ad button is clicked
   */
  private onWatchAdClick(): void {
    console.log("[NotEnoughCoinsModal] Watch Ad clicked");
    // TODO: Implement Rewarded Ad logic
    // For now, just give some coins for testing
    const gameManager = GameManager.getInstance();
    if (gameManager) {
      gameManager.addCoins(25);
    }
    this.hide();
  }

  /**
   * Called when Close button is clicked
   */
  public onLowerBetClick(): void {
    console.log("[NotEnoughCoinsModal] Lower Bet clicked");
    // Automatically lower the bet to an affordable amount
    const gameManager = GameManager.getInstance();
    if (gameManager) {
      // Try to find an affordable bet
      // This is just a simple implementation
      while (gameManager.getCurrentBet() > gameManager.getPlayerCoins()) {
        gameManager.decreaseBet();
      }
    }
    this.hide();
  }
}
