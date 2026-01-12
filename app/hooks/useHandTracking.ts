import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export type HandData = {
    isPalmOpen: boolean;
    isFist: boolean;
    pitch: number; // -1 to 1 (up/down)
    yaw: number;   // -1 to 1 (left/right)
    roll: number;  // -1 to 1
    handPosition: { x: number, y: number } | null;
};

export const useHandTracking = (videoRef: React.RefObject<any>) => {
    const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
    const [handData, setHandData] = useState<HandData>({
        isPalmOpen: false,
        isFist: false,
        pitch: 0,
        yaw: 0,
        roll: 0,
        handPosition: null,
    });

    useEffect(() => {
        const createHandLandmarker = async () => {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );
            const landmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 1
            });
            setHandLandmarker(landmarker);
        };
        createHandLandmarker();
    }, []);

    useEffect(() => {
        if (!handLandmarker) return;

        let requestAnimationFrameId: number;
        let isActive = true;

        const predictLoop = async () => {
            if (!isActive) return;

            const video = videoRef.current?.video;
            if (video && video.readyState >= 2) {
                try {
                    const startTimeMs = performance.now();
                    const result = handLandmarker.detectForVideo(video, startTimeMs);

                    if (result.landmarks && result.landmarks.length > 0) {
                        const landmarks = result.landmarks[0];

                        // 1. Gesture Detection (Open Palm vs Fist)
                        const fingersOpen = [8, 12, 16, 20].map(tipIdx => {
                            const tip = landmarks[tipIdx];
                            const mcp = landmarks[tipIdx - 3]; // MCP joint
                            return tip.y < mcp.y; // Higher in Y (smaller value) means extended
                        });
                        const isOpen = fingersOpen.every(f => f);
                        const isClosed = fingersOpen.every(f => !f);

                        // 2. Orientation Detection (Pitch/Yaw)
                        // Wrist (0), Middle MCP (9)
                        const wrist = landmarks[0];
                        const middleMCP = landmarks[9];

                        // Pitch: vertical angle of the palm
                        // Yaw: horizontal position or tilt
                        const dx = middleMCP.x - wrist.x;
                        const dy = middleMCP.y - wrist.y;

                        // Normalize to -1 to 1 range for game control
                        // Center of screen is roughly 0
                        const yaw = (middleMCP.x - 0.5) * 2; // -1 (left) to 1 (right)
                        const pitch = (middleMCP.y - 0.5) * 2; // -1 (up) to 1 (down) - note Y is flipped in screen space

                        setHandData({
                            isPalmOpen: isOpen,
                            isFist: isClosed,
                            pitch: -pitch, // Invert so up is up
                            yaw: -yaw,   // Invert so left/right matches mirror
                            roll: dx * 5,
                            handPosition: { x: middleMCP.x, y: middleMCP.y },
                        });
                    } else {
                        setHandData(prev => ({ ...prev, handPosition: null }));
                    }
                } catch (err) { }
            }

            requestAnimationFrameId = requestAnimationFrame(predictLoop);
        };

        predictLoop();

        return () => {
            isActive = false;
            cancelAnimationFrame(requestAnimationFrameId);
        };
    }, [handLandmarker, videoRef]);

    return handData;
};
