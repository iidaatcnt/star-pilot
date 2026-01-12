'use client';

import React, { useRef, useState, useMemo, Suspense, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PerspectiveCamera, Stars } from '@react-three/drei';
import * as THREE from 'three';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Navigation, Target } from 'lucide-react';
import { useHandTracking, HandData } from './hooks/useHandTracking';

const SHIP_COLOR = "#00f2ff";
const GLOW_COLOR = "#0072ff";

type Config = {
    vSens: number;
    hSens: number;
    vOffset: number;
};

// --- Components ---

const SpaceShip = ({ pitch, yaw, speed, posX, posY }: { pitch: number; yaw: number; speed: number; posX: number; posY: number }) => {
    const meshRef = useRef<THREE.Group>(null);

    useFrame(() => {
        if (!meshRef.current) return;
        meshRef.current.position.x = posX;
        meshRef.current.position.y = posY;
        // Rotation: Tilt on pitch, Roll on yaw
        meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, pitch * 0.6, 0.1);
        meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, -yaw * 1.5, 0.1);
        meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, -yaw * 0.3, 0.1);
    });

    return (
        <group ref={meshRef}>
            <Float speed={2} rotationIntensity={0.1} floatIntensity={0.2}>
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

const Rings = ({ speed, onPass, shipX, shipY }: { speed: number; onPass: () => void; shipX: number; shipY: number }) => {
    const count = 3;
    const rings = useMemo(() => {
        return Array.from({ length: count }).map((_, i) => ({
            id: i,
            z: -30 - i * 30,
            x: (Math.random() - 0.5) * 12,
            y: (Math.random() - 0.5) * 10,
            passed: false
        }));
    }, []);

    const groupRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        groupRef.current.children.forEach((child, i) => {
            const r = rings[i];
            r.z += (speed * 80 + 10) * delta;

            // Collision detection - when ring is near camera
            if (!r.passed && r.z > 5 && r.z < 8) {
                const dx = Math.abs(r.x - shipX);
                const dy = Math.abs(r.y - shipY);
                if (dx < 4 && dy < 4) {
                    r.passed = true;
                    onPass();
                }
            }

            if (r.z > 20) {
                r.z = -70;
                r.x = (Math.random() - 0.5) * 18;
                r.y = (Math.random() - 0.5) * 12;
                r.passed = false;
            }
            child.position.set(r.x, r.y, r.z);
            child.rotation.z += delta * 0.5;
        });
    });

    return (
        <group ref={groupRef}>
            {rings.map((r) => (
                <mesh key={r.id}>
                    <torusGeometry args={[4, 0.1, 16, 32]} />
                    <meshBasicMaterial color={r.passed ? "#fff" : "#00f2ff"} transparent opacity={0.3} />
                </mesh>
            ))}
        </group>
    );
};

const MovingStars = ({ speed, pitch, yaw }: { speed: number; pitch: number; yaw: number }) => {
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
        if (!meshRef.current) return;
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

const GameScene = ({ handData, config, onPass, onSpeedChange }: { handData: HandData; config: Config; onPass: () => void; onSpeedChange: (s: number) => void }) => {
    const [speed, setSpeed] = useState(0);
    const shipPos = useRef({ x: 0, y: 0 });

    useFrame(() => {
        const targetSpeed = (handData.handPosition && handData.isPalmOpen) ? 1.0 : 0.0;
        const nextSpeed = THREE.MathUtils.lerp(speed, targetSpeed, 0.05);
        setSpeed(nextSpeed);
        onSpeedChange(nextSpeed);

        // Apply sensitivity and offset
        const adjYaw = handData.yaw * config.hSens;
        const adjPitch = (handData.pitch + config.vOffset * 0.5) * config.vSens; // Offset multiplier reduced for fine control

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
                />
                <Rings speed={speed} onPass={onPass} shipX={shipPos.current.x} shipY={shipPos.current.y} />
                <MovingStars speed={speed} pitch={handData.pitch} yaw={handData.yaw} />
                <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={0.1} />
            </Suspense>

            <fog attach="fog" args={['#000', 10, 50]} />
        </>
    );
};

// --- Main App ---

export default function StarPilot() {
    const webcamRef = useRef<any>(null);
    const handData = useHandTracking(webcamRef);

    const [gameState, setGameState] = useState<'start' | 'playing' | 'result'>('start');
    const [config, setConfig] = useState<Config>({ vSens: 1.2, hSens: 1.2, vOffset: 0.2 });
    const [currentSpeed, setCurrentSpeed] = useState(0);
    const [score, setScore] = useState(0);
    const [flightTime, setFlightTime] = useState(0);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const engineOscRef = useRef<OscillatorNode | null>(null);
    const engineGainRef = useRef<GainNode | null>(null);

    useEffect(() => {
        let timer: any;
        if (gameState === 'playing' && currentSpeed > 0.1) {
            timer = setInterval(() => {
                setFlightTime(t => t + 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [gameState, currentSpeed]);

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
            engineGainRef.current.gain.setTargetAtTime(currentSpeed * 0.1, now, 0.1);
            engineOscRef.current.frequency.setTargetAtTime(40 + currentSpeed * 120, now, 0.1);
        }
    }, [currentSpeed]);

    const handlePass = () => {
        setScore(s => s + 100);
        if (audioCtxRef.current) {
            const osc = audioCtxRef.current.createOscillator();
            const g = audioCtxRef.current.createGain();
            osc.frequency.setValueAtTime(880, audioCtxRef.current.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, audioCtxRef.current.currentTime + 0.1);
            g.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.1);
            osc.connect(g);
            g.connect(audioCtxRef.current.destination);
            osc.start();
            osc.stop(audioCtxRef.current.currentTime + 0.1);
        }
    };

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none">

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

                        <div className="flex flex-col gap-6 mono uppercase text-[11px]">
                            <div className="flex flex-col gap-3">
                                <label className="text-cyan-500/60 flex justify-between">Vertical Sensitivity <span>{config.vSens.toFixed(1)}x</span></label>
                                <input type="range" min="0.5" max="3.0" step="0.1" value={config.vSens} onChange={e => setConfig({ ...config, vSens: parseFloat(e.target.value) })} className="w-full h-1 bg-cyan-900 rounded-full appearance-none cursor-pointer" />
                            </div>
                            <div className="flex flex-col gap-3">
                                <label className="text-cyan-500/60 flex justify-between">Horizontal Sensitivity <span>{config.hSens.toFixed(1)}x</span></label>
                                <input type="range" min="0.5" max="3.0" step="0.1" value={config.hSens} onChange={e => setConfig({ ...config, hSens: parseFloat(e.target.value) })} className="w-full h-1 bg-cyan-900 rounded-full appearance-none cursor-pointer" />
                            </div>
                            <div className="flex flex-col gap-3">
                                <label className="text-cyan-500/60 flex justify-between">Hand Height Offset <span>{config.vOffset > 0 ? 'LOWER' : 'HIGHER'}</span></label>
                                <input type="range" min="-1.0" max="1.0" step="0.05" value={config.vOffset} onChange={e => setConfig({ ...config, vOffset: parseFloat(e.target.value) })} className="w-full h-1 bg-cyan-900 rounded-full appearance-none cursor-pointer" />
                                <p className="text-[8px] text-white/30 lowercase text-right">※ 手を高く上げにくい方は LOWER (右側) へ</p>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                setGameState('playing');
                                audioCtxRef.current?.resume();
                            }}
                            className="w-full py-4 bg-cyan-500 text-black font-black text-xl hover:bg-white transition-colors uppercase tracking-widest shadow-[0_0_30px_rgba(0,242,255,0.5)]"
                        >
                            Launch Mission
                        </button>

                        <div className="text-[9px] text-white/30 text-center uppercase leading-loose border-t border-white/5 pt-4">
                            &gt; PALM_OPEN TO START ENGINE<br />
                            &gt; TILT_HAND TO STEER<br />
                            &gt; CLEAR RINGS TO SCORE
                        </div>
                    </motion.div>
                </div>
            )}

            <div className="absolute inset-x-0 top-0 z-50 p-8 flex justify-between items-start pointer-events-none">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse" />
                        <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white/90">PILOT_LINK_ALPHA</h1>
                    </div>
                    <div className="flex gap-4 opacity-70 mono text-[10px] text-cyan-400">
                        <span className="bg-cyan-500/10 px-2 py-1 border border-cyan-500/20 shadow-[0_0_10px_rgba(0,242,255,0.2)]">SCORE: {score.toString().padStart(6, '0')}</span>
                        <span className="bg-cyan-500/10 px-2 py-1 border border-cyan-500/20">FLIGHT_TIME: {Math.floor(flightTime / 60)}:{(flightTime % 60).toString().padStart(2, '0')}</span>
                        <span className="bg-cyan-500/10 px-2 py-1 border border-cyan-500/20">VELOCITY: {Math.round(currentSpeed * 300)} KM/S</span>
                    </div>
                    <div className="flex gap-4 opacity-50 mono text-[9px] mt-1">
                        <span className="flex items-center gap-1.5"><Navigation size={10} /> {handData.handPosition ? 'LOCKED' : 'SCANNING'}</span>
                        <span className={`flex items-center gap-1.5 ${handData.isPalmOpen && handData.handPosition ? 'text-cyan-400 font-bold' : ''}`}>ACCEL: {handData.isPalmOpen && handData.handPosition ? 'ON' : 'OFF'}</span>
                    </div>
                </div>

                <div className="bg-black-60 backdrop-blur-md border border-white/5 p-3 rounded-sm flex flex-col items-end gap-2 text-right pointer-events-auto">
                    <span className="mono text-[8px] text-cyan-500/60 tracking-[0.3em] uppercase">Visual_Aux_Feed</span>
                    <div className="rounded-sm border border-cyan-500/20 overflow-hidden relative grayscale opacity-70" style={{ width: '160px', height: '112px' }}>
                        <Webcam ref={webcamRef} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-cyan-900/10" />
                        {handData.handPosition && (
                            <motion.div
                                className="absolute w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#0ff]"
                                style={{ left: `${handData.handPosition.x * 100}%`, top: `${handData.handPosition.y * 100}%` }}
                            />
                        )}
                    </div>
                </div>
            </div>

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
                        <div className="w-0.5 h-12 bg-white/10 absolute top-0" />
                        <div className="w-0.5 h-12 bg-white/10 absolute bottom-0" />
                        <div className="w-12 h-0.5 bg-white/10 absolute left-0" />
                        <div className="w-12 h-0.5 bg-white/10 absolute right-0" />

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

            <AnimatePresence>
                {currentSpeed > 0.8 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.15 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-cyan-400 pointer-events-none z-10 blur-3xl opacity-10"
                    />
                )}
            </AnimatePresence>

            <div className="scanlines" />
            <div className="vignette" />

            <div className="absolute inset-0 z-0">
                <Canvas gl={{ antialias: true }}>
                    <GameScene handData={handData} config={config} onPass={handlePass} onSpeedChange={setCurrentSpeed} />
                </Canvas>
            </div>
        </div>
    );
}
