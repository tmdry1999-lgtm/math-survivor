let audioContext = null;

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
