import React, { useState, useEffect } from 'react';
import { NetworkMessage, COLORS, SHAPES } from '../types';
import { Smartphone, Check, X, Clock } from 'lucide-react';

interface PlayerViewProps {
  channel: BroadcastChannel | null;
  onExit: () => void;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ channel, onExit }) => {
  // Local Player State
  const [name, setName] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [status, setStatus] = useState<'ENTER_PIN' | 'ENTER_NAME' | 'WAITING' | 'GAME_ON' | 'ANSWERED'>('ENTER_PIN');
  const [playerId, setPlayerId] = useState('');
  
  // Game Context State (received from Host)
  const [questionCount, setQuestionCount] = useState(0);
  const [currentAnswers, setCurrentAnswers] = useState<{id: string, color: string, text: string}[]>([]);
  const [isGameActive, setIsGameActive] = useState(false);
  const [feedback, setFeedback] = useState<'NONE' | 'CORRECT' | 'WRONG' | 'TIME_UP'>('NONE');
  const [score, setScore] = useState(0);
  const [answerStartTime, setAnswerStartTime] = useState(0);

  useEffect(() => {
    if (!channel) return;

    const handleMessage = (event: MessageEvent<NetworkMessage>) => {
      const msg = event.data;

      if (msg.type === 'PLAYER_JOINED') {
        if (msg.payload.player.id === playerId) {
          setStatus('WAITING');
        }
      }

      if (msg.type === 'GAME_START') {
        setQuestionCount(msg.payload.totalQuestions);
      }

      if (msg.type === 'NEXT_QUESTION') {
        setFeedback('NONE');
        setStatus('WAITING'); // Wait for "START_TIMER"
        setCurrentAnswers(msg.payload.answers);
      }

      if (msg.type === 'START_TIMER') {
        setStatus('GAME_ON');
        setAnswerStartTime(Date.now());
      }

      if (msg.type === 'ROUND_END') {
        // Did we get it right? 
        // Note: In a real app, we'd check against a locally stored answer attempt
        // Ideally the host tells us, but we can infer from score update or just generic "Round Over"
        // Let's rely on the updated score payload to verify if we gained points
        const myData = msg.payload.scores.find(p => p.id === playerId);
        if (myData) {
          const gainedPoints = myData.score - score;
          setScore(myData.score);
          if (status === 'ANSWERED') {
             if (gainedPoints > 0) setFeedback('CORRECT');
             else setFeedback('WRONG');
          } else {
             setFeedback('TIME_UP');
          }
        }
        setStatus('WAITING');
      }

      if (msg.type === 'GAME_OVER') {
        setStatus('WAITING'); // Or a game over screen
        setFeedback('NONE');
      }
    };

    channel.onmessage = handleMessage;
  }, [channel, playerId, score, status]);

  const joinGame = () => {
    if (!name || !channel) return;
    const pid = Math.random().toString(36).substr(2, 9);
    setPlayerId(pid);
    channel.postMessage({ 
      type: 'JOIN_REQUEST', 
      payload: { name, id: pid, avatar: '' } 
    });
    // Optimistic Wait
    setStatus('WAITING');
  };

  const handlePinSubmit = () => {
     // In this purely frontend demo, we assume the user typed the "channel name" essentially.
     // But to make it work with the parent App.tsx logic which creates the channel based on user choice,
     // we actually don't switch channels here. We assume the user is already on the correct "App" flow.
     // However, to simulate the experience:
     if (pinInput.length > 0) {
       setStatus('ENTER_NAME');
     }
  };

  const submitAnswer = (ansId: string) => {
    if (status !== 'GAME_ON' || !channel) return;
    
    const now = Date.now();
    const timeTaken = (now - answerStartTime) / 1000;
    const timeLeft = Math.max(0, 5 - timeTaken); // 5s total time

    channel.postMessage({
      type: 'SUBMIT_ANSWER',
      payload: { playerId, answerId: ansId, timeLeft }
    });
    setStatus('ANSWERED');
  };

  // --- RENDER ---

  if (status === 'ENTER_PIN') {
    return (
      <div className="min-h-screen bg-purple-800 flex flex-col items-center justify-center p-6 text-white">
        <div className="max-w-xs w-full">
           <div className="mb-8 text-center font-black text-4xl italic">FlashQuiz</div>
           <input 
            type="text" 
            placeholder="PIN del Juego" 
            className="w-full p-4 rounded text-center text-gray-900 font-bold text-xl mb-4"
            value={pinInput}
            onChange={e => setPinInput(e.target.value)}
           />
           <button onClick={handlePinSubmit} className="w-full bg-gray-900 p-4 rounded font-bold hover:bg-gray-800 transition">Entrar</button>
        </div>
      </div>
    );
  }

  if (status === 'ENTER_NAME') {
    return (
      <div className="min-h-screen bg-purple-800 flex flex-col items-center justify-center p-6 text-white">
        <div className="max-w-xs w-full">
           <div className="mb-8 text-center font-black text-4xl italic">FlashQuiz</div>
           <input 
            type="text" 
            placeholder="Apodo" 
            className="w-full p-4 rounded text-center text-gray-900 font-bold text-xl mb-4"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={12}
           />
           <button onClick={joinGame} className="w-full bg-green-500 p-4 rounded font-bold hover:bg-green-600 transition">¡Listo, Vamos!</button>
        </div>
      </div>
    );
  }

  if (status === 'WAITING' || status === 'ANSWERED') {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-white transition-colors duration-500 ${
        feedback === 'CORRECT' ? 'bg-green-600' : 
        feedback === 'WRONG' ? 'bg-red-600' : 
        'bg-purple-700'
      }`}>
        <div className="text-center">
           {feedback === 'NONE' && status === 'WAITING' && (
             <>
                <h2 className="text-2xl font-bold mb-4">¡Estás dentro!</h2>
                <p className="animate-pulse">¿Ves tu nombre en pantalla?</p>
             </>
           )}
           {status === 'ANSWERED' && feedback === 'NONE' && (
             <>
               <h2 className="text-2xl font-bold mb-4">¡Respuesta Enviada!</h2>
               <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto"></div>
             </>
           )}
           {feedback === 'CORRECT' && (
             <div className="flex flex-col items-center">
               <Check className="w-24 h-24 mb-4" />
               <h2 className="text-4xl font-black">¡Correcto!</h2>
               <p className="mt-2 text-xl">+ Puntos</p>
               <p className="mt-4 opacity-80">Puntaje: {score}</p>
             </div>
           )}
           {feedback === 'WRONG' && (
             <div className="flex flex-col items-center">
               <X className="w-24 h-24 mb-4" />
               <h2 className="text-4xl font-black">Incorrecto</h2>
               <p className="mt-2 text-xl">¡Sigue intentando!</p>
               <p className="mt-4 opacity-80">Puntaje: {score}</p>
             </div>
           )}
           {feedback === 'TIME_UP' && (
             <div className="flex flex-col items-center">
               <Clock className="w-24 h-24 mb-4" />
               <h2 className="text-4xl font-black">¡Tiempo Agotado!</h2>
               <p className="mt-4 opacity-80">Puntaje: {score}</p>
             </div>
           )}
        </div>
        <div className="fixed bottom-4 text-sm opacity-50">{name} • {score}</div>
      </div>
    );
  }

  if (status === 'GAME_ON') {
    return (
      <div className="min-h-screen bg-gray-100 grid grid-cols-2 gap-4 p-4">
        {currentAnswers.map(a => (
          <button
            key={a.id}
            onClick={() => submitAnswer(a.id)}
            className={`${COLORS[a.color as keyof typeof COLORS]} rounded-xl shadow-lg flex flex-col items-center justify-center active:scale-95 transition-transform`}
          >
            <span className="text-6xl text-white drop-shadow-md">
              {SHAPES[a.color as keyof typeof SHAPES]}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return <div>Cargando...</div>;
};