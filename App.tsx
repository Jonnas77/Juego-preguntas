import React, { useState, useEffect } from 'react';
import { HostView } from './components/HostView';
import { PlayerView } from './components/PlayerView';
import { Smartphone, MonitorPlay } from 'lucide-react';

// For this demo, we use a fixed PIN for the "simulated" channel logic if manually typed
// But effectively, we create a channel based on a PIN.
const DEMO_PIN = "3928";

export default function App() {
  const [role, setRole] = useState<'NONE' | 'HOST' | 'PLAYER'>('NONE');
  const [channel, setChannel] = useState<BroadcastChannel | null>(null);

  useEffect(() => {
    // Initialize BroadcastChannel when role is selected
    if (role !== 'NONE') {
      const ch = new BroadcastChannel(`quiz-channel-${DEMO_PIN}`);
      setChannel(ch);
      return () => {
        ch.close();
        setChannel(null);
      };
    }
  }, [role]);

  const reset = () => setRole('NONE');

  if (role === 'NONE') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-6 text-white">
        <div className="max-w-md w-full text-center">
          <h1 className="text-6xl font-black italic mb-2 tracking-tighter">FlashQuiz</h1>
          <p className="text-lg opacity-90 mb-12">El juego de preguntas rápido impulsado por IA</p>
          
          <div className="grid gap-6">
            <button 
              onClick={() => setRole('HOST')}
              className="group bg-white text-purple-900 hover:bg-gray-50 p-6 rounded-2xl shadow-xl transition-all transform hover:-translate-y-1 flex items-center justify-between"
            >
              <div className="text-left">
                <div className="font-bold text-2xl group-hover:text-purple-600 transition-colors">Anfitrión</div>
                <div className="text-sm opacity-60">Crear partida en pantalla grande</div>
              </div>
              <MonitorPlay className="w-10 h-10 opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all" />
            </button>

            <button 
              onClick={() => setRole('PLAYER')}
              className="group bg-white text-purple-900 hover:bg-gray-50 p-6 rounded-2xl shadow-xl transition-all transform hover:-translate-y-1 flex items-center justify-between"
            >
              <div className="text-left">
                <div className="font-bold text-2xl group-hover:text-purple-600 transition-colors">Jugador</div>
                <div className="text-sm opacity-60">Unirse con el móvil</div>
              </div>
              <Smartphone className="w-10 h-10 opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all" />
            </button>
          </div>

          <div className="mt-12 text-xs opacity-50 max-w-xs mx-auto">
            <p><strong>Nota para Demo:</strong> Como esta es una demo en el cliente, abre esta URL en dos pestañas separadas. Usa una como Anfitrión y otra como Jugador. Se conectarán automáticamente con el PIN: <strong>{DEMO_PIN}</strong>.</p>
          </div>
        </div>
      </div>
    );
  }

  if (role === 'HOST') {
    return <HostView channel={channel} pin={DEMO_PIN} onExit={reset} />;
  }

  if (role === 'PLAYER') {
    return <PlayerView channel={channel} onExit={reset} />;
  }

  return null;
}