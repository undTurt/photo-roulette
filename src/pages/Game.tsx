import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Upload, Users, Timer, Trophy, ArrowLeft } from 'lucide-react';
import { useGameStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { validateImage, compressImage } from '../lib/utils';

export function Game() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [playerName] = useState(location.state?.playerName || '');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedGuess, setSelectedGuess] = useState<string | null>(null);
  
  const {
    players,
    gamePhase,
    currentRound,
    timeRemaining,
    currentPhoto,
    scores,
    setPlayers,
    setGamePhase,
    setRoomCode,
    setCurrentRound,
    setTimeRemaining,
    setCurrentPhoto,
    updateScore,
    resetGame,
  } = useGameStore();

  useEffect(() => {
    if (roomCode) {
      setRoomCode(roomCode);
      // Subscribe to room channel and game updates
      const roomChannel = supabase.channel(`room:${roomCode}`);
      
      roomChannel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = roomChannel.presenceState();
          const currentPlayers = Object.values(presenceState).flat() as any[];
          setPlayers(currentPlayers);
        })
        .on('broadcast', { event: 'game_state' }, ({ payload }) => {
          if (payload.phase) setGamePhase(payload.phase);
          if (payload.round) setCurrentRound(payload.round);
          if (payload.timeRemaining) setTimeRemaining(payload.timeRemaining);
          if (payload.currentPhoto) setCurrentPhoto(payload.currentPhoto);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await roomChannel.track({ user: playerName, id: playerId });
          }
        });

      return () => {
        roomChannel.unsubscribe();
      };
    }
  }, [roomCode, playerName, playerId]);

  useEffect(() => {
    const initializePlayer = async () => {
      if (!roomCode || !playerName) {
        navigate('/');
        return;
      }

      try {
        // First get or create game
        let gameId;
        const { data: existingGame } = await supabase
          .from('games')
          .select('id')
          .eq('room_code', roomCode)
          .single();

        if (existingGame) {
          gameId = existingGame.id;
        } else {
          const { data: newGame } = await supabase
            .from('games')
            .insert({ room_code: roomCode })
            .select('id')
            .single();
          
          if (!newGame) throw new Error('Failed to create game');
          gameId = newGame.id;
        }

        // Create player
        const { data: player, error: playerError } = await supabase
          .from('players')
          .insert({
            game_id: gameId,
            name: playerName,
          })
          .select()
          .single();

        if (playerError) throw playerError;
        if (player) {
          setPlayerId(player.id);
          setError(null);
        }
      } catch (err) {
        console.error('Error initializing player:', err);
        setError('Failed to join game');
      }
    };

    initializePlayer();
  }, [roomCode, playerName, navigate]);

  const handleBackToMenu = () => {
    resetGame();
    navigate('/');
  };

  const startRound = useCallback(async () => {
    if (!roomCode) return;

    try {
      // Get unused photo for this round
      const { data: photo } = await supabase
        .from('photos')
        .select('*')
        .eq('game_id', roomCode)
        .eq('used', false)
        .limit(1)
        .single();

      if (!photo) {
        setGamePhase('results');
        return;
      }

      // Get photo URL
      const { data: { publicUrl } } = supabase.storage
        .from('game-photos')
        .getPublicUrl(photo.storage_path);

      setCurrentPhoto({
        id: photo.id,
        url: publicUrl,
        playerId: photo.player_id,
        used: false,
      });

      // Show photo for 5 seconds
      setGamePhase('playing');
      setTimeRemaining(5);

      const timer = setInterval(() => {
        setTimeRemaining((time) => {
          if (time <= 1) {
            clearInterval(timer);
            setGamePhase('guessing');
            setTimeRemaining(10);
            return 0;
          }
          return time - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } catch (err) {
      console.error('Error starting round:', err);
    }
  }, [roomCode]);

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = playerName.trim();
    
    if (!roomCode || trimmedName.length < 2) {
      setError('Please enter at least 2 characters for your name');
      return;
    }

    try {
      // First, check if the game exists and is in lobby state
      const { data: game } = await supabase
        .from('games')
        .select()
        .eq('room_code', roomCode)
        .single();

      if (!game) {
        // Create new game if it doesn't exist
        const { data: newGame, error: gameError } = await supabase
          .from('games')
          .insert({ room_code: roomCode })
          .select()
          .single();

        if (gameError) throw gameError;
      }

      // Create player
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert({
          game_id: game?.id,
          name: trimmedName,
        })
        .select()
        .single();

      if (playerError) throw playerError;

      setPlayerId(player.id);
      setGamePhase('lobby');
    } catch (err) {
      console.error('Error joining game:', err);
      setError('Failed to join game. Please try again.');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length < 10) {
      setError('Please select at least 10 photos');
      return;
    }

    if (files.length > 20) {
      setError('Please select no more than 20 photos');
      return;
    }

    // Validate each file
    for (const file of files) {
      const isValid = await validateImage(file);
      if (!isValid) {
        setError('Please only select image files');
        return;
      }
    }

    setError(null);
    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (!selectedFiles.length || !playerId || !roomCode) return;
    
    setIsUploading(true);
    setError(null);

    try {
      const compressedFiles = await Promise.all(
        selectedFiles.map(file => compressImage(file))
      );

      // Get game ID
      const { data: game } = await supabase
        .from('games')
        .select('id')
        .eq('room_code', roomCode)
        .single();

      if (!game) throw new Error('Game not found');

      // Upload files to storage and create photo records
      for (const file of compressedFiles) {
        const fileName = `${roomCode}/${crypto.randomUUID()}`;
        const { error: uploadError } = await supabase.storage
          .from('game-photos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Create photo record
        const { error: photoError } = await supabase
          .from('photos')
          .insert({
            game_id: game.id,
            player_id: playerId,
            storage_path: fileName,
          });

        if (photoError) throw photoError;
      }

      // Update player ready status
      await supabase
        .from('players')
        .update({ ready: true })
        .eq('id', playerId);

      setGamePhase('uploading');
    } catch (err) {
      console.error('Error uploading photos:', err);
      setError('Failed to upload photos. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleGuess = async () => {
    if (!selectedGuess || !currentPhoto || !playerId) return;

    try {
      // Record guess
      const { error: guessError } = await supabase
        .from('guesses')
        .insert({
          game_id: roomCode,
          round: currentRound,
          photo_id: currentPhoto.id,
          player_id: playerId,
          guessed_player_id: selectedGuess,
          correct: selectedGuess === currentPhoto.playerId,
        });

      if (guessError) throw guessError;

      // Update score if correct
      if (selectedGuess === currentPhoto.playerId) {
        updateScore(playerId, 100);
      }

      // Mark photo as used
      await supabase
        .from('photos')
        .update({ used: true })
        .eq('id', currentPhoto.id);

      // Start next round
      setCurrentRound(currentRound + 1);
      if (currentRound < 10) {
        await startRound();
      } else {
        setGamePhase('results');
      }
    } catch (err) {
      console.error('Error submitting guess:', err);
    }
  };

  if (!playerName) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="flex items-center justify-between mb-6">
            <Button
              onClick={handleBackToMenu}
              variant="ghost"
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-2xl font-bold text-center flex-1 mr-8">Enter Your Name</h2>
          </div>
          <form onSubmit={handleJoinGame} className="space-y-4">
            <div className="space-y-2">
              <input
                type="text"
                value={playerName}
                onChange={(e) => {
                  setPlayerName(e.target.value);
                  setError(null);
                }}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Your name"
                maxLength={20}
                minLength={2}
                required
              />
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={playerName.trim().length < 2}
            >
              Join Game
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleBackToMenu}
                variant="ghost"
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h2 className="text-2xl font-bold">Room: {roomCode}</h2>
                <p className="text-gray-600">Round {currentRound}/10</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <Users className="w-5 h-5 text-gray-600 mr-2" />
                <span>{players.length}/8</span>
              </div>
              {timeRemaining > 0 && (
                <div className="flex items-center">
                  <Timer className="w-5 h-5 text-gray-600 mr-2" />
                  <span>{timeRemaining}s</span>
                </div>
              )}
            </div>
          </div>

          {gamePhase === 'lobby' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Upload Your Photos</h3>
                <p className="text-gray-500 mb-4">Select 10-20 photos to play with</p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-purple-50 file:text-purple-700
                    hover:file:bg-purple-100"
                  id="photo-upload"
                />
                {selectedFiles.length > 0 && (
                  <p className="mt-2 text-sm text-gray-600">
                    {selectedFiles.length} photos selected
                  </p>
                )}
                {error && (
                  <p className="mt-2 text-sm text-red-600">{error}</p>
                )}
              </div>

              <Button
                onClick={handleUpload}
                disabled={!selectedFiles.length || isUploading}
                className="w-full"
              >
                {isUploading ? 'Uploading...' : 'Start Game'}
              </Button>
            </div>
          )}

          {gamePhase === 'playing' && currentPhoto && (
            <div className="space-y-4">
              <div className="aspect-video rounded-lg overflow-hidden">
                <img
                  src={currentPhoto.url}
                  alt="Mystery photo"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-center text-lg">
                Memorize this photo! Time remaining: {timeRemaining}s
              </p>
            </div>
          )}

          {gamePhase === 'guessing' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-center">
                Whose photo was it?
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {players.map((player) => (
                  <Button
                    key={player.id}
                    onClick={() => setSelectedGuess(player.id)}
                    variant={selectedGuess === player.id ? 'default' : 'outline'}
                    className="w-full"
                  >
                    {player.name}
                  </Button>
                ))}
              </div>
              <Button
                onClick={handleGuess}
                disabled={!selectedGuess}
                className="w-full"
              >
                Submit Guess
              </Button>
              <p className="text-center">Time remaining: {timeRemaining}s</p>
            </div>
          )}

          {gamePhase === 'results' && (
            <div className="space-y-6">
              <div className="flex items-center justify-center mb-8">
                <Trophy className="w-16 h-16 text-yellow-400" />
              </div>
              <h3 className="text-2xl font-bold text-center mb-6">
                Final Scores
              </h3>
              <div className="space-y-4">
                {players
                  .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
                  .map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center">
                        <span className="text-2xl font-bold mr-4">
                          #{index + 1}
                        </span>
                        <span className="text-lg">{player.name}</span>
                      </div>
                      <span className="text-xl font-semibold">
                        {scores[player.id] || 0}
                      </span>
                    </div>
                  ))}
              </div>
              <Button
                onClick={handleBackToMenu}
                className="w-full"
              >
                Back to Menu
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}