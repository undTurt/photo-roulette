import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { generateRoomCode } from '../lib/utils';
import { Button } from '../components/ui/Button';

export function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialPlayerName = location.state?.playerName || '';
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [joining, setJoining] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim().length < 2) {
      setError('Please enter at least 2 characters for your name');
      return;
    }
    const code = generateRoomCode();
    navigate(`/game/${code}`, { state: { playerName } });
  };

  const joinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim().length < 2) {
      setError('Please enter at least 2 characters for your name');
      return;
    }
    if (roomCode.length === 6) {
      navigate(`/game/${roomCode.toUpperCase()}`, { state: { playerName } });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Camera className="w-12 h-12 text-purple-500" />
          <h1 className="text-3xl font-bold ml-3">Photo Roulette</h1>
        </div>

        <div className="mb-6">
          <label
            htmlFor="playerName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Your Name
          </label>
          <input
            type="text"
            id="playerName"
            value={playerName}
            onChange={(e) => {
              setPlayerName(e.target.value);
              setError(null);
            }}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Enter your name"
            maxLength={20}
            minLength={2}
          />
          {error && (
            <p className="mt-1 text-sm text-red-600">{error}</p>
          )}
        </div>

        {!joining ? (
          <div className="space-y-4">
            <Button
              onClick={createGame}
              className="w-full bg-purple-500 hover:bg-purple-600"
              disabled={playerName.trim().length < 2}
            >
              Create New Game
            </Button>
            <Button
              onClick={() => setJoining(true)}
              variant="outline"
              className="w-full"
              disabled={playerName.trim().length < 2}
            >
              Join Game
            </Button>
          </div>
        ) : (
          <form onSubmit={joinGame} className="space-y-4">
            <div>
              <label
                htmlFor="roomCode"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Enter Room Code
              </label>
              <input
                type="text"
                id="roomCode"
                maxLength={6}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="XXXXXX"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-purple-500 hover:bg-purple-600"
              disabled={roomCode.length !== 6}
            >
              Join Game
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setJoining(false)}
              className="w-full"
            >
              Back
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}