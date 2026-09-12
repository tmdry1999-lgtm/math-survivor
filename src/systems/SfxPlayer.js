// 이 파일은 게임의 모든 효과음과 배경음악을 담당합니다.
// 별도의 음악/효과음 파일 없이, 브라우저 자체 기능(Web Audio API)으로 그때그때
// 삐-소리 같은 톤을 직접 만들어 재생하는 방식입니다. 음소거 여부도 여기서 기억합니다.
const MUTE_KEY = 'mathSurvivorMuted';

// 이전에 음소거를 켜둔 적이 있는지 저장 공간에서 읽어온다.
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

// 지금 음소거 상태인지 알려준다.
export function isMuted() {
  return muted;
}

// 음소거를 켜거나 끄고, 그 설정을 저장해서 다음에도 기억하게 한다.
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

// 소리를 만들어내는 브라우저 기능(오디오 컨텍스트)을 준비해서 돌려준다.
// 한 번만 만들어두고 계속 재사용한다.
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

// 지정한 높낮이(frequency)와 길이(duration)로 짧은 "삐" 소리를 하나 재생하는
// 가장 기본이 되는 함수. 아래의 playAttack, playHit 등이 모두 이 함수를 이용한다.
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

// 무기를 발사할 때 나는 소리.
export function playAttack() {
  playTone({ frequency: 880, duration: 0.05, type: 'square', volume: 0.04 });
}

// 적을 처치했을 때 나는 소리.
export function playHit() {
  playTone({ frequency: 220, duration: 0.08, type: 'square', volume: 0.08, glideTo: 110 });
}

// 문제를 맞혔을 때 나는 소리.
export function playCorrect() {
  playTone({ frequency: 523.25, duration: 0.12, type: 'sine', volume: 0.15, glideTo: 783.99 });
}

// 문제를 틀렸을 때 나는 소리.
export function playWrong() {
  playTone({ frequency: 220, duration: 0.18, type: 'sawtooth', volume: 0.1, glideTo: 110 });
}

// 레벨업(문제 화면이 열릴 때)할 때 나는 소리.
export function playLevelUp() {
  playTone({ frequency: 523.25, duration: 0.25, type: 'triangle', volume: 0.15, glideTo: 1046.5 });
}

// 코인을 얻었을 때 나는 소리.
export function playCoin() {
  playTone({ frequency: 988, duration: 0.1, type: 'square', volume: 0.1, glideTo: 1318.51 });
}

// 배경음악을 구성하는 부드러운 화음 한 음을 길게(3.6초) 울려준다.
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

// 배경음악을 켠다. 외부 음원 파일 없이 4개 음을 순서대로 겹쳐 울리는 아주 단순한 반복 재생이다.
export function startBackgroundMusic() {
  if (bgmIntervalId) return;
  const playNextNote = () => {
    playPadNote(BGM_CHORD[bgmNoteIndex % BGM_CHORD.length]);
    bgmNoteIndex += 1;
  };
  playNextNote();
  bgmIntervalId = window.setInterval(playNextNote, 1800);
}

// 배경음악을 멈춘다.
export function stopBackgroundMusic() {
  if (bgmIntervalId) {
    window.clearInterval(bgmIntervalId);
    bgmIntervalId = null;
  }
}
