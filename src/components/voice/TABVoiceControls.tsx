'use client';

import React, { useState } from 'react';
import { TABVoiceState } from '../../lib/voice/types';

interface TABVoiceControlsProps {
  state: TABVoiceState;
  onToggleListen: () => void;
  onInterrupt: () => void;
  onSendText: (text: string) => void;
  onClose?: () => void;
  disabled?: boolean;
}

export function TABVoiceControls({
  state,
  onToggleListen,
  onInterrupt,
  onSendText,
  onClose,
  disabled,
}: TABVoiceControlsProps) {
  const [showTextInput, setShowTextInput] = useState(false);
  const [textVal, setTextVal] = useState('');

  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';
  const isBusy = state === 'processing' || isSpeaking;

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textVal.trim()) return;
    onSendText(textVal.trim());
    setTextVal('');
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center space-y-3 pt-2">
      {/* Primary Interaction Buttons */}
      <div className="flex items-center justify-center gap-4">
        {/* Text Input Toggle */}
        <button
          type="button"
          onClick={() => setShowTextInput(!showTextInput)}
          className={`p-3 rounded-full border transition-all cursor-pointer ${
            showTextInput
              ? 'bg-[#E86A33] text-white border-[#E86A33]'
              : 'bg-white dark:bg-[#25211D] border-stone-200 dark:border-[#38312A] text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#2D2722]'
          }`}
          title="Type instead of speak"
          aria-label="Toggle text input"
        >
          <span className="text-base">⌨️</span>
        </button>

        {/* Central Big Microphone Button */}
        <button
          type="button"
          onClick={onToggleListen}
          disabled={disabled}
          className={`relative p-5 rounded-full transition-all transform active:scale-95 cursor-pointer shadow-lg flex items-center justify-center ${
            isListening
              ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/30 scale-105 shadow-emerald-500/25'
              : 'bg-[#E86A33] hover:bg-[#d65f2c] text-white ring-4 ring-[#E86A33]/20 shadow-[#E86A33]/30'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          {isListening ? (
            <span className="text-2xl animate-pulse">🎙️</span>
          ) : (
            <span className="text-2xl">🎤</span>
          )}
        </button>

        {/* Interrupt / Stop Button */}
        {isBusy ? (
          <button
            type="button"
            onClick={onInterrupt}
            className="p-3 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-100 transition-all cursor-pointer animate-pulse"
            title="Interrupt TAB"
            aria-label="Interrupt speech"
          >
            <span className="text-base font-bold">⏹️</span>
          </button>
        ) : onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="p-3 rounded-full bg-white dark:bg-[#25211D] border border-stone-200 dark:border-[#38312A] text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#2D2722] transition-all cursor-pointer"
            title="Close Assistant"
            aria-label="Close"
          >
            <span className="text-base">✕</span>
          </button>
        ) : null}
      </div>

      <span className="text-3xs text-stone-500 dark:text-stone-400 font-medium">
        {isListening
          ? 'Tap mic to mute • Or speak naturally'
          : isSpeaking
          ? 'TAB is speaking • Speak to interrupt'
          : 'Tap microphone to talk to TAB'}
      </span>

      {/* Expandable Text Input */}
      {showTextInput && (
        <form
          onSubmit={handleSubmitText}
          className="w-full flex items-center gap-2 pt-1 transition-all"
        >
          <input
            type="text"
            value={textVal}
            onChange={(e) => setTextVal(e.target.value)}
            placeholder="Ask TAB anything about food, cooking, calories..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-[#1D1A17] border border-stone-300 dark:border-[#38312A] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#E86A33]"
            autoFocus
          />
          <button
            type="submit"
            disabled={!textVal.trim()}
            className="px-4 py-2.5 rounded-xl bg-[#E86A33] hover:bg-[#d65f2c] disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer shrink-0"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
