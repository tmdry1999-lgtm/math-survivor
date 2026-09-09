const MUTE_KEY = 'mathSurvivorMuted';

function readStoredMute() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

let muted = readStoredMute();
let audioContext = null;
let bgmIntervalId = null;
let bgmNoteIndex = 0;

const BGM_CHORD = [261.63, 329.63, 392.0, 523.25]; // C4-E4-G4-C5, a soft major pad loop

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // 저장에 실패해도 음소거 자체는 이번 세션 동안 계속 적용된다
  }
  if (muted) {
    stopBackgroundMusic();
  }
}

function getContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function playTone({ frequency, duration, type = 'sine', volume = 0.15, glideTo }) {
  if (muted) return;
  const ctx = getContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
  if (glideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + duration);
  }

  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

export function playAttack() {
  playTone({ frequency: 880, duration: 0.05, type: 'square', volume: 0.04 });
}

export function playHit() {
  playTone({ frequency: 220, duration: 0.08, type: 'square', volume: 0.08, glideTo: 110 });
}

export function playCorrect() {
  playTone({ frequency: 523.25, duration: 0.12, type: 'sine', volume: 0.15, glideTo: 783.99 });
}

export function playWrong() {
  playTone({ frequency: 220, duration: 0.18, type: 'sawtooth', volume: 0.1, glideTo: 110 });
}

export function playLevelUp() {
  playTone({ frequency: 523.25, duration: 0.25, type: 'triangle', volume: 0.15, glideTo: 1046.5 });
}

export function playCoin() {
  playTone({ frequency: 988, duration: 0.1, type: 'square', volume: 0.1, glideTo: 1318.51 });
}

function playPadNote(frequency) {
  if (muted) return;
  const ctx = getContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 1.2);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3.6);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 3.6);
}

// 외부 음원 파일 없이 4개 음을 순서대로 겹쳐 울리는 아주 단순한 앰비언트 루프.
export function startBackgroundMusic() {
  if (bgmIntervalId) return;
  const playNextNote = () => {
    playPadNote(BGM_CHORD[bgmNoteIndex % BGM_CHORD.length]);
    bgmNoteIndex += 1;
  };
  playNextNote();
  bgmIntervalId = window.setInterval(playNextNote, 1800);
}

export function stopBackgroundMusic() {
  if (bgmIntervalId) {
    window.clearInterval(bgmIntervalId);
    bgmIntervalId = null;
  }
}
