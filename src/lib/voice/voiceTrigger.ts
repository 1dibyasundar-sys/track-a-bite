/**
 * Track-a-Bite — TAB Voice Hook & Trigger Helpers
 *
 * Provides a safe, reusable React hook for connecting to the TAB Voice Session.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserTABVoiceProvider } from './voiceProvider';
import {
    TABAction,
    TABContext,
    TABMessage,
    TABMicrophonePermission,
    TABVoiceLatencyMetrics,
    TABVoiceState,
} from './types';

export interface UseTABVoiceOptions {
    context?: TABContext;
    onAction?: (action: TABAction) => void;
    autoConnect?: boolean;
}

export function useTABVoiceSession(options: UseTABVoiceOptions = {}) {
    const [state, setState] = useState<TABVoiceState>('idle');
    const [permission, setPermission] = useState<TABMicrophonePermission>('prompt');
    const [interimTranscript, setInterimTranscript] = useState<string>('');
    const [messages, setMessages] = useState<TABMessage[]>([]);
    const [audioLevel, setAudioLevel] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSupported, setIsSupported] = useState<boolean>(true);
    const [latencyMetrics, setLatencyMetrics] = useState<TABVoiceLatencyMetrics | null>(null);

    const providerRef = useRef<BrowserTABVoiceProvider | null>(null);
    const optionsRef = useRef(options);

    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    // Initialize provider
    useEffect(() => {
        const provider = new BrowserTABVoiceProvider({
            onStateChange: (newState) => {
                setState(newState);
            },
            onMicrophonePermissionChange: (newPerm) => {
                setPermission(newPerm);
            },
            onTranscript: (text, isFinal) => {
                if (!isFinal) {
                    setInterimTranscript(text);
                } else {
                    setInterimTranscript('');
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: `user-${Date.now()}`,
                            role: 'user',
                            text,
                            timestamp: Date.now(),
                        },
                    ]);
                }
            },
            onResponseChunk: (chunk) => {
                setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === 'assistant' && last.isStreaming) {
                        return [
                            ...prev.slice(0, -1),
                            { ...last, text: last.text + chunk },
                        ];
                    } else {
                        return [
                            ...prev,
                            {
                                id: `tab-${Date.now()}`,
                                role: 'assistant',
                                text: chunk,
                                timestamp: Date.now(),
                                isStreaming: true,
                            },
                        ];
                    }
                });
            },
            onResponseComplete: (fullText, action) => {
                setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === 'assistant') {
                        return [
                            ...prev.slice(0, -1),
                            { ...last, text: fullText, isStreaming: false, actionExecuted: action },
                        ];
                    } else {
                        return [
                            ...prev,
                            {
                                id: `tab-${Date.now()}`,
                                role: 'assistant',
                                text: fullText,
                                timestamp: Date.now(),
                                isStreaming: false,
                                actionExecuted: action,
                            },
                        ];
                    }
                });

                if (action && optionsRef.current.onAction) {
                    optionsRef.current.onAction(action);
                }
            },
            onAudioLevel: (level) => {
                setAudioLevel(level);
            },
            onError: (msg) => {
                setErrorMessage(msg);
            },
            onLatencyMetrics: (metrics) => {
                setLatencyMetrics(metrics);
                if (typeof window !== 'undefined') {
                    (window as unknown as { __TAB_LAST_LATENCY_METRICS__?: TABVoiceLatencyMetrics }).__TAB_LAST_LATENCY_METRICS__ = metrics;
                }
            },
        });

        providerRef.current = provider;
        setIsSupported(provider.isSupported());

        if (options.autoConnect) {
            provider.connect().catch(console.error);
        }

        return () => {
            provider.disconnect().catch(console.error);
            providerRef.current = null;
        };
    }, [options.autoConnect]);

    const connect = useCallback(async () => {
        setErrorMessage(null);
        if (providerRef.current) {
            await providerRef.current.connect();
        }
    }, []);

    const disconnect = useCallback(async () => {
        if (providerRef.current) {
            await providerRef.current.disconnect();
        }
    }, []);

    const startListening = useCallback(async () => {
        setErrorMessage(null);
        if (providerRef.current) {
            await providerRef.current.startListening();
        }
    }, []);

    const stopListening = useCallback(async () => {
        if (providerRef.current) {
            await providerRef.current.stopListening();
        }
    }, []);

    const interrupt = useCallback(async () => {
        if (providerRef.current) {
            await providerRef.current.interrupt();
        }
    }, []);

    const sendText = useCallback(
        async (text: string) => {
            setErrorMessage(null);
            if (providerRef.current) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `user-${Date.now()}`,
                        role: 'user',
                        text,
                        timestamp: Date.now(),
                    },
                ]);
                await providerRef.current.sendText(text, optionsRef.current.context);
            }
        },
        []
    );

    return {
        state,
        permission,
        interimTranscript,
        messages,
        audioLevel,
        errorMessage,
        connect,
        disconnect,
        startListening,
        stopListening,
        interrupt,
        sendText,
        isSupported,
        latencyMetrics,
    };
}
