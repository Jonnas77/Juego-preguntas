import React, { useState, useEffect, useRef } from 'react';
import { GamePhase, Player, Question, NetworkMessage, COLORS, SHAPES } from '../types';
import { generateQuizQuestions } from '../services/geminiService';
import { Trophy, Medal, Users, Smartphone, Zap, Loader2, Music, CheckCircle, XCircle } from 'lucide-react';

interface HostViewProps {
  channel: BroadcastChannel | null;
  pin: string;
  onExit: () => void;
}

export const HostView: React.FC<HostViewProps> = ({ channel, pin, onExit }) => {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.LOBBY);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [timer, setTimer] = useState(0);
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [manualQText, setManualQText] = useState('');
  
  // Audio refs (mocked for visual effect mainly, real audio would be better)
  // Logic references
  const playersRef = useRef<Player[]>([]);
  
  // Sync state ref
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // Network Listener
  useEffect(() => {
    if (!channel) return;

    const handleMessage = (event: MessageEvent<NetworkMessage>) => {
      const msg = event.data;
      
      if (msg.type === 'JOIN_REQUEST') {
        const newPlayer: Player = {
          id: msg.payload.id,
          name: msg.payload.name,
          avatar: msg.payload.avatar,
          score: 0,
          streak: 0
        };
        setPlayers(prev => {
          if (prev.find(p => p.id === newPlayer.id)) return prev;
          const updated = [...prev, newPlayer];
          // Notify everyone this player joined
          channel.postMessage({ type: 'PLAYER_JOINED', payload: { player: newPlayer } });
          return updated;
        });
      }

      if (msg.type === 'SUBMIT_ANSWER') {
        // Handle scoring logic here
        // We only process answers during ANSWERING phase
        if (phase !== GamePhase.ANSWERING && phase !== GamePhase.PREVIEW_QUESTION) return; // Allow early submit? No.

        const { playerId, answerId, timeLeft } = msg.payload;
        
        setPlayers(currentPlayers => {
          return currentPlayers.map(p => {
            if (p.id !== playerId) return p;
            
            // Avoid double answering
            if (p.lastAnswerTime === currentQIndex) return p;

            const currentQ = questions[currentQIndex];
            const answer = currentQ.answers.find(a => a.id === answerId);
            const isCorrect = answer?.isCorrect || false;

            // Score Calculation: Base 1000 + Time Bonus
            // 5 seconds max. 
            // If correct: 1000 * (1 - ((5 - timeLeft) / 10)) -- Linear decay isn't quite right for Kahoot style
            // Kahoot style: roughly 1000 points max.
            let points = 0;
            if (isCorrect) {
              // timeLeft is effectively how quickly they answered (e.g. 4.5s left)
              // max score 1000. min score 500 if correct.
              const ratio = timeLeft / 5; // 0 to 1
              points = Math.round(500 + (500 * ratio));
            }

            return {
              ...p,
              score: p.score + points,
              streak: isCorrect ? p.streak + 1 : 0,
              lastAnswerTime: currentQIndex // Mark as answered for this Q
            };
          });
        });
      }
    };

    channel.onmessage = handleMessage;
    // Cleanup handled by react
  }, [channel, phase, questions, currentQIndex]);


  // Timer Logic
  useEffect(() => {
    let interval: number;
    if (phase === GamePhase.PREVIEW_QUESTION) {
      setTimer(3); // 3 seconds to read
      interval = window.setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            setPhase(GamePhase.ANSWERING);
            channel?.postMessage({ type: 'START_TIMER', payload: null });
            return 5; // Switch to 5s answer timer
          }
          return prev - 1;
        });
      }, 1000);
    } else if (phase === GamePhase.ANSWERING) {
      // 5 seconds to answer
      interval = window.setInterval(() => {
        setTimer(prev => {
          if (prev <= 0) {
            // Time is up
            finishRound();
            return 0;
          }
          return prev - 0.1; // Smooth timer
        });
      }, 100);
    }

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const finishRound = () => {
    setPhase(GamePhase.LEADERBOARD);
    const correctAns = questions[currentQIndex].answers.find(a => a.isCorrect);
    channel?.postMessage({ 
      type: 'ROUND_END', 
      payload: { 
        correctId: correctAns?.id || '', 
        scores: playersRef.current 
      } 
    });
  };

  const startGame = () => {
    if (questions.length === 0) return;
    setPhase(GamePhase.PREVIEW_QUESTION);
    setCurrentQIndex(0);
    broadcastQuestion(0);
  };

  const nextQuestion = () => {
    const nextIdx = currentQIndex + 1;
    if (nextIdx >= questions.length) {
      setPhase(GamePhase.PODIUM);
      channel?.postMessage({ type: 'GAME_OVER', payload: { podium: [...playersRef.current].sort((a,b) => b.score - a.score).slice(0,3) } });
    } else {
      setCurrentQIndex(nextIdx);
      setPhase(GamePhase.PREVIEW_QUESTION);
      broadcastQuestion(nextIdx);
    }
  };

  const broadcastQuestion = (idx: number) => {
    const q = questions[idx];
    channel?.postMessage({
      type: 'NEXT_QUESTION',
      payload: {
        questionIndex: idx,
        text: q.text,
        timeLimit: q.timeLimit,
        answers: q.answers.map(a => ({ id: a.id, color: a.color, text: a.text }))
      }
    });
  };

  const generateAIQuiz = async () => {
    if (!topic) return;
    setIsLoading(true);
    try {
      const qs = await generateQuizQuestions(topic, 5);
      setQuestions(qs);
    } catch (e) {
      console.error(e);
      alert("Error al generar el cuestionario. Verifica la API Key o intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const addManualQuestion = () => {
    // Simple manual adder for demo purposes
    const newQ: Question = {
      id: Math.random().toString(),
      text: manualQText || "¿Pregunta de ejemplo?",
      timeLimit: 5,
      answers: [
        { id: '1', text: 'Respuesta Correcta', isCorrect: true, color: 'red' },
        { id: '2', text: 'Incorrecta 1', isCorrect: false, color: 'blue' },
        { id: '3', text: 'Incorrecta 2', isCorrect: false, color: 'yellow' },
        { id: '4', text: 'Incorrecta 3', isCorrect: false, color: 'green' },
      ]
    };
    setQuestions([...questions, newQ]);
    setManualQText('');
  };

  // --- RENDERERS ---

  if (phase === GamePhase.LOBBY) {
    return (
      <div className="min-h-screen bg-purple-900 text-white flex flex-col items-center p-6 relative overflow-hidden">
        {/* Animated Background Blobs */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>

        <div className="z-10 w-full max-w-4xl flex flex-col items-center gap-8">
          <div className="bg-white text-purple-900 px-12 py-6 rounded-2xl shadow-2xl transform -rotate-2">
            <h2 className="text-xl font-bold uppercase tracking-widest text-center mb-2">Únete con el PIN:</h2>
            <h1 className="text-7xl font-black tracking-tighter text-center">{pin}</h1>
          </div>

          <div className="flex gap-4 w-full justify-center">
            <div className="bg-white/10 p-6 rounded-xl backdrop-blur-md flex-1 max-w-md">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Zap className="w-5 h-5"/> Crear Cuestionario</h3>
              <div className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="ej. Roma Antigua, JavaScript, Pop de los 80"
                  className="flex-1 px-4 py-2 rounded-lg text-gray-900"
                />
                <button 
                  onClick={generateAIQuiz}
                  disabled={isLoading || !topic}
                  className="bg-pink-500 hover:bg-pink-600 px-4 py-2 rounded-lg font-bold disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin w-4 h-4"/> : "Generar IA"}
                </button>
              </div>
              
              <div className="border-t border-white/20 pt-4">
                 <h3 className="text-sm font-bold mb-2">O añadir manual (Demo):</h3>
                 <div className="flex gap-2">
                   <input value={manualQText} onChange={e => setManualQText(e.target.value)} placeholder="Texto de la pregunta..." className="flex-1 px-3 py-1 rounded text-gray-900 text-sm"/>
                   <button onClick={addManualQuestion} className="bg-blue-500 px-3 py-1 rounded text-sm font-bold">+</button>
                 </div>
              </div>

              <div className="mt-4 text-center">
                <p className="text-2xl font-bold">{questions.length} Preguntas Listas</p>
              </div>
            </div>

            <div className="bg-white/10 p-6 rounded-xl backdrop-blur-md flex-1 max-w-md">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Users className="w-5 h-5"/> Jugadores ({players.length})</h3>
              <div className="flex flex-wrap gap-3">
                {players.map(p => (
                  <div key={p.id} className="bg-white text-purple-900 px-3 py-1 rounded-full font-bold shadow-lg animate-pop">
                    {p.name}
                  </div>
                ))}
                {players.length === 0 && <p className="opacity-50 italic">Esperando jugadores...</p>}
              </div>
            </div>
          </div>

          <button 
            onClick={startGame}
            disabled={questions.length === 0 || players.length === 0}
            className="bg-green-500 hover:bg-green-600 text-white text-2xl font-black py-4 px-12 rounded-full shadow-lg transform transition hover:scale-105 disabled:opacity-50 disabled:scale-100"
          >
            EMPEZAR JUEGO
          </button>
        </div>
      </div>
    );
  }

  if (phase === GamePhase.PREVIEW_QUESTION || phase === GamePhase.ANSWERING) {
    const q = questions[currentQIndex];
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold">
            {currentQIndex + 1} / {questions.length}
          </div>
          <div className="bg-white px-6 py-2 rounded-full shadow-lg text-2xl font-black text-purple-900 flex items-center gap-2">
            {phase === GamePhase.PREVIEW_QUESTION ? "¡Prepárate!" : Math.ceil(timer)}
          </div>
          <div className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold">
            {players.length} Respuestas
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl mb-8 flex-1 flex items-center justify-center text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 leading-tight">
            {q.text}
          </h1>
        </div>

        {phase === GamePhase.ANSWERING && (
          <div className="grid grid-cols-2 gap-4 h-64">
             {q.answers.map(a => (
               <div key={a.id} className={`${COLORS[a.color]} rounded-xl shadow-lg flex items-center justify-between px-6 text-white text-2xl font-bold transition-all`}>
                 <span className="text-3xl">{SHAPES[a.color]}</span>
                 <span className="truncate ml-4">{a.text}</span>
               </div>
             ))}
          </div>
        )}
        
        {phase === GamePhase.PREVIEW_QUESTION && (
          <div className="h-64 flex items-center justify-center">
             <div className="animate-bounce text-3xl font-bold text-purple-600">Leyendo...</div>
          </div>
        )}

        {/* 5 Second Progress Bar */}
        {phase === GamePhase.ANSWERING && (
          <div className="fixed bottom-0 left-0 h-2 bg-purple-600 transition-all duration-100 ease-linear" style={{ width: `${(timer / 5) * 100}%` }}></div>
        )}
      </div>
    );
  }

  if (phase === GamePhase.LEADERBOARD) {
    // Sort players
    const sortedPlayers = [...players].sort((a,b) => b.score - a.score).slice(0, 5);
    const q = questions[currentQIndex];
    
    return (
       <div className="min-h-screen bg-purple-900 text-white p-6 flex flex-col">
         <h1 className="text-center text-3xl font-bold mb-8">Tabla de Puntajes</h1>
         
         {/* Show correct answer recap */}
         <div className="bg-white/10 p-4 rounded-lg mb-8 text-center backdrop-blur-sm">
            <span className="text-gray-300 mr-2">Respuesta Correcta:</span>
            <span className="font-bold text-xl">{q.answers.find(a=>a.isCorrect)?.text}</span>
         </div>

         <div className="flex-1 flex flex-col gap-4 max-w-2xl mx-auto w-full">
            {sortedPlayers.map((p, idx) => (
              <div key={p.id} className="bg-white text-gray-900 p-4 rounded-lg shadow-lg flex justify-between items-center transform transition-all hover:scale-105" style={{ transitionDelay: `${idx * 100}ms` }}>
                 <div className="flex items-center gap-4">
                    <span className="text-2xl font-black text-purple-600 w-8">{idx + 1}</span>
                    <span className="font-bold text-xl">{p.name}</span>
                    {p.streak > 2 && <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">🔥 {p.streak}</span>}
                 </div>
                 <div className="font-black text-2xl">{p.score}</div>
              </div>
            ))}
         </div>

         <div className="flex justify-end mt-8">
           <button onClick={nextQuestion} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg text-xl flex items-center gap-2">
             Siguiente <Zap className="w-5 h-5"/>
           </button>
         </div>
       </div>
    );
  }

  if (phase === GamePhase.PODIUM) {
    const sorted = [...players].sort((a,b) => b.score - a.score);
    const first = sorted[0];
    const second = sorted[1];
    const third = sorted[2];

    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Confetti mock */}
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
        
        <h1 className="text-5xl font-black text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-pink-500">PODIO</h1>

        <div className="flex items-end justify-center gap-4 md:gap-8 mb-12 h-96">
          {/* 2nd Place */}
          {second && (
            <div className="flex flex-col items-center animate-slide-up" style={{animationDelay: '0.5s'}}>
              <div className="text-xl font-bold mb-2">{second.name}</div>
              <div className="text-gray-400 mb-2">{second.score} pts</div>
              <div className="w-24 md:w-32 h-48 bg-gray-400 rounded-t-lg flex flex-col justify-end items-center pb-4 shadow-2xl relative">
                 <Medal className="w-12 h-12 text-gray-200 mb-2" />
                 <span className="text-4xl font-black text-gray-800 opacity-50">2</span>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {first && (
             <div className="flex flex-col items-center z-10 animate-slide-up">
              <div className="text-2xl font-bold mb-2 text-yellow-400">{first.name}</div>
              <div className="text-yellow-200 mb-2">{first.score} pts</div>
              <div className="w-28 md:w-40 h-64 bg-yellow-400 rounded-t-lg flex flex-col justify-end items-center pb-4 shadow-[0_0_50px_rgba(250,204,21,0.5)] relative">
                 <Trophy className="w-16 h-16 text-yellow-100 mb-4 animate-bounce" />
                 <span className="text-6xl font-black text-yellow-700 opacity-50">1</span>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {third && (
            <div className="flex flex-col items-center animate-slide-up" style={{animationDelay: '1s'}}>
              <div className="text-xl font-bold mb-2">{third.name}</div>
              <div className="text-gray-400 mb-2">{third.score} pts</div>
              <div className="w-24 md:w-32 h-32 bg-orange-700 rounded-t-lg flex flex-col justify-end items-center pb-4 shadow-2xl relative">
                 <Medal className="w-12 h-12 text-orange-300 mb-2" />
                 <span className="text-4xl font-black text-orange-900 opacity-50">3</span>
              </div>
            </div>
          )}
        </div>

        <button onClick={onExit} className="mt-8 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-full text-white font-bold transition">
          Salir al Menú
        </button>
      </div>
    );
  }

  return <div>Unknown Phase</div>;
};