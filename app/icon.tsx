import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 512,
  height: 512,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#047857',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="320"
          height="320"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Angled Pill/Capsule Outline */}
          <path
            d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"
            stroke="white"
            strokeWidth="2.2"
            fill="rgba(255, 255, 255, 0.15)"
          />
          {/* Center Dividing Band */}
          <path d="m8.5 8.5 7 7" stroke="white" strokeWidth="2.2" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}