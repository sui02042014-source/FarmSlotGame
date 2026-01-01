import { GameConfig } from "../data/config/game-config";
import { PlayerDataStorage } from "../utils/storage/player-data-storage";
import { EventManager } from "../core/events/event-manager";
import { Logger } from "../utils/helpers/logger";
import { SlotService } from "./slot-service";

const logger = Logger.create("WalletService");

export enum TransactionType {
  BET = "bet",
  WIN = "win",
  REFUND = "refund",
  FREE_COINS = "free_coins",
}

export enum TransactionStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  REFUNDED = "refunded",
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  timestamp: number;
  status: TransactionStatus;
  details?: any;
}

export class WalletService {
  private static _instance: WalletService | null = null;

  private _coins: number = 0;
  private _currentBet: number = 0;
  private _currentBetIndex: number = 0;
  private _isInitialized: boolean = false;
  private _syncQueue: Promise<void> = Promise.resolve();
  private _isSyncing: boolean = false;
  private _transactions: Transaction[] = [];
  private _pendingTransaction: Transaction | null = null;
  private readonly MAX_TRANSACTION_HISTORY = 100;

  public static getInstance(): WalletService {
    if (!this._instance) {
      this._instance = new WalletService();
    }
    return this._instance;
  }

  public async init(): Promise<void> {
    if (this._isInitialized) return;

    await new Promise((resolve) =>
      setTimeout(resolve, GameConfig.NETWORK.INIT_DELAY_MS)
    );

    const mockApiResponse = {
      success: true,
      data: {
        coins:
          GameConfig.DEFAULT_COINS +
          Math.floor(Math.random() * GameConfig.RANDOM_COINS_BONUS_MAX),
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
    if (!Number.isFinite(amount) || amount < 0) {
      return false;
    }
    return this._coins >= amount;
  }

  public addCoins(amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0) {
      logger.warn("Invalid amount for addCoins:", amount);
      return false;
    }

    const newCoins = this._coins + amount;

    if (!Number.isFinite(newCoins) || newCoins > Number.MAX_SAFE_INTEGER) {
      logger.error("Coin overflow detected, amount:", amount);
      return false;
    }

    this._coins = newCoins;
    this.onDataChanged();
    this.queueSync();
    return true;
  }

  public deductCoins(amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0) {
      logger.warn("Invalid amount for deductCoins:", amount);
      return false;
    }

    if (!this.canAfford(amount)) return false;

    const transaction = this.createTransaction(
      TransactionType.BET,
      amount,
      TransactionStatus.PENDING
    );
    this._pendingTransaction = transaction;

    this._coins -= amount;
    this.onDataChanged();
    this.queueSync();

    logger.info(`Bet placed: ${amount} coins (Transaction: ${transaction.id})`);
    return true;
  }

  public completeBetTransaction(winAmount: number): void {
    if (
      this._pendingTransaction &&
      this._pendingTransaction.type === TransactionType.BET
    ) {
      this._pendingTransaction.status = TransactionStatus.COMPLETED;
      this._pendingTransaction.details = { winAmount };
      this.addTransactionToHistory(this._pendingTransaction);

      if (winAmount > 0) {
        const winTransaction = this.createTransaction(
          TransactionType.WIN,
          winAmount,
          TransactionStatus.COMPLETED
        );
        this.addTransactionToHistory(winTransaction);
      }

      this._pendingTransaction = null;
      logger.info(`Transaction completed. Win: ${winAmount}`);
    }
  }

  public refundPendingTransaction(): boolean {
    if (!this._pendingTransaction) {
      logger.warn("No pending transaction to refund");
      return false;
    }

    const refundAmount = this._pendingTransaction.amount;
    this._pendingTransaction.status = TransactionStatus.REFUNDED;
    this.addTransactionToHistory(this._pendingTransaction);

    const refundTransaction = this.createTransaction(
      TransactionType.REFUND,
      refundAmount,
      TransactionStatus.COMPLETED,
      { originalTransactionId: this._pendingTransaction.id }
    );
    this.addTransactionToHistory(refundTransaction);

    this._coins += refundAmount;
    this._pendingTransaction = null;
    this.onDataChanged();

    logger.info(`Transaction refunded: ${refundAmount} coins`);
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

  private createTransaction(
    type: TransactionType,
    amount: number,
    status: TransactionStatus,
    details?: any
  ): Transaction {
    return {
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      type,
      amount,
      timestamp: Date.now(),
      status,
      details,
    };
  }

  private addTransactionToHistory(transaction: Transaction): void {
    this._transactions.push(transaction);

    if (this._transactions.length > this.MAX_TRANSACTION_HISTORY) {
      this._transactions.shift();
    }
  }

  public getTransactionHistory(): Transaction[] {
    return [...this._transactions];
  }

  public getPendingTransaction(): Transaction | null {
    return this._pendingTransaction;
  }

  public clearTransactionHistory(): void {
    this._transactions = [];
    logger.info("Transaction history cleared");
  }
}
