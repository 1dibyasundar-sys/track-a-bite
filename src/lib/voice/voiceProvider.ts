/**
 * Track-a-Bite — TAB Realtime Voice Provider
 *
 * Implements TABVoiceProvider using standard Web Speech Recognition,
 * streaming Gemini chat route, Web Speech Synthesis / Web Audio,
 * and instant barge-in Voice Activity Detection.
 */

import {
  TABAction,
  TABContext,
  TABVoiceProvider,
  TABVoiceProviderEvents,
  TABVoiceState,
} from './types';

// Browser SpeechRecognition interface
interface IWindowSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: IWindowSpeechRecognition, ev: Event) => void) | null;
  onend: ((this: IWindowSpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: IWindowSpeechRecognition, ev: { error: string; message?: string }) => void) | null;
  onresult: ((this: IWindowSpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onspeechstart: ((this: IWindowSpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: IWindowSpeechRecognition, ev: Event) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

type SpeechRecognitionConstructor = new () => IWindowSpeechRecognition;

function getSpeechRecognitionClass(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export class BrowserTABVoiceProvider implements TABVoiceProvider {
  private state: TABVoiceState = 'idle';
  private events: TABVoiceProviderEvents;
  private recognition: IWindowSpeechRecognition | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private abortController: AbortController | null = null;
  private isExplicitlyStopped = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private conversationHistory: Array<{ role: 'user' | 'assistant'; text: string }> = [];
  private lastContext?: TABContext;

  constructor(events: TABVoiceProviderEvents) {
    this.events = events;
  }

  public getState(): TABVoiceState {
    return this.state;
  }

  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      (Boolean(getSpeechRecognitionClass()) || Boolean(navigator.mediaDevices?.getUserMedia))
    );
  }

  private setState(newState: TABVoiceState) {
    if (this.state === newState) return;
    this.state = newState;
    this.events.onStateChange(newState);
  }

  /**
   * Request microphone permission & connect audio infrastructure.
   */
  public async connect(): Promise<void> {
    if (typeof window === 'undefined') return;

    this.setState('connecting');
    this.isExplicitlyStopped = false;

    // 1. Check microphone access
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        this.mediaStream = stream;
        this.events.onMicrophonePermissionChange?.('granted');
        this.setupAudioVisualizer(stream);
      } catch (err: unknown) {
        const error = err as Error;
        console.warn('[TAB Provider] Microphone access issue:', error.name, error.message);
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          this.events.onMicrophonePermissionChange?.('denied');
          this.setState('error');
          this.events.onError('Microphone access is needed for TAB to hear you. Please allow microphone access in your browser.', true);
          return;
        } else {
          this.events.onMicrophonePermissionChange?.('prompt');
        }
      }
    }

    // 2. Initialize Speech Recognition
    const RecognitionClass = getSpeechRecognitionClass();
    if (RecognitionClass) {
      try {
        const recognition = new RecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN'; // Default to Indian English, compatible globally
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          if (!this.isExplicitlyStopped && this.state !== 'speaking' && this.state !== 'processing') {
            this.setState('listening');
          }
        };

        // Barge-in: Detect when user begins speaking
        recognition.onspeechstart = () => {
          if (this.state === 'speaking') {
            console.log('[TAB Provider] Barge-in triggered: user started speaking while TAB was talking.');
            this.interrupt();
          }
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          // If TAB was speaking and user speaks, barge-in immediately
          if (this.state === 'speaking') {
            this.interrupt();
          }

          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            const text = result[0]?.transcript || '';
            if (result.isFinal) {
              finalTranscript += text;
            } else {
              interimTranscript += text;
            }
          }

          if (interimTranscript) {
            this.events.onTranscript(interimTranscript.trim(), false);
          }

          if (finalTranscript.trim()) {
            const cleanFinal = finalTranscript.trim();
            this.events.onTranscript(cleanFinal, true);
            // Process query
            this.processUserQuery(cleanFinal);
          }
        };

        recognition.onerror = (ev: { error: string; message?: string }) => {
          if (ev.error === 'no-speech') {
            // Normal silence timeout, ignore
            return;
          }
          if (ev.error === 'not-allowed') {
            this.events.onMicrophonePermissionChange?.('denied');
            this.setState('error');
            this.events.onError('Microphone access was denied. Please allow microphone access.', true);
            return;
          }
          console.warn('[TAB Provider] Speech recognition notice:', ev.error);
        };

        recognition.onend = () => {
          if (
            !this.isExplicitlyStopped &&
            this.state !== 'disconnected' &&
            this.state !== 'processing' &&
            this.state !== 'speaking' &&
            this.state !== 'error'
          ) {
            try {
              recognition.start();
            } catch {
              // Ignore already running error
            }
          }
        };

        this.recognition = recognition;
        this.setState('idle');
      } catch (e) {
        console.warn('[TAB Provider] SpeechRecognition initialization notice:', e);
        this.setState('idle');
      }
    } else {
      this.setState('idle');
    }
  }

  private setupAudioVisualizer(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      this.audioContext = audioCtx;
      this.analyser = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!this.analyser || this.state === 'disconnected') return;
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1.0, avg / 128);

        this.events.onAudioLevel?.(normalized);
        this.animFrameId = requestAnimationFrame(updateLevel);
      };

      this.animFrameId = requestAnimationFrame(updateLevel);
    } catch (e) {
      console.warn('[TAB Provider] Audio visualizer setup notice:', e);
    }
  }

  public async startListening(): Promise<void> {
    this.isExplicitlyStopped = false;
    this.stopSpeaking();

    if (this.recognition) {
      try {
        this.recognition.start();
      } catch {
        // May already be running
      }
    }
    this.setState('listening');
  }

  public async stopListening(): Promise<void> {
    this.isExplicitlyStopped = true;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
    }
    if (this.state === 'listening') {
      this.setState('idle');
    }
  }

  /**
   * Interrupt ongoing speech playback or active LLM generation.
   */
  public async interrupt(): Promise<void> {
    if (this.state === 'speaking' || this.state === 'processing') {
      this.setState('interrupted');
    }

    // Stop audio
    this.stopSpeaking();

    // Abort LLM stream
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Re-engage listening if recognition is active
    if (!this.isExplicitlyStopped && this.recognition) {
      setTimeout(() => {
        if (this.state !== 'disconnected') {
          this.setState('listening');
        }
      }, 150);
    } else {
      this.setState('idle');
    }
  }

  private stopSpeaking() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
  }

  /**
   * Process a recognized or typed user query through the streaming backend.
   */
  private async processUserQuery(text: string) {
    if (!text || this.state === 'disconnected') return;
    this.sendText(text, this.lastContext);
  }

  public async sendText(text: string, context?: TABContext): Promise<void> {
    if (!text.trim()) return;

    this.lastContext = context;
    this.interrupt();
    this.setState('processing');

    this.conversationHistory.push({ role: 'user', text: text.trim() });

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const response = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: this.conversationHistory.slice(-6),
          context,
        }),
        signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Streaming response body unavailable.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let detectedAction: TABAction | undefined = undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.substring(6);
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === 'chunk' && event.text) {
                accumulatedText += event.text;
                this.events.onResponseChunk(event.text);
              } else if (event.type === 'done') {
                if (event.action) {
                  detectedAction = event.action;
                }
              }
            } catch {
              // Ignore partial JSON
            }
          }
        }
      }

      const finalText = accumulatedText.trim();
      if (!finalText) {
        this.setState('idle');
        return;
      }

      this.conversationHistory.push({ role: 'assistant', text: finalText });
      this.events.onResponseComplete(finalText, detectedAction);

      // Play audio response
      this.speakText(finalText);
    } catch (err: unknown) {
      if (signal.aborted) {
        // Intentional cancellation/interruption
        return;
      }
      const error = err as Error;
      console.warn('[TAB Provider] Query processing error:', error.message);
      this.setState('error');
      this.events.onError(error.message || 'Could not connect to TAB. Please try again.', true);
    }
  }

  /**
   * Speak output using high-quality browser SpeechSynthesis.
   */
  private speakText(text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      this.setState('idle');
      return;
    }

    this.stopSpeaking();
    this.setState('speaking');

    // Clean any action tags before speaking
    const cleanSpeech = text.replace(/\[ACTION:[^\]]+\]/g, '').trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = 'en-IN';
    utterance.rate = 1.05; // Slightly brisk, natural tempo
    utterance.pitch = 1.0;

    // Pick a natural voice if available
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const preferred = voices.find(
        v =>
          (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Karen')) &&
          (v.lang.startsWith('en') || v.lang.startsWith('en-IN'))
      ) || voices.find(v => v.lang.startsWith('en-IN')) || voices.find(v => v.lang.startsWith('en'));

      if (preferred) {
        utterance.voice = preferred;
      }
    }

    utterance.onend = () => {
      this.currentUtterance = null;
      if (this.state === 'speaking') {
        // Return to listening automatically for conversational flow
        if (!this.isExplicitlyStopped && this.recognition) {
          this.setState('listening');
        } else {
          this.setState('idle');
        }
      }
    };

    utterance.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') {
        // Expected on barge-in
        return;
      }
      console.warn('[TAB Provider] Speech synthesis notice:', e.error);
      this.currentUtterance = null;
      this.setState('idle');
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  public async disconnect(): Promise<void> {
    this.isExplicitlyStopped = true;

    // 1. Stop audio playback
    this.stopSpeaking();

    // 2. Abort active network calls
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // 3. Stop speech recognition
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignore
      }
      this.recognition = null;
    }

    // 4. Stop media stream audio tracks (release microphone immediately)
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // 5. Close audio context
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch {
        // Ignore
      }
      this.audioContext = null;
      this.analyser = null;
    }

    this.setState('disconnected');
  }
}
