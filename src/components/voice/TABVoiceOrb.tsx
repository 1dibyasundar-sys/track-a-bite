'use client';

import React, { useEffect, useRef } from 'react';
import { TABVoiceState } from '../../lib/voice/types';

interface TABVoiceOrbProps {
  state: TABVoiceState;
  audioLevel?: number; // 0.0 to 1.0
  size?: number; // default 160
}

export function TABVoiceOrb({ state, audioLevel = 0, size = 160 }: TABVoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render animated canvas waves when listening or speaking
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let step = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const baseRadius = (size / 2) * 0.72;

      // When speaking or listening, draw reactive ripples
      if (state === 'speaking' || state === 'listening' || state === 'processing') {
        const reactiveFactor = Math.max(0.15, audioLevel);
        const waveCount = 3;

        for (let i = 0; i < waveCount; i++) {
          ctx.beginPath();
          const wavePhase = step * 0.04 + i * (Math.PI / 1.5);
          const r = baseRadius + Math.sin(wavePhase) * (8 + reactiveFactor * 24);

          ctx.arc(cx, cy, Math.max(10, r), 0, Math.PI * 2);
          ctx.lineWidth = 2 + reactiveFactor * 2;

          if (state === 'speaking') {
            // Terracotta to mango ripple
            ctx.strokeStyle = `rgba(232, 106, 51, ${0.4 - i * 0.1})`;
          } else if (state === 'listening') {
            // Emerald to teal ripple
            ctx.strokeStyle = `rgba(16, 185, 129, ${0.45 - i * 0.12})`;
          } else {
            // Violet / amber breathing ripple
            ctx.strokeStyle = `rgba(124, 108, 231, ${0.35 - i * 0.1})`;
          }
          ctx.stroke();
        }
      }

      step++;
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [state, audioLevel, size]);

  // Gradient and glow styles based on state
  let orbBg = 'from-[#E86A33] via-[#F4A340] to-[#E86A33]';
  let glowColor = 'rgba(232, 106, 51, 0.35)';
  let stateLabel = 'Ready to talk';
  let stateEmoji = '✨';

  if (state === 'connecting') {
    orbBg = 'from-amber-500 via-orange-400 to-amber-600 animate-pulse';
    glowColor = 'rgba(245, 158, 11, 0.4)';
    stateLabel = 'Connecting...';
    stateEmoji = '⏳';
  } else if (state === 'listening') {
    orbBg = 'from-emerald-500 via-teal-400 to-emerald-600';
    glowColor = 'rgba(16, 185, 129, 0.45)';
    stateLabel = 'Listening to you...';
    stateEmoji = '🎙️';
  } else if (state === 'processing') {
    orbBg = 'from-indigo-500 via-purple-400 to-violet-600 animate-pulse';
    glowColor = 'rgba(124, 108, 231, 0.4)';
    stateLabel = 'Thinking...';
    stateEmoji = '🧠';
  } else if (state === 'speaking') {
    orbBg = 'from-[#E86A33] via-[#F4A340] to-[#D9531E]';
    glowColor = 'rgba(232, 106, 51, 0.5)';
    stateLabel = 'TAB is speaking...';
    stateEmoji = '🗣️';
  } else if (state === 'interrupted') {
    orbBg = 'from-amber-500 via-orange-400 to-amber-500';
    glowColor = 'rgba(245, 158, 11, 0.4)';
    stateLabel = 'Listening...';
    stateEmoji = '👂';
  } else if (state === 'error') {
    orbBg = 'from-rose-500 via-red-400 to-rose-600';
    glowColor = 'rgba(239, 68, 68, 0.4)';
    stateLabel = 'Microphone notice';
    stateEmoji = '⚠️';
  }

  const scale = state === 'speaking' || state === 'listening' ? 1 + audioLevel * 0.15 : 1;

  return (
    <div className="flex flex-col items-center justify-center space-y-4 select-none">
      <div
        className="relative flex items-center justify-center transition-transform duration-150"
        style={{ width: size, height: size }}
      >
        {/* Animated wave background canvas */}
        <canvas
          ref={canvasRef}
          width={size * 1.5}
          height={size * 1.5}
          className="absolute inset-0 m-auto pointer-events-none"
          style={{ width: size * 1.5, height: size * 1.5 }}
        />

        {/* Outer ambient glow */}
        <div
          className="absolute inset-0 rounded-full blur-2xl transition-all duration-300 pointer-events-none"
          style={{
            background: glowColor,
            transform: `scale(${scale * 1.25})`,
          }}
        />

        {/* Central Core Orb */}
        <div
          className={`relative rounded-full bg-linear-to-tr ${orbBg} shadow-2xl transition-transform duration-200 flex items-center justify-center`}
          style={{
            width: size * 0.68,
            height: size * 0.68,
            transform: `scale(${scale})`,
            boxShadow: `0 0 35px ${glowColor}`,
          }}
        >
          {/* Internal gloss reflection */}
          <div className="absolute top-2 left-3 w-8 h-8 rounded-full bg-white/35 blur-xs pointer-events-none" />

          {/* Core Symbol / Voice Icon */}
          <span className="text-3xl filter drop-shadow-md select-none">{stateEmoji}</span>
        </div>
      </div>

      {/* State Feedback Tag */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 dark:bg-[#25211D] border border-stone-200 dark:border-[#38312A] text-xs font-semibold text-stone-700 dark:text-stone-300 transition-colors">
        <span
          className={`w-2 h-2 rounded-full ${
            state === 'listening'
              ? 'bg-emerald-500 animate-ping'
              : state === 'speaking'
              ? 'bg-[#E86A33] animate-pulse'
              : state === 'processing'
              ? 'bg-purple-500 animate-pulse'
              : state === 'error'
              ? 'bg-rose-500'
              : 'bg-stone-400'
          }`}
        />
        <span>{stateLabel}</span>
      </div>
    </div>
  );
}
