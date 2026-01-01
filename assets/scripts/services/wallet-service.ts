import { GameConfig } from "../data/config/game-config";
import { PlayerDataStorage } from "../utils/storage/player-data-storage";
import { EventManager } from "../core/events/event-manager";
import { Logger } from "../utils/helpers/logger";
import { SlotService } from "./slot-service";

const logger = Logger.create("WalletService");

export class WalletService {
  private static _instance: WalletService | null = null;

  private _coins: number = 0;
  private _currentBet: number = 0;
  private _currentBetIndex: number = 0;
  private _isInitialized: boolean = false;
  private _syncQueue: Promise<void> = Promise.resolve();
  private _isSyncing: boolean = false;

  public static getInstance(): WalletService {
    if (!this._instance) {
      this._instance = new WalletService();
    }
    return this._instance;
  }

  public async init(): Promise<void> {
    if (this._isInitialized) return;

    await new Promise((resolve) => setTimeout(resolve, 800));

    const mockApiResponse = {
      success: true,
      data: {
        coins: GameConfig.DEFAULT_COINS + Math.floor(Math.random() * 500),
        bet: GameConfig.BET_STEPS[GameConfig.DEFAULT_BET_INDEX],
        betIndex: GameConfig.DEFAULT_BET_INDEX,
      },
    };

    const localData = PlayerDataStorage.load(
      mockApiResponse.data.coins,
      mockApiResponse.data.bet
    );

    this._coins = localData.coins;
    this._currentBet = localData.bet;
    this._currentBetIndex = localData.betIndex;
    this._isInitialized = true;

    this.onDataChanged();
  }

  public get coins(): number {
    return this._coins;
  }

  public get currentBet(): number {
    return this._currentBet;
  }

  public get currentBetIndex(): number {
    return this._currentBetIndex;
  }

  public canAfford(amount: number): boolean {
    return this._coins >= amount;
  }

  public addCoins(amount: number): void {
    if (amount <= 0) return;
    this._coins += amount;
    this.onDataChanged();
    this.queueSync();
  }

  public deductCoins(amount: number): boolean {
    if (!this.canAfford(amount)) return false;
    this._coins -= amount;
    this.onDataChanged();
    this.queueSync();
    return true;
  }

  public setBetIndex(index: number): void {
    if (index < 0 || index >= GameConfig.BET_STEPS.length) return;
    this._currentBetIndex = index;
    this._currentBet = GameConfig.BET_STEPS[this._currentBetIndex];
    this.onDataChanged(false, true); // Emit bet changed event
  }

  public increaseBet(): void {
    this.setBetIndex(this._currentBetIndex + 1);
  }

  public decreaseBet(): void {
    this.setBetIndex(this._currentBetIndex - 1);
  }

  public setMaxBet(): void {
    this.setBetIndex(GameConfig.BET_STEPS.length - 1);
  }

  private queueSync(): void {
    this._syncQueue = this._syncQueue
      .then(() => this.syncWithServer())
      .catch((error) => {
        logger.error("Sync queue error:", error);
      });
  }

  private async syncWithServer(retries = 3): Promise<void> {
    this._isSyncing = true;
    let lastError: any = null;

    try {
      const coinsToSync = this._coins;

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          await SlotService.getInstance().syncPlayerData(coinsToSync);
          return;
        } catch (error) {
          lastError = error;
          logger.warn(`Sync attempt ${attempt + 1}/${retries} failed:`, error);

          if (attempt < retries - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, Math.pow(2, attempt) * 500)
            );
          }
        }
      }

      logger.error(
        "Failed to sync wallet with server after retries",
        lastError
      );
    } finally {
      this._isSyncing = false;
    }
  }

  private onDataChanged(
    coinsChanged: boolean = true,
    betChanged: boolean = false
  ): void {
    PlayerDataStorage.save(this._coins, this._currentBet);

    if (coinsChanged) {
      EventManager.emit(GameConfig.EVENTS.COINS_CHANGED, this._coins);
    }

    if (betChanged) {
      EventManager.emit(GameConfig.EVENTS.BET_CHANGED, this._currentBet);
    }
  }
}
