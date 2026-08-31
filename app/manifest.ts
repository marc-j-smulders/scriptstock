import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ScriptStock - Community Stock Tracker',
    short_name: 'ScriptStock',
    description: 'Live crowdsourced prescription medication availability',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#059669',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}