import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Perplexica - Chat with the internet',
    short_name: 'Perplexica',
    description:
      'Perplexica is an AI powered chatbot that is connected to the internet.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      {
        src: '/icons8-search-50.png',
        sizes: '50x50',
        type: 'image/png' as const,
      },
      {
        src: '/icons8-search-100.png',
        sizes: '100x100',
        type: 'image/png',
      },
    ],
  };
}
