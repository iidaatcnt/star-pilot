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

// --- Components ---

const SpaceShip = ({ pitch, yaw, speed }: { pitch: number; yaw: number; speed: number }) => {
    const meshRef = useRef<THREE.Group>(null);
    const targetPos = useRef(new THREE.Vector3(0, 0, 0));

    useFrame(() => {
        if (!meshRef.current) return;

        // Position movement based on steer - CLAMPED to stay inside
        targetPos.current.x = THREE.MathUtils.lerp(targetPos.current.x, -yaw * 6.5, 0.05);
        targetPos.current.y = THREE.MathUtils.lerp(targetPos.current.y, pitch * 4.5, 0.05);

        meshRef.current.position.x = THREE.MathUtils.clamp(targetPos.current.x, -5, 5);
        meshRef.current.position.y = THREE.MathUtils.clamp(targetPos.current.y, -3, 3);

        // Rotation: Roll on yaw, Tilt on pitch
        meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, pitch * 0.6, 0.1);
        meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, -yaw * 1.2, 0.1);
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
            // Move towards camera
            s.pos.z += (speed * 100 + 5) * delta;

            // Influence by ship rotation
            s.pos.x -= yaw * speed * 20 * delta;
            s.pos.y += pitch * speed * 20 * delta;

            if (s.pos.z > 20) {
                s.pos.z = -80;
                s.pos.x = (Math.random() - 0.5) * 60;
                s.pos.y = (Math.random() - 0.5) * 60;
            }
            child.position.copy(s.pos);
            // Scale based on speed for "stretch" effect
            child.scale.z = 1 + speed * 15;
        });
    });

    return (
        <group ref={meshRef}>
            {stars.map((s, i) => (
                <mesh key={i} rotation={[0, 0, 0]}>
                    <boxGeometry args={[0.05, 0.05, s.len]} />
                    <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
                </mesh>
            ))}
        </group>
    );
};

const GameScene = ({ handData, onPass, onSpeedChange }: { handData: HandData; onPass: () => void; onSpeedChange: (s: number) => void }) => {
    const [speed, setSpeed] = useState(0);
    const shipPos = useRef({ x: 0, y: 0 });

    useFrame(() => {
        // Only accelerate if hand is detected AND palm is open
        const targetSpeed = (handData.handPosition && handData.isPalmOpen) ? 1.0 : 0.0;
        const nextSpeed = THREE.MathUtils.lerp(speed, targetSpeed, 0.05);
        setSpeed(nextSpeed);
        onSpeedChange(nextSpeed);

        // Track ship position for ring collision
        const targetX = -handData.yaw * 6.5;
        const targetY = handData.pitch * 4.5;
        shipPos.current.x = THREE.MathUtils.clamp(targetX, -5, 5);
        shipPos.current.y = THREE.MathUtils.clamp(targetY, -3, 3);
    });

    return (
        <>
            <PerspectiveCamera makeDefault position={[0, 3, 8]} fov={65} rotation={[-0.2, 0, 0]} />
            <ambientLight intensity={1.5} />
            <pointLight position={[10, 10, 10]} intensity={2} />

            <Suspense fallback={null}>
                <SpaceShip pitch={handData.pitch} yaw={handData.yaw} speed={speed} />
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
    const [currentSpeed, setCurrentSpeed] = useState(0);
    const [score, setScore] = useState(0);

    // Audio Refs
    const audioCtxRef = useRef<AudioContext | null>(null);
    const engineOscRef = useRef<OscillatorNode | null>(null);
    const engineGainRef = useRef<GainNode | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && !audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

            // Simple Engine Sound
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

    // Update sound based on speed
    useEffect(() => {
        if (engineGainRef.current && engineOscRef.current && audioCtxRef.current) {
            const now = audioCtxRef.current.currentTime;
            engineGainRef.current.gain.setTargetAtTime(currentSpeed * 0.1, now, 0.1);
            engineOscRef.current.frequency.setTargetAtTime(50 + currentSpeed * 100, now, 0.1);
        }
    }, [currentSpeed]);

    const handlePass = () => {
        setScore(s => s + 100);
        // Success Beep
        if (audioCtxRef.current) {
            const osc = audioCtxRef.current.createOscillator();
            const g = audioCtxRef.current.createGain();
            osc.frequency.setValueAtTime(880, audioCtxRef.current.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, audioCtxRef.current.currentTime + 0.2);
            g.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.2);
            osc.connect(g);
            g.connect(audioCtxRef.current.destination);
            osc.start();
            osc.stop(audioCtxRef.current.currentTime + 0.2);
        }
    };

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none">
            {/* HUD Layers */}
            <div className="absolute inset-x-0 top-0 z-50 p-8 flex justify-between items-start pointer-events-none">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse" />
                        <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white/90">PILOT_LINK_ALPHA</h1>
                    </div>
                    <div className="flex gap-4 opacity-70 mono text-[10px] text-cyan-400">
                        <span className="bg-cyan-500/10 px-2 py-1 border border-cyan-500/20">SCORE: {score.toString().padStart(6, '0')}</span>
                        <span className="bg-cyan-500/10 px-2 py-1 border border-cyan-500/20">VELOCITY: {Math.round(currentSpeed * 300)} KM/S</span>
                    </div>
                    <div className="flex gap-4 opacity-50 mono text-[9px] mt-1">
                        <span className="flex items-center gap-1.5"><Navigation size={10} /> {handData.handPosition ? 'LOCKED' : 'SCANNING'}</span>
                        <span className={`flex items-center gap-1.5 ${handData.isPalmOpen ? 'text-cyan-400 font-bold' : ''}`}>ACCEL: {handData.isPalmOpen ? 'ON' : 'OFF'}</span>
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
                    {/* Speed Gauge */}
                    <div className="flex flex-col items-center gap-3">
                        <span className="mono text-[10px] text-cyan-500/50 uppercase tracking-widest">Velocity</span>
                        <div className="w-1.5 h-40 bg-white/5 relative rounded-full overflow-hidden border border-white/5">
                            <motion.div
                                className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-blue-600 to-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.8)]"
                                style={{ height: `${currentSpeed * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Central Crosshair */}
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

                    {/* Manual Controls Help */}
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

            {/* 3D Scene */}
            <div className="absolute inset-0 z-0">
                <Canvas gl={{ antialias: true }}>
                    <GameScene handData={handData} onPass={handlePass} onSpeedChange={setCurrentSpeed} />
                </Canvas>
            </div>

            <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 15s linear infinite;
        }
      `}</style>
        </div>
    );
}
