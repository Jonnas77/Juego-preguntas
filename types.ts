export enum GamePhase {
  SETUP = 'SETUP',
  LOBBY = 'LOBBY',
  PREVIEW_QUESTION = 'PREVIEW_QUESTION', // Reading time
  ANSWERING = 'ANSWERING', // 5 second timer
  LEADERBOARD = 'LEADERBOARD',
  PODIUM = 'PODIUM',
}

export interface Answer {
  id: string;
  text: string;
  isCorrect: boolean;
  color: 'red' | 'blue' | 'yellow' | 'green';
}

export interface Question {
  id: string;
  text: string;
  answers: Answer[];
  timeLimit: number; // Default 5s
}

export interface Player {
  id: string;
  name: string;
  score: number;
  lastAnswerTime?: number; // For tie-breaking or bonus calculation
  streak: number;
  avatar: string;
}

// Networking Types (BroadcastChannel)
export type NetworkMessage = 
  | { type: 'JOIN_REQUEST'; payload: { name: string; avatar: string; id: string } }
  | { type: 'PLAYER_JOINED'; payload: { player: Player } } // Confirmed join
  | { type: 'GAME_START'; payload: { totalQuestions: number } }
  | { type: 'NEXT_QUESTION'; payload: { questionIndex: number; text: string; answers: {id: string, color: string, text: string}[]; timeLimit: number } } // Don't send isCorrect to player
  | { type: 'START_TIMER'; payload: null }
  | { type: 'SUBMIT_ANSWER'; payload: { playerId: string; answerId: string; timeLeft: number } }
  | { type: 'ROUND_END'; payload: { correctId: string; scores: Player[] } } // Send updated scores
  | { type: 'GAME_OVER'; payload: { podium: Player[] } }
  | { type: 'KICK_PLAYER'; payload: { playerId: string } };

export const COLORS = {
  red: 'bg-red-500 hover:bg-red-600',
  blue: 'bg-blue-500 hover:bg-blue-600',
  yellow: 'bg-yellow-500 hover:bg-yellow-600',
  green: 'bg-green-500 hover:bg-green-600',
};

export const SHAPES = {
  red: '▲',
  blue: '◆',
  yellow: '●',
  green: '■',
};