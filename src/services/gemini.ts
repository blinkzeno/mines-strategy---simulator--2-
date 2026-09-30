import { GoogleGenAI } from "@google/genai";
import { GameRecord, PredictionResult } from "../types";

const getAIInstance = (customKey?: string) => {
  return new GoogleGenAI({ apiKey: customKey || process.env.GEMINI_API_KEY || "" });
};

export async function analyzeScreenshot(base64Image: string, customKey?: string): Promise<PredictionResult> {
  const ai = getAIInstance(customKey);
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        inlineData: {
          mimeType: "image/png",
          data: base64Image.split(",")[1] || base64Image,
        },
      },
      {
        text: `Analyse cette capture d'écran du jeu Mines (grille 5x5).
        1. Identifie les cases déjà découvertes (étoiles) et les mines visibles s'il y en a.
        2. Prédit les 8 prochaines cases (index 0 à 24, de gauche à droite, haut en bas) ayant la plus haute probabilité d'être des étoiles pour viser la cote 3.17 avec 3 mines.
        3. Donne un score de confiance (0-100) et une brève explication stratégique.
        Réponds au format JSON: { "recommendedCells": [index1, index2, index3, index4, index5, index6, index7, index8], "confidence": number, "reasoning": "string" }`,
      },
    ],
    config: {
      responseMimeType: "application/json",
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return { recommendedCells: [0, 2, 3, 4, 20, 21, 22, 24], confidence: 50, reasoning: "Erreur d'analyse, suggestion par défaut." };
  }
}

export async function getStrategyRecommendation(history: GameRecord[], currentBalance: number, customKey?: string): Promise<{ nextBet: number; targetMultiplier: number; advice: string }> {
  const ai = getAIInstance(customKey);
  const historySummary = history.slice(0, 10).map(h => `${h.type === 'win' ? 'Gagné' : 'Perdu'} ${h.amount}F (x${h.multiplier})`).join(", ");
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `En tant qu'expert en gestion de bankroll pour le jeu Mines, analyse cet historique récent: ${historySummary}. 
    Solde actuel: ${currentBalance}F.
    La stratégie joue une mise uniforme avec une cible de 8 étoiles pour la cote 3.17 avec 3 mines.
    Suggère le montant de la prochaine mise (reste proche de la mise uniforme en cours) et le multiplicateur cible optimal pour minimiser les risques tout en récupérant les pertes éventuelles.
    Réponds au format JSON: { "nextBet": number, "targetMultiplier": number, "advice": "string" }`,
    config: {
      responseMimeType: "application/json",
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { nextBet: 200, targetMultiplier: 3.17, advice: "Mise uniforme recommandée, cible 8 étoiles." };
  }
}
