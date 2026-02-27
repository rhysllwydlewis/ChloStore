'use client';

export default function DecorativeBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Soft radial gradient blobs in warm beige tones */}
      <div
        className="absolute w-[700px] h-[700px] rounded-full"
        style={{
          background: 'radial-gradient(circle, #E7D8C6, transparent 70%)',
          top: '-200px',
          right: '-150px',
          opacity: 0.6,
          filter: 'blur(40px)',
          animation: 'drift 20s infinite ease-in-out',
        }}
      />
      <div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, #C9A983, transparent 70%)',
          bottom: '-150px',
          left: '-100px',
          opacity: 0.3,
          filter: 'blur(60px)',
          animation: 'drift 25s infinite ease-in-out reverse',
        }}
      />
      <div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, #E7D8C6, transparent 70%)',
          top: '40%',
          left: '30%',
          opacity: 0.4,
          filter: 'blur(50px)',
          animation: 'drift 18s infinite ease-in-out',
          animationDelay: '-8s',
        }}
      />
    </div>
  );
}
