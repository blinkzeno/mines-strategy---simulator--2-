import { useState, useCallback, useEffect } from 'react';
import { Bomb, Star, Coins, RefreshCcw, Trophy, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SimulatorProps {
  virtualBalance: number;
  onUpdateBalance: (amount: number) => void;
}

const GRID_SIZE = 25;
const MULTIPLIERS: Record<number, number> = {
  1: 1.06,
  2: 1.22,
  3: 1.40,
  4: 1.62,
  5: 1.89,
  6: 2.23,
  7: 2.64,
  8: 3.17,
  9: 3.81,
  10: 4.57
};

export default function Simulator({ virtualBalance, onUpdateBalance }: SimulatorProps) {
  const [selectedStars, setSelectedStars] = useState(3);
  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [totalLostAmount, setTotalLostAmount] = useState(0);
  const [sessionProfit, setSessionProfit] = useState(0);
  const [turnsToday, setTurnsToday] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle');
  const [grid, setGrid] = useState<(null | 'star' | 'mine')[]>(Array(GRID_SIZE).fill(null));
  const [minePositions, setMinePositions] = useState<number[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);

  const currentMartingaleBet = Math.round(500 * Math.pow(1.5, consecutiveLosses));

  const isSessionGoalReached = sessionProfit >= 1500;
  const isStopLossReached = totalLostAmount >= 5000;
  const isTurnLimitReached = turnsToday >= 30;
  const isBlocked = isSessionGoalReached || isStopLossReached || isTurnLimitReached;

  const startGame = () => {
    if (isBlocked || currentMartingaleBet > virtualBalance) return;
    
    onUpdateBalance(-currentMartingaleBet);
    // Mines count is fixed at 3 for this strategy simulation
    const minesCount = 3;
    const newMines: number[] = [];
    while (newMines.length < minesCount) {
      const pos = Math.floor(Math.random() * GRID_SIZE);
      if (!newMines.includes(pos)) newMines.push(pos);
    }
    
    setMinePositions(newMines);
    setGrid(Array(GRID_SIZE).fill(null));
    setRevealedCount(0);
    setGameState('playing');
    setTurnsToday(prev => prev + 1);
  };

  const handleCellClick = (index: number) => {
    if (gameState !== 'playing' || grid[index] !== null) return;

    if (minePositions.includes(index)) {
      const newGrid = [...grid];
      minePositions.forEach(pos => newGrid[pos] = 'mine');
      setGrid(newGrid);
      setGameState('lost');
      
      // Martingale logic
      const lost = currentMartingaleBet;
      setTotalLostAmount(prev => prev + lost);
      setSessionProfit(prev => prev - lost);
      setConsecutiveLosses(prev => prev + 1);
    } else {
      const newGrid = [...grid];
      newGrid[index] = 'star';
      setGrid(newGrid);
      const newRevealedCount = revealedCount + 1;
      setRevealedCount(newRevealedCount);

      // Auto-cashout only if max stars reached (10)
      if (newRevealedCount === 10) {
        handleCashout(10);
      }
    }
  };

  const handleCashout = (starsToUse?: number) => {
    const stars = starsToUse || revealedCount;
    if (stars === 0) return;

    const multiplier = MULTIPLIERS[stars];
    const winAmount = Math.floor(currentMartingaleBet * multiplier);
    const profit = winAmount - currentMartingaleBet;
    
    onUpdateBalance(winAmount);
    setGameState('won');
    setSessionProfit(prev => prev + profit);
    setTotalLostAmount(0); // Reset loss streak on win
    setConsecutiveLosses(0); // Reset to base bet

    // Reveal mines
    const newGrid = [...grid];
    minePositions.forEach(pos => newGrid[pos] = 'mine');
    setGrid(newGrid);
  };

  const reset = () => {
    setGameState('idle');
    setGrid(Array(GRID_SIZE).fill(null));
    setRevealedCount(0);
  };

  const handleFullReset = () => {
    if (confirm('Réinitialiser la simulation ?')) {
      setSessionProfit(0);
      setTotalLostAmount(0);
      setTurnsToday(0);
      setConsecutiveLosses(0);
      onUpdateBalance(100000 - virtualBalance);
      reset();
    }
  };

  return (
    <div className="space-y-6">
      {/* Virtual Balance Header */}
      <div className="bg-[#141828] border border-[#252d45] rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
              <Coins className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] text-[#4a5578] font-mono uppercase tracking-widest">Solde Virtuel</p>
              <p className="text-lg font-bold text-white">{virtualBalance.toLocaleString()} F</p>
            </div>
          </div>
          <button onClick={handleFullReset} className="p-2 text-[#4a5578] hover:text-white transition-colors">
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#0e1220] rounded-xl p-2 border border-[#252d45]">
            <p className="text-[8px] text-[#4a5578] uppercase font-mono">Profit</p>
            <p className={`text-xs font-bold ${sessionProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {sessionProfit.toLocaleString()} F
            </p>
          </div>
          <div className="bg-[#0e1220] rounded-xl p-2 border border-[#252d45]">
            <p className="text-[8px] text-[#4a5578] uppercase font-mono">Tours</p>
            <p className="text-xs font-bold text-white">{turnsToday}/30</p>
          </div>
          <div className="bg-[#0e1220] rounded-xl p-2 border border-[#252d45]">
            <p className="text-[8px] text-[#4a5578] uppercase font-mono">Mise Actuelle</p>
            <p className="text-xs font-bold text-amber-400">{currentMartingaleBet.toLocaleString()} F</p>
          </div>
        </div>

        {isBlocked && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-500" />
            <p className="text-[10px] text-rose-400 font-bold uppercase">
              {isTurnLimitReached ? 'Limite de tours atteinte' : isStopLossReached ? 'Stop-Loss atteint' : 'Objectif atteint'}
            </p>
          </div>
        )}
      </div>

      {/* Multiplier Carousel */}
      <div className="bg-[#141828] border border-[#252d45] rounded-2xl overflow-hidden">
        <div className="p-3 border-b border-[#252d45]">
          <p className="text-[9px] text-[#4a5578] uppercase font-mono tracking-widest">
            {gameState === 'playing' ? 'Cote Actuelle' : 'Cible (Étoiles)'}
          </p>
        </div>
        <div className="flex overflow-x-auto no-scrollbar p-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(stars => {
            const isCurrent = revealedCount === stars;
            const isTarget = selectedStars === stars && gameState !== 'playing';
            const isDone = revealedCount > stars;
            
            return (
              <button
                key={stars}
                onClick={() => setSelectedStars(stars)}
                disabled={gameState === 'playing' || isBlocked}
                className={`flex-shrink-0 min-w-[70px] text-center p-2 rounded-lg border transition-all ${
                  isDone ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 
                  isCurrent ? 'bg-emerald-500 border-emerald-500 text-white scale-110 font-bold shadow-lg shadow-emerald-500/20' :
                  isTarget ? 'bg-amber-400/10 border-amber-400 text-amber-400 scale-110 font-bold shadow-lg shadow-amber-400/10' : 
                  'bg-[#0e1220] border-[#252d45] text-[#4a5578]'
                } disabled:opacity-50`}
              >
                <p className="text-[8px] font-mono uppercase">⭐{stars}</p>
                <p className="text-[10px] font-bold">{(Math.floor(currentMartingaleBet * MULTIPLIERS[stars])).toLocaleString()} F</p>
                <p className="text-[7px] opacity-60 font-mono">x{MULTIPLIERS[stars]}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Game Grid */}
      <div className="aspect-square w-full max-w-[320px] mx-auto grid grid-cols-5 gap-2">
        {grid.map((cell, i) => (
          <button
            key={i}
            onClick={() => handleCellClick(i)}
            disabled={gameState !== 'playing' || cell !== null}
            className={`
              relative rounded-xl aspect-square flex items-center justify-center transition-all duration-200
              ${cell === null ? 'bg-[#1c2235] border border-[#252d45] hover:bg-[#252d45] active:scale-95' : ''}
              ${cell === 'star' ? 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : ''}
              ${cell === 'mine' ? 'bg-rose-500/20 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]' : ''}
              ${gameState === 'playing' && cell === null ? 'cursor-pointer' : 'cursor-default'}
            `}
          >
            <AnimatePresence>
              {cell === 'star' && (
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="text-emerald-400"
                >
                  <Star className="w-6 h-6 fill-current" />
                </motion.div>
              )}
              {cell === 'mine' && (
                <motion.div
                  initial={{ scale: 0, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  className="text-rose-500"
                >
                  <Bomb className="w-6 h-6 fill-current" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        ))}
      </div>

      {/* Game Controls */}
      <div className="bg-[#141828] border border-[#252d45] rounded-2xl p-5 space-y-4">
        <div className="space-y-3">
          <label className="text-[10px] text-[#4a5578] uppercase font-mono block">Séquence Martingale (Mises)</label>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map(index => {
              const stepMise = Math.round(500 * Math.pow(1.5, index));
              // Calculate cumulative loss for this step
              let cumulativeLoss = 0;
              for (let i = 0; i <= index; i++) {
                cumulativeLoss += Math.round(500 * Math.pow(1.5, i));
              }
              
              const isActive = consecutiveLosses === index;
              const isPast = consecutiveLosses > index;
              return (
                <div
                  key={index}
                  className={`flex flex-col items-center py-2 rounded-xl border transition-all text-center ${
                    isActive ? 'bg-amber-400/10 border-amber-400 text-amber-400 scale-105 shadow-lg shadow-amber-400/10' : 
                    isPast ? 'bg-rose-500/5 border-rose-500/20 text-rose-500/50' :
                    'bg-[#0e1220] border-[#252d45] text-[#4a5578]'
                  }`}
                >
                  <p className="text-xs font-bold">{stepMise.toLocaleString()}</p>
                  <p className="text-[7px] font-mono uppercase opacity-50">Cumul: -{cumulativeLoss.toLocaleString()}</p>
                  <p className="text-[7px] font-mono uppercase opacity-70">Mise {index + 1}</p>
                </div>
              );
            })}
          </div>
        </div>

        {gameState === 'playing' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="text-left">
                <p className="text-[9px] text-[#4a5578] uppercase">Étoiles</p>
                <p className="text-lg font-bold text-emerald-400">{revealedCount} ⭐</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-[#4a5578] uppercase">Gain Actuel</p>
                <p className="text-lg font-bold text-white">
                  {revealedCount > 0 ? Math.floor(currentMartingaleBet * MULTIPLIERS[revealedCount]).toLocaleString() : '0'} F
                </p>
              </div>
            </div>
            
            <button
              onClick={() => handleCashout()}
              disabled={revealedCount === 0}
              className={`w-full font-bold py-4 rounded-xl text-xs uppercase tracking-[0.2em] transition-all shadow-lg ${
                revealedCount === 0 
                  ? 'bg-[#252d45] text-[#4a5578] cursor-not-allowed' 
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
              }`}
            >
              Encaisser {revealedCount > 0 ? Math.floor(currentMartingaleBet * MULTIPLIERS[revealedCount]).toLocaleString() : ''} F
            </button>
          </div>
        ) : (
          <button
            onClick={gameState === 'idle' ? startGame : reset}
            disabled={isBlocked}
            className={`w-full font-bold py-4 rounded-xl text-xs uppercase tracking-[0.2em] transition-all shadow-lg ${isBlocked ? 'bg-[#252d45] text-[#4a5578] cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20'}`}
          >
            {gameState === 'idle' ? 'Jouer' : 'Nouvelle partie'}
          </button>
        )}
      </div>

      {/* Result Overlay */}
      <AnimatePresence>
        {(gameState === 'won' || gameState === 'lost') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl p-6 flex items-center gap-4 ${gameState === 'won' ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'}`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${gameState === 'won' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
              {gameState === 'won' ? <Trophy className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            </div>
            <div>
              <h3 className={`font-bold uppercase tracking-tight ${gameState === 'won' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {gameState === 'won' ? 'Victoire !' : 'Défaite...'}
              </h3>
              <p className="text-xs text-[#cdd3e8]/70 mt-1">
                {gameState === 'won' 
                  ? `Tu as gagné ${(Math.floor(currentMartingaleBet * MULTIPLIERS[revealedCount])).toLocaleString()} F avec un multiplicateur de x${MULTIPLIERS[revealedCount]}.`
                  : `La mine a explosé. Tu as perdu ta mise de ${currentMartingaleBet.toLocaleString()} F. La prochaine mise est augmentée (Martingale).`
                }
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
