import { GameConfig } from "../data/config/game-config";
import { PlayerDataStorage } from "../utils/storage/player-data-storage";
import { EventManager } from "../core/events/event-manager";
import { Logger } from "../utils/helpers/logger";
import { SlotService } from "./slot-service";

const logger = Logger.create("WalletService");

const WALLET_CONSTANTS = {
  MAX_TRANSACTION_HISTORY: 100,
  DEFAULT_SYNC_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 500,
} as const;

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
  details?: unknown;
}

export class WalletService {
  private static instance: WalletService | null = null;

  private _coins: number = 0;
  private _currentBet: number = 0;
  private _currentBetIndex: number = 0;
  private _isInitialized: boolean = false;
  private _syncQueue: Promise<void> = Promise.resolve();
  private _isSyncing: boolean = false;
  private _transactions: Transaction[] = [];
  private _pendingTransaction: Transaction | null = null;

  private slotService = SlotService.getInstance();

  // ==========================================
  // Singleton
  // ==========================================

  public static getInstance(): WalletService {
    if (!this.instance) {
      this.instance = new WalletService();
    }
    return this.instance;
  }

  // ==========================================
  // Initialization
  // ==========================================

  public async init(): Promise<void> {
    if (this._isInitialized) return;

    await this.delay(GameConfig.NETWORK.INIT_DELAY_MS);

    const apiData = this.generateMockApiData();
    const localData = PlayerDataStorage.load(apiData.coins, apiData.bet);

    this.applyInitialData(localData);
    this._isInitialized = true;
    this.onDataChanged();
  }

  private generateMockApiData() {
    return {
      coins:
        GameConfig.DEFAULT_COINS +
        Math.floor(Math.random() * GameConfig.RANDOM_COINS_BONUS_MAX),
      bet: GameConfig.BET_STEPS[GameConfig.DEFAULT_BET_INDEX],
      betIndex: GameConfig.DEFAULT_BET_INDEX,
    };
  }

  private applyInitialData(data: {
    coins: number;
    bet: number;
    betIndex: number;
  }): void {
    this._coins = data.coins;
    this._currentBet = data.bet;
    this._currentBetIndex = data.betIndex;
  }

  // ==========================================
  // Getters
  // ==========================================

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
    return this.isValidPositiveAmount(amount) && this._coins >= amount;
  }

  // ==========================================
  // Coin Operations
  // ==========================================

  public addCoins(amount: number): boolean {
    if (!this.isValidPositiveAmount(amount)) {
      logger.warn("Invalid amount for addCoins:", amount);
      return false;
    }

    if (!this.isWithinSafeRange(amount)) {
      logger.error("Coin overflow detected, amount:", amount);
      return false;
    }

    this._coins += amount;
    this.onDataChanged();
    this.queueSync();
    return true;
  }

  public deductCoins(amount: number): boolean {
    if (!this.isValidPositiveAmount(amount)) {
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

  // ==========================================
  // Transaction Management
  // ==========================================

  public completeBetTransaction(winAmount: number): void {
    if (!this.hasPendingBetTransaction()) return;

    this._pendingTransaction!.status = TransactionStatus.COMPLETED;
    this._pendingTransaction!.details = { winAmount };
    this.addTransactionToHistory(this._pendingTransaction!);

    if (winAmount > 0) {
      this.addWinTransaction(winAmount);
    }

    this._pendingTransaction = null;
    logger.info(`Transaction completed. Win: ${winAmount}`);
  }

  public refundPendingTransaction(): boolean {
    if (!this._pendingTransaction) {
      logger.warn("No pending transaction to refund");
      return false;
    }

    const refundAmount = this._pendingTransaction.amount;
    this.markTransactionAsRefunded(this._pendingTransaction);
    this.createAndAddRefundTransaction(
      refundAmount,
      this._pendingTransaction.id
    );

    this._coins += refundAmount;
    this._pendingTransaction = null;
    this.onDataChanged();

    logger.info(`Transaction refunded: ${refundAmount} coins`);
    return true;
  }

  private hasPendingBetTransaction(): boolean {
    return (
      this._pendingTransaction !== null &&
      this._pendingTransaction.type === TransactionType.BET
    );
  }

  private addWinTransaction(winAmount: number): void {
    const winTransaction = this.createTransaction(
      TransactionType.WIN,
      winAmount,
      TransactionStatus.COMPLETED
    );
    this.addTransactionToHistory(winTransaction);
  }

  private markTransactionAsRefunded(transaction: Transaction): void {
    transaction.status = TransactionStatus.REFUNDED;
    this.addTransactionToHistory(transaction);
  }

  private createAndAddRefundTransaction(
    amount: number,
    originalId: string
  ): void {
    const refundTransaction = this.createTransaction(
      TransactionType.REFUND,
      amount,
      TransactionStatus.COMPLETED,
      { originalTransactionId: originalId }
    );
    this.addTransactionToHistory(refundTransaction);
  }

  // ==========================================
  // Bet Management
  // ==========================================

  public setBetIndex(index: number): void {
    if (!this.isValidBetIndex(index)) return;

    this._currentBetIndex = index;
    this._currentBet = GameConfig.BET_STEPS[this._currentBetIndex];
    this.onDataChanged(false, true);
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

  private isValidBetIndex(index: number): boolean {
    return index >= 0 && index < GameConfig.BET_STEPS.length;
  }

  // ==========================================
  // Synchronization
  // ==========================================

  private queueSync(): void {
    this._syncQueue = this._syncQueue
      .then(() => this.syncWithServer())
      .catch((error) => {
        logger.error("Sync queue error:", error);
      });
  }

  private async syncWithServer(
    retries = WALLET_CONSTANTS.DEFAULT_SYNC_RETRIES
  ): Promise<void> {
    this._isSyncing = true;

    try {
      await this.attemptSyncWithRetry(retries);
    } finally {
      this._isSyncing = false;
    }
  }

  private async attemptSyncWithRetry(retries: number): Promise<void> {
    const coinsToSync = this._coins;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await this.slotService.syncPlayerData(coinsToSync);
        return;
      } catch (error) {
        lastError = error;
        this.logSyncAttemptFailure(attempt, retries, error);

        if (this.shouldRetry(attempt, retries)) {
          await this.delay(this.calculateRetryDelay(attempt));
        }
      }
    }

    this.logSyncFailure(lastError);
  }

  private logSyncAttemptFailure(
    attempt: number,
    maxRetries: number,
    error: unknown
  ): void {
    logger.warn(`Sync attempt ${attempt + 1}/${maxRetries} failed:`, error);
  }

  private shouldRetry(attempt: number, maxRetries: number): boolean {
    return attempt < maxRetries - 1;
  }

  private calculateRetryDelay(attempt: number): number {
    return Math.pow(2, attempt) * WALLET_CONSTANTS.RETRY_BASE_DELAY_MS;
  }

  private logSyncFailure(error: unknown): void {
    logger.error("Failed to sync wallet with server after retries", error);
  }

  // ==========================================
  // Event & Storage
  // ==========================================

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

  // ==========================================
  // Transaction Helpers
  // ==========================================

  private createTransaction(
    type: TransactionType,
    amount: number,
    status: TransactionStatus,
    details?: unknown
  ): Transaction {
    return {
      id: this.generateTransactionId(),
      type,
      amount,
      timestamp: Date.now(),
      status,
      details,
    };
  }

  private generateTransactionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 11);
    return `txn_${timestamp}_${random}`;
  }

  private addTransactionToHistory(transaction: Transaction): void {
    this._transactions.push(transaction);

    if (this._transactions.length > WALLET_CONSTANTS.MAX_TRANSACTION_HISTORY) {
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
    this._transactions.length = 0;
    logger.info("Transaction history cleared");
  }

  // ==========================================
  // Validation Helpers
  // ==========================================

  private isValidPositiveAmount(amount: number): boolean {
    return Number.isFinite(amount) && amount > 0;
  }

  private isWithinSafeRange(amount: number): boolean {
    const newCoins = this._coins + amount;
    return Number.isFinite(newCoins) && newCoins <= Number.MAX_SAFE_INTEGER;
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
