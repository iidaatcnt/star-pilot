'use client';

import React, { useRef, useState, useMemo, Suspense, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PerspectiveCamera, Stars } from '@react-three/drei';
import * as THREE from 'three';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, Target, Clock, Trophy, XCircle, Play } from 'lucide-react';
import { useHandTracking, HandData } from './hooks/useHandTracking';

const SHIP_COLOR = "#00f2ff";
const GLOW_COLOR = "#0072ff";

type Config = {
    vSens: number;
    hSens: number;
    vOffset: number;
    duration: number;
};

// --- Components ---

const SpaceShip = ({ pitch, yaw, speed, posX, posY, isPaused, isActive }: { pitch: number; yaw: number; speed: number; posX: number; posY: number; isPaused: boolean; isActive: boolean }) => {
    const meshRef = useRef<THREE.Group>(null);

    useFrame(() => {
        if (!meshRef.current || isPaused || !isActive) return;
        meshRef.current.position.x = posX;
        meshRef.current.position.y = posY;
        meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, pitch * 0.6, 0.1);
        meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, -yaw * 1.5, 0.1);
        meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, -yaw * 0.3, 0.1);
    });

    return (
        <group ref={meshRef}>
            <Float speed={isActive ? 2 : 0} rotationIntensity={0.1} floatIntensity={0.2}>
                <group rotation={[-Math.PI / 2, 0, 0]}>
                    <mesh>
                        <coneGeometry args={[0.4, 2, 8]} />
                        <meshStandardMaterial color={SHIP_COLOR} emissive={SHIP_COLOR} emissiveIntensity={0.5} />
                    </mesh>
                    <mesh position={[0, -0.2, 0]}>
                        <boxGeometry args={[2.5, 0.05, 0.8]} />
                        <meshStandardMaterial color={SHIP_COLOR} transparent opacity={0.8} />
                    </mesh>
                    <mesh position={[0, 0.4, 0.3]}>
                        <sphereGeometry args={[0.22, 16, 16]} />
                        <meshStandardMaterial color="#ffffff" transparent opacity={0.5} />
                    </mesh>
                    <pointLight position={[0, -1, 0]} color={GLOW_COLOR} intensity={speed * 15} distance={15} />
                    <mesh position={[0, -1, 0]}>
                        <sphereGeometry args={[0.3, 16, 16]} />
                        <meshBasicMaterial color={GLOW_COLOR} transparent opacity={speed > 0.1 ? 1.0 : 0.2} />
                    </mesh>
                </group>
            </Float>
        </group>
    );
};

const Rings = ({ speed, onPass, shipX, shipY, isPaused, isActive }: { speed: number; onPass: () => void; shipX: number; shipY: number; isPaused: boolean; isActive: boolean }) => {
    const count = 3;
    const rings = useMemo(() => {
        return Array.from({ length: count }).map((_, i) => ({
            id: i,
            z: -30 - i * 30,
            x: (Math.random() - 0.5) * 12,
            y: (Math.random() - 0.5) * 10,
            passed: false,
            scale: 1,
            opacity: 0.3
        }));
    }, []);

    const groupRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        if (!groupRef.current || isPaused || !isActive) return;
        groupRef.current.children.forEach((child, i) => {
            const r = rings[i];
            if (r.passed) {
                r.scale += delta * 15;
                r.opacity -= delta * 2;
                r.z += speed * 20 * delta;
            } else {
                r.z += (speed * 80 + 10) * delta;
                if (r.z > 5 && r.z < 8) {
                    const dx = Math.abs(r.x - shipX);
                    const dy = Math.abs(r.y - shipY);
                    if (dx < 4 && dy < 4) {
                        r.passed = true;
                        onPass();
                    }
                }
            }

            if (r.z > 20 || r.opacity <= 0) {
                r.z = -70;
                r.x = (Math.random() - 0.5) * 18;
                r.y = (Math.random() - 0.5) * 12;
                r.passed = false;
                r.scale = 1;
                r.opacity = 0.3;
            }
            child.position.set(r.x, r.y, r.z);
            child.scale.setScalar(r.scale);
            const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
            mat.opacity = Math.max(0, r.opacity);
        });
    });

    return (
        <group ref={groupRef}>
            {rings.map((r) => (
                <mesh key={r.id}>
                    <torusGeometry args={[4, 0.1, 16, 32]} />
                    <meshBasicMaterial color="#00f2ff" transparent opacity={0.3} />
                </mesh>
            ))}
        </group>
    );
};

const MovingStars = ({ speed, pitch, yaw, isPaused, isActive }: { speed: number; pitch: number; yaw: number; isPaused: boolean; isActive: boolean }) => {
    const count = 200;
    const meshRef = useRef<THREE.Group>(null);
    const stars = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            temp.push({
                pos: new THREE.Vector3((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 100),
                len: 0.5 + Math.random() * 2
            });
        }
        return temp;
    }, []);

    useFrame((state, delta) => {
        if (!meshRef.current || isPaused || !isActive) return;
        meshRef.current.children.forEach((child, i) => {
            const s = stars[i];
            s.pos.z += (speed * 100 + 5) * delta;
            s.pos.x -= yaw * speed * 20 * delta;
            s.pos.y += pitch * speed * 20 * delta;

            if (s.pos.z > 20) {
                s.pos.z = -80;
                s.pos.x = (Math.random() - 0.5) * 60;
                s.pos.y = (Math.random() - 0.5) * 60;
            }
            child.position.copy(s.pos);
            child.scale.z = 1 + speed * 15;
        });
    });

    return (
        <group ref={meshRef}>
            {stars.map((s, i) => (
                <mesh key={i}>
                    <boxGeometry args={[0.05, 0.05, s.len]} />
                    <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
                </mesh>
            ))}
        </group>
    );
};

const GameScene = ({ handData, config, onPass, onSpeedChange, isPaused, isActive }: { handData: HandData; config: Config; onPass: () => void; onSpeedChange: (s: number) => void; isPaused: boolean; isActive: boolean }) => {
    const [speed, setSpeed] = useState(0);
    const shipPos = useRef({ x: 0, y: 0 });

    useFrame(() => {
        if (isPaused || !isActive) {
            if (!isActive && speed > 0) {
                const nextSpeed = THREE.MathUtils.lerp(speed, 0, 0.1);
                setSpeed(nextSpeed);
                onSpeedChange(nextSpeed);
            }
            return;
        }
        const targetSpeed = (handData.handPosition && handData.isPalmOpen) ? 1.0 : 0.0;
        const nextSpeed = THREE.MathUtils.lerp(speed, targetSpeed, 0.05);
        setSpeed(nextSpeed);
        onSpeedChange(nextSpeed);

        const adjYaw = handData.yaw * config.hSens;
        const adjPitch = (handData.pitch + config.vOffset * 0.5) * config.vSens;

        const targetX = -adjYaw * 8;
        const targetY = adjPitch * 6;
        shipPos.current.x = THREE.MathUtils.clamp(targetX, -10, 10);
        shipPos.current.y = THREE.MathUtils.clamp(targetY, -6, 6);
    });

    return (
        <>
            <PerspectiveCamera makeDefault position={[0, 3, 8]} fov={65} rotation={[-0.2, 0, 0]} />
            <ambientLight intensity={1.5} />
            <pointLight position={[10, 10, 10]} intensity={2} />

            <Suspense fallback={null}>
                <SpaceShip
                    pitch={(handData.pitch + config.vOffset * 0.5) * config.vSens}
                    yaw={handData.yaw * config.hSens}
                    speed={speed}
                    posX={shipPos.current.x}
                    posY={shipPos.current.y}
                    isPaused={isPaused}
                    isActive={isActive}
                />
                <Rings speed={speed} onPass={onPass} shipX={shipPos.current.x} shipY={shipPos.current.y} isPaused={isPaused} isActive={isActive} />
                <MovingStars speed={speed} pitch={handData.pitch} yaw={handData.yaw} isPaused={isPaused} isActive={isActive} />
                <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={isPaused || !isActive ? 0 : 0.1} />
            </Suspense>

            <fog attach="fog" args={['#000', 10, 50]} />
        </>
    );
};

const ConfigMenu = ({ config, setConfig }: { config: Config; setConfig: (c: Config) => void }) => (
    <div className="flex flex-col gap-6 mono uppercase text-[11px]">
        <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            <div className="flex flex-col gap-3">
                <label className="text-cyan-500/60 flex justify-between">Vertical Sens <span>{config.vSens.toFixed(1)}x</span></label>
                <input type="range" min="0.5" max="3.0" step="0.1" value={config.vSens} onChange={e => setConfig({ ...config, vSens: parseFloat(e.target.value) })} className="w-full h-1 bg-cyan-900 rounded-full appearance-none cursor-pointer" />
            </div>
            <div className="flex flex-col gap-3">
                <label className="text-cyan-500/60 flex justify-between">Horizontal Sens <span>{config.hSens.toFixed(1)}x</span></label>
                <input type="range" min="0.5" max="3.0" step="0.1" value={config.hSens} onChange={e => setConfig({ ...config, hSens: parseFloat(e.target.value) })} className="w-full h-1 bg-cyan-900 rounded-full appearance-none cursor-pointer" />
            </div>
            <div className="flex flex-col gap-3">
                <label className="text-cyan-500/60 flex justify-between">Hand Height <span>{config.vOffset > 0 ? 'LOW' : 'HIGH'}</span></label>
                <input type="range" min="-1.0" max="1.0" step="0.05" value={config.vOffset} onChange={e => setConfig({ ...config, vOffset: parseFloat(e.target.value) })} className="w-full h-1 bg-cyan-900 rounded-full appearance-none cursor-pointer" />
            </div>
            <div className="flex flex-col gap-3">
                <label className="text-cyan-500/60 flex justify-between">Mission Time <span>{config.duration}s</span></label>
                <input type="range" min="30" max="300" step="10" value={config.duration} onChange={e => setConfig({ ...config, duration: parseInt(e.target.value) })} className="w-full h-1 bg-cyan-900 rounded-full appearance-none cursor-pointer" />
            </div>
        </div>
    </div>
);

// --- Main App ---

export default function StarPilot() {
    const webcamRef = useRef<any>(null);
    const handData = useHandTracking(webcamRef);

    const [gameState, setGameState] = useState<'start' | 'playing' | 'result' | 'exit'>('start');
    const [isPaused, setIsPaused] = useState(false);
    const [config, setConfig] = useState<Config>({ vSens: 1.2, hSens: 1.2, vOffset: 0.2, duration: 30 });
    const [currentSpeed, setCurrentSpeed] = useState(0);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(30);
    const [showScorePopup, setShowScorePopup] = useState(false);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const engineOscRef = useRef<OscillatorNode | null>(null);
    const engineGainRef = useRef<GainNode | null>(null);

    // Core Timer Logic - Refactoring for stability
    useEffect(() => {
        let timer: any;
        if (gameState === 'playing' && !isPaused) {
            timer = setInterval(() => {
                setTimeLeft(t => {
                    if (t <= 1) {
                        setGameState('result');
                        clearInterval(timer); // Pre-emptive stop
                        return 0;
                    }
                    const next = t - 1;
                    // Countdown Beeps
                    if (next <= 5 && next > 0) {
                        playCountdownBeep(next === 1 ? 880 : 440);
                    }
                    return next;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [gameState === 'playing', isPaused]);

    const playCountdownBeep = (freq: number) => {
        if (audioCtxRef.current) {
            const osc = audioCtxRef.current.createOscillator();
            const g = audioCtxRef.current.createGain();
            osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
            g.gain.setValueAtTime(0.05, audioCtxRef.current.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.1);
            osc.connect(g);
            g.connect(audioCtxRef.current.destination);
            osc.start();
            osc.stop(audioCtxRef.current.currentTime + 0.1);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                if (gameState === 'start' || gameState === 'result') {
                    launchMission();
                } else if (gameState === 'playing') {
                    setIsPaused(p => !p);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState, config]);

    useEffect(() => {
        if (typeof window !== 'undefined' && !audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtxRef.current.createOscillator();
            const gain = audioCtxRef.current.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(50, audioCtxRef.current.currentTime);
            gain.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
            const filter = audioCtxRef.current.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, audioCtxRef.current.currentTime);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtxRef.current.destination);
            osc.start();
            engineOscRef.current = osc;
            engineGainRef.current = gain;
        }
        return () => {
            engineOscRef.current?.stop();
            audioCtxRef.current?.close();
        };
    }, []);

    useEffect(() => {
        if (engineGainRef.current && engineOscRef.current && audioCtxRef.current) {
            const now = audioCtxRef.current.currentTime;
            const targetVol = (isPaused || gameState !== 'playing') ? 0 : currentSpeed * 0.1;
            engineGainRef.current.gain.setTargetAtTime(targetVol, now, 0.1);
            engineOscRef.current.frequency.setTargetAtTime(40 + currentSpeed * 120, now, 0.1);
        }
    }, [currentSpeed, isPaused, gameState]);

    const launchMission = () => {
        setScore(0);
        setTimeLeft(config.duration);
        setGameState('playing');
        setIsPaused(false);
        audioCtxRef.current?.resume();
    };

    const handlePass = () => {
        if (gameState !== 'playing') return;
        setScore(s => s + 100);
        setShowScorePopup(true);
        setTimeout(() => setShowScorePopup(false), 800);

        if (audioCtxRef.current) {
            const osc = audioCtxRef.current.createOscillator();
            const g = audioCtxRef.current.createGain();
            osc.frequency.setValueAtTime(880, audioCtxRef.current.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1320, audioCtxRef.current.currentTime + 0.1);
            g.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.1);
            osc.connect(g);
            g.connect(audioCtxRef.current.destination);
            osc.start();
            osc.stop(audioCtxRef.current.currentTime + 0.1);
        }
    };

    const quitApp = () => {
        setGameState('exit');
        setTimeout(() => {
            window.close();
            // If window.close() doesn't work (browser security), we stay in 'exit' state.
        }, 1000);
    };

    return (
        <div
            className="relative w-full h-screen bg-black overflow-hidden font-sans select-none"
            onClick={() => { if (gameState === 'playing') setIsPaused(true); }}
        >
            {/* LARGE PROMINENT TIMER - CENTER TOP */}
            {gameState === 'playing' && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center gap-2 pointer-events-none scale-150">
                    <motion.div
                        animate={timeLeft <= 10 ? { scale: [1, 1.05, 1], rotate: [0, 1, -1, 0] } : {}}
                        className="flex items-center gap-4 px-10 py-3 bg-black/60 border-2 border-cyan-500/50 rounded-lg shadow-[0_0_50px_rgba(0,242,255,0.2)]"
                    >
                        <Clock size={24} className={timeLeft <= 10 ? 'text-red-500' : 'text-cyan-400'} />
                        <span className={`text-6xl font-black italic mono w-40 text-center tracking-tighter ${timeLeft <= 10 ? 'text-red-500' : 'text-white'}`}>
                            {timeLeft} <span className="text-xl">S</span>
                        </span>
                    </motion.div>
                    <div className="text-[12px] text-cyan-500 uppercase tracking-[0.5em] font-bold">REMAINING_TIME</div>
                </div>
            )}

            {/* Start / Settings Screen */}
            {gameState === 'start' && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="w-[500px] bg-black border border-cyan-500/30 p-12 rounded-lg shadow-[0_0_50px_rgba(0,242,255,0.1)] flex flex-col gap-8"
                    >
                        <div className="text-center">
                            <h1 className="text-5xl font-black italic tracking-tighter text-cyan-400 mb-2 underline decoration-cyan-500/50 underline-offset-8">STAR_PILOT</h1>
                            <p className="mono text-[10px] text-white/40 tracking-[0.3em] uppercase mt-4">Health Training & Space Exploration</p>
                        </div>
                        <ConfigMenu config={config} setConfig={setConfig} />
                        <button
                            onClick={(e) => { e.stopPropagation(); launchMission(); }}
                            className="w-full py-4 bg-cyan-500 text-black font-black text-xl hover:bg-white transition-colors uppercase tracking-widest shadow-[0_0_30px_rgba(0,242,255,0.5)] flex items-center justify-center gap-3"
                        >
                            <Play size={20} fill="currentColor" /> Launch Mission
                        </button>
                        <div className="text-[9px] text-white/30 text-center uppercase leading-loose border-t border-white/5 pt-4">
                            &gt; SPACE_KEY OR CLICK TO START<br />
                            &gt; PALM_OPEN TO THRUST<br />
                            &gt; TILT_HAND TO STEER
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Pause Menu */}
            {isPaused && gameState === 'playing' && (
                <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md pointer-events-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-black/90 border border-cyan-500/50 p-10 rounded-lg flex flex-col gap-8 text-center w-[450px] shadow-[0_0_50px_rgba(0,0,0,1)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-3xl font-black italic text-cyan-400 uppercase tracking-tighter">Mission Pawsed</h2>
                        <div className="border-y border-white/5 py-6">
                            <ConfigMenu config={config} setConfig={setConfig} />
                        </div>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsPaused(false); }}
                                className="w-full py-4 bg-cyan-500 text-black font-bold uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)]"
                            >
                                Resume Mission
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setGameState('start'); setIsPaused(false); }}
                                className="w-full py-3 border border-white/20 text-white/60 font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                            >
                                Quit to Menu
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* HUD Overlay - Smaller and peripheral */}
            <div className="absolute inset-x-0 top-0 z-50 p-8 flex justify-between items-start pointer-events-none">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse" />
                        <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white/90">PILOT_LINK_ALPHA</h1>
                    </div>
                    <div className="flex gap-4 opacity-70 mono text-[10px] text-cyan-400 mt-2">
                        <motion.span
                            key={score} animate={{ scale: [1, 1.3, 1] }}
                            className="bg-cyan-500/10 px-3 py-1.5 border border-cyan-500/20 shadow-[0_0_10px_rgba(0,242,255,0.2)] flex items-center gap-2"
                        >
                            <Trophy size={12} /> SCORE: {score.toString().padStart(6, '0')}
                        </motion.span>
                        <span className="bg-cyan-500/10 px-3 py-1.5 border border-cyan-500/20">VELOCITY: {Math.round(currentSpeed * 300)} KM/S</span>
                    </div>
                </div>

                <div className="bg-black/60 backdrop-blur-md border border-white/5 p-3 rounded-sm flex flex-col items-end gap-2 text-right pointer-events-auto">
                    <span className="mono text-[8px] text-cyan-500/60 tracking-[0.3em] uppercase">Visual_Aux_Feed</span>
                    <div className="rounded-sm border border-cyan-500/20 overflow-hidden relative grayscale opacity-70" style={{ width: '160px', height: '112px' }}>
                        <Webcam ref={webcamRef} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-cyan-900/10" />
                    </div>
                </div>
            </div>

            {/* Steering Visualizer */}
            <div className="absolute inset-x-0 bottom-10 z-50 flex justify-center pointer-events-none">
                <div className="flex gap-16 items-end">
                    <div className="flex flex-col items-center gap-3">
                        <span className="mono text-[10px] text-cyan-500/50 uppercase tracking-widest">Velocity</span>
                        <div className="w-1.5 h-40 bg-white/5 relative rounded-full overflow-hidden border border-white/5">
                            <motion.div
                                className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-blue-600 to-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.8)]"
                                style={{ height: `${currentSpeed * 100}%` }}
                            />
                        </div>
                    </div>
                    <div className="relative w-48 h-48 border border-white/10 rounded-full flex items-center justify-center">
                        <div className="absolute inset-0 border-[0.5px] border-cyan-500/20 rounded-full animate-spin-slow" />
                        <motion.div
                            className="absolute w-8 h-8 border border-cyan-500/50 flex items-center justify-center"
                            animate={{ x: handData.yaw * 60, y: -handData.pitch * 60 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                        >
                            <Target size={14} className="text-cyan-400/50" />
                        </motion.div>
                    </div>
                    <div className="bg-white/5 backdrop-blur-sm p-4 border-l-2 border-cyan-500/50 mono text-[8px] uppercase tracking-[0.2em] leading-loose text-white/40">
                        <span className="text-cyan-400">&gt; PALM_OPEN:</span> ACCEL<br />
                        <span className="text-cyan-400">&gt; FIST:</span> BREAK<br />
                        <span className="text-cyan-400">&gt; TILT_HAND:</span> STEER
                    </div>
                </div>
            </div>

            {/* Global FX Overlay */}
            <AnimatePresence>
                {/* Last 10s Countdown Overlay */}
                {gameState === 'playing' && timeLeft <= 10 && timeLeft > 0 && (
                    <motion.div
                        key={timeLeft}
                        initial={{ scale: 3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] pointer-events-none"
                    >
                        <span className={`text-[20rem] font-black italic tracking-tighter ${timeLeft <= 3 ? 'text-red-500' : 'text-white'} drop-shadow-[0_0_80px_rgba(0,0,0,0.8)]`}>
                            {timeLeft}
                        </span>
                    </motion.div>
                )}

                {showScorePopup && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: -20 }}
                        animate={{ opacity: 1, scale: 1.5, y: -100 }}
                        exit={{ opacity: 0 }}
                        className="fixed left-1/2 top-1/2 z-[100] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    >
                        <span className="text-8xl font-black italic text-cyan-400 drop-shadow-[0_0_40px_#0ff] tracking-tighter">+100</span>
                    </motion.div>
                )}

                {/* Final Result Screen */}
                {gameState === 'result' && (
                    <div className="absolute inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-3xl">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="text-center flex flex-col gap-12 max-w-2xl px-12"
                        >
                            <div>
                                <h2 className="text-3xl mono text-cyan-500 uppercase tracking-[0.5em] mb-8">Mission Complete</h2>
                                <div className="flex items-center justify-center gap-12 border-b border-white/10 pb-12">
                                    <div className="flex flex-col items-center">
                                        <span className="text-white/40 uppercase mono text-xs mb-2">Duration</span>
                                        <span className="text-5xl font-black text-white italic">{config.duration}s</span>
                                    </div>
                                    <div className="w-px h-16 bg-white/10" />
                                    <div className="flex flex-col items-center">
                                        <span className="text-white/40 uppercase mono text-xs mb-2">Final Score</span>
                                        <span className="text-9xl font-black italic text-white tracking-tighter drop-shadow-[0_0_30px_#0ff]">
                                            {score.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-6">
                                <button
                                    onClick={() => launchMission()}
                                    className="w-full py-6 bg-cyan-500 text-black font-black text-3xl uppercase tracking-[0.2em] hover:bg-white transition-all shadow-[0_0_50px_rgba(0,242,255,0.4)] flex items-center justify-center gap-4"
                                >
                                    <Play size={24} fill="currentColor" /> Try Again (Space)
                                </button>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setGameState('start')}
                                        className="flex-1 py-4 border border-white/20 text-white/60 font-bold uppercase tracking-widest hover:bg-white/10 transition-all text-xs"
                                    >
                                        Change Settings
                                    </button>
                                    <button
                                        onClick={() => quitApp()}
                                        className="flex-1 py-4 border border-red-500/30 text-red-500 font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all text-xs flex items-center justify-center gap-2"
                                    >
                                        <XCircle size={14} /> Finish & Close
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Exit Farewell Screen */}
                {gameState === 'exit' && (
                    <div className="absolute inset-0 z-[150] bg-black flex flex-center items-center justify-center text-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <h1 className="text-4xl font-black italic text-cyan-400 mb-4 tracking-tighter">GOODBYE PILOT</h1>
                            <p className="text-white/20 mono text-sm uppercase">Powering down systems...</p>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="scanlines" />
            <div className="vignette" />

            <div className="absolute inset-0 z-0">
                <Canvas gl={{ antialias: true }}>
                    <GameScene
                        handData={handData} config={config} onPass={handlePass}
                        onSpeedChange={setCurrentSpeed} isPaused={isPaused}
                        isActive={gameState === 'playing'}
                    />
                </Canvas>
            </div>
        </div>
    );
}
