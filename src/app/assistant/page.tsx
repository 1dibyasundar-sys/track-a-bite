import { Suspense } from 'react';
import { Metadata } from 'next';
import { AuthGuard } from '../../components/auth/AuthGuard';
import { TABVoicePageContent } from './TABVoicePageContent';

export const metadata: Metadata = {
  title: 'TAB — AI Live Food Companion | Track-a-Bite',
  description: 'Talk naturally with TAB, your live AI companion for cooking hacks, recipes, food science, and nutrition curiosity.',
};

export default function AssistantPage() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <div className="w-full min-h-[calc(100vh-5rem)] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-3 border-[#E86A33] border-t-transparent animate-spin" />
              <p className="text-xs text-stone-500 font-medium tracking-wide">Connecting to TAB...</p>
            </div>
          </div>
        }
      >
        <TABVoicePageContent />
      </Suspense>
    </AuthGuard>
  );
}

