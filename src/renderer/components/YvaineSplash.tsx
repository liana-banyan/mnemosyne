// YvaineSplash — BP063 SEG-3 · Yvaine "What do stars do? SHINE." greeting
// Mnemosyne-native mirror of the platform Yvaine HEOHO splash.
// Shown once on first launch (before ThreeOptionAsk).
// LocalStorage key: mnemo_yvaine_seen

import React, { useRef, useState, useEffect, useCallback } from 'react';

const AUDIO_SRC = 'https://lianabanyan.com/audio/WhatDoStarsDOShine.m4a';

interface YvaineSplashProps {
  onDismiss: () => void;
}

export function YvaineSplash({ onDismiss }: YvaineSplashProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(true);
  const [shineGlow, setShineGlow] = useState(false);

  // Pulse the SHINE glow every 2.5s
  useEffect(() => {
    const id = setInterval(() => setShineGlow((g) => !g), 1200);
    return () => clearInterval(id);
  }, []);

  const handlePlay = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(AUDIO_SRC);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  }, [playing]);

  const handleDismiss = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setVisible(false);
    // Small fade delay before calling parent dismiss
    setTimeout(onDismiss, 350);
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(4, 7, 16, 0.97)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        animation: 'yvaine-fade-in 0.6s ease',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Yvaine greeting"
    >
      <style>{`
        @keyframes yvaine-fade-in {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes shine-pulse {
          0%, 100% { text-shadow: 0 0 12px #fff8, 0 0 32px #fffb, 0 0 64px #6ee7b740; }
          50%       { text-shadow: 0 0 24px #ffff, 0 0 60px #fff, 0 0 120px #6ee7b7aa; }
        }
        .yvaine-shine {
          animation: shine-pulse 2.4s ease-in-out infinite;
        }
        @keyframes star-drift {
          0%   { opacity: 0; transform: translateY(0px); }
          30%  { opacity: 0.6; }
          100% { opacity: 0; transform: translateY(-60px); }
        }
      `}</style>

      {/* Stars decorative */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[...Array(18)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${5 + (i * 5.3) % 90}%`,
              top: `${10 + (i * 7.1) % 75}%`,
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              borderRadius: '50%',
              background: '#fff',
              opacity: 0.15 + (i % 4) * 0.08,
              animation: `star-drift ${3 + (i % 4)}s ease-in-out ${i * 0.3}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Quote block */}
      <div style={{ textAlign: 'center', padding: '0 32px', position: 'relative', zIndex: 1 }}>
        <p style={{
          fontFamily: "'Georgia', 'Crimson Pro', 'Times New Roman', serif",
          fontSize: 22,
          fontWeight: 400,
          color: 'rgba(250, 245, 235, 0.85)',
          letterSpacing: '0.04em',
          marginBottom: 12,
          lineHeight: 1.6,
        }}>
          What do stars do?
        </p>
        <p
          className="yvaine-shine"
          style={{
            fontFamily: "'Georgia', 'Crimson Pro', 'Times New Roman', serif",
            fontSize: 52,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            lineHeight: 1,
            marginBottom: 0,
          }}
        >
          SHINE.
        </p>
        <p style={{
          marginTop: 18,
          fontSize: 11,
          color: 'rgba(250,245,235,0.38)',
          fontStyle: 'italic',
          letterSpacing: '0.06em',
        }}>
          — Yvaine, Stardust (2007)
        </p>
      </div>

      {/* Audio play button */}
      <button
        onClick={handlePlay}
        title={playing ? 'Pause audio' : 'Play "What Do Stars Do"'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 22px',
          background: playing ? 'rgba(110,231,183,0.15)' : 'rgba(255,255,255,0.07)',
          border: playing
            ? '1px solid rgba(110,231,183,0.5)'
            : '1px solid rgba(255,255,255,0.2)',
          borderRadius: 24,
          color: playing ? '#6ee7b7' : 'rgba(255,255,255,0.75)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          letterSpacing: '0.04em',
          position: 'relative',
          zIndex: 1,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
      >
        <span style={{ fontSize: 16 }}>{playing ? '⏸' : '▶'}</span>
        {playing ? 'Playing…' : 'Hear it'}
      </button>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.3)',
          fontSize: 11,
          cursor: 'pointer',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          position: 'relative',
          zIndex: 1,
          padding: '4px 12px',
          transition: 'color 0.2s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
        aria-label="Continue to Mnemosyne"
      >
        Continue →
      </button>
    </div>
  );
}
