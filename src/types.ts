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
}

export interface PredictionResult {
  recommendedCells: number[];
  confidence: number;
  reasoning: string;
}
