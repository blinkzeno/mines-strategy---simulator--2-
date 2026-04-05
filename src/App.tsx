import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Gamepad2,
  History as HistoryIcon,
  Settings,
  Calendar,
  Wallet,
  ArrowUpRight,
  Banknote,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Dashboard from "./components/Dashboard";
import Simulator from "./components/Simulator";
import { AppState, GameRecord, WithdrawalRecord } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "simulator" | "history" | "settings">(
    "dashboard",
  );
  const [state, setState] = useState<AppState>(() => {
    const defaultState: AppState = {
      realBalance: 50000,
      initialRealBalance: 50000,
      defaultCapital: 50000,
      sessionStartBalance: 50000,
      dailyGoal: 3000,
      sessionGoal: 1500,
      sessionsCompleted: 0,
      stopLoss: 5000,
      baseBet: 500,
      martingaleFactor: 1.5,
      history: [],
      virtualBalance: 100000,
      turnsToday: 0,
      withdrawalHistory: [],
    };
    const saved = localStorage.getItem("mines_pro_state");
    if (saved) {
      try {
        return { ...defaultState, ...JSON.parse(saved) };
      } catch (e) {
        return defaultState;
      }
    }
    return defaultState;
  });

  useEffect(() => {
    localStorage.setItem("mines_pro_state", JSON.stringify(state));
  }, [state]);

  const addGameRecord = (record: GameRecord) => {
    setState((prev) => {
      const newBalance =
        prev.realBalance +
        (record.type === "win" ? record.profit : -record.amount);
      // Protection: balance should never be 0 or negative
      const safeBalance = Math.max(1, newBalance);

      return {
        ...prev,
        history: [record, ...prev.history].slice(0, 50),
        realBalance: safeBalance,
        turnsToday: prev.turnsToday + 1,
      };
    });
  };

  const updateVirtualBalance = (amount: number) => {
    setState((prev) => ({
      ...prev,
      virtualBalance: prev.virtualBalance + amount,
    }));
  };

  const updateState = (updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const addWithdrawal = (withdrawal: Omit<WithdrawalRecord, 'id' | 'timestamp'>) => {
    const newWithdrawal: WithdrawalRecord = {
      ...withdrawal,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
    };
    
    setState((prev) => ({
      ...prev,
      realBalance: prev.realBalance - withdrawal.amount,
      withdrawalHistory: [newWithdrawal, ...(prev.withdrawalHistory || [])].slice(0, 50),
    }));
    
    return newWithdrawal;
  };

  return (
    <div className="min-h-screen bg-[#080b12] text-[#cdd3e8] font-sans selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-[#080b12]/80 backdrop-blur-md border-b border-[#252d45] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
            <LayoutDashboard className="w-5 h-5 text-black" />
          </div>
          <h1 className="font-bold tracking-tight text-white">
            MINES<span className="text-orange-500">PRO</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-[#4a5578] font-mono tracking-widest uppercase text-[8px]">
              Solde Réel
            </p>
            <p className="text-sm font-bold text-amber-400">
              {(state.realBalance || 0).toLocaleString()} F
            </p>
          </div>
        </div>
      </header>

      <main className="pb-24 max-w-md mx-auto px-4 pt-4">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Dashboard
                state={state}
                onAddRecord={addGameRecord}
                onUpdateState={updateState}
                onWithdrawal={addWithdrawal}
              />
            </motion.div>
          ) : activeTab === "simulator" ? (
            <motion.div
              key="simulator"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Simulator
                virtualBalance={state.virtualBalance}
                onUpdateBalance={updateVirtualBalance}
              />
            </motion.div>
          ) : activeTab === "history" ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="space-y-4">
                <div className="bg-[#141828] border border-[#252d45] rounded-2xl p-5">
                  <h2 className="font-bold text-sm uppercase tracking-tight mb-4">
                    Historique des Sessions
                  </h2>
                  <div className="space-y-4">
                    {state.sessionHistory && state.sessionHistory.length > 0 ? (
                      [...state.sessionHistory].reverse().map((session) => (
                        <div
                          key={session.id}
                          className="flex flex-col p-4 rounded-xl border border-[#252d45] bg-[#0e1220] space-y-3"
                        >
                          <div className="flex justify-between items-center border-b border-[#252d45] pb-2">
                            <span className="text-xs font-bold text-white uppercase flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-indigo-400" />
                              {new Date(session.timestamp).toLocaleDateString(
                                "fr-FR",
                                {
                                  weekday: "long",
                                  day: "numeric",
                                  month: "short",
                                },
                              )}
                              <span className="text-[10px] text-[#4a5578] font-mono lowercase">
                                •{" "}
                                {new Date(session.timestamp).toLocaleTimeString(
                                  "fr-FR",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                            </span>
                            <span
                              className={`text-xs font-bold ${session.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                            >
                              {session.profit >= 0 ? "+" : ""}
                              {session.profit.toLocaleString()} F
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-[10px] font-mono">
                            <div className="flex flex-col bg-[#141828] p-2 rounded-lg border border-[#252d45]/50">
                              <span className="text-[#4a5578] uppercase mb-1">
                                Solde Initial
                              </span>
                              <span className="text-white font-bold">
                                {session.startBalance?.toLocaleString() || 0} F
                              </span>
                            </div>
                            <div className="flex flex-col bg-[#141828] p-2 rounded-lg border border-[#252d45]/50 text-right">
                              <span className="text-[#4a5578] uppercase mb-1">
                                Solde Final
                              </span>
                              <span className="text-white font-bold">
                                {session.endBalance?.toLocaleString() || 0} F
                              </span>
                            </div>

                            <div className="flex flex-col bg-[#141828] p-2 rounded-lg border border-[#252d45]/50">
                              <span className="text-[#4a5578] uppercase mb-1">
                                Tours Joués
                              </span>
                              <span className="text-white font-bold">
                                {session.turns}
                              </span>
                            </div>
                            <div className="flex flex-col bg-[#141828] p-2 rounded-lg border border-[#252d45]/50 text-right">
                              <span className="text-[#4a5578] uppercase mb-1">
                                Pertes Max
                              </span>
                              <span className="text-rose-400 font-bold">
                                {session.maxConsecutiveLosses || 0} consécutives
                              </span>
                            </div>

                            <div className="col-span-2 flex justify-between items-center bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">
                              <span className="text-[#4a5578] uppercase font-bold">
                                Perte Cumulée Max
                              </span>
                              <span className="text-rose-400 font-black">
                                -
                                {session.maxCumulativeLoss?.toLocaleString() ||
                                  0}{" "}
                                F
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-xs text-[#4a5578] py-8 border border-dashed border-[#252d45] rounded-xl bg-[#0e1220]">
                        Aucune session complétée
                      </p>
                    )}
                  </div>
                </div>

                {/* Withdrawal History */}
                {(state.withdrawalHistory || []).length > 0 && (
                  <div className="bg-[#141828] border border-[#252d45] rounded-2xl p-5 mt-4">
                    <h2 className="font-bold text-sm uppercase tracking-tight mb-4 flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-emerald-400" />
                      Historique des Retraits
                    </h2>
                    <div className="space-y-4">
                      {[...(state.withdrawalHistory || [])].reverse().map((withdrawal) => (
                        <div
                          key={withdrawal.id}
                          className="flex flex-col p-4 rounded-xl border border-[#252d45] bg-[#0e1220] space-y-3"
                        >
                          <div className="flex justify-between items-center border-b border-[#252d45] pb-2">
                            <span className="text-xs font-bold text-white uppercase flex items-center gap-2">
                              <Wallet className="w-4 h-4 text-emerald-400" />
                              {withdrawal.method === 'bank_transfer' && 'Virement Bancaire'}
                              {withdrawal.method === 'mobile_money' && 'Mobile Money'}
                              {withdrawal.method === 'crypto' && 'Cryptomonnaie'}
                              <span className="text-[10px] text-[#4a5578] font-mono lowercase">
                                •{" "}
                                {new Date(withdrawal.timestamp).toLocaleTimeString(
                                  "fr-FR",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                            </span>
                            <span className="text-xs font-bold text-emerald-400">
                              -{withdrawal.amount.toLocaleString()} F
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-[10px] font-mono">
                            <div className="flex flex-col bg-[#141828] p-2 rounded-lg border border-[#252d45]/50">
                              <span className="text-[#4a5578] uppercase mb-1">
                                Date
                              </span>
                              <span className="text-white font-bold">
                                {new Date(withdrawal.timestamp).toLocaleDateString(
                                  "fr-FR",
                                  {
                                    weekday: "long",
                                    day: "numeric",
                                    month: "short",
                                  },
                                )}
                              </span>
                            </div>
                            <div className="flex flex-col bg-[#141828] p-2 rounded-lg border border-[#252d45]/50 text-right">
                              <span className="text-[#4a5578] uppercase mb-1">
                                Statut
                              </span>
                              <span
                                className={`font-bold ${
                                  withdrawal.status === "completed"
                                    ? "text-emerald-400"
                                    : withdrawal.status === "pending"
                                      ? "text-amber-400"
                                      : "text-rose-400"
                                }`}
                              >
                                {withdrawal.status === "completed" && "Complété"}
                                {withdrawal.status === "pending" && "En attente"}
                                {withdrawal.status === "failed" && "Échoué"}
                              </span>
                            </div>

                            {withdrawal.notes && (
                              <div className="col-span-2 flex justify-between items-center bg-[#141828] p-2 rounded-lg border border-[#252d45]/50">
                                <span className="text-[#4a5578] uppercase font-bold">
                                  Notes
                                </span>
                                <span className="text-white text-right">
                                  {withdrawal.notes}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-[#141828] border border-[#252d45] rounded-2xl p-5 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-5 h-5 text-indigo-400" />
                  <h2 className="font-bold text-sm uppercase tracking-tight">
                    Réglages Généraux
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-[#4a5578] uppercase font-mono mb-1 block">
                      Clé API Gemini Personnalisée
                    </label>
                    <input
                      type="password"
                      placeholder="Laissez vide pour utiliser la clé par défaut"
                      value={state.customApiKey || ""}
                      onChange={(e) =>
                        updateState({ customApiKey: e.target.value })
                      }
                      className="w-full bg-[#0e1220] border border-[#252d45] rounded-xl px-4 py-3 text-sm focus:border-orange-500 outline-none transition-colors font-mono"
                    />
                    <p className="text-[9px] text-[#4a5578] mt-2 leading-relaxed italic">
                      Cette clé sera utilisée pour les fonctionnalités d'analyse
                      de capture d'écran et de recommandations stratégiques.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#252d45] space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <HistoryIcon className="w-4 h-4 text-amber-400" />
                      <h3 className="font-bold text-[10px] uppercase tracking-wider text-[#4a5578]">
                        Stratégie & Bankroll
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5 opacity-80">
                        <label className="text-[10px] text-[#4a5578] uppercase font-mono">
                          Capital de Base (F)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={state.defaultCapital}
                            readOnly
                            className="w-full bg-[#0e1220]/50 border border-[#252d45] rounded-xl px-4 py-3 text-[#4a5578] font-bold outline-none cursor-not-allowed"
                          />
                        </div>
                        <p className="text-[7px] text-amber-500/70 font-bold uppercase tracking-wider italic">
                          ℹ️ Modifiable uniquement via "Reset Total"
                        </p>
                      </div>
                      <div>
                        <label className="text-[9px] text-[#4a5578] uppercase font-mono mb-1 block">
                          Mise Base (F)
                        </label>
                        <input
                          type="number"
                          value={state.baseBet || 500}
                          onChange={(e) =>
                            updateState({
                              baseBet: parseFloat(e.target.value) || 500,
                            })
                          }
                          className="w-full bg-[#0e1220] border border-[#252d45] rounded-xl px-3 py-2 text-xs focus:border-indigo-500 outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-[#4a5578] uppercase font-mono mb-1 block">
                          Stop-Loss (F)
                        </label>
                        <input
                          type="number"
                          value={state.stopLoss || 5000}
                          onChange={(e) =>
                            updateState({
                              stopLoss: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-[#0e1220] border border-[#252d45] rounded-xl px-3 py-2 text-xs focus:border-rose-500 outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-[#4a5578] uppercase font-mono mb-1 block">
                          Objectif Session (F)
                        </label>
                        <input
                          type="number"
                          value={state.sessionGoal || 1500}
                          onChange={(e) =>
                            updateState({
                              sessionGoal: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-[#0e1220] border border-[#252d45] rounded-xl px-3 py-2 text-xs focus:border-indigo-500 outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-[#4a5578] uppercase font-mono mb-1 block">
                          Facteur Martingale
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={state.martingaleFactor || 1.5}
                          onChange={(e) =>
                            updateState({
                              martingaleFactor:
                                parseFloat(e.target.value) || 1.5,
                            })
                          }
                          className="w-full bg-[#0e1220] border border-[#252d45] rounded-xl px-3 py-2 text-xs focus:border-indigo-500 outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#252d45]">
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            "Réinitialiser toutes les données de l'application ?",
                          )
                        ) {
                          localStorage.removeItem("mines_pro_state");
                          window.location.reload();
                        }
                      }}
                      className="w-full py-3 rounded-xl border border-rose-500/30 text-rose-500 text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500/10 transition-colors"
                    >
                      Effacer toutes les données
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0e1220] border-t border-[#252d45] px-6 py-3 flex justify-around items-center z-50">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "dashboard" ? "text-orange-500" : "text-[#4a5578]"}`}
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">
            Stratégie
          </span>
        </button>

        <button
          onClick={() => setActiveTab("simulator")}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "simulator" ? "text-orange-500" : "text-[#4a5578]"}`}
        >
          <Gamepad2 className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">
            Simulateur
          </span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "history" ? "text-orange-500" : "text-[#4a5578]"}`}
        >
          <HistoryIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">
            Historique
          </span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "settings" ? "text-orange-500" : "text-[#4a5578]"}`}
        >
          <Settings className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">
            Réglages
          </span>
        </button>
      </nav>
    </div>
  );
}
