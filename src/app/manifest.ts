import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Track-a-Bite Regional Indian Nutrition',
    short_name: 'Track-a-Bite',
    description: 'AI-powered regional Indian food recognition and personalized nutrition assistant.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf8f5',
    theme_color: '#059669',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
