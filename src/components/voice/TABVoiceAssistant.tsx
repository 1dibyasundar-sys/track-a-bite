'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTABVoiceSession } from '../../lib/voice/voiceTrigger';
import { TABContext, TABAction } from '../../lib/voice/types';
import { TABVoiceOrb } from './TABVoiceOrb';
import { TABTranscript } from './TABTranscript';
import { TABContextCard } from './TABContextCard';
import { TABVoiceControls } from './TABVoiceControls';
import { Container } from '../layout/container';
import { SparklesIcon } from '../ui/icons';

interface TABVoiceAssistantProps {
  initialContext?: TABContext;
  onClose?: () => void;
  isModal?: boolean;
}

const SAMPLE_FOOD_QUESTIONS = [
  'Why does biryani taste better the next day?',
  'I only have ₹50. What can I eat?',
  'What can I cook with rice, eggs & onions?',
  'Give me a high protein breakfast idea',
  'Where did dalma come from?',
  'Is this healthy for me?',
  'Scan another product',
];

export function TABVoiceAssistant({
  initialContext,
  onClose,
  isModal = false,
}: TABVoiceAssistantProps) {
  const router = useRouter();
  const [clearedProduct, setClearedProduct] = useState(false);
  const [clearedMeal, setClearedMeal] = useState(false);

  const activeContext = React.useMemo(() => {
    if (!initialContext) return undefined;
    return {
      ...initialContext,
      currentProduct: clearedProduct ? null : initialContext.currentProduct,
      currentMeal: clearedMeal ? null : initialContext.currentMeal,
    };
  }, [initialContext, clearedProduct, clearedMeal]);

  const handleAction = (action: TABAction) => {
    console.log('[TAB Assistant] Action triggered:', action.type);
    if (action.type === 'OPEN_SCANNER' || action.type === 'OPEN_MEAL_SCANNER') {
      router.push('/scan');
    } else if (action.type === 'OPEN_BARCODE_SCANNER') {
      router.push('/scan');
    } else if (action.type === 'OPEN_HISTORY') {
      router.push('/history');
    } else if (action.type === 'OPEN_PROFILE') {
      router.push('/profile');
    } else if (action.type === 'GET_NUTRITION_SUMMARY') {
      router.push('/dashboard');
    } else if (action.type === 'START_REANALYSIS') {
      router.push('/scan?reanalyze=true');
    } else if (action.type === 'SCAN_ANOTHER_PRODUCT') {
      router.push('/scan');
    }
  };

  const {
    state,
    permission,
    interimTranscript,
    messages,
    audioLevel,
    errorMessage,
    connect,
    startListening,
    stopListening,
    interrupt,
    sendText,
    isSupported,
  } = useTABVoiceSession({
    context: activeContext,
    onAction: handleAction,
    autoConnect: true,
  });

  const handleToggleListen = () => {
    if (permission === 'denied' || state === 'error') {
      connect();
    } else if (state === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleClearProduct = () => {
    setClearedProduct(true);
  };

  const handleClearMeal = () => {
    setClearedMeal(true);
  };

  return (
    <div className={`w-full min-h-[calc(100vh-5rem)] flex flex-col justify-between py-6 px-4 ${isModal ? 'max-w-2xl mx-auto' : ''}`}>
      <Container size="md" className="flex-1 flex flex-col justify-between space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-1.5 pt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF7EE] dark:bg-[#2A1C14] border border-[#F4A340]/40 text-[#E86A33] dark:text-[#F4A340] text-3xs font-extrabold uppercase tracking-widest">
            <SparklesIcon size={12} />
            <span>AI Food Companion</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
            Talk with TAB
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-sm mx-auto leading-relaxed">
            Your live food friend for cooking hacks, recipes, nutrition curiosity, and local food science.
          </p>
        </div>

        {/* Error / Permission Alert */}
        {errorMessage && (
          <div className="w-full max-w-lg mx-auto p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-base shrink-0">⚠️</span>
              <p className="leading-snug">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => connect()}
              className="px-3 py-1 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-3xs shrink-0 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Browser Unsupported Notice */}
        {!isSupported && (
          <div className="w-full max-w-lg mx-auto p-3 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-300 text-center">
            Voice recognition is limited in this browser. You can still chat by typing below!
          </div>
        )}

        {/* Centerpiece: Interactive TAB Voice Orb */}
        <div className="py-2 flex items-center justify-center">
          <TABVoiceOrb state={state} audioLevel={audioLevel} size={170} />
        </div>

        {/* Active Grounding Context Card */}
        {activeContext && (
          <TABContextCard
            context={activeContext}
            onClearProduct={handleClearProduct}
            onClearMeal={handleClearMeal}
          />
        )}

        {/* Conversational Transcript */}
        <TABTranscript
          messages={messages}
          interimTranscript={interimTranscript}
          isListening={state === 'listening'}
        />

        {/* Contextual Inspiration Suggestions */}
        {messages.length === 0 && (
          <div className="w-full max-w-lg mx-auto space-y-2">
            <span className="text-3xs font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 block text-center">
              Try asking TAB
            </span>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {SAMPLE_FOOD_QUESTIONS.slice(0, 5).map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendText(q)}
                  className="px-3 py-1.5 rounded-full bg-white dark:bg-[#1D1A17] hover:bg-[#FEF7EE] dark:hover:bg-[#2A1C14] border border-stone-200 dark:border-[#38312A] text-stone-700 dark:text-stone-300 hover:text-[#E86A33] dark:hover:text-[#F4A340] text-2xs font-medium transition-all shadow-2xs cursor-pointer text-left"
                >
                  &ldquo;{q}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Interactive Voice Controls */}
        <div className="pt-2 border-t border-stone-200/60 dark:border-[#38312A]/60">
          <TABVoiceControls
            state={state}
            onToggleListen={handleToggleListen}
            onInterrupt={interrupt}
            onSendText={sendText}
            onClose={onClose}
          />
        </div>
      </Container>
    </div>
  );
}
