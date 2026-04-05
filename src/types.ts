export interface GameRecord {
  id: string;
  timestamp: number;
  type: 'win' | 'lose';
  amount: number;
  profit: number;
  stars: number;
  multiplier: number;
  mines: number;
}

export interface SessionSummary {
  id: string;
  timestamp: number;
  profit: number;
  endReason: 'goal' | 'stop-loss' | 'manual';
  turns: number;
  startBalance: number;
  endBalance: number;
  maxConsecutiveLosses: number;
  maxCumulativeLoss: number;
}

export interface WithdrawalRecord {
  id: string;
  timestamp: number;
  amount: number;
  method: 'bank_transfer' | 'mobile_money' | 'crypto';
  status: 'pending' | 'completed' | 'failed';
  notes?: string;
}

export interface AppState {
  realBalance: number;
  initialRealBalance: number;
  dailyGoal: number;
  sessionGoal: number;
  sessionsCompleted: number;
  stopLoss: number;
  baseBet: number;
  martingaleFactor: number;
  history: GameRecord[];
  virtualBalance: number;
  turnsToday: number;
  sessionHistory?: SessionSummary[];
  customApiKey?: string;
  lastSessionEndTime?: number;
  nextSessionStartTime?: number;
  defaultCapital: number;
  sessionStartBalance: number;
  withdrawalHistory?: WithdrawalRecord[];
  // Prediction mode
  useRandomPrediction?: boolean;
  // Withdrawal tracking
  lastWithdrawalDate?: number;
  withdrawalCycleStart?: number;
  withdrawalCycleGains?: number;
  // Stop-loss tracking
  stopLossActive?: boolean;
  stopLossRecoveredAt?: number;
}

export interface PredictionResult {
  recommendedCells: number[];
  confidence: number;
  reasoning: string;
}
