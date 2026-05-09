/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Heart, 
  Play, 
  RefreshCw, 
  ChevronLeft, 
  Star, 
  Plus, 
  Minus, 
  X,
  Volume2,
  VolumeX,
  Target,
  Box,
  Dice5,
  Circle as CircleIcon,
  Pyramid,
  Cylinder
} from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, MeshWobbleMaterial, Float } from '@react-three/drei';
import confetti from 'canvas-confetti';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from './firebase';

// --- Types ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

enum GameState {
  LOBBY = 'lobby',
  PLAYING = 'playing',
  GAME_OVER = 'game_over',
  WIN = 'win',
  LEARNING_3D = 'learning_3d'
}

enum Difficulty {
  EASY = 'Mudah',
  MEDIUM = 'Sedang',
  HARD = 'Sulit'
}

enum Operation {
  ADD = 'Penjumlahan',
  SUBTRACT = 'Pengurangan',
  MULTIPLY = 'Perkalian'
}

interface Question {
  id: number;
  num1: number;
  num2: number;
  operation: '+' | '-' | '×';
  answer: number;
  options: number[];
}

interface LeaderboardEntry {
  name: string;
  score: number;
  difficulty: Difficulty;
  operation: Operation;
  timestamp: number;
}

// --- Constants ---

const MAX_LIVES = 3;
const QUESTIONS_PER_LEVEL = 10;
const LEADERBOARD_COLLECTION = 'leaderboard';

// --- Audio Utility ---

let musicInterval: number | null = null;

const playSound = (type: 'correct' | 'wrong' | 'click' | 'win' | 'start' | 'bgm_start' | 'bgm_stop', enabled: boolean) => {
  if (!enabled && type !== 'bgm_stop') return;
  
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const createOscillator = (freq: number, type: OscillatorType, duration: number, volume: number = 0.1) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    };

    if (type === 'correct') {
      createOscillator(523.25, 'sine', 0.5); // C5
      setTimeout(() => createOscillator(659.25, 'sine', 0.5), 100); // E5
    } else if (type === 'wrong') {
      createOscillator(220, 'sawtooth', 0.3, 0.05); // A3
      setTimeout(() => createOscillator(164.81, 'sawtooth', 0.3, 0.05), 50); // E3
    } else if (type === 'click') {
      createOscillator(440, 'triangle', 0.1, 0.05);
    } else if (type === 'start') {
      createOscillator(392, 'sine', 0.2);
      setTimeout(() => createOscillator(523.25, 'sine', 0.4), 100);
    } else if (type === 'win') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        setTimeout(() => createOscillator(freq, 'sine', 0.6), i * 150);
      });
    } else if (type === 'bgm_start') {
      if (musicInterval) return;
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      let count = 0;
      musicInterval = window.setInterval(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(notes[count % notes.length], ctx.currentTime);
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
        count++;
      }, 400);
    } else if (type === 'bgm_stop') {
      if (musicInterval) {
        clearInterval(musicInterval);
        musicInterval = null;
      }
    }
  } catch (e) {
    console.warn('Audio not supported or blocked', e);
  }
};

// --- Helper Functions ---

function generateQuestion(difficulty: Difficulty, opType: Operation): Question {
  let num1 = 0;
  let num2 = 0;
  let operation: '+' | '-' | '×' = '+';
  let answer = 0;

  if (opType === Operation.ADD) {
    operation = '+';
    const range = difficulty === Difficulty.EASY ? 10 : difficulty === Difficulty.MEDIUM ? 50 : 100;
    num1 = Math.floor(Math.random() * range) + 1;
    num2 = Math.floor(Math.random() * range) + 1;
    answer = num1 + num2;
  } else if (opType === Operation.SUBTRACT) {
    operation = '-';
    const range = difficulty === Difficulty.EASY ? 10 : difficulty === Difficulty.MEDIUM ? 50 : 100;
    num1 = Math.floor(Math.random() * range) + 1;
    num2 = Math.floor(Math.random() * num1) + 1; // Ensure positive result for subtraction
    answer = num1 - num2;
  } else {
    operation = '×';
    const range = difficulty === Difficulty.EASY ? 5 : difficulty === Difficulty.MEDIUM ? 10 : 12;
    num1 = Math.floor(Math.random() * range) + 1;
    num2 = Math.floor(Math.random() * range) + 1;
    answer = num1 * num2;
  }

  // Generate options
  const options = new Set<number>();
  options.add(answer);
  while (options.size < 4) {
    const offset = Math.floor(Math.random() * 10) - 5;
    const opt = Math.max(0, answer + (offset === 0 ? 3 : offset));
    options.add(opt);
  }

  return {
    id: Date.now(),
    num1,
    num2,
    operation,
    answer,
    options: Array.from(options).sort(() => Math.random() - 0.5)
  };
}

// --- 3D Shape Components ---

function Shape3D({ type }: { type: 'kubus' | 'balok' | 'tabung' | 'bola' | 'kerucut' }) {
  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1}>
      <mesh castShadow receiveShadow>
        {type === 'kubus' && <boxGeometry args={[2, 2, 2]} />}
        {type === 'balok' && <boxGeometry args={[3, 1.5, 1.5]} />}
        {type === 'tabung' && <cylinderGeometry args={[1, 1, 3, 32]} />}
        {type === 'bola' && <sphereGeometry args={[1.5, 32, 32]} />}
        {type === 'kerucut' && <coneGeometry args={[1.5, 3, 32]} />}
        <MeshWobbleMaterial 
          color={
            type === 'kubus' ? '#EF476F' :
            type === 'balok' ? '#118AB2' :
            type === 'tabung' ? '#06D6A0' :
            type === 'bola' ? '#FFD166' : '#073B4C'
          } 
          factor={0.1} 
          speed={1} 
          roughness={0}
          emissive="#ffffff"
          emissiveIntensity={0.1}
        />
      </mesh>
    </Float>
  );
}

// --- Components ---

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.LOBBY);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.EASY);
  const [operation, setOperation] = useState<Operation>(Operation.ADD);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [questionCount, setQuestionCount] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedShape, setSelectedShape] = useState<'kubus' | 'balok' | 'tabung' | 'bola' | 'kerucut'>('kubus');

  // Load leaderboard real-time
  useEffect(() => {
    const q = query(
      collection(db, LEADERBOARD_COLLECTION), 
      orderBy('score', 'desc'), 
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries: LeaderboardEntry[] = [];
      snapshot.forEach((doc) => {
        entries.push(doc.data() as LeaderboardEntry);
      });
      setLeaderboard(entries);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, LEADERBOARD_COLLECTION);
    });

    return () => unsubscribe();
  }, []);

  const saveScore = useCallback(async (finalScore: number) => {
    if (!userName.trim() || finalScore === 0) return;
    
    try {
      await addDoc(collection(db, LEADERBOARD_COLLECTION), {
        name: userName,
        score: finalScore,
        difficulty,
        operation,
        timestamp: Date.now() // or serverTimestamp() - but rules expect number and schema says number
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, LEADERBOARD_COLLECTION);
    }
  }, [userName, difficulty, operation]);

  useEffect(() => {
    if (gameState === GameState.PLAYING && isSoundEnabled) {
      playSound('bgm_start', true);
    } else {
      playSound('bgm_stop', false);
    }

    // Save score only once when game ends
    if ((gameState === GameState.WIN || gameState === GameState.GAME_OVER) && score > 0) {
      saveScore(score);
    }

    return () => playSound('bgm_stop', false);
  }, [gameState, isSoundEnabled, saveScore]); // removed score from deps to prevent re-triggering if score changes (though it shouldn't at end)

  const startGame = (diff: Difficulty, op: Operation) => {
    setDifficulty(diff);
    setOperation(op);
    setGameState(GameState.PLAYING);
    setScore(0);
    setLives(MAX_LIVES);
    setQuestionCount(0);
    setFeedback(null);
    playSound('start', isSoundEnabled);
    nextQuestion(diff, op);
  };

  const nextQuestion = useCallback((diff: Difficulty, op: Operation) => {
    if (questionCount >= QUESTIONS_PER_LEVEL) {
      setGameState(GameState.WIN);
      playSound('win', isSoundEnabled);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
      return;
    }
    setCurrentQuestion(generateQuestion(diff, op));
    setQuestionCount(prev => prev + 1);
    setFeedback(null);
  }, [questionCount, isSoundEnabled]);

  const handleAnswer = (selected: number) => {
    if (!currentQuestion || feedback) return;

    if (selected === currentQuestion.answer) {
      setScore(prev => prev + 10);
      setFeedback('correct');
      playSound('correct', isSoundEnabled);
      setTimeout(() => nextQuestion(difficulty, operation), 1000);
    } else {
      setLives(prev => prev - 1);
      setFeedback('wrong');
      playSound('wrong', isSoundEnabled);
      if (lives <= 1) {
        setTimeout(() => setGameState(GameState.GAME_OVER), 1000);
      } else {
        setTimeout(() => {
          setFeedback(null);
          setCurrentQuestion(generateQuestion(difficulty, operation));
        }, 1200);
      }
    }
  };

  const renderLobby = () => (
    <div className="flex flex-col items-center justify-center min-h-[90vh] gap-8 md:gap-12 p-4 py-12">
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center px-2"
      >
        <span className="tag-badge mb-4 inline-block">Aplikasi Edukasi</span>
        <h1 className="text-5xl sm:text-7xl md:text-9xl font-black text-[#073B4C] mb-2 tracking-tighter uppercase italic text-shadow-brutal">HITUNG CEPAT!</h1>
        <p className="text-lg sm:text-2xl text-[#073B4C] font-bold opacity-80 uppercase tracking-tight">Belajar matematika jadi super seru!</p>
      </motion.div>

      {/* Mode Selector */}
      <div className="flex gap-4 mb-4">
        <button 
          onClick={() => {
            playSound('click', isSoundEnabled);
            setGameState(GameState.LOBBY);
          }}
          className={`px-6 py-3 rounded-2xl font-black uppercase tracking-tighter border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${
            gameState === GameState.LOBBY ? 'bg-[#EF476F] text-white' : 'bg-white text-[#073B4C]'
          }`}
        >
          🎮 Main Game
        </button>
        <button 
          onClick={() => {
            playSound('click', isSoundEnabled);
            setGameState(GameState.LEARNING_3D);
          }}
          className={`px-6 py-3 rounded-2xl font-black uppercase tracking-tighter border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${
            gameState === GameState.LEARNING_3D ? 'bg-[#118AB2] text-white' : 'bg-white text-[#073B4C]'
          }`}
        >
          🧊 Bangun Ruang
        </button>
      </div>

      {gameState === GameState.LOBBY ? (
        <>
          {/* Name Input Section */}
          <div className="w-full max-w-md bg-white border-4 border-black rounded-[30px] p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Nama Pemain</label>
            <input 
              type="text" 
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Masukkan namamu..."
              className="w-full p-4 text-xl font-bold bg-slate-50 border-4 border-black rounded-2xl outline-none focus:bg-white transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full max-w-5xl px-4">
            {[Operation.ADD, Operation.SUBTRACT, Operation.MULTIPLY].map((op) => (
              <motion.button
                key={op}
                whileHover={{ scale: 1.05, rotate: -1 }}
                whileTap={{ scale: 0.95 }}
                disabled={!userName.trim()}
                onClick={() => {
                  playSound('click', isSoundEnabled);
                  startGame(difficulty, op);
                }}
                className={`flex flex-row sm:flex-col items-center gap-6 p-6 sm:p-10 bg-white rounded-[30px] sm:rounded-[40px] border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] group hover:bg-[#06D6A0] transition-all ${!userName.trim() ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
              >
                <motion.div 
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 4, 
                    repeat: Infinity, 
                    ease: "easeInOut",
                    delay: op === Operation.SUBTRACT ? 1 : op === Operation.MULTIPLY ? 2 : 0
                  }}
                  className={`p-4 sm:p-6 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
                    op === Operation.ADD ? 'bg-[#EF476F] text-white' : 
                    op === Operation.SUBTRACT ? 'bg-[#118AB2] text-white' : 
                    'bg-[#FFD166] text-[#073B4C]'
                  }`}
                >
                  {op === Operation.ADD && <Plus size={32} className="sm:w-14 sm:h-14" strokeWidth={3} />}
                  {op === Operation.SUBTRACT && <Minus size={32} className="sm:w-14 sm:h-14" strokeWidth={3} />}
                  {op === Operation.MULTIPLY && <X size={32} className="sm:w-14 sm:h-14" strokeWidth={3} />}
                </motion.div>
                <span className="text-2xl sm:text-3xl font-black text-[#073B4C] uppercase tracking-tighter">{op}</span>
              </motion.button>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 p-2 sm:p-3 bg-white border-4 border-black rounded-3xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map((diff) => (
              <button
                key={diff}
                onClick={() => {
                  playSound('click', isSoundEnabled);
                  setDifficulty(diff);
                }}
                className={`px-4 sm:px-8 py-2 sm:py-3 rounded-xl font-black text-sm sm:text-xl uppercase tracking-tight transition-all ${
                  difficulty === diff 
                    ? 'bg-[#118AB2] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]' 
                    : 'text-[#073B4C] hover:bg-slate-100'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>

          {/* Leaderboard Section */}
          {leaderboard.length > 0 && (
            <div className="w-full max-w-2xl bg-white border-4 border-black rounded-[40px] p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 flex items-center gap-3 italic">
                <Trophy className="text-[#FFD166]" size={32} strokeWidth={3} />
                Papan Peringkat
              </h2>
              <div className="space-y-3">
                {leaderboard.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 border-2 border-black rounded-2xl">
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-full border-2 border-black font-black text-sm ${
                        i === 0 ? 'bg-[#FFD166]' : i === 1 ? 'bg-slate-200' : i === 2 ? 'bg-orange-300' : 'bg-white'
                      }`}>
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-black text-[#073B4C] uppercase tracking-tight leading-none">{entry.name}</p>
                        <span className="text-[10px] font-bold opacity-50 uppercase">{entry.operation} • {entry.difficulty}</span>
                      </div>
                    </div>
                    <span className="text-2xl font-black text-[#118AB2]">{entry.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : renderLearning3D()}
    </div>
  );

  const renderLearning3D = () => {
    const shapes = [
      { id: 'kubus', name: 'Kubus', icon: <Dice5 size={32} /> },
      { id: 'balok', name: 'Balok', icon: <Box size={32} /> },
      { id: 'tabung', name: 'Tabung', icon: <Cylinder size={32} /> },
      { id: 'bola', name: 'Bola', icon: <CircleIcon size={32} /> },
      { id: 'kerucut', name: 'Kerucut', icon: <Pyramid size={32} /> }
    ];

    const currentShapeData = {
      kubus: { faces: 6, edges: 12, vertices: 8, desc: 'Memiliki 6 sisi berbentuk persegi yang sama besar.' },
      balok: { faces: 6, edges: 12, vertices: 8, desc: 'Memiliki 6 sisi, di mana sisi yang berhadapan sama besar.' },
      tabung: { faces: 3, edges: 2, vertices: 0, desc: 'Memiliki alas dan tutup berbentuk lingkaran yang sejajar.' },
      bola: { faces: 1, edges: 0, vertices: 0, desc: 'Bangun ruang yang dibatasi oleh satu bidang lengkung.' },
      kerucut: { faces: 2, edges: 1, vertices: 1, desc: 'Memiliki alas lingkaran dan titik puncak.' }
    }[selectedShape];

    return (
      <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-8 mt-4">
        {/* Sidebar */}
        <div className="w-full lg:w-72 flex flex-col gap-4">
          <h2 className="text-3xl font-black uppercase tracking-tighter text-[#073B4C] mb-2 italic">Bangun Ruang</h2>
          {shapes.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                playSound('click', isSoundEnabled);
                setSelectedShape(s.id as any);
              }}
              className={`flex items-center gap-4 p-4 rounded-2xl border-4 border-black transition-all ${
                selectedShape === s.id 
                  ? 'bg-[#118AB2] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]' 
                  : 'bg-white text-[#073B4C] hover:bg-slate-50'
              }`}
            >
              <div className={selectedShape === s.id ? 'text-white' : 'text-[#118AB2]'}>
                {s.icon}
              </div>
              <span className="text-xl font-black uppercase tracking-tight">{s.name}</span>
            </button>
          ))}
        </div>

        {/* 3D Viewport */}
        <div className="flex-1 min-h-[500px] lg:min-h-0 bg-white border-4 border-black rounded-[40px] shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative flex flex-col">
          <div className="h-[400px] bg-slate-50 relative">
            <Canvas shadows camera={{ position: [5, 5, 5], fov: 45 }}>
              <ambientLight intensity={0.5} />
              <pointLight position={[10, 10, 10]} castShadow />
              <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} castShadow />
              <Stage environment="city" intensity={0.5}>
                <Shape3D type={selectedShape} />
              </Stage>
              <OrbitControls makeDefault autoRotate autoRotateSpeed={2} />
            </Canvas>
            <div className="absolute top-6 right-6 flex flex-col items-end gap-2">
               <span className="tag-badge bg-[#FFD166] text-[#073B4C]">Mode 3D Interaktif</span>
               <p className="text-[10px] font-black uppercase opacity-40">Geser untuk memutar</p>
            </div>
          </div>
          
          <div className="p-8 border-t-4 border-black">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
              <h3 className="text-5xl font-black text-[#073B4C] uppercase tracking-tighter italic">
                {shapes.find(s => s.id === selectedShape)?.name}
              </h3>
              <div className="flex gap-4">
                <div className="flex flex-col items-center px-4 py-2 bg-slate-100 rounded-xl border-2 border-black">
                   <span className="text-[10px] font-black uppercase opacity-60">Sisi</span>
                   <span className="text-2xl font-black text-[#EF476F]">{currentShapeData.faces}</span>
                </div>
                <div className="flex flex-col items-center px-4 py-2 bg-slate-100 rounded-xl border-2 border-black">
                   <span className="text-[10px] font-black uppercase opacity-60">Rusuk</span>
                   <span className="text-2xl font-black text-[#118AB2]">{currentShapeData.edges}</span>
                </div>
                <div className="flex flex-col items-center px-4 py-2 bg-slate-100 rounded-xl border-2 border-black">
                   <span className="text-[10px] font-black uppercase opacity-60">Titik</span>
                   <span className="text-2xl font-black text-[#06D6A0]">{currentShapeData.vertices}</span>
                </div>
              </div>
            </div>
            <p className="text-2xl text-[#073B4C] font-bold opacity-80 leading-relaxed max-w-2xl">
              {currentShapeData.desc}
            </p>
          </div>
        </div>
      </div>
    );
  };
  const renderGame = () => {
    if (!currentQuestion) return null;

    return (
      <div className="w-full max-w-5xl mx-auto p-4 md:p-10 space-y-6 md:space-y-10">
        <header className="flex items-center justify-between bg-white px-4 md:px-8 py-3 md:py-4 rounded-[24px] md:rounded-[30px] border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sticky top-4 z-40">
          <button 
            onClick={() => setGameState(GameState.LOBBY)}
            className="p-2 md:p-3 bg-slate-100 border-2 border-black rounded-xl md:rounded-2xl hover:bg-[#EF476F] hover:text-white transition-colors"
          >
            <ChevronLeft size={20} className="md:w-6 md:h-6" strokeWidth={4} />
          </button>
          
          <div className="flex items-center gap-4 md:gap-10">
            <div className="flex flex-col items-center">
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-60">Poin</span>
              <div className="flex items-center gap-1 md:gap-2">
                <Trophy className="text-[#FFD166] w-5 h-5 md:w-6 md:h-6" strokeWidth={3} />
                <span className="text-xl md:text-3xl font-black text-[#073B4C]">{score}</span>
              </div>
            </div>
            <div className="flex flex-col items-center">
               <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-60">Nyawa</span>
               <div className="flex items-center gap-0.5 md:gap-1 mt-0.5">
                {[...Array(MAX_LIVES)].map((_, i) => (
                  <Heart 
                    key={i} 
                    size={16} 
                    strokeWidth={4}
                    className={`md:w-6 md:h-6 ${i < lives ? "text-[#EF476F] fill-[#EF476F]" : "text-slate-200"}`} 
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Kemajuan</span>
            <div className="w-24 md:w-32 bg-slate-100 border-2 border-black rounded-full h-3 md:h-4 relative overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(questionCount / QUESTIONS_PER_LEVEL) * 100}%` }}
                className="absolute h-full bg-[#06D6A0]"
              />
            </div>
          </div>
        </header>

        <motion.div 
          key={currentQuestion.id}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="brutalist-card flex flex-col items-center gap-8 md:gap-10 py-10 md:py-20 bg-white px-4"
        >
          <div className="tag-badge text-[10px] md:text-xs">Pertanyaan {questionCount} dari 10</div>
          
          <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-6 md:gap-10 text-4xl sm:text-6xl md:text-8xl lg:text-[120px] font-black tracking-tighter select-none mt-2 md:mt-4">
            <motion.span 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="text-[#073B4C]"
            >
              {currentQuestion.num1}
            </motion.span>
            <span className="text-[#EF476F]">{currentQuestion.operation}</span>
            <motion.span 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="text-[#073B4C]"
            >
              {currentQuestion.num2}
            </motion.span>
            <span className="text-slate-200">=</span>
            <div className={`flex items-center justify-center min-w-[64px] h-16 sm:min-w-[112px] sm:h-28 md:min-w-[144px] md:h-36 px-4 rounded-2xl md:rounded-3xl border-2 md:border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${
              feedback === 'correct' ? 'bg-[#06D6A0] text-white' :
              feedback === 'wrong' ? 'bg-[#EF476F] text-white animate-pulse' :
              'bg-slate-50 text-slate-200'
            } transition-colors`}>
              {feedback === 'correct' ? currentQuestion.answer : '?'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:gap-10 w-full max-w-2xl">
            <div className="flex flex-wrap gap-1 sm:gap-2 justify-center content-start min-h-[40px] md:min-h-12 bg-[#118AB2]/10 p-3 md:p-6 rounded-[20px] md:rounded-[30px] border-2 border-black/10">
               {[...Array(Math.min(currentQuestion.num1, 20))].map((_, i) => (
                 <motion.div
                   key={i}
                   animate={{ 
                     y: [0, -5, 0],
                     scale: [1, 1.2, 1]
                   }}
                   transition={{ 
                     duration: 2 + (i % 3), 
                     repeat: Infinity, 
                     delay: i * 0.1 
                   }}
                 >
                   <Star size={14} className="text-[#118AB2] fill-[#118AB2] md:w-6 md:h-6" strokeWidth={3} />
                 </motion.div>
               ))}
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-2 justify-center content-start min-h-[40px] md:min-h-12 bg-[#EF476F]/10 p-3 md:p-6 rounded-[20px] md:rounded-[30px] border-2 border-black/10">
               {[...Array(Math.min(currentQuestion.num2, 20))].map((_, i) => (
                 <motion.div
                   key={i}
                   animate={{ 
                     y: [0, -5, 0],
                     scale: [1, 1.2, 1]
                   }}
                   transition={{ 
                     duration: 2 + (i % 2), 
                     repeat: Infinity, 
                     delay: i * 0.1 
                   }}
                 >
                   <Star size={14} className="text-[#EF476F] fill-[#EF476F] md:w-6 md:h-6" strokeWidth={3} />
                 </motion.div>
               ))}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 pb-8">
          {currentQuestion.options.map((opt, i) => (
            <motion.button
              key={i}
              whileHover={{ y: -6, rotate: i % 2 === 0 ? 1 : -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAnswer(opt)}
              disabled={!!feedback}
              className={`brutalist-option p-4 md:p-6 text-xl md:text-3xl ${
                feedback === 'correct' && opt === currentQuestion.answer ? 'bg-[#06D6A0] text-white shadow-none translate-y-1' :
                feedback === 'wrong' && opt !== currentQuestion.answer ? 'bg-white opacity-40 grayscale' :
                feedback === 'wrong' && opt === currentQuestion.answer ? 'bg-[#06D6A0] text-white' :
                'bg-white text-[#073B4C]'
              }`}
            >
              {opt}
            </motion.button>
          ))}
        </div>
      </div>
    );
  };

  const renderOutcome = (isWin: boolean) => (
    <div className="flex flex-col items-center justify-center min-h-[90vh] gap-10 p-4">
      <motion.div 
        initial={{ scale: 0, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        className="brutalist-card text-center max-w-lg w-full py-16 bg-white"
      >
        <div className="mb-10 flex justify-center">
          <div className={`p-8 rounded-full border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${isWin ? 'bg-[#FFD166]' : 'bg-[#EF476F]'}`}>
            {isWin ? (
              <Trophy size={100} className="text-white" strokeWidth={3} />
            ) : (
              <Target size={100} className="text-white" strokeWidth={3} />
            )}
          </div>
        </div>
        
        <h2 className="text-6xl font-black text-[#073B4C] mb-4 uppercase tracking-tighter italic">
          {isWin ? 'JUARA BANGET!' : 'NYARIS SAJA!'}
        </h2>
        <p className="text-xl text-[#073B4C] mb-12 px-8 font-bold opacity-70 uppercase">
          {isWin 
            ? `Kamu menaklukkan tingkat ${difficulty} dengan skor sempurna!` 
            : 'Terus berlatih ya, kamu pasti bisa jadi ahli matematika!'}
        </p>

        <div className="grid grid-cols-2 gap-6 mb-12 px-8">
          <div className="bg-[#118AB2]/10 border-4 border-black p-6 rounded-[30px] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <span className="block text-xs uppercase tracking-widest text-[#073B4C] font-black mb-1 opacity-50">SKOR AKHIR</span>
            <span className="text-5xl font-black text-[#118AB2]">{score}</span>
          </div>
          <div className="bg-[#06D6A0]/10 border-4 border-black p-6 rounded-[30px] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <span className="block text-xs uppercase tracking-widest text-[#073B4C] font-black mb-1 opacity-50">TOTAL SOAL</span>
            <span className="text-5xl font-black text-[#06D6A0]">{isWin ? '10/10' : `${Math.max(0, questionCount - 1)}/10`}</span>
          </div>
        </div>

        <button 
          onClick={() => setGameState(GameState.LOBBY)}
          className="brutalist-btn w-full max-w-xs mx-auto bg-[#FFD166]"
        >
          <RefreshCw size={24} strokeWidth={3} />
          Main Lagi Yuk!
        </button>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FFD166] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] relative overflow-hidden">
      {/* Brutalist accents */}
      <motion.div 
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-10 left-10 w-24 h-24 bg-[#EF476F] border-4 border-black rounded-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hidden md:block" 
      />
      <motion.div 
        animate={{ y: [0, 20, 0], rotate: [12, -12, 12] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-40 right-20 w-16 h-16 bg-[#118AB2] border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hidden md:block" 
      />
      <motion.div 
        animate={{ x: [0, 15, 0], y: [0, -15, 0], rotate: [-12, 12, -12] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-20 left-20 w-32 h-32 bg-[#06D6A0] border-4 border-black rounded-[40px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hidden md:block" 
      />
      
      <main className="relative z-10">
        <AnimatePresence mode="wait">
          {(gameState === GameState.LOBBY || gameState === GameState.LEARNING_3D) && renderLobby()}
          {gameState === GameState.PLAYING && renderGame()}
          {gameState === GameState.WIN && renderOutcome(true)}
          {gameState === GameState.GAME_OVER && renderOutcome(false)}
        </AnimatePresence>
      </main>

      {/* Floating Elements Corner */}
      <div className="fixed bottom-6 right-6 flex items-center gap-4 z-50">
        <button 
          onClick={() => setIsSoundEnabled(!isSoundEnabled)}
          className="p-4 bg-white rounded-2xl shadow-lg text-slate-400 hover:text-indigo-600 transition-colors"
        >
          {isSoundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
        </button>
      </div>
    </div>
  );
}
