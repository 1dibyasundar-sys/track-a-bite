'use client';

import React, { useEffect, useRef, useState } from 'react';
import { TABMessage } from '../../lib/voice/types';

interface TABTranscriptProps {
  messages: TABMessage[];
  interimTranscript?: string;
  isListening?: boolean;
}

export function TABTranscript({
  messages,
  interimTranscript,
  isListening,
}: TABTranscriptProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll when new message or chunk arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, interimTranscript]);

  if (messages.length === 0 && !interimTranscript) {
    return null;
  }

  const recentMessages = isExpanded ? messages : messages.slice(-3);

  return (
    <div className="w-full max-w-lg mx-auto bg-white/70 dark:bg-[#1D1A17]/80 backdrop-blur-md rounded-2xl border border-stone-200/80 dark:border-[#38312A] shadow-xs overflow-hidden transition-all">
      {/* Header bar */}
      <div className="px-4 py-2 border-b border-stone-100 dark:border-[#2C2723] flex items-center justify-between text-2xs text-stone-500 dark:text-stone-400">
        <span className="font-semibold uppercase tracking-wider">Conversation</span>
        {messages.length > 3 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="hover:text-stone-900 dark:hover:text-stone-200 cursor-pointer font-medium"
          >
            {isExpanded ? 'Collapse' : `View all (${messages.length})`}
          </button>
        )}
      </div>

      {/* Message stream */}
      <div
        ref={scrollRef}
        className={`p-3 space-y-2.5 overflow-y-auto transition-all ${
          isExpanded ? 'max-h-72' : 'max-h-48'
        }`}
      >
        {recentMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#E86A33] text-white rounded-br-xs shadow-xs'
                  : 'bg-stone-100 dark:bg-[#25211D] text-stone-900 dark:text-stone-100 rounded-bl-xs border border-stone-200/60 dark:border-[#38312A]'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.actionExecuted && (
                <div className="mt-1 pt-1 border-t border-stone-200/50 dark:border-stone-700/50 text-3xs font-semibold text-[#E86A33] dark:text-[#F4A340]">
                  ⚡ Action: {msg.actionExecuted.label}
                </div>
              )}
            </div>
            <span className="text-3xs text-stone-400 dark:text-stone-500 mt-0.5 px-1 font-mono">
              {msg.role === 'user' ? 'You' : 'TAB'}
            </span>
          </div>
        ))}

        {/* Interim speech recognition preview */}
        {isListening && interimTranscript && (
          <div className="flex flex-col items-end opacity-75 animate-pulse">
            <div className="max-w-[85%] rounded-2xl rounded-br-xs px-3.5 py-2 text-xs bg-stone-200 dark:bg-[#2A2420] text-stone-700 dark:text-stone-300">
              <p className="italic">{interimTranscript}...</p>
            </div>
            <span className="text-3xs text-stone-400 mt-0.5 px-1">Hearing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
