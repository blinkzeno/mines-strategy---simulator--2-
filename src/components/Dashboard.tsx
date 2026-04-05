import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Brain,
  Camera,
  Plus,
  AlertCircle,
  Loader2,
  Settings,
  RefreshCw,
  Trophy,
  ShieldAlert,
  History as HistoryIcon,
  Calendar,
  Wallet,
  Banknote,
  ArrowUpRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  AppState,
  GameRecord,
  PredictionResult,
  SessionSummary,
  WithdrawalRecord,
} from "../types";
import {
  analyzeScreenshot,
  getStrategyRecommendation,
} from "../services/gemini";

interface DashboardProps {
  state: AppState;
  onAddRecord: (record: GameRecord) => void;
  onUpdateState: (updates: Partial<AppState>) => void;
  onWithdrawal: (withdrawal: Omit<WithdrawalRecord, 'id' | 'timestamp'>) => WithdrawalRecord;
}

const MULTIPLIERS: Record<number, number> = {
  1: 1.06,
  2: 1.22,
  3: 1.4,
  4: 1.62,
  5: 1.89,
  6: 2.23,
  7: 2.64,
  8: 3.17,
  9: 3.81,
  10: 4.57,
};

export default function Dashboard({
  state,
  onAddRecord,
  onUpdateState,
  onWithdrawal,
}: DashboardProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [strategy, setStrategy] = useState<{
    nextBet: number;
    targetMultiplier: number;
    advice: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiSuggestions, setAiSuggestions] = useState<number[]>([]);

  // Withdrawal form state
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalMethod, setWithdrawalMethod] = useState<WithdrawalRecord['method']>('bank_transfer');
  const [withdrawalNotes, setWithdrawalNotes] = useState('');

  // Patterns optimaux basés sur le rapport de simulation (TOP 20)
  const OPTIMAL_PATTERNS = [
    { rank: 1, cells: [0, 3, 4, 20, 21, 24], name: "Coins Opposés", score: 0.90513 },     // 1-4-5-21-22-25
    { rank: 2, cells: [0, 4, 5, 19, 20, 24], name: "Diagonal Coins", score: 0.90511 },    // 1-5-6-20-21-25
    { rank: 3, cells: [0, 4, 9, 15, 20, 24], name: "Extended Z", score: 0.90510 },        // 1-5-10-16-21-25
    { rank: 4, cells: [0, 1, 4, 20, 23, 24], name: "Z-Pattern", score: 0.90510 },          // 1-2-5-21-24-25
    { rank: 5, cells: [0, 4, 9, 20, 21, 24], name: "Top-Bottom", score: 0.90258 },         // 1-5-10-21-22-25
    { rank: 6, cells: [0, 3, 4, 15, 20, 24], name: "L-Extended", score: 0.90258 },        // 1-4-5-16-21-25
    { rank: 7, cells: [0, 4, 5, 20, 23, 24], name: "Corner Spread", score: 0.90257 },    // 1-5-6-21-24-25
    { rank: 8, cells: [0, 1, 4, 19, 20, 24], name: "Double Edge", score: 0.90256 },        // 1-2-5-20-21-25
    { rank: 9, cells: [0, 1, 4, 20, 21, 24], name: "X-Corners", score: 0.89999 },         // 1-2-5-21-22-25
    { rank: 10, cells: [0, 4, 5, 9, 20, 24], name: "Triple Edge", score: 0.89998 },      // 1-5-6-10-21-25
  ];

  // Named patterns from the report
  const NAMED_PATTERNS = [
    { name: "🏆 Coins Opposés", cells: [0, 3, 4, 20, 21, 24], rank: "#1", desc: "4 coins + 2 bords intermédiaires" },
    { name: "Z-Pattern", cells: [0, 1, 4, 20, 23, 24], rank: "#4", desc: "Coins haut + coins bas + bords" },
    { name: "Carré Externe", cells: [0, 2, 4, 20, 23, 24], rank: "~#20", desc: "4 coins + 2 milieux bords" },
    { name: "Anti-Cluster", cells: [0, 4, 12, 16, 20, 24], rank: "~#150", desc: "Maximum de distance entre cases" },
  ];

  const [currentPattern, setCurrentPattern] = useState<typeof OPTIMAL_PATTERNS[0] | null>(null);
  const [useRandomPrediction, setUseRandomPrediction] = useState(state.useRandomPrediction || false);

  const generateNewSuggestions = (bet: number, losses: number, isRandom: boolean) => {
    // TOUJOURS 6 cases, indépendamment du montant parié
    const STAR_COUNT = 6;

    if (isRandom) {
      // Mode aléatoire: générer 6 cases complètement aléatoires
      const suggested: number[] = [];
      while (suggested.length < STAR_COUNT) {
        const cell = Math.floor(Math.random() * 25);
        if (!suggested.includes(cell)) {
          suggested.push(cell);
        }
      }
      setCurrentPattern(null);
      setAiSuggestions(suggested);
      return;
    }

    // Mode optimal basé sur les pertes consécutives
    let selectedPattern;
    
    if (losses === 0) {
      selectedPattern = OPTIMAL_PATTERNS[Math.floor(Math.random() * 5)];
    } else if (losses === 1) {
      selectedPattern = OPTIMAL_PATTERNS[Math.floor(Math.random() * 3)];
    } else if (losses === 2) {
      selectedPattern = OPTIMAL_PATTERNS[Math.floor(Math.random() * 2)];
    } else {
      selectedPattern = OPTIMAL_PATTERNS[0];
    }

    setCurrentPattern(selectedPattern);
    
    const variedCells = selectedPattern.cells.map(cell => {
      if (Math.random() < 0.2) {
        const variation = Math.random() < 0.5 ? -1 : 1;
        const newCell = cell + variation;
        if (newCell >= 0 && newCell < 25) return newCell;
      }
      return cell;
    });

    setAiSuggestions(variedCells);
  };

  // Calculate consecutive losses and total amount lost from history
  const lossStats = useMemo(() => {
    let count = 0;
    let totalAmount = 0;
    for (const record of state.history) {
      if (record.type === "lose") {
        count++;
        totalAmount += record.amount;
      } else {
        break;
      }
    }
    return { count, totalAmount };
  }, [state.history]);

  const consecutiveLosses = lossStats.count;
  const consecutiveLostAmount = lossStats.totalAmount;

  const currentSessionProfit = state.realBalance - state.sessionStartBalance;
  const currentSessionLoss = Math.max(
    0,
    state.sessionStartBalance - state.realBalance,
  );

  // Martingale calculation: baseBet * (factor ^ losses)
  const currentMartingaleBet = Math.round(
    state.baseBet * Math.pow(state.martingaleFactor, consecutiveLosses),
  );

  const handleQuickLog = (type: "win" | "lose") => {
    const amount = currentMartingaleBet;
    const starCount = 6; // TOUJOURS 6 cases
    const multiplier = type === "win" ? MULTIPLIERS[starCount] : 1.0;
    const profit =
      type === "win" ? Math.floor(amount * multiplier - amount) : 0;

    onAddRecord({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      type,
      amount,
      profit,
      stars: type === "win" ? starCount : 0,
      multiplier,
      mines: 3,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const result = await analyzeScreenshot(base64, state.customApiKey);
      setPrediction(result);
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleGetStrategy = async () => {
    setIsAnalyzing(true);
    const result = await getStrategyRecommendation(
      state.history,
      state.realBalance,
      state.customApiKey,
    );
    setStrategy(result);
    setIsAnalyzing(false);
  };

  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    // Initialize timer if not set but we are in a restricted time window
    if (!state.nextSessionStartTime) {
      const initialNext = calculateNextSessionTime(
        state.sessionsCompleted || 0,
      );
      if (initialNext && initialNext > Date.now()) {
        onUpdateState({ nextSessionStartTime: initialNext });
      }
    }
  }, []);

  useEffect(() => {
    generateNewSuggestions(currentMartingaleBet, consecutiveLosses, useRandomPrediction);
  }, [state.history.length, currentMartingaleBet, consecutiveLosses, useRandomPrediction]);

  useEffect(() => {
    if (!state.nextSessionStartTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = state.nextSessionStartTime! - now;

      if (diff <= 0) {
        // If it's a new day (3 AM), reset turns and sessions
        const nextDate = new Date(state.nextSessionStartTime!);
        if (nextDate.getHours() === 3) {
          onUpdateState({
            nextSessionStartTime: undefined,
            sessionsCompleted: 0,
            turnsToday: 0,
            initialRealBalance: state.realBalance,
          });
        } else {
          onUpdateState({ nextSessionStartTime: undefined });
        }
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(
          `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state.nextSessionStartTime, state.sessionsCompleted, state.realBalance]);

  const calculateNextSessionTime = (sessionsDone: number) => {
    const now = new Date();
    const next = new Date(now);

    if (sessionsDone === 0) {
      // If before 3 AM, wait until 3 AM today
      if (now.getHours() < 3) {
        next.setHours(3, 0, 0, 0);
      } else {
        return undefined;
      }
    } else if (sessionsDone === 1) {
      // Wait until 3 PM (15:00) today
      if (now.getHours() < 15) {
        next.setHours(15, 0, 0, 0);
      } else {
        return undefined;
      }
    } else {
      // Daily goal reached (2 sessions), wait until 3 AM tomorrow
      next.setDate(now.getDate() + 1);
      next.setHours(3, 0, 0, 0);
    }
    return next.getTime();
  };

  const isSessionGoalReached = currentSessionProfit >= state.sessionGoal;

  const winRate =
    state.history.length > 0
      ? (
          (state.history.filter((h) => h.type === "win").length /
            state.history.length) *
          100
        ).toFixed(1)
      : "0.0";

  // Recovery Analysis - TOUJOURS 6 étoiles
  const currentTargetStars = 6;
  const potentialGain =
    Math.floor(currentMartingaleBet * MULTIPLIERS[currentTargetStars]) -
    currentMartingaleBet;
  const recoveryNet = potentialGain - consecutiveLostAmount;

  // Calculate withdrawal eligibility
  const totalGainsSinceLastWithdrawal = state.realBalance - (state.withdrawalCycleStart || state.initialRealBalance);
  const isWithdrawalBlocked = state.stopLossActive || totalGainsSinceLastWithdrawal <= 0;
  
  // Calculate days since last withdrawal
  const daysSinceLastWithdrawal = state.lastWithdrawalDate 
    ? Math.floor((Date.now() - state.lastWithdrawalDate) / (1000 * 60 * 60 * 24))
    : 999;
  
  // Max withdrawable amount (half of gains after 3 days if daily goals met)
  const maxWithdrawableAmount = daysSinceLastWithdrawal >= 3 && totalGainsSinceLastWithdrawal > 0
    ? Math.floor(totalGainsSinceLastWithdrawal / 2)
    : 0;
  
  const canWithdraw = !isWithdrawalBlocked && maxWithdrawableAmount > 0;

  const totalProfitSinceReset = state.realBalance - state.initialRealBalance;
  const isDailyGoalReached = totalProfitSinceReset >= 3000;
  const isStopLossReached = currentSessionLoss >= state.stopLoss;
  const isTurnLimitReached = (state.turnsToday || 0) >= 30;
  const isWaitingForNextSession = state.nextSessionStartTime
    ? Date.now() < state.nextSessionStartTime
    : false;

  const isBlocked =
    isSessionGoalReached ||
    isDailyGoalReached ||
    isStopLossReached ||
    isTurnLimitReached ||
    isWaitingForNextSession;

  const handleResetSession = () => {
    // If daily goal reached or stop loss reached, force to 2 sessions to trigger the "tomorrow 5 AM" timer
    const newSessionsCompleted =
      isDailyGoalReached || isStopLossReached
        ? 2
        : isSessionGoalReached
          ? state.sessionsCompleted + 1
          : state.sessionsCompleted;
    const nextStart = calculateNextSessionTime(newSessionsCompleted);

    let maxConsLosses = 0;
    let maxCumLoss = 0;
    let currentConsLosses = 0;
    let currentCumLoss = 0;

    for (let i = state.history.length - 1; i >= 0; i--) {
      const record = state.history[i];
      if (record.type === "lose") {
        currentConsLosses++;
        currentCumLoss += record.amount;
        if (currentConsLosses > maxConsLosses)
          maxConsLosses = currentConsLosses;
        if (currentCumLoss > maxCumLoss) maxCumLoss = currentCumLoss;
      } else {
        currentConsLosses = 0;
        currentCumLoss = 0;
      }
    }

    const summary: SessionSummary = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      profit: currentSessionProfit,
      endReason: isStopLossReached
        ? "stop-loss"
        : isSessionGoalReached
          ? "goal"
          : "manual",
      turns: state.history.length,
      startBalance: state.sessionStartBalance,
      endBalance: state.realBalance,
      maxConsecutiveLosses: maxConsLosses,
      maxCumulativeLoss: maxCumLoss,
    };

    onUpdateState({
      history: [],
      turnsToday: isTurnLimitReached ? 0 : state.turnsToday,
      realBalance: state.realBalance,
      sessionStartBalance: state.realBalance,
      sessionsCompleted: newSessionsCompleted,
      sessionHistory: [...(state.sessionHistory || []), summary],
      lastSessionEndTime: Date.now(),
      nextSessionStartTime: nextStart,
      // Track stop-loss for withdrawal blocking
      stopLossActive: isStopLossReached ? true : state.stopLossActive,
      stopLossRecoveredAt: isStopLossReached ? undefined : 
        (state.stopLossActive && currentSessionProfit > 0 ? Date.now() : state.stopLossRecoveredAt),
    });
  };

  const handleFullReset = () => {
    const input = window.prompt(
      "Réinitialisation Totale\n\nEntrez votre nouveau capital de base (F) :",
      state.defaultCapital.toString(),
    );

    if (input !== null) {
      const newCapital = parseInt(input.replace(/\s/g, ""), 10);

      if (isNaN(newCapital) || newCapital <= 0) {
        alert("Veuillez entrer un montant valide supérieur à 0.");
        return;
      }

      if (
        confirm(
          `Confirmez-vous la réinitialisation complète avec un capital de ${newCapital.toLocaleString()} F ?\n\nCela effacera tout votre historique.`,
        )
      ) {
        onUpdateState({
          history: [],
          sessionHistory: [],
          turnsToday: 0,
          realBalance: newCapital,
          initialRealBalance: newCapital,
          sessionStartBalance: newCapital,
          defaultCapital: newCapital,
          sessionsCompleted: 0,
          virtualBalance: 100000,
        });
      }
    }
  };

  const handleWithdrawal = () => {
    const amount = parseInt(withdrawalAmount.replace(/\s/g, ""), 10);
    
    if (isNaN(amount) || amount <= 0) {
      alert("Veuillez entrer un montant valide supérieur à 0.");
      return;
    }
    
    if (amount > state.realBalance) {
      alert("Le montant du retrait ne peut pas dépasser votre solde.");
      return;
    }
    
    if (isWithdrawalBlocked) {
      if (state.stopLossActive) {
        alert("Retrait bloqué: Stop-Loss atteint. Vous devez récupérer votre perte avant de pouvoir retirer.");
      } else {
        alert("Retrait bloqué: Vous devez avoir des gains positifs par rapport au solde initial pour effectuer un retrait.");
      }
      return;
    }
    
    if (daysSinceLastWithdrawal < 3) {
      alert(`Retrait disponible dans ${3 - daysSinceLastWithdrawal} jour(s). Les retraits sont autorisés tous les 3 jours uniquement.`);
      return;
    }
    
    if (amount > maxWithdrawableAmount) {
      alert(`Montant maximum de retrait: ${maxWithdrawableAmount.toLocaleString()} F (50% des gains sur 3 jours)`);
      return;
    }
    
    if (confirm(`Confirmez-vous le retrait de ${amount.toLocaleString()} F ?\n\nAprès ce retrait, vous devrez attendre 3 jours pour un nouveau retrait.`)) {
      onWithdrawal({
        amount,
        method: withdrawalMethod,
        status: 'pending',
        notes: withdrawalNotes,
      });
      
      // Update withdrawal tracking
      onUpdateState({
        lastWithdrawalDate: Date.now(),
        withdrawalCycleStart: state.realBalance - amount,
        withdrawalCycleGains: 0,
      });
      
      // Reset form
      setWithdrawalAmount('');
      setWithdrawalNotes('');
      setShowWithdrawalForm(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Modal Notification */}
      <AnimatePresence>
        {isBlocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-black/80"
          >
            {/* Background Glow for Success */}
            {!isStopLossReached && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1.5 }}
                className="absolute w-64 h-64 bg-emerald-500/20 rounded-full blur-[100px]"
              />
            )}

            <motion.div
              initial={{ scale: 0.8, y: 40, rotateX: 15 }}
              animate={{ scale: 1, y: 0, rotateX: 0 }}
              className="relative bg-[#141828] border border-white/10 rounded-[2.5rem] p-10 max-w-sm w-full text-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden"
            >
              {/* Decorative particles for success */}
              {!isStopLossReached && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{
                        y: -20,
                        x: Math.random() * 300 - 150,
                        opacity: 0,
                      }}
                      animate={{
                        y: 400,
                        opacity: [0, 1, 1, 0],
                        rotate: Math.random() * 360,
                      }}
                      transition={{
                        duration: 2 + Math.random() * 2,
                        repeat: Infinity,
                        delay: Math.random() * 2,
                      }}
                      className="absolute top-0 left-1/2 w-2 h-2 bg-emerald-400/30 rounded-full"
                    />
                  ))}
                </div>
              )}

              <div
                className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-8 shadow-2xl ${isStopLossReached ? "bg-rose-500 text-white shadow-rose-500/20" : "bg-emerald-500 text-black shadow-emerald-500/20"}`}
              >
                {isStopLossReached ? (
                  <ShieldAlert className="w-10 h-10" />
                ) : (
                  <Trophy className="w-10 h-10" />
                )}
              </div>

              <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tighter">
                {isWaitingForNextSession
                  ? "Pause Obligatoire"
                  : isStopLossReached
                    ? "Stop-Loss Atteint"
                    : isTurnLimitReached
                      ? "Limite de Tours"
                      : isDailyGoalReached
                        ? "Objectif Journalier !"
                        : "Objectif Session !"}
              </h3>

              <p className="text-sm text-[#8e9299] leading-relaxed mb-10 font-medium">
                {isWaitingForNextSession
                  ? `Discipline : Prochaine session disponible dans ${timeLeft}. Reposez-vous et restez concentré.`
                  : isStopLossReached
                    ? `Sécurité activée. Vous avez atteint votre limite de perte de ${state.stopLoss.toLocaleString()} F. Reposez-vous.`
                    : isTurnLimitReached
                      ? "Discipline avant tout. Limite de 30 tours atteinte. Revenez demain pour une nouvelle opportunité."
                      : isDailyGoalReached
                        ? "Exceptionnel ! L'objectif journalier de 3 000 F est validé. Votre capital est sécurisé pour aujourd'hui."
                        : `Bravo ! L'objectif de session de ${state.sessionGoal.toLocaleString()} F est atteint avec succès.`}
              </p>

              <div className="space-y-4">
                {!isWaitingForNextSession && (
                  <button
                    onClick={handleResetSession}
                    className={`w-full py-5 rounded-2xl font-bold text-sm uppercase tracking-[0.2em] transition-all transform active:scale-95 ${isStopLossReached ? "bg-rose-500 text-white shadow-xl shadow-rose-500/30 hover:bg-rose-600" : "bg-emerald-500 text-black shadow-xl shadow-emerald-500/30 hover:bg-emerald-400"}`}
                  >
                    {isTurnLimitReached
                      ? "Nouveau Jour"
                      : isDailyGoalReached
                        ? "Terminer la Journée"
                        : "Session Suivante"}
                  </button>
                )}

                {isWaitingForNextSession && (
                  <div className="space-y-4 w-full">
                    <div className="w-full py-5 rounded-2xl bg-[#0e1220] border border-[#252d45] flex flex-col items-center justify-center">
                      <p className="text-[10px] text-[#4a5578] uppercase tracking-widest mb-1">
                        Temps restant
                      </p>
                      <p className="text-2xl font-mono font-bold text-indigo-400">
                        {timeLeft}
                      </p>
                    </div>
                  </div>
                )}

                {isDailyGoalReached && (
                  <button
                    onClick={handleFullReset}
                    className="w-full py-3 text-[10px] font-bold text-[#4a5578] uppercase tracking-widest hover:text-rose-400 transition-colors"
                  >
                    Réinitialiser le Capital (50k)
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capital Overview */}
      <section className="bg-[#141828] border border-[#252d45] rounded-2xl p-5 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/5 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] text-[#4a5578] font-mono uppercase tracking-[0.2em]">
              Capital Réel
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleFullReset}
                className="text-[9px] font-bold text-rose-500/50 hover:text-rose-500 uppercase tracking-widest transition-colors"
              >
                Reset Total
              </button>
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${totalProfitSinceReset >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-500"}`}
              >
                {totalProfitSinceReset >= 0 ? "+" : ""}
                {(totalProfitSinceReset || 0).toLocaleString()} F Profit Total
              </div>
            </div>
          </div>
          <div className="text-center py-2">
            <p
              className={`text-5xl font-extrabold tracking-tighter ${totalProfitSinceReset >= 0 ? "text-white" : "text-rose-400"}`}
            >
              {(state.realBalance || 0).toLocaleString()}{" "}
              <span className="text-sm font-normal text-[#4a5578]">F</span>
            </p>
            {isDailyGoalReached && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[10px] font-bold text-emerald-400 mt-2 uppercase tracking-widest"
              >
                Objectif Journalier Atteint 🎉
              </motion.div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 mt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-mono text-[#4a5578] uppercase">
                  <span>Objectif Session</span>
                  <span>
                    {Math.max(0, currentSessionProfit).toLocaleString()} /{" "}
                    {state.sessionGoal.toLocaleString()} F
                  </span>
                </div>
                <div className="h-1.5 bg-[#0e1220] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, (Math.max(0, currentSessionProfit) / state.sessionGoal) * 100)}%`,
                    }}
                    className={`h-full ${currentSessionProfit >= state.sessionGoal ? "bg-emerald-400" : "bg-indigo-500"}`}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-mono text-[#4a5578] uppercase">
                  <span>Stop-Loss Session</span>
                  <span>
                    {currentSessionLoss.toLocaleString()} /{" "}
                    {state.stopLoss.toLocaleString()} F
                  </span>
                </div>
                <div className="h-1.5 bg-[#0e1220] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, (currentSessionLoss / state.stopLoss) * 100)}%`,
                    }}
                    className={`h-full ${currentSessionLoss >= state.stopLoss ? "bg-rose-500" : "bg-amber-500"}`}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[9px] font-mono text-[#4a5578] uppercase">
                <span>Objectif Journalier</span>
                <span>
                  {Math.max(0, totalProfitSinceReset).toLocaleString()} / 3 000
                  F
                </span>
              </div>
              <div className="h-1.5 bg-[#0e1220] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(100, (Math.max(0, totalProfitSinceReset) / 3000) * 100)}%`,
                  }}
                  className={`h-full ${totalProfitSinceReset >= 3000 ? "bg-amber-400" : "bg-indigo-400"}`}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[9px] font-mono text-[#4a5578] uppercase">
                <span>Tours du Jour</span>
                <span>{state.turnsToday || 0} / 30</span>
              </div>
              <div className="h-1.5 bg-[#0e1220] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(100, ((state.turnsToday || 0) / 30) * 100)}%`,
                  }}
                  className={`h-full ${(state.turnsToday || 0) >= 30 ? "bg-rose-500" : "bg-blue-500"}`}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Withdrawal Section */}
      <section className="bg-[#141828] border border-[#252d45] rounded-2xl p-5 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/5 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              <h2 className="font-bold text-sm uppercase tracking-tight">
                Retrait de Gains
              </h2>
            </div>
            <button
              onClick={() => setShowWithdrawalForm(!showWithdrawalForm)}
              className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest hover:text-emerald-300 transition-colors"
            >
              {showWithdrawalForm ? 'Annuler' : 'Nouveau Retrait'}
            </button>
          </div>

          {!showWithdrawalForm ? (
            <div className="text-center py-4">
              <p className="text-[10px] text-[#4a5578] uppercase tracking-widest mb-2">
                Solde Disponible pour Retrait
              </p>
              <p className="text-3xl font-extrabold text-white tracking-tighter">
                {(state.realBalance || 0).toLocaleString()}{' '}
                <span className="text-sm font-normal text-[#4a5578]">F</span>
              </p>
              
              {/* Withdrawal status */}
              <div className="mt-4 space-y-2">
                {state.stopLossActive ? (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-2">
                    <p className="text-[9px] text-rose-400">
                      🔒 Retrait bloqué: Stop-Loss atteint. Récupérez votre perte pour débloquer.
                    </p>
                  </div>
                ) : daysSinceLastWithdrawal < 3 ? (
                  <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg p-2">
                    <p className="text-[9px] text-amber-400">
                      ⏳ Prochain retrait dans {3 - daysSinceLastWithdrawal} jour(s)
                    </p>
                  </div>
                ) : maxWithdrawableAmount > 0 ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
                    <p className="text-[9px] text-emerald-400">
                      ✅ Retrait disponible: max {maxWithdrawableAmount.toLocaleString()} F (50% des gains)
                    </p>
                  </div>
                ) : (
                  <div className="bg-[#252d45] rounded-lg p-2">
                    <p className="text-[9px] text-[#4a5578]">
                      ℹ️ Aucun gain disponible pour retrait
                    </p>
                  </div>
                )}
              </div>
              
              <p className="text-[9px] text-[#4a5578] mt-2">
                {(state.withdrawalHistory || []).length} retrait(s) effectué(s)
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-[#4a5578] uppercase font-mono mb-1 block">
                  Montant du Retrait (F)
                </label>
                <input
                  type="number"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  placeholder="Ex: 5000"
                  className="w-full bg-[#0e1220] border border-[#252d45] rounded-xl px-4 py-3 text-sm focus:border-emerald-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#4a5578] uppercase font-mono mb-1 block">
                  Méthode de Retrait
                </label>
                <select
                  value={withdrawalMethod}
                  onChange={(e) => setWithdrawalMethod(e.target.value as WithdrawalRecord['method'])}
                  className="w-full bg-[#0e1220] border border-[#252d45] rounded-xl px-4 py-3 text-sm focus:border-emerald-500 outline-none transition-colors"
                >
                  <option value="bank_transfer">Virement Bancaire</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="crypto">Cryptomonnaie</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[#4a5578] uppercase font-mono mb-1 block">
                  Notes (optionnel)
                </label>
                <input
                  type="text"
                  value={withdrawalNotes}
                  onChange={(e) => setWithdrawalNotes(e.target.value)}
                  placeholder="Référence, notes..."
                  className="w-full bg-[#0e1220] border border-[#252d45] rounded-xl px-4 py-3 text-sm focus:border-emerald-500 outline-none transition-colors"
                />
              </div>

              <button
                onClick={handleWithdrawal}
                disabled={!withdrawalAmount || parseInt(withdrawalAmount) <= 0}
                className={`w-full font-bold py-4 rounded-xl text-xs uppercase tracking-[0.2em] transition-all shadow-lg flex items-center justify-center gap-2 ${
                  !withdrawalAmount || parseInt(withdrawalAmount) <= 0
                    ? 'bg-[#252d45] text-[#4a5578] cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20'
                }`}
              >
                <ArrowUpRight className="w-5 h-5" />
                Confirmer le Retrait
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Withdrawal History */}
      {(state.withdrawalHistory || []).length > 0 && (
        <section className="bg-[#141828] border border-[#252d45] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-400" />
              <h2 className="font-bold text-sm uppercase tracking-tight">
                Historique des Retraits
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[#4a5578]">
              {(state.withdrawalHistory || []).length} retrait(s)
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {[...(state.withdrawalHistory || [])].reverse().map((withdrawal) => (
              <div
                key={withdrawal.id}
                className="flex items-center justify-between p-3 rounded-xl border bg-emerald-500/5 border-emerald-500/20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/20 text-emerald-400">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white uppercase tracking-tight">
                      {withdrawal.method === 'bank_transfer' && 'Virement Bancaire'}
                      {withdrawal.method === 'mobile_money' && 'Mobile Money'}
                      {withdrawal.method === 'crypto' && 'Cryptomonnaie'}
                    </p>
                    <p className="text-[8px] text-[#4a5578] font-mono">
                      {new Date(withdrawal.timestamp).toLocaleDateString()} —{' '}
                      {new Date(withdrawal.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {withdrawal.notes && (
                      <p className="text-[8px] text-[#4a5578] italic">
                        {withdrawal.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-400">
                    -{withdrawal.amount.toLocaleString()} F
                  </p>
                  <p className="text-[8px] font-mono uppercase">
                    <span className={`${
                      withdrawal.status === 'completed' ? 'text-emerald-400' :
                      withdrawal.status === 'pending' ? 'text-amber-400' :
                      'text-rose-400'
                    }`}>
                      {withdrawal.status === 'completed' && 'Complété'}
                      {withdrawal.status === 'pending' && 'En attente'}
                      {withdrawal.status === 'failed' && 'Échoué'}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tour en Cours (Automated) */}
      <section className="bg-[#141828] border border-[#252d45] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <RefreshCw
              className={`w-5 h-5 ${consecutiveLosses > 0 ? "text-rose-400 animate-spin-slow" : "text-emerald-400"}`}
            />
            <h2 className="font-bold text-sm uppercase tracking-tight">
              Tour en Cours
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
              Session {state.sessionsCompleted + 1}
            </span>
          </div>
        </div>

        {/* Objectif Stratégique Display */}
        <div className="bg-[#0e1220] border border-indigo-500/20 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-[#4a5578] uppercase font-mono tracking-widest leading-none mb-1">
                Pattern Optimal
              </p>
              <p className="text-sm font-bold text-white uppercase">
                {currentPattern ? currentPattern.name : "Analyse..."}{" "}
                <span className="text-[10px] text-indigo-400 font-mono">
                  (6 Cases)
                </span>
              </p>
              {consecutiveLosses > 0 && (
                <p className="text-[9px] text-amber-400 mt-1">
                  🎯 Adapté aux {consecutiveLosses} perte{consecutiveLosses > 1 ? 's' : ''} consécutive{consecutiveLosses > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#4a5578] uppercase font-mono tracking-widest leading-none mb-1">
              Score Pattern
            </p>
            <p className="text-sm font-black text-emerald-400">
              {currentPattern ? (currentPattern.score * 100).toFixed(2) : "--"}%
            </p>
          </div>
        </div>

        {/* Martingale Sequence Display */}
        <div className="mb-6">
          <p className="text-[9px] text-[#4a5578] uppercase font-mono mb-3 tracking-widest">
            Séquence Martingale (Mises)
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((index) => {
              const stepMise = Math.round(
                state.baseBet * Math.pow(state.martingaleFactor, index),
              );
              // Calculate cumulative loss for this step
              let cumulativeLoss = 0;
              for (let i = 0; i <= index; i++) {
                cumulativeLoss += Math.round(
                  state.baseBet * Math.pow(state.martingaleFactor, i),
                );
              }

              const isActive = consecutiveLosses === index;
              const isPast = consecutiveLosses > index;
              return (
                <div
                  key={index}
                  className={`flex flex-col items-center py-2 rounded-xl border transition-all text-center ${
                    isActive
                      ? "bg-amber-400/10 border-amber-400 text-amber-400 scale-105 shadow-lg shadow-amber-400/10"
                      : isPast
                        ? "bg-rose-500/5 border-rose-500/20 text-rose-500/50"
                        : "bg-[#0e1220] border-[#252d45] text-[#4a5578]"
                  }`}
                >
                  <p className="text-xs font-bold">
                    {stepMise.toLocaleString()}
                  </p>
                  <p className="text-[7px] font-mono uppercase opacity-50">
                    Cumul: -{cumulativeLoss.toLocaleString()}
                  </p>
                  <p className="text-[7px] font-mono uppercase opacity-70">
                    Mise {index + 1}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mise Conseillée */}
        <div className="bg-gradient-to-br from-[#1c2235] to-[#0e1220] rounded-2xl p-6 border border-white/5 text-center mb-6 shadow-inner">
          <p className="text-[10px] text-[#4a5578] uppercase tracking-[0.2em] mb-2">
            Mise Conseillée
          </p>
          <p className="text-4xl font-extrabold text-white tracking-tighter">
            {currentMartingaleBet.toLocaleString()}{" "}
            <span className="text-sm font-normal text-[#4a5578]">F</span>
          </p>
          <p className="text-[9px] text-[#4a5578] mt-2 font-mono">
            {consecutiveLosses === 0
              ? "Mise de base — aucune perte"
              : `Récupération x${state.martingaleFactor} (${consecutiveLosses} pertes)`}
          </p>
        </div>

        {/* Recovery Analysis */}
        {consecutiveLosses > 0 && (
          <div className="bg-black/20 rounded-xl p-4 border border-white/5 mb-6 space-y-2">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-[#4a5578]">Dette Cumulée:</span>
              <span className="text-rose-400">
                -{consecutiveLostAmount.toLocaleString()} F
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-[#4a5578]">Gain si Victoire:</span>
              <span className="text-emerald-400">
                +{potentialGain.toLocaleString()} F
              </span>
            </div>
            <div className="pt-2 border-t border-white/5 flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase text-[#4a5578]">
                Net après Récup:
              </span>
              <span
                className={`text-xs font-bold ${recoveryNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}
              >
                {recoveryNet >= 0 ? "+" : ""}
                {recoveryNet.toLocaleString()} F
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleQuickLog("win")}
            disabled={isBlocked}
            className={`font-bold py-4 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all shadow-lg ${isBlocked ? "bg-[#252d45] text-[#4a5578] cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20"}`}
          >
            <Trophy className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-widest">
              J'ai Gagné
            </span>
          </button>
          <button
            onClick={() => handleQuickLog("lose")}
            disabled={isBlocked}
            className={`font-bold py-4 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all shadow-lg ${isBlocked ? "bg-[#252d45] text-[#4a5578] cursor-not-allowed" : "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20"}`}
          >
            <TrendingDown className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-widest">
              J'ai Perdu
            </span>
          </button>
        </div>
      </section>

      {/* AI Strategy Section */}
      <section className="bg-gradient-to-br from-[#1c2235] to-[#141828] border border-orange-500/30 rounded-2xl p-5 shadow-xl shadow-orange-500/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-orange-500" />
            <h2 className="font-bold text-sm uppercase tracking-tight">
              Intelligence Stratégique
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle for random prediction */}
            <button
              onClick={() => {
                const newMode = !useRandomPrediction;
                setUseRandomPrediction(newMode);
                onUpdateState({ useRandomPrediction: newMode });
                generateNewSuggestions(currentMartingaleBet, consecutiveLosses, newMode);
              }}
              className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${
                useRandomPrediction 
                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' 
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {useRandomPrediction ? '🎲 Aléatoire' : '🎯 Optimal'}
            </button>
            <button
              onClick={handleGetStrategy}
              disabled={isAnalyzing}
              className="text-[10px] font-bold text-orange-500 uppercase tracking-widest hover:underline disabled:opacity-50"
            >
              {isAnalyzing ? "Analyse..." : "Actualiser"}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {useRandomPrediction ? (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 mb-4">
              <p className="text-[10px] text-purple-400 font-bold uppercase mb-1">
                Mode Aléatoire Activé
              </p>
              <p className="text-[9px] text-[#4a5578]">
                Les cases sont générées aléatoirement sans pattern optimisé
              </p>
            </div>
          ) : currentPattern && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 mb-4">
              <p className="text-[10px] text-emerald-400 font-bold uppercase mb-1">
                Pattern #{currentPattern.rank} — {currentPattern.name}
              </p>
              <p className="text-[9px] text-[#4a5578]">
                Score: {(currentPattern.score * 100).toFixed(3)}% · Cases: {currentPattern.cells.map(c => c + 1).join('-')}
              </p>
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            <div className="grid grid-cols-5 gap-1 bg-black/20 p-2 rounded-xl border border-white/5">
              {[...Array(25)].map((_, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-bold transition-all duration-500 ${
                    aiSuggestions.includes(i)
                      ? "bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)] scale-105"
                      : "bg-[#252d45] text-[#4a5578]"
                  }`}
                >
                  {aiSuggestions.includes(i) ? "⭐" : i}
                </div>
              ))}
            </div>
          </div>

          {consecutiveLosses >= 2 && (
            <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-3 mt-4">
              <p className="text-[10px] text-amber-400 text-center">
                ⚠️ {consecutiveLosses} pertes consécutives — Utilisation du pattern #{consecutiveLosses >= 3 ? '1' : 'TOP 2'} pour maximiser les chances
              </p>
            </div>
          )}

          {strategy ? (
            <div className="space-y-3 pt-2 border-t border-white/5">
              <div className="flex gap-3">
                <div className="flex-1 bg-black/20 rounded-xl p-3 border border-white/5">
                  <p className="text-[9px] text-[#4a5578] uppercase mb-1">
                    Mise Optimale
                  </p>
                  <p className="text-lg font-bold text-amber-400">
                    {(strategy.nextBet || 0).toLocaleString()} F
                  </p>
                </div>
                <div className="flex-1 bg-black/20 rounded-xl p-3 border border-white/5">
                  <p className="text-[9px] text-[#4a5578] uppercase mb-1">
                    Objectif Cote
                  </p>
                  <p className="text-lg font-bold text-emerald-400">
                    x{strategy.targetMultiplier}
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#cdd3e8] leading-relaxed italic text-center">
                "{strategy.advice}"
              </p>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-[10px] text-[#4a5578]">
                Suggestions basées sur la mise actuelle ({currentMartingaleBet}{" "}
                F)
              </p>
            </div>
          )}
        </div>
      </section>
      {/* Screenshot Analysis */}
      <section className="bg-[#141828] border border-[#252d45] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-sm uppercase tracking-tight">
              Analyse de Capture
            </h2>
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-blue-500/20"
          >
            Scanner
          </button>
        </div>

        {isAnalyzing ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-xs text-[#4a5578] animate-pulse">
              L'IA déchiffre la grille...
            </p>
          </div>
        ) : prediction ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="grid grid-cols-5 gap-1 bg-black/20 p-2 rounded-xl border border-white/5">
                {[...Array(25)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-bold transition-all duration-500 ${
                      prediction.recommendedCells.includes(i)
                        ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(52,211,153,0.4)] scale-105"
                        : "bg-[#252d45] text-[#4a5578]"
                    }`}
                  >
                    {prediction.recommendedCells.includes(i) ? "⭐" : i}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1 bg-black/20 rounded-xl p-3 border border-white/5 text-center">
                  <p className="text-[9px] text-[#4a5578] uppercase mb-1">
                    Confiance
                  </p>
                  <p className="text-sm font-bold text-emerald-400">
                    {prediction.confidence}%
                  </p>
                </div>
                <div className="flex-1 bg-black/20 rounded-xl p-3 border border-white/5 text-center">
                  <p className="text-[9px] text-[#4a5578] uppercase mb-1">
                    Cases Sûres
                  </p>
                  <p className="text-sm font-bold text-blue-400">
                    {prediction.recommendedCells.length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4">
              <p className="text-xs text-blue-300 leading-relaxed">
                <span className="font-bold uppercase mr-2 text-blue-400">
                  Conseil IA:
                </span>
                {prediction.reasoning}
              </p>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-[#252d45] rounded-xl py-8 flex flex-col items-center gap-2">
            <Camera className="w-6 h-6 text-[#252d45]" />
            <p className="text-[10px] text-[#4a5578] uppercase tracking-widest">
              Importe une capture d'écran
            </p>
          </div>
        )}
      </section>

      {/* History Section */}
      <section className="bg-[#141828] border border-[#252d45] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-sm uppercase tracking-tight">
              Historique Session
            </h2>
          </div>
          <span className="text-[10px] font-mono text-[#4a5578]">
            {state.history.length} tours
          </span>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {state.history.length > 0 ? (
            state.history.map((record, idx) => (
              <div
                key={record.id}
                className={`flex items-center justify-between p-3 rounded-xl border ${record.type === "win" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${record.type === "win" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}
                  >
                    {record.type === "win" ? (
                      <Trophy className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white uppercase tracking-tight">
                      {record.type === "win" ? "Gagné" : "Perdu"}
                    </p>
                    <p className="text-[8px] text-[#4a5578] font-mono">
                      {new Date(record.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-xs font-bold ${record.type === "win" ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {record.type === "win"
                      ? `+${record.profit.toLocaleString()}`
                      : `-${record.amount.toLocaleString()}`}{" "}
                    F
                  </p>
                  <p className="text-[8px] text-[#4a5578] font-mono">
                    Mise: {record.amount.toLocaleString()} F
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-[#252d45] rounded-xl">
              <p className="text-[10px] text-[#4a5578] uppercase tracking-widest">
                Aucun tour enregistré
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Session History Summary */}
      <section className="bg-[#141828] border border-[#252d45] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-sm uppercase tracking-tight">
              Résumé des Sessions
            </h2>
          </div>
          <span className="text-[10px] font-mono text-[#4a5578]">
            {(state.sessionHistory || []).length} sessions
          </span>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {(state.sessionHistory || []).length > 0 ? (
            [...(state.sessionHistory || [])].reverse().map((session) => (
              <div
                key={session.id}
                className={`flex items-center justify-between p-3 rounded-xl border ${session.profit >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${session.profit >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}
                  >
                    {session.endReason === "goal" ? (
                      <Trophy className="w-4 h-4" />
                    ) : session.endReason === "stop-loss" ? (
                      <ShieldAlert className="w-4 h-4" />
                    ) : (
                      <Calendar className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white uppercase tracking-tight">
                      {session.endReason === "goal"
                        ? "Objectif Atteint"
                        : session.endReason === "stop-loss"
                          ? "Stop-Loss"
                          : "Session Terminée"}
                    </p>
                    <p className="text-[8px] text-[#4a5578] font-mono">
                      {new Date(session.timestamp).toLocaleDateString()} —{" "}
                      {new Date(session.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-xs font-bold ${session.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {session.profit >= 0 ? "+" : ""}
                    {session.profit.toLocaleString()} F
                  </p>
                  <p className="text-[8px] text-[#4a5578] font-mono">
                    {session.turns} tours
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-[#252d45] rounded-xl">
              <p className="text-[10px] text-[#4a5578] uppercase tracking-widest">
                Aucune session terminée
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Discipline Alerts */}
      <div className="space-y-3">
        {currentSessionProfit >= state.sessionGoal && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex gap-3 items-start">
            <ShieldAlert className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-tight">
                Session Terminée !
              </p>
              <p className="text-[10px] text-emerald-400/70 mt-1 leading-relaxed">
                Félicitations ! Tu as atteint ton objectif de session (+
                {state.sessionGoal.toLocaleString()} F). Prends une pause
                obligatoire avant la prochaine session.
              </p>
            </div>
          </div>
        )}

        {currentSessionLoss >= (state.stopLoss || 0) && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <div>
              <p className="text-xs font-bold text-rose-500 uppercase tracking-tight">
                Stop-Loss Atteint !
              </p>
              <p className="text-[10px] text-rose-500/70 mt-1 leading-relaxed">
                Attention ! Ta perte de session (
                {(currentSessionLoss || 0).toLocaleString()} F) a atteint ton
                seuil de Stop-Loss ({(state.stopLoss || 0).toLocaleString()} F).
                Arrête immédiatement !
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
