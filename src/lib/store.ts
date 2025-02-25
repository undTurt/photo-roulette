import { create } from 'zustand';

interface GameState {
  roomCode: string | null;
  players: Player[];
  currentRound: number;
  scores: Record<string, number>;
  photos: GamePhoto[];
  currentPhoto: GamePhoto | null;
  gamePhase: 'lobby' | 'uploading' | 'playing' | 'guessing' | 'results';
  timeRemaining: number;
  setRoomCode: (code: string) => void;
  setPlayers: (players: Player[]) => void;
  setCurrentRound: (round: number) => void;
  updateScore: (playerId: string, points: number) => void;
  setPhotos: (photos: GamePhoto[]) => void;
  setCurrentPhoto: (photo: GamePhoto | null) => void;
  setGamePhase: (phase: GameState['gamePhase']) => void;
  setTimeRemaining: (time: number) => void;
  resetGame: () => void;
}

interface Player {
  id: string;
  name: string;
  ready: boolean;
  score?: number;
}

interface GamePhoto {
  id: string;
  url: string;
  playerId: string;
  used: boolean;
}

const initialState = {
  roomCode: null,
  players: [],
  currentRound: 0,
  scores: {},
  photos: [],
  currentPhoto: null,
  gamePhase: 'lobby' as const,
  timeRemaining: 0,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,
  setRoomCode: (code) => set({ roomCode: code }),
  setPlayers: (players) => set({ players }),
  setCurrentRound: (round) => set({ currentRound: round }),
  updateScore: (playerId, points) =>
    set((state) => ({
      scores: {
        ...state.scores,
        [playerId]: (state.scores[playerId] || 0) + points,
      },
    })),
  setPhotos: (photos) => set({ photos }),
  setCurrentPhoto: (photo) => set({ currentPhoto: photo }),
  setGamePhase: (phase) => set({ gamePhase: phase }),
  setTimeRemaining: (time) => set({ timeRemaining: time }),
  resetGame: () => set(initialState),
}));