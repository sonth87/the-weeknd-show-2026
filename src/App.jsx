import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  CLIPS,
  WEEKND_TRACKS,
  mapGazeToFrame,
  getGazeDirectionLabel,
} from './clipsConfig';
import { useSpriteSheetFrames } from './useSpriteSheetFrames';

export default function App() {
  const [clipIndex, setClipIndex] = useState(0);
  const [trackingMode, setTrackingMode] = useState('spatial'); // 'spatial' | 'linear'
  const [compositionMode, setCompositionMode] = useState('original'); // 'original' | 'cinema'
  const [isTransitioningClip, setIsTransitioningClip] = useState(false);
  const [isScrubberOpen, setIsScrubberOpen] = useState(false);

  // Audio player state for 5 famous The Weeknd tracks
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isMutedByUser, setIsMutedByUser] = useState(false);
  const [usingFallbackAudio, setUsingFallbackAudio] = useState(false);

  const activeClip = CLIPS[clipIndex];
  const nextClip = CLIPS[(clipIndex + 1) % CLIPS.length];
  const currentTrack = WEEKND_TRACKS[trackIndex];

  const { progress, ready, hdLoadedCount, getFrameDrawable } =
    useSpriteSheetFrames(activeClip);

  // Refs for high-frequency 60/120fps animation loop
  const heroRef = useRef(null);
  const audioRef = useRef(null);
  const mainCanvasRef = useRef(null);
  const ambientCanvasRef = useRef(null);
  const cardStageRef = useRef(null);
  const laserLayerRef = useRef(null);
  const bgMonumentRef = useRef(null);
  const bgCollageRef = useRef(null);
  const cursorFollowerRef = useRef(null);
  const playheadFillRef = useRef(null);
  const playheadThumbRef = useRef(null);
  const frameReadoutRef = useRef(null);
  const targetReadoutRef = useRef(null);
  const gazeBadgeRef = useRef(null);
  const coordReadoutRef = useRef(null);

  const animStateRef = useRef({
    currentFrame: activeClip.idleFrame,
    targetFrame: activeClip.idleFrame,
    lastBranch: 'center',
    crossfadeFromFrame: null,
    crossfadeAlpha: 0,
    isPointerInside: false,
    normX: 0,
    normY: 0,
    gazeX: 0,
    gazeY: 0,
    pointerClientX: 0,
    pointerClientY: 0,
    isScrubbingBar: false,
    manualScrubFrame: activeClip.idleFrame,
  });

  // Audio control handlers
  const toggleMusic = useCallback(
    (e) => {
      if (e) e.stopPropagation();
      const audio = audioRef.current;
      if (!audio) return;

      if (isPlayingAudio) {
        audio.pause();
        setIsPlayingAudio(false);
        setIsMutedByUser(true);
      } else {
        audio.muted = false;
        setIsMutedByUser(false);
        audio.volume = 0.78;
        audio
          .play()
          .then(() => {
            setIsPlayingAudio(true);
          })
          .catch(() => {
            setIsPlayingAudio(false);
          });
      }
    },
    [isPlayingAudio]
  );

  const nextTrack = useCallback((e) => {
    if (e) e.stopPropagation();
    setUsingFallbackAudio(false);
    setTrackIndex((prev) => (prev + 1) % WEEKND_TRACKS.length);
    setIsMutedByUser(false);
  }, []);

  const prevTrack = useCallback((e) => {
    if (e) e.stopPropagation();
    setUsingFallbackAudio(false);
    setTrackIndex(
      (prev) => (prev - 1 + WEEKND_TRACKS.length) % WEEKND_TRACKS.length
    );
    setIsMutedByUser(false);
  }, []);

  // Sync track changes and attempt auto-start
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.78;
    if (!isMutedByUser) {
      audio
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch(() => {
          setIsPlayingAudio(false);
        });
    }
  }, [trackIndex, usingFallbackAudio, isMutedByUser]);

  // Unlock audio automatically on first click/tap anywhere if not muted by user
  const handleHeroPointerDown = useCallback(() => {
    if (isMutedByUser || isPlayingAudio) return;
    const audio = audioRef.current;
    if (audio && audio.paused) {
      audio.volume = 0.78;
      audio
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch(() => {});
    }
  }, [isMutedByUser, isPlayingAudio]);

  useEffect(() => {
    const st = animStateRef.current;
    if (!st.isPointerInside) {
      st.gazeX = 0;
      st.gazeY = 0;
      st.currentFrame = activeClip.idleFrame;
      st.targetFrame = activeClip.idleFrame;
    }
  }, [activeClip]);

  const handleSwitchClip = useCallback(() => {
    setIsTransitioningClip(true);
    setTimeout(() => {
      setClipIndex((prev) => (prev + 1) % CLIPS.length);
      setTimeout(() => {
        setIsTransitioningClip(false);
      }, 180);
    }, 140);
  }, []);

  // Keyboard shortcuts: [C] switch clip, [M] mute/unmute music, [N] next song
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      if (e.code === 'KeyC') {
        e.preventDefault();
        handleSwitchClip();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMusic();
      } else if (e.code === 'KeyN') {
        e.preventDefault();
        nextTrack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSwitchClip, toggleMusic, nextTrack]);

  const updatePointerTracking = useCallback(
    (clientX, clientY) => {
      const heroEl = heroRef.current;
      if (!heroEl) return;

      const heroRect = heroEl.getBoundingClientRect();
      const stageEl = cardStageRef.current;
      const stageRect = stageEl ? stageEl.getBoundingClientRect() : heroRect;

      const faceCenterX = stageRect.left + stageRect.width * 0.5;
      const faceCenterY =
        stageRect.top + stageRect.height * (activeClip.faceAnchorY ?? 0.44);

      const spanX = Math.max(220, stageRect.width * 0.85);
      const spanY = Math.max(220, stageRect.height * 0.48);

      const nx = Math.max(-1, Math.min(1, (clientX - faceCenterX) / spanX));
      const ny = Math.max(-1, Math.min(1, (clientY - faceCenterY) / spanY));

      const st = animStateRef.current;
      st.isPointerInside = true;
      st.normX = nx;
      st.normY = ny;
      st.pointerClientX = clientX - heroRect.left;
      st.pointerClientY = clientY - heroRect.top;
    },
    [activeClip.faceAnchorY]
  );

  const handlePointerMove = useCallback(
    (e) => {
      updatePointerTracking(e.clientX, e.clientY);
    },
    [updatePointerTracking]
  );

  const handlePointerLeave = useCallback(() => {
    const st = animStateRef.current;
    st.isPointerInside = false;
    st.isScrubbingBar = false;
    st.normX = 0;
    st.normY = 0;
  }, []);

  const handleFilmstripScrub = useCallback((e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const st = animStateRef.current;
    st.manualScrubFrame = Math.round(8 + ratio * 176);
  }, []);

  // Main requestAnimationFrame loop
  useEffect(() => {
    let rafId;
    let lastTime = performance.now();

    const renderLoop = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const st = animStateRef.current;

      const gazeSpeed = st.isPointerInside ? 9.5 : 4.6;
      const gazeAlpha = 1 - Math.exp(-gazeSpeed * dt);

      const targetX = st.isPointerInside ? st.normX : 0;
      const targetY = st.isPointerInside ? st.normY : 0;

      st.gazeX += (targetX - st.gazeX) * gazeAlpha;
      st.gazeY += (targetY - st.gazeY) * gazeAlpha;

      if (!st.isPointerInside && Math.hypot(st.gazeX, st.gazeY) < 0.004) {
        st.gazeX = 0;
        st.gazeY = 0;
      }

      if (st.isScrubbingBar) {
        st.targetFrame = st.manualScrubFrame;
        const scrubAlpha = 1 - Math.exp(-14 * dt);
        st.currentFrame += (st.targetFrame - st.currentFrame) * scrubAlpha;
      } else {
        const mappedTarget = mapGazeToFrame(
          targetX,
          targetY,
          trackingMode,
          activeClip.id
        );
        const mappedSmooth = mapGazeToFrame(
          st.gazeX,
          st.gazeY,
          trackingMode,
          activeClip.id
        );

        st.targetFrame = mappedTarget.frame;

        if (
          mappedSmooth.branch !== st.lastBranch &&
          Math.abs(mappedSmooth.frame - st.currentFrame) > 8
        ) {
          st.crossfadeFromFrame = st.currentFrame;
          st.crossfadeAlpha = 1.0;
          st.currentFrame = mappedSmooth.frame;
        } else {
          const frameAlpha = 1 - Math.exp(-16 * dt);
          st.currentFrame += (mappedSmooth.frame - st.currentFrame) * frameAlpha;
        }
        st.lastBranch = mappedSmooth.branch;
      }

      if (st.crossfadeAlpha > 0) {
        st.crossfadeAlpha = Math.max(0, st.crossfadeAlpha - dt * 7.5);
      }

      const mainCanvas = mainCanvasRef.current;
      if (mainCanvas) {
        const ctx = mainCanvas.getContext('2d');
        const cw = mainCanvas.width;
        const ch = mainCanvas.height;

        const floorIdx = Math.floor(st.currentFrame);
        const ceilIdx = Math.ceil(st.currentFrame);
        const frac = st.currentFrame - floorIdx;

        const baseDrawable = getFrameDrawable(floorIdx);
        if (baseDrawable) {
          ctx.globalAlpha = 1;
          ctx.drawImage(baseDrawable, 0, 0, cw, ch);

          if (ceilIdx !== floorIdx && frac > 0.02) {
            const nextDrawable = getFrameDrawable(ceilIdx);
            if (nextDrawable && nextDrawable !== baseDrawable) {
              ctx.globalAlpha = frac;
              ctx.drawImage(nextDrawable, 0, 0, cw, ch);
              ctx.globalAlpha = 1;
            }
          }

          if (st.crossfadeAlpha > 0.01 && st.crossfadeFromFrame !== null) {
            const prevDrawable = getFrameDrawable(
              Math.round(st.crossfadeFromFrame)
            );
            if (prevDrawable && prevDrawable !== baseDrawable) {
              ctx.globalAlpha = st.crossfadeAlpha;
              ctx.drawImage(prevDrawable, 0, 0, cw, ch);
              ctx.globalAlpha = 1;
            }
          }
        }

        const ambientCanvas = ambientCanvasRef.current;
        if (ambientCanvas) {
          const actx = ambientCanvas.getContext('2d');
          actx.drawImage(
            mainCanvas,
            0,
            0,
            ambientCanvas.width,
            ambientCanvas.height
          );
        }
      }

      // 3D micro-parallax on centered character stage
      if (cardStageRef.current) {
        const rotY = st.gazeX * 4.2;
        const rotX = -st.gazeY * 3.4;
        const shiftX = st.gazeX * -8;
        const shiftY = st.gazeY * -6;
        const scale = st.isPointerInside ? 1.012 : 1.0;
        cardStageRef.current.style.transform = `perspective(1200px) translate3d(${shiftX.toFixed(
          2
        )}px, ${shiftY.toFixed(2)}px, 0) rotateX(${rotX.toFixed(
          2
        )}deg) rotateY(${rotY.toFixed(2)}deg) scale(${scale})`;
      }

      // Parallax on background THE WEEKND / XO monument & Blood Moon
      if (bgMonumentRef.current) {
        const mx = st.gazeX * 22;
        const my = st.gazeY * 14;
        bgMonumentRef.current.style.transform = `translate3d(${mx.toFixed(
          1
        )}px, ${my.toFixed(1)}px, 0)`;
      }

      // Counter-parallax on background floating tour photo collage
      if (bgCollageRef.current) {
        const cx = st.gazeX * -18;
        const cy = st.gazeY * -12;
        bgCollageRef.current.style.transform = `translate3d(${cx.toFixed(
          1
        )}px, ${cy.toFixed(1)}px, 0)`;
      }

      // Dynamic stadium laser sweep
      if (laserLayerRef.current) {
        const laserAngle = st.gazeX * 14;
        const laserShift = st.gazeX * 32;
        laserLayerRef.current.style.transform = `translate3d(${laserShift.toFixed(
          1
        )}px, 0, 0) rotate(${laserAngle.toFixed(2)}deg)`;
      }

      // Custom XO cursor reticle
      if (cursorFollowerRef.current) {
        cursorFollowerRef.current.style.transform = `translate3d(${st.pointerClientX.toFixed(
          1
        )}px, ${st.pointerClientY.toFixed(1)}px, 0)`;
        cursorFollowerRef.current.style.opacity = st.isPointerInside ? '1' : '0';
      }

      // Live sprite sheet scrubber playhead & telemetry readouts
      const displayFrame = Math.round(st.currentFrame);
      const sheetProgress = Math.max(
        0,
        Math.min(100, ((st.currentFrame - 8) / 176) * 100)
      );

      if (playheadFillRef.current) {
        playheadFillRef.current.style.width = `${sheetProgress.toFixed(2)}%`;
      }
      if (playheadThumbRef.current) {
        playheadThumbRef.current.style.left = `${sheetProgress.toFixed(2)}%`;
      }
      if (frameReadoutRef.current) {
        frameReadoutRef.current.textContent = String(displayFrame + 1).padStart(
          3,
          '0'
        );
      }
      if (targetReadoutRef.current) {
        targetReadoutRef.current.textContent = String(
          Math.round(st.targetFrame) + 1
        ).padStart(3, '0');
      }
      if (gazeBadgeRef.current) {
        gazeBadgeRef.current.textContent = getGazeDirectionLabel(
          st.gazeX,
          st.gazeY,
          st.isPointerInside
        );
        gazeBadgeRef.current.dataset.active = st.isPointerInside
          ? 'true'
          : 'false';
      }
      if (coordReadoutRef.current) {
        if (st.isPointerInside) {
          const xStr =
            (st.normX >= 0 ? '+' : '') + Math.round(st.normX * 100) + '%';
          const yStr =
            (st.normY >= 0 ? '+' : '') + Math.round(st.normY * 100) + '%';
          coordReadoutRef.current.textContent = `X ${xStr} · Y ${yStr}`;
        } else {
          coordReadoutRef.current.textContent = 'IDLE LOCK (FRAME 001)';
        }
      }

      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [getFrameDrawable, trackingMode, activeClip.id]);

  return (
    <main
      ref={heroRef}
      className={`hero-viewport ${
        compositionMode === 'cinema' ? 'mode-cinema' : 'mode-original'
      }`}
      style={{
        '--accent-color': activeClip.accentColor,
        '--gold-color': activeClip.goldColor,
        '--accent-glow': activeClip.accentGlow,
        '--secondary-glow': activeClip.secondaryGlow,
      }}
      onPointerDown={handleHeroPointerDown}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* Hidden Audio Element Playing 5 Famous Hits by The Weeknd */}
      <audio
        ref={audioRef}
        src={
          usingFallbackAudio
            ? currentTrack.fallbackUrl
            : currentTrack.streamUrl
        }
        loop
        preload="auto"
        onPlay={() => setIsPlayingAudio(true)}
        onPause={() => setIsPlayingAudio(false)}
        onError={() => {
          if (!usingFallbackAudio) {
            setUsingFallbackAudio(true);
          }
        }}
      />

      {/* ================= ICONIC THE WEEKND STADIUM BACKGROUND LAYER ================= */}
      <div className="ambient-backdrop" aria-hidden="true">
        <canvas
          ref={ambientCanvasRef}
          width={135}
          height={240}
          className="ambient-canvas"
        />

        {/* Volumetric Stadium Laser Beams */}
        <div ref={laserLayerRef} className="stadium-laser-beams">
          <span className="laser-beam beam-1" />
          <span className="laser-beam beam-2" />
          <span className="laser-beam beam-3" />
        </div>

        {/* Scrolling Stadium LED Ticker Tape in Deep Background */}
        <div className="xo-bg-ticker-wrap">
          <div className="xo-bg-ticker">
            <span>
              THE WEEKND ✦ X ♥ O ✦ AFTER HOURS TIL DAWN ASIA STADIUM TOUR ✦ THE
              FINAL LEG BEFORE SHUTDOWN ✦ RAJAMANGALA STADIUM BANGKOK 13.10 ✦
              TOKYO ✦ JAKARTA ✦ SINGAPORE ✦ SEOUL ✦ BANGKOK ✦ HONG KONG ✦ KUALA
              LUMPUR ✦ BLINDING LIGHTS ✦ STARBOY ✦ SAVE YOUR TEARS ✦ CAN&apos;T
              FEEL MY FACE ✦ TAKE MY BREATH ✦ HAJIME SORAYAMA GOLD MONOLITH
              ✦&nbsp;
            </span>
            <span>
              THE WEEKND ✦ X ♥ O ✦ AFTER HOURS TIL DAWN ASIA STADIUM TOUR ✦ THE
              FINAL LEG BEFORE SHUTDOWN ✦ RAJAMANGALA STADIUM BANGKOK 13.10 ✦
              TOKYO ✦ JAKARTA ✦ SINGAPORE ✦ SEOUL ✦ BANGKOK ✦ HONG KONG ✦ KUALA
              LUMPUR ✦ BLINDING LIGHTS ✦ STARBOY ✦ SAVE YOUR TEARS ✦ CAN&apos;T
              FEEL MY FACE ✦ TAKE MY BREATH ✦ HAJIME SORAYAMA GOLD MONOLITH
              ✦&nbsp;
            </span>
          </div>
        </div>

        {/* Monumental "THE WEEKND" + Red Inflatable Tour Moon + ASIA Cyan Chrome Motif */}
        <div ref={bgMonumentRef} className="xo-bg-monument-layer">
          {/* Iconic Giant Red Inflatable Moon from After Hours Til Dawn Tour */}
          <div className="xo-blood-moon">
            <div className="moon-craters" />
            <span className="moon-xo-mark">X♥O</span>
          </div>

          {/* Iconic "A S I A" (AFTER / HOURS / TIL / DAWN) Cyan Chrome Motif from Asia Tour Poster */}
          <div className="asia-chrome-row">
            <div className="asia-chrome-item">
              <span className="asia-chrome-letter">A</span>
              <span className="asia-chrome-cross">AFTER</span>
            </div>
            <div className="asia-chrome-item">
              <span className="asia-chrome-letter">S</span>
              <span className="asia-chrome-cross">HOURS</span>
            </div>
            <div className="asia-chrome-item">
              <span className="asia-chrome-letter">I</span>
              <span className="asia-chrome-cross">TIL</span>
            </div>
            <div className="asia-chrome-item">
              <span className="asia-chrome-letter">A</span>
              <span className="asia-chrome-cross">DAWN</span>
            </div>
          </div>

          <div className="giant-weeknd-wordmark">THE WEEKND</div>
          <div className="giant-tour-submark">
            X ♥ O · AFTER HOURS TIL DAWN · THE FINAL LEG BEFORE SHUTDOWN · BKK
            13.10
          </div>
        </div>

        {/* Floating Tour Photo Cards & Iconic XO Symbols in Background */}
        <div ref={bgCollageRef} className="xo-bg-photo-collage">
          {/* Top-Left Photo Card: Golden Sorayama Gynoid Statue from Bangkok Show */}
          <div className="bg-artifact-card card-sorayama">
            <div className="artifact-img-wrap">
              <img
                src="/sprites/xo/sorayama-statue.jpg"
                alt="Hajime Sorayama Gold Gynoid Statue at Bangkok Show"
              />
              <span className="artifact-tag">SORAYAMA GYNOID · BKK</span>
            </div>
            <div className="artifact-caption">
              <span>HAJIME SORAYAMA MONOLITH</span>
              <strong>RAJAMANGALA RUNWAY · 13.10</strong>
            </div>
          </div>

          {/* Mid-Left Photo Card: Official ASIA Global Stadium Tour Poster */}
          <div className="bg-artifact-card card-asia-poster">
            <div className="artifact-img-wrap">
              <img
                src="/sprites/xo/asia-tour-poster.png"
                alt="The Weeknd Asia Global Stadium Tour Poster"
              />
              <span className="artifact-tag tag-cyan">ASIA TOUR POSTER</span>
            </div>
            <div className="artifact-caption">
              <span>THE FINAL LEG BEFORE SHUTDOWN</span>
              <strong>GLOBAL STADIUM TOUR · ASIA</strong>
            </div>
          </div>

          {/* Bottom-Left Photo Card: Spinning Vinyl Record + Track Sleeve */}
          <div
            className={`bg-artifact-card card-vinyl ${
              isPlayingAudio ? 'is-spinning' : ''
            }`}
          >
            <div className="vinyl-record-visual">
              <div className="vinyl-disc">
                <div className="vinyl-grooves" />
                <span className="vinyl-center-label">X♥O</span>
              </div>
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                onError={(e) => {
                  e.currentTarget.src = '/sprites/xo/weeknd-asia-portrait.jpg';
                }}
                className="vinyl-sleeve-img"
              />
            </div>
            <div className="artifact-caption">
              <span>
                THE WEEKND · {currentTrack.album.toUpperCase()} ({currentTrack.bpm})
              </span>
              <strong>{currentTrack.title.toUpperCase()}</strong>
            </div>
          </div>

          {/* Top-Right Photo Card: Rajamangala Stadium Panorama */}
          <div className="bg-artifact-card card-stadium">
            <div className="artifact-img-wrap">
              <img
                src="/sprites/xo/stadium-stage.jpg"
                alt="Rajamangala National Stadium Bangkok 13/10"
              />
              <span className="artifact-tag">SOLD OUT · 65,000</span>
            </div>
            <div className="artifact-caption">
              <span>RAJAMANGALA NATIONAL STADIUM</span>
              <strong>BANGKOK, THAILAND · 13 OCT</strong>
            </div>
          </div>

          {/* Bottom-Right Artifact: Iconic XO + Starboy Cross + BKK VIP Ticket */}
          <div className="bg-artifact-card card-ticket">
            <div className="ticket-neon-row">
              <span className="neon-xo-badge">X ♥ O</span>
              <span className="neon-starboy-cross" title="Starboy Cross">
                ✞
              </span>
              <span className="neon-fm-freq">103.5 FM</span>
            </div>
            <div className="ticket-stub-body">
              <span className="ticket-tour">
                THE WEEKND · AFTER HOURS TIL DAWN
              </span>
              <strong className="ticket-venue">
                RAJAMANGALA STADIUM · PITCH A1
              </strong>
              <span className="ticket-serial">
                OCT 13 · BANGKOK · VIP GOLDEN CIRCLE
              </span>
            </div>
          </div>
        </div>

        <div className="ambient-vignette" />
        <div className="ambient-grain" />
      </div>

      {/* Custom XO Cursor Reticle */}
      <div
        ref={cursorFollowerRef}
        className="cursor-reticle"
        aria-hidden="true"
      >
        <span className="cursor-reticle-dot" />
        <span className="cursor-reticle-ring" />
      </div>

      {/* Top XO Tour Navigation Bar */}
      <header className="hero-topbar">
        <div className="brand-cluster">
          <div className="xo-emblem" aria-label="XO Emblem">
            <span>X</span>
            <span className="xo-heart">♥</span>
            <span>O</span>
          </div>
          <span className="brand-divider" />
          <div className="brand-titles">
            <span className="brand-eyebrow">THE WEEKND · LIVE IN BANGKOK</span>
            <h1 className="brand-name">
              AFTER HOURS TIL DAWN · RAJAMANGALA 13.10
            </h1>
          </div>
        </div>

        <div
          className="topbar-controls"
          onPointerMove={(e) => e.stopPropagation()}
        >
          {/* PROMINENT 5-TRACK MUSIC PLAYER & MUTE/UNMUTE ICON BUTTON */}
          <div className="music-control-cluster">
            <button
              type="button"
              className="track-nav-btn"
              onClick={prevTrack}
              title="Bài trước"
              aria-label="Previous The Weeknd track"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="19 20 9 12 19 4 19 20" />
                <line x1="5" y1="19" x2="5" y2="5" />
              </svg>
            </button>

            <button
              type="button"
              className={`music-toggle-btn ${
                isPlayingAudio ? 'is-playing' : 'is-muted'
              }`}
              onClick={toggleMusic}
              title={
                isPlayingAudio
                  ? 'Tắt nhạc (Phím M)'
                  : `Bật nhạc ${currentTrack.title} - The Weeknd (Phím M)`
              }
              aria-label={isPlayingAudio ? 'Mute music' : 'Play music'}
            >
              <span className="music-icon-wrap" aria-hidden="true">
                {isPlayingAudio ? (
                  /* Speaker Volume On Icon */
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                ) : (
                  /* Speaker Muted Icon */
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                )}
              </span>

              <div className="music-btn-labels">
                <span className="music-btn-status">
                  {isPlayingAudio
                    ? `ON AIR · ${trackIndex + 1}/${WEEKND_TRACKS.length}`
                    : `MUTED · ${trackIndex + 1}/${WEEKND_TRACKS.length}`}
                </span>
                <span className="music-btn-song">{currentTrack.title}</span>
              </div>

              <div
                className={`mini-eq ${isPlayingAudio ? 'is-active' : ''}`}
                aria-hidden="true"
              >
                <span />
                <span />
                <span />
                <span />
              </div>
            </button>

            <button
              type="button"
              className="track-nav-btn"
              onClick={nextTrack}
              title="Bài tiếp theo (Phím N): Blinding Lights / Starboy / Save Your Tears / Can't Feel My Face / Take My Breath"
              aria-label="Next The Weeknd track"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" />
              </svg>
            </button>
          </div>

          <div
            className="control-pill-group"
            role="group"
            aria-label="Tracking Mode"
          >
            <button
              type="button"
              className={`control-pill ${
                trackingMode === 'spatial' ? 'is-active' : ''
              }`}
              onClick={() => setTrackingMode('spatial')}
            >
              360° Gaze
            </button>
            <button
              type="button"
              className={`control-pill ${
                trackingMode === 'linear' ? 'is-active' : ''
              }`}
              onClick={() => setTrackingMode('linear')}
            >
              Linear Scrub
            </button>
          </div>

          <div
            className="control-pill-group"
            role="group"
            aria-label="Framing Mode"
          >
            <button
              type="button"
              className={`control-pill ${
                compositionMode === 'original' ? 'is-active' : ''
              }`}
              onClick={() => setCompositionMode('original')}
            >
              9:16 Pass
            </button>
            <button
              type="button"
              className={`control-pill ${
                compositionMode === 'cinema' ? 'is-active' : ''
              }`}
              onClick={() => setCompositionMode('cinema')}
            >
              Full Stage
            </button>
          </div>
        </div>
      </header>

      {/* Main 3-Column XO Stadium Stage */}
      <section className="hero-stage-grid">
        {/* Left Tour Editorial Column */}
        <aside className="hero-editorial-left">
          <div className="clip-tag-row">
            <span className="clip-badge">{activeClip.badgeText}</span>
            <span className="clip-date-pill">{activeClip.dateBadge}</span>
            <span className="final-leg-inline-pill">
              THE FINAL LEG BEFORE SHUTDOWN
            </span>
          </div>

          <p className="tour-act-label">{activeClip.tourAct}</p>
          <h2 className="editorial-headline">{activeClip.title}</h2>
          <p className="editorial-venue">{activeClip.venueLine}</p>
          <p className="editorial-subtitle">{activeClip.subtitle}</p>
          <p className="editorial-description">{activeClip.description}</p>

          {/* Special Guests Bar from the ASIA Tour Poster */}
          <div className="editorial-guests-strip">
            <span className="guests-strip-label">SPECIAL GUESTS:</span>
            <span className="guests-strip-names">
              *CREEPY NUTS · **¥ØU$UK€ ¥UK1MAT$U
            </span>
          </div>

          {/* Live Telemetry Readout Card */}
          <div className="telemetry-panel">
            <div className="telemetry-header">
              <span
                ref={gazeBadgeRef}
                className="gaze-status-badge"
                data-active="false"
              >
                IDLE · CENTER GAZE
              </span>
              <span ref={coordReadoutRef} className="coord-readout">
                IDLE LOCK (FRAME 001)
              </span>
            </div>

            <div className="telemetry-metrics">
              <div className="metric-box">
                <span className="metric-label">SPRITE FRAME</span>
                <div className="metric-value-row">
                  <span ref={frameReadoutRef} className="metric-number">
                    001
                  </span>
                  <span className="metric-total">/ {activeClip.totalFrames}</span>
                </div>
              </div>

              <div className="metric-box">
                <span className="metric-label">TARGET INDEX</span>
                <div className="metric-value-row">
                  <span ref={targetReadoutRef} className="metric-number">
                    001
                  </span>
                  <span className="metric-total">IDLE 001</span>
                </div>
              </div>

              <div className="metric-box">
                <span className="metric-label">STAGE STREAM</span>
                <div className="metric-value-row">
                  <span className="metric-number">{progress}%</span>
                  <span className="metric-total">
                    {hdLoadedCount >= 180 ? 'HD READY' : 'SYNCING'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Centered Character Composition Stage */}
        <div className="character-center-column">
          <div
            ref={cardStageRef}
            className={`character-frame-stage ${
              isTransitioningClip ? 'is-switching' : ''
            }`}
          >
            {/* Top VIP Pass Overlay Inside Frame */}
            <div className="stage-top-hud">
              <span className="rec-pill">
                <span className="rec-dot" />
                THE WEEKND · BKK 13.10
              </span>
              <span className="xo-watermark">X ♥ O</span>
            </div>

            {/* Subtle Corner Reticles Holding the Original Composition */}
            <span className="frame-corner corner-tl" aria-hidden="true" />
            <span className="frame-corner corner-tr" aria-hidden="true" />
            <span className="frame-corner corner-bl" aria-hidden="true" />
            <span className="frame-corner corner-br" aria-hidden="true" />

            {/* High-Priority LCP Poster Fallback */}
            <img
              src={activeClip.posterUrl}
              alt={activeClip.title}
              fetchPriority="high"
              width={540}
              height={960}
              className={`character-poster-fallback ${ready ? 'is-hidden' : ''}`}
            />

            {/* Primary Frame-Based Sprite Sheet Animation Canvas */}
            <canvas
              ref={mainCanvasRef}
              width={activeClip.hdFrameWidth}
              height={activeClip.hdFrameHeight}
              className="character-main-canvas"
            />

            {/* Bottom Stage Caption */}
            <div className="stage-overlay-pill">
              <span className="overlay-dot" />
              <span>{activeClip.stageLabel}</span>
            </div>
          </div>
        </div>

        {/* Right Column: ASIA Tour Stops Card + XO Stadium Gaze Compass */}
        <aside className="hero-editorial-right">
          <div className="right-cards-stack">
            {/* Added Detail from Poster: Official ASIA Stadium Tour Stops */}
            <div className="asia-stops-card">
              <div className="asia-stops-header">
                <span className="asia-stops-title">ASIA STADIUM TOUR</span>
                <span className="asia-stops-tag">FINAL LEG</span>
              </div>
              <div className="asia-stops-grid">
                <div className="asia-stop-row">
                  <strong>TOKYO*</strong>
                  <span>20 SEPT</span>
                </div>
                <div className="asia-stop-row">
                  <strong>JAKARTA*</strong>
                  <span>26–27 SEPT</span>
                </div>
                <div className="asia-stop-row">
                  <strong>SINGAPORE*</strong>
                  <span>2–3 OCT</span>
                </div>
                <div className="asia-stop-row">
                  <strong>*SEOUL</strong>
                  <span>7–8 OCT</span>
                </div>
                <div className="asia-stop-row is-bkk-active">
                  <strong>*BANGKOK ●</strong>
                  <span>11 &amp; 13 OCT</span>
                </div>
                <div className="asia-stop-row">
                  <strong>HONG KONG</strong>
                  <span>30–31 OCT</span>
                </div>
                <div className="asia-stop-row">
                  <strong>**KUALA LUMPUR</strong>
                  <span>4 NOV</span>
                </div>
              </div>
            </div>

            {/* Original XO Stadium Gaze Compass Card */}
            <div className="compass-card">
              <div className="compass-title-row">
                <span className="compass-title">XO STADIUM GAZE</span>
                <span className="compass-meta">240F SPRITE</span>
              </div>
              <div className="compass-grid">
                <div className="compass-cell">
                  <span className="cell-dir">↖ UPPER-LEFT</span>
                  <span className="cell-frame">F·067–092</span>
                </div>
                <div className="compass-cell">
                  <span className="cell-dir">↗ UPPER-RIGHT</span>
                  <span className="cell-frame">
                    {activeClip.id === 'clip1' ? 'F·108–124' : 'F·167–186'}
                  </span>
                </div>
                <div className="compass-cell is-center">
                  <span className="cell-dir">★ CENTER IDLE POSE</span>
                  <span className="cell-frame">FRAME 001</span>
                </div>
                <div className="compass-cell">
                  <span className="cell-dir">← PITCH LEFT</span>
                  <span className="cell-frame">F·001–029</span>
                </div>
                <div className="compass-cell">
                  <span className="cell-dir">→ PITCH RIGHT</span>
                  <span className="cell-frame">F·101–127</span>
                </div>
                <div className="compass-cell">
                  <span className="cell-dir">↙ STAGE LEFT</span>
                  <span className="cell-frame">F·029–046</span>
                </div>
                <div className="compass-cell">
                  <span className="cell-dir">↘ STAGE RIGHT</span>
                  <span className="cell-frame">F·127–145</span>
                </div>
              </div>

              <div className="tour-coords-footer">
                <span>{activeClip.coordinates}</span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {/* Bottom Bar: Collapsible Sprite Sheet Scrubber (Hidden by Default) + Bottom-Right Clip Switcher Button */}
      <footer className="hero-bottombar">
        <div
          className={`scrubber-drawer-wrap ${
            isScrubberOpen ? 'is-open' : 'is-collapsed'
          }`}
          onPointerMove={(e) => e.stopPropagation()}
        >
          <div className="scrubber-slide-panel">
            <div
              className="spritesheet-scrubber-card"
              onPointerDown={(e) => {
                animStateRef.current.isScrubbingBar = true;
                handleFilmstripScrub(e);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) {
                  animStateRef.current.isScrubbingBar = true;
                  handleFilmstripScrub(e);
                }
              }}
              onPointerUp={() => {
                animStateRef.current.isScrubbingBar = false;
              }}
            >
              <div className="scrubber-label-row">
                <span className="scrubber-title">
                  FFMPEG HORIZONTAL SPRITE SHEET (240×1 STRIP)
                </span>
                <span className="scrubber-hint">
                  THE WEEKND · AFTER HOURS TIL DAWN · BKK 13.10
                </span>
              </div>

              <div
                className="scrubber-strip-viewport"
                style={{
                  backgroundImage: `url(${activeClip.previewStripUrl})`,
                }}
              >
                <div ref={playheadFillRef} className="scrubber-progress-fill" />
                <div
                  className="scrubber-idle-marker"
                  title="Idle Pose (Frame 097)"
                />
                <div ref={playheadThumbRef} className="scrubber-playhead" />
              </div>
            </div>
          </div>

          <button
            type="button"
            className="scrubber-drawer-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setIsScrubberOpen((prev) => !prev);
            }}
            title={
              isScrubberOpen
                ? 'Thu gọn thanh Sprite Sheet'
                : 'Mở thanh FFmpeg Sprite Sheet (240×1)'
            }
            aria-expanded={isScrubberOpen}
            aria-label="Toggle FFmpeg Sprite Sheet Scrubber"
          >
            <svg
              className="toggle-film-icon"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="6" y1="4" x2="6" y2="20" />
              <line x1="18" y1="4" x2="18" y2="20" />
              <line x1="2" y1="9" x2="6" y2="9" />
              <line x1="2" y1="15" x2="6" y2="15" />
              <line x1="18" y1="9" x2="22" y2="9" />
              <line x1="18" y1="15" x2="22" y2="15" />
            </svg>
            <span className="toggle-chevron">
              {isScrubberOpen ? '‹' : '›'}
            </span>
          </button>
        </div>

        {/* REQUIRED: Button at Bottom-Right to Switch the 2 Resource Clips */}
        <button
          type="button"
          className="clip-switch-button"
          onClick={handleSwitchClip}
          onPointerMove={(e) => e.stopPropagation()}
          aria-label={`Switch resource clip to ${nextClip.title}`}
        >
          <div className="switch-thumb-wrapper">
            <img
              src={nextClip.thumbUrl}
              alt={nextClip.title}
              width={48}
              height={64}
              className="switch-thumb-img"
            />
            <span className="switch-index-pill">
              {activeClip.indexLabel} / 02
            </span>
          </div>

          <div className="switch-text-col">
            <span className="switch-eyebrow">SWITCH XO SCENE · [C]</span>
            <span className="switch-clip-name">{nextClip.title}</span>
            <span className="switch-clip-meta">
              {nextClip.venueLine} ({nextClip.originalResolution})
            </span>
          </div>

          <div className="switch-icon-circle" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 10l5-6 5 6" />
              <path d="M17 14l-5 6-5-6" />
            </svg>
          </div>
        </button>
      </footer>
    </main>
  );
}
