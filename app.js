/**
 * A.X.E.L. - Interactive 3D Cyber Robot Companion
 * Core Engine: 3D Three.js Kinematics, Web Audio Synthesis, Particle System, Mini-Games & Modern 3D Control Matrix
 */

import { Robot3DViewer } from './robot3d.js';

// =========================================================================
// 1. Audio Synthesis Engine (Web Audio API + Speech Synthesis)
// =========================================================================
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.hasInteracted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.hasInteracted = true;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (window.speechSynthesis && this.isMuted) {
      window.speechSynthesis.cancel();
    }
    return this.isMuted;
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.15, delay = 0) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const startTime = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  playChirp() {
    if (this.isMuted) return;
    this.init();
    const notes = [587, 784, 988, 1175];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'sine', 0.1, 0.12, idx * 0.05);
    });
  }

  playPurr() {
    if (this.isMuted) return;
    this.init();
    for (let i = 0; i < 6; i++) {
      this.playTone(180 + Math.sin(i) * 30, 'triangle', 0.08, 0.08, i * 0.07);
    }
  }

  playPowerUp() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const start = this.ctx.currentTime;
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, start);
    osc.frequency.exponentialRampToValueAtTime(880, start + 0.45);

    gain.gain.setValueAtTime(0.08, start);
    gain.gain.linearRampToValueAtTime(0.15, start + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  }

  playBuzzer() {
    if (this.isMuted) return;
    this.init();
    this.playTone(160, 'sawtooth', 0.35, 0.2);
  }

  playFanfare() {
    if (this.isMuted) return;
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'triangle', 0.25, 0.16, idx * 0.12);
    });
  }

  playSimonTone(padIndex) {
    const frequencies = [329.63, 392.00, 440.00, 587.33];
    const freq = frequencies[padIndex] || 440;
    this.playTone(freq, 'sine', 0.3, 0.22);
  }

  playCustomSynth(pitch, tempo) {
    if (this.isMuted) return;
    this.init();
    const baseFreq = Number(pitch) || 550;
    const stepTime = (Number(tempo) || 180) / 1000;
    const chord = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2];
    chord.forEach((freq, idx) => {
      this.playTone(freq, 'square', stepTime, 0.08, idx * (stepTime * 0.6));
    });
  }

  speak(text, onStart, onEnd) {
    if (this.isMuted) {
      if (onStart) onStart();
      setTimeout(() => { if (onEnd) onEnd(); }, 1800);
      return;
    }
    this.init();

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.pitch = 1.35; // robotic tone
      
      const voices = window.speechSynthesis.getVoices();
      const robotVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Robot')));
      if (robotVoice) utterance.voice = robotVoice;

      utterance.onstart = () => { if (onStart) onStart(); };
      utterance.onend = () => { if (onEnd) onEnd(); };
      utterance.onerror = () => { if (onEnd) onEnd(); };

      window.speechSynthesis.speak(utterance);
    } else {
      this.playChirp();
      if (onStart) onStart();
      setTimeout(() => { if (onEnd) onEnd(); }, 1500);
    }
  }
}

const audio = new AudioEngine();

// =========================================================================
// 2. Interactive Background Particle Canvas
// =========================================================================
class ParticleSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.sparks = [];
    this.mouse = { x: -1000, y: -1000 };
    this.resize();
    this.initParticles();

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
    window.addEventListener('click', (e) => {
      this.emitSparks(e.clientX, e.clientY, 14);
    });

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  resize() {
    if (!this.canvas) return;
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  getThemeColor() {
    const theme = document.body.getAttribute('data-theme') || 'cyan';
    switch (theme) {
      case 'magenta': return '#ff007f';
      case 'emerald': return '#10b981';
      case 'amber': return '#f59e0b';
      case 'violet': return '#a855f7';
      default: return '#00f0ff';
    }
  }

  initParticles() {
    const count = Math.min(Math.floor(window.innerWidth / 20), 65);
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        alpha: Math.random() * 0.4 + 0.2
      });
    }
  }

  emitSparks(x, y, count = 10) {
    const color = this.getThemeColor();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 2.5 + 1.5,
        color,
        alpha: 1,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  }

  animate() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
    const themeColor = this.getThemeColor();

    this.ctx.fillStyle = themeColor;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      const dx = this.mouse.x - p.x;
      const dy = this.mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        const force = (120 - dist) / 120;
        p.x -= (dx / dist) * force * 3;
        p.y -= (dy / dist) * force * 3;
      }

      this.ctx.globalAlpha = p.alpha;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.alpha -= s.decay;

      if (s.alpha <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }

      this.ctx.globalAlpha = s.alpha;
      this.ctx.fillStyle = s.color;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.globalAlpha = 1.0;
    requestAnimationFrame(this.animate);
  }
}

// =========================================================================
// 3. Robot Character & Telemetry Controller
// =========================================================================
class RobotController {
  constructor(viewer) {
    this.viewer = viewer;
    this.avatarEl = document.getElementById('robotAvatar');
    this.speechText = document.getElementById('speechText');
    this.speechBubble = document.getElementById('speechBubble');

    // Metrics
    this.energy = 98;
    this.happiness = 100;
    this.currentMood = 'curious';

    this.startMetricsTimer();
  }

  setMood(mood) {
    this.currentMood = mood;
    const moodTextEl = document.getElementById('moodStatusText');
    if (moodTextEl) moodTextEl.textContent = mood.toUpperCase();

    document.querySelectorAll('.mood-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mood') === mood);
    });

    switch (mood) {
      case 'happy':
        if (this.viewer) this.viewer.triggerReaction('bounce');
        audio.playChirp();
        break;

      case 'love':
        if (this.viewer) this.viewer.triggerReaction('bounce');
        audio.playPurr();
        break;

      case 'thinking':
        audio.playTone(660, 'sine', 0.2, 0.1);
        break;

      case 'party':
        if (this.viewer) this.viewer.triggerReaction('dance');
        audio.playCustomSynth(600, 120);
        break;

      case 'sleepy':
        if (this.viewer) this.viewer.stopAnimation();
        audio.playTone(180, 'sine', 0.4, 0.08);
        break;

      case 'curious':
      default:
        if (this.viewer) this.viewer.startAnimation();
        break;
    }
  }

  poke() {
    if (this.viewer) this.viewer.triggerReaction('poke');
    this.happiness = Math.min(100, this.happiness + 5);
    this.updateMetricsUI();
    audio.playChirp();

    const quips = [
      "Hehe! Capacitive touch sensors registered your poke!",
      "Boop! A.X.E.L. 3D Unit operational and fully responsive!",
      "System check: 100% happy! Orbit around to inspect my armor!",
      "Beep boop! Sensor poke detected. +5 Happiness Index!",
      "Warning: High levels of human interaction detected!"
    ];
    const randomQuip = quips[Math.floor(Math.random() * quips.length)];
    this.say(randomQuip, 'happy');
  }

  say(message, moodOverride = null) {
    if (moodOverride) {
      this.setMood(moodOverride);
    }

    if (this.speechText) this.speechText.textContent = message;
    if (this.speechBubble) {
      this.speechBubble.style.transform = 'scale(1.04)';
      setTimeout(() => {
        if (this.speechBubble) this.speechBubble.style.transform = 'scale(1)';
      }, 250);
    }

    audio.speak(message);
  }

  recharge() {
    this.energy = 100;
    this.updateMetricsUI();
    if (this.viewer) this.viewer.triggerReaction('recharge');
    audio.playPowerUp();
    this.say("⚡ Energy reactor recharged to MAXIMUM! All 3D servos nominal!", 'happy');
  }

  pet() {
    this.happiness = 100;
    this.updateMetricsUI();
    if (this.viewer) this.viewer.triggerReaction('bounce');
    audio.playPurr();
    this.say("Awww! Purr... I really enjoy when you interact with my titanium armor plates!", 'love');
  }

  danceParty() {
    this.setMood('party');
    if (this.viewer) this.viewer.triggerReaction('dance');
    this.say("DISCO PROTOCOL INITIATED! Dropping holographic cyber beats!", 'party');
    let beats = 0;
    const beatInterval = setInterval(() => {
      beats++;
      audio.playCustomSynth(450 + (beats % 4) * 120, 100);
      if (beats >= 12) {
        clearInterval(beatInterval);
      }
    }, 220);
  }

  tellJoke() {
    const jokes = [
      "Why do robots never panic? Because they have nerves of steel!",
      "There are 10 types of people: those who understand binary, and those who don't!",
      "Why did the 3D robot visit the renderer? To fix its polygon count!",
      "How do robots eat pizza? One byte at a time!",
      "What is a robot's favorite type of music? Heavy metal!",
      "Why was the computer cold? It forgot to close its Windows!"
    ];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    this.say(joke, 'happy');
  }

  tellTrivia() {
    const facts = [
      "This 3D robot model features 100 separate meshes and over 20,000 polygons rendered in real time!",
      "The fastest industrial robot arm can accelerate up to 40G — faster than a cheetah!",
      "Voyager 1 is the farthest robotic explorer in space, over 15 billion miles away from Earth!",
      "Robots on Mars use ultraviolet lasers to vaporize rock samples for spectral analysis!"
    ];
    const fact = facts[Math.floor(Math.random() * facts.length)];
    this.say(fact, 'thinking');
  }

  highFive() {
    if (this.viewer) this.viewer.triggerReaction('bounce');
    this.happiness = Math.min(100, this.happiness + 8);
    this.updateMetricsUI();
    audio.playFanfare();
    this.say("CLAP! High five, partner! 3D neural link synchronization is at 100%!", 'happy');
  }

  startMetricsTimer() {
    setInterval(() => {
      if (this.energy > 15) {
        this.energy -= 1;
      } else if (this.energy <= 15 && this.currentMood !== 'sleepy') {
        this.setMood('sleepy');
        this.say("My battery levels are critically low... Please click Recharge!", 'sleepy');
      }
      this.updateMetricsUI();
    }, 12000);
  }

  updateMetricsUI() {
    const energyVal = document.getElementById('energyVal');
    const energyBar = document.getElementById('energyBar');
    const happinessVal = document.getElementById('happinessVal');
    const happinessBar = document.getElementById('happinessBar');

    if (energyVal) energyVal.textContent = `${this.energy}%`;
    if (energyBar) energyBar.style.width = `${this.energy}%`;

    if (happinessVal) happinessVal.textContent = `${this.happiness}%`;
    if (happinessBar) happinessBar.style.width = `${this.happiness}%`;
  }
}

// =========================================================================
// 4. Mini-Games Hub
// =========================================================================

// Game 1: Robot Simon Says
class SimonGame {
  constructor(robot) {
    this.robot = robot;
    this.pads = [
      document.getElementById('pad0'),
      document.getElementById('pad1'),
      document.getElementById('pad2'),
      document.getElementById('pad3')
    ];
    this.startBtn = document.getElementById('btnStartSimon');
    this.levelEl = document.getElementById('simonLevel');
    this.scoreEl = document.getElementById('simonScore');
    this.bestEl = document.getElementById('simonBest');
    this.hintEl = document.getElementById('simonHint');

    this.sequence = [];
    this.playerStep = 0;
    this.score = 0;
    this.bestScore = parseInt(localStorage.getItem('axel_simon_best') || '0', 10);
    this.isShowingSequence = false;
    this.isPlaying = false;

    if (this.bestEl) this.bestEl.textContent = this.bestScore;

    if (this.startBtn) {
      this.startBtn.addEventListener('click', () => this.startGame());
    }

    this.pads.forEach((pad, idx) => {
      if (pad) pad.addEventListener('click', () => this.handlePadClick(idx));
    });
  }

  startGame() {
    audio.init();
    this.sequence = [];
    this.score = 0;
    this.playerStep = 0;
    this.isPlaying = true;
    this.updateUI();
    if (this.hintEl) this.hintEl.textContent = "Memorize the sequence!";
    this.robot.say("Memory link engaged! Watch my sequence closely...", 'thinking');
    this.nextRound();
  }

  nextRound() {
    this.playerStep = 0;
    this.sequence.push(Math.floor(Math.random() * 4));
    this.updateUI();
    this.playSequence();
  }

  updateUI() {
    if (this.levelEl) this.levelEl.textContent = this.sequence.length || 1;
    if (this.scoreEl) this.scoreEl.textContent = this.score;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      if (this.bestEl) this.bestEl.textContent = this.bestScore;
      localStorage.setItem('axel_simon_best', this.bestScore.toString());
    }
  }

  async playSequence() {
    this.isShowingSequence = true;
    this.setDisabledPads(true);
    await this.sleep(600);

    const delay = Math.max(260, 550 - this.sequence.length * 20);

    for (let i = 0; i < this.sequence.length; i++) {
      const padIdx = this.sequence[i];
      await this.flashPad(padIdx, delay * 0.7);
      await this.sleep(delay * 0.3);
    }

    this.isShowingSequence = false;
    this.setDisabledPads(false);
    if (this.hintEl) this.hintEl.textContent = `Your turn! Repeat the ${this.sequence.length} note(s).`;
  }

  async flashPad(index, duration = 300) {
    const pad = this.pads[index];
    if (!pad) return;
    pad.classList.add('flash');
    audio.playSimonTone(index);
    await this.sleep(duration);
    pad.classList.remove('flash');
  }

  handlePadClick(index) {
    if (!this.isPlaying || this.isShowingSequence) return;

    this.flashPad(index, 200);

    if (index === this.sequence[this.playerStep]) {
      this.playerStep++;
      if (this.playerStep === this.sequence.length) {
        this.score += this.sequence.length * 10;
        this.updateUI();
        this.setDisabledPads(true);
        if (this.hintEl) this.hintEl.textContent = "Correct! Advancing to next round...";

        if (this.sequence.length % 3 === 0) {
          this.robot.say(`Awesome memory! You've matched ${this.sequence.length} patterns!`, 'happy');
        }

        setTimeout(() => this.nextRound(), 1000);
      }
    } else {
      this.isPlaying = false;
      this.setDisabledPads(true);
      audio.playBuzzer();
      if (this.hintEl) this.hintEl.textContent = `Game Over! Final Score: ${this.score}. Try again!`;
      this.robot.say(`Wrong sequence! You scored ${this.score}. Press Start to challenge me again!`, 'love');
    }
  }

  setDisabledPads(disabled) {
    this.pads.forEach(p => { if (p) p.disabled = disabled; });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Game 2: Cyber Rock-Paper-Scissors
class RpsGame {
  constructor(robot) {
    this.robot = robot;
    this.playerScore = 0;
    this.draws = 0;
    this.robotScore = 0;

    this.playerDisplay = document.getElementById('rpsPlayerDisplay');
    this.robotDisplay = document.getElementById('rpsRobotDisplay');
    this.statusBanner = document.getElementById('rpsStatus');
    this.playerScoreEl = document.getElementById('rpsPlayerScore');
    this.drawsEl = document.getElementById('rpsDraws');
    this.robotScoreEl = document.getElementById('rpsRobotScore');

    this.buttons = document.querySelectorAll('.rps-btn');
    this.buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const choice = btn.getAttribute('data-choice');
        this.play(choice);
      });
    });

    this.emojis = {
      rock: '🪨',
      paper: '📄',
      scissors: '✂️'
    };
  }

  async play(playerChoice) {
    audio.init();
    audio.playTone(440, 'triangle', 0.1, 0.1);

    if (this.playerDisplay) {
      this.playerDisplay.textContent = this.emojis[playerChoice];
      this.playerDisplay.classList.add('active-choice');
    }
    if (this.robotDisplay) {
      this.robotDisplay.classList.remove('active-choice');
      this.robotDisplay.textContent = '⏳';
    }
    if (this.statusBanner) this.statusBanner.textContent = "A.X.E.L. computing probability vectors...";

    this.buttons.forEach(b => b.disabled = true);
    await new Promise(r => setTimeout(r, 650));

    const choices = ['rock', 'paper', 'scissors'];
    const robotChoice = choices[Math.floor(Math.random() * choices.length)];

    if (this.robotDisplay) {
      this.robotDisplay.textContent = this.emojis[robotChoice];
      this.robotDisplay.classList.add('active-choice');
    }

    this.evaluate(playerChoice, robotChoice);
    this.buttons.forEach(b => b.disabled = false);
  }

  evaluate(p, r) {
    if (p === r) {
      this.draws++;
      if (this.drawsEl) this.drawsEl.textContent = this.draws;
      if (this.statusBanner) this.statusBanner.textContent = "SYNCHRONIZATION! It's a draw!";
      audio.playTone(500, 'sine', 0.2, 0.1);
      this.robot.say("Neural collision! We picked the exact same algorithm!", 'curious');
    } else if (
      (p === 'rock' && r === 'scissors') ||
      (p === 'paper' && r === 'rock') ||
      (p === 'scissors' && r === 'paper')
    ) {
      this.playerScore++;
      if (this.playerScoreEl) this.playerScoreEl.textContent = this.playerScore;
      if (this.statusBanner) this.statusBanner.textContent = `VICTORY! ${p.toUpperCase()} beats ${r.toUpperCase()}!`;
      audio.playFanfare();
      this.robot.say("Impressive tactical maneuver! You won that round!", 'happy');
    } else {
      this.robotScore++;
      if (this.robotScoreEl) this.robotScoreEl.textContent = this.robotScore;
      if (this.statusBanner) this.statusBanner.textContent = `A.X.E.L. WINS! ${r.toUpperCase()} beats ${p.toUpperCase()}!`;
      audio.playBuzzer();
      this.robot.say("Bwahaha! My predictive neural network foresaw your move!", 'thinking');
    }
  }
}

// Game 3: Reflex Speed Test
class ReflexGame {
  constructor(robot) {
    this.robot = robot;
    this.zone = document.getElementById('reflexZone');
    this.titleEl = document.getElementById('reflexTitle');
    this.descEl = document.getElementById('reflexDesc');
    this.lastEl = document.getElementById('reflexLast');
    this.bestEl = document.getElementById('reflexBest');

    this.state = 'IDLE';
    this.timeoutId = null;
    this.startTime = 0;
    this.bestTime = parseInt(localStorage.getItem('axel_reflex_best') || '9999', 10);

    if (this.bestEl && this.bestTime < 9999) {
      this.bestEl.textContent = `${this.bestTime} ms`;
    }

    if (this.zone) {
      this.zone.addEventListener('click', () => this.handleClick());
    }
  }

  handleClick() {
    audio.init();

    if (this.state === 'IDLE') {
      this.arm();
    } else if (this.state === 'ARMED') {
      clearTimeout(this.timeoutId);
      this.state = 'IDLE';
      if (this.zone) this.zone.className = 'reflex-pad-zone early';
      if (this.titleEl) this.titleEl.textContent = "TOO EARLY!";
      if (this.descEl) this.descEl.textContent = "Premature click detected! Wait for NEON GREEN next time.";
      audio.playBuzzer();
      this.robot.say("Whoa there! Wait for the neon green flash!", 'thinking');
    } else if (this.state === 'READY') {
      const elapsed = Math.round(performance.now() - this.startTime);
      this.state = 'IDLE';
      if (this.zone) this.zone.className = 'reflex-pad-zone';
      if (this.lastEl) this.lastEl.textContent = `${elapsed} ms`;

      let verdict = "";
      if (elapsed < 200) {
        verdict = "CYBERNETIC SPEED! Superhuman reflexes!";
      } else if (elapsed < 260) {
        verdict = "LIGHTNING REFLEXES! Pro gamer speed!";
      } else if (elapsed < 350) {
        verdict = "Sharp human reflexes! Good job!";
      } else {
        verdict = "Sensor latency detected. You can do better!";
      }

      if (this.titleEl) this.titleEl.textContent = `${elapsed} MS!`;
      if (this.descEl) this.descEl.textContent = `${verdict} Click to try again.`;

      if (elapsed < this.bestTime) {
        this.bestTime = elapsed;
        if (this.bestEl) this.bestEl.textContent = `${this.bestTime} ms`;
        localStorage.setItem('axel_reflex_best', this.bestTime.toString());
        audio.playFanfare();
        this.robot.say(`NEW RECORD! ${elapsed} ms! You're faster than my core processor!`, 'happy');
      } else {
        audio.playChirp();
        this.robot.say(`Recorded ${elapsed} ms! Solid reaction time!`, 'curious');
      }
    }
  }

  arm() {
    this.state = 'ARMED';
    if (this.zone) this.zone.className = 'reflex-pad-zone waiting';
    if (this.titleEl) this.titleEl.textContent = "WAIT FOR GREEN...";
    if (this.descEl) this.descEl.textContent = "Sensors armed. Prepare your finger!";
    audio.playTone(300, 'sine', 0.1, 0.08);

    const delay = Math.random() * 3000 + 1500;
    this.timeoutId = setTimeout(() => {
      if (this.state === 'ARMED') {
        this.state = 'READY';
        if (this.zone) this.zone.className = 'reflex-pad-zone ready';
        if (this.titleEl) this.titleEl.textContent = "CLICK NOW!!!";
        if (this.descEl) this.descEl.textContent = "FAST AS YOU CAN!";
        this.startTime = performance.now();
        audio.playTone(880, 'triangle', 0.2, 0.2);
      }
    }, delay);
  }
}

// =========================================================================
// 5. Chat & Natural Command Handler
// =========================================================================
class ChatHandler {
  constructor(robot) {
    this.robot = robot;
    this.form = document.getElementById('chatForm');
    this.input = document.getElementById('chatInput');

    if (this.form && this.input) {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = this.input.value.trim();
        if (query) {
          this.process(query);
          this.input.value = '';
        }
      });
    }
  }

  process(rawQuery) {
    const q = rawQuery.toLowerCase();

    if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
      this.robot.say("Greetings, human! Great to connect with you!", 'happy');
    } else if (q.includes('who are you') || q.includes('your name')) {
      this.robot.say("I am A.X.E.L. — Autonomous eXploration & Empathy Link, your 3D interactive cyber companion!", 'curious');
    } else if (q.includes('joke')) {
      this.robot.tellJoke();
    } else if (q.includes('coin') || q.includes('flip')) {
      const result = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
      this.robot.say(`Flipping cyber coin... It landed on ${result}!`, 'curious');
    } else if (q.includes('dice') || q.includes('roll')) {
      const roll = Math.floor(Math.random() * 6) + 1;
      this.robot.say(`Rolling virtual 6-sided die... You rolled a ${roll}!`, 'happy');
    } else if (q.includes('dance')) {
      this.robot.danceParty();
    } else if (q.includes('love') || q.includes('cute') || q.includes('friend')) {
      this.robot.pet();
    } else if (q.includes('sleep') || q.includes('night') || q.includes('tired')) {
      this.robot.setMood('sleepy');
      this.robot.say("Entering low-power standby mode... Zzz...", 'sleepy');
    } else if (q.includes('help') || q.includes('command')) {
      this.robot.say("Try asking for a joke, flip coin, dance, pet me, or test the 3D controls below me!", 'curious');
    } else {
      const genericResponses = [
        `Fascinating thought: "${rawQuery}". My neural network is expanding!`,
        `Query processed: "${rawQuery}". All diagnostic parameters green!`,
        `I like the way you think! Try rotating my 3D view or playing Simon Says!`,
        `Data packet received! Try challenging me in Simon Says or Rock-Paper-Scissors!`
      ];
      const res = genericResponses[Math.floor(Math.random() * genericResponses.length)];
      this.robot.say(res, 'curious');
    }
  }
}

// =========================================================================
// 6. Application Bootstrap & Event Wiring
// =========================================================================
function initApp() {
  // 1. Initialize Particles Background
  new ParticleSystem('particleCanvas');

  // 2. Initialize 3D Robot Viewer
  const webglContainer = document.getElementById('webglContainer');
  let viewer = null;

  try {
    viewer = new Robot3DViewer(webglContainer, {
      modelUrl: '/models/robot.glb',
      fallbackUrl: './public/models/robot.glb'
    });
  } catch (err) {
    console.error('[App] Failed to initialize Robot3DViewer:', err);
  }

  // 3. Initialize Robot Character Controller
  const robot = new RobotController(viewer);

  // 4. Loading Overlay Hooks
  const loadingOverlay = document.getElementById('loadingOverlay');
  const progressFill = document.getElementById('loadingProgressFill');
  const percentText = document.getElementById('loadingPercentText');

  if (viewer) {
    viewer.on('loadProgress', (percent) => {
      if (progressFill) progressFill.style.width = `${percent}%`;
      if (percentText) percentText.textContent = `${percent}%`;
    });

    viewer.on('loaded', (stats) => {
      if (progressFill) progressFill.style.width = '100%';
      if (percentText) percentText.textContent = '100%';
      setTimeout(() => {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
      }, 350);
      populateModalStats(stats);
      robot.say("3D Neural Core online and fully initialized! Drag to orbit or poke me!", 'happy');
    });

    viewer.on('loadError', (err) => {
      if (percentText) percentText.textContent = 'ERR';
      console.error('[App] Error loading 3D GLB model:', err);
    });

    // When 3D mesh is clicked directly
    viewer.on('robotClicked', () => {
      robot.poke();
    });

    // Sync button UI when animation state changes
    viewer.on('animationStateChange', (isAnimating) => {
      if (btnRobotAnimation) btnRobotAnimation.classList.toggle('is-active', isAnimating);
      if (animationStatusBadge) {
        animationStatusBadge.textContent = isAnimating ? '● KINEMATICS ACTIVE' : '○ KINEMATICS PAUSED';
        animationStatusBadge.classList.toggle('paused', !isAnimating);
      }
    });

    // Sync turntable button UI when rotation state changes
    viewer.on('rotateStateChange', (isRotating) => {
      if (btnRotateRobot) btnRotateRobot.classList.toggle('is-active', isRotating);
      if (rotateBtnLabel) rotateBtnLabel.textContent = isRotating ? 'Rotating...' : 'Rotate Robot';
    });
  }

  // 5. Wire the 7 Modern UI Control Buttons
  const btnResetView = document.getElementById('btnResetView');
  const btnRotateRobot = document.getElementById('btnRotateRobot');
  const rotateBtnLabel = document.getElementById('rotateBtnLabel');
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnRobotAnimation = document.getElementById('btnRobotAnimation');
  const btnStopAnimation = document.getElementById('btnStopAnimation');
  const btnRobotInfo = document.getElementById('btnRobotInfo');
  const animationStatusBadge = document.getElementById('animationStatusBadge');

  // Button 1: Reset View
  if (btnResetView) {
    btnResetView.addEventListener('click', () => {
      audio.playChirp();
      if (viewer) viewer.resetView();
      robot.say("Camera coordinates restored to standard origin.", 'curious');
    });
  }

  // Button 2: Rotate Robot (Turntable Toggle)
  if (btnRotateRobot) {
    btnRotateRobot.addEventListener('click', () => {
      audio.playTone(520, 'sine', 0.12, 0.1);
      if (!viewer) return;
      const isRotating = viewer.toggleRotate();
      btnRotateRobot.classList.toggle('is-active', isRotating);
      if (rotateBtnLabel) rotateBtnLabel.textContent = isRotating ? 'Rotating...' : 'Rotate Robot';
      robot.say(isRotating ? "Turntable 360° showcase active." : "Turntable rotation stopped.", 'curious');
    });
  }

  // Button 3: Zoom In
  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      audio.playTone(620, 'sine', 0.1, 0.08);
      if (viewer) viewer.zoomIn();
    });
  }

  // Button 4: Zoom Out
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      audio.playTone(460, 'sine', 0.1, 0.08);
      if (viewer) viewer.zoomOut();
    });
  }

  // Button 5: Robot Animation (Start Procedural Motion)
  if (btnRobotAnimation) {
    btnRobotAnimation.addEventListener('click', () => {
      audio.playPowerUp();
      if (viewer) viewer.startAnimation();
      btnRobotAnimation.classList.add('is-active');
      if (animationStatusBadge) {
        animationStatusBadge.textContent = '● KINEMATICS ACTIVE';
        animationStatusBadge.classList.remove('paused');
      }
      robot.say("Procedural kinematic hover engine activated!", 'happy');
    });
  }

  // Button 6: Stop Animation
  if (btnStopAnimation) {
    btnStopAnimation.addEventListener('click', () => {
      audio.playTone(220, 'sawtooth', 0.2, 0.15);
      if (viewer) viewer.stopAnimation();
      btnStopAnimation.classList.add('is-active');
      setTimeout(() => btnStopAnimation.classList.remove('is-active'), 350);
      if (btnRobotAnimation) btnRobotAnimation.classList.remove('is-active');
      if (btnRotateRobot) btnRotateRobot.classList.remove('is-active');
      if (rotateBtnLabel) rotateBtnLabel.textContent = 'Rotate Robot';
      if (animationStatusBadge) {
        animationStatusBadge.textContent = '○ KINEMATICS PAUSED';
        animationStatusBadge.classList.add('paused');
      }
      robot.say("Kinematic motion halted. Unit in resting pose.", 'thinking');
    });
  }

  // Button 7: Robot Information (Modal Dialog)
  const robotInfoModal = document.getElementById('robotInfoModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnModalAcknowledge = document.getElementById('btnModalAcknowledge');

  const openInfoModal = () => {
    audio.playChirp();
    if (viewer) populateModalStats(viewer.getInfo());
    if (robotInfoModal) {
      robotInfoModal.classList.add('open');
      robotInfoModal.setAttribute('aria-hidden', 'false');
    }
  };

  const closeInfoModal = () => {
    audio.playTone(400, 'sine', 0.08, 0.08);
    if (robotInfoModal) {
      robotInfoModal.classList.remove('open');
      robotInfoModal.setAttribute('aria-hidden', 'true');
    }
  };

  if (btnRobotInfo) btnRobotInfo.addEventListener('click', openInfoModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeInfoModal);
  if (btnModalAcknowledge) btnModalAcknowledge.addEventListener('click', closeInfoModal);

  if (robotInfoModal) {
    robotInfoModal.addEventListener('click', (e) => {
      if (e.target === robotInfoModal) closeInfoModal();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && robotInfoModal && robotInfoModal.classList.contains('open')) {
      closeInfoModal();
    }
  });

  function populateModalStats(stats) {
    if (!stats) return;
    const specMeshCount = document.getElementById('specMeshCount');
    const specPolyCount = document.getElementById('specPolyCount');
    const specDimensions = document.getElementById('specDimensions');
    const specMaterialCount = document.getElementById('specMaterialCount');

    if (specMeshCount && stats.meshCount) {
      specMeshCount.textContent = `${stats.meshCount} Independent Meshes`;
    }
    if (specPolyCount && stats.triangleCount) {
      specPolyCount.textContent = `${Number(stats.triangleCount).toLocaleString()} Triangles / ${Number(stats.vertexCount).toLocaleString()} Vertices`;
    }
    if (specDimensions && stats.dimensions) {
      const d = stats.dimensions;
      specDimensions.textContent = `${d.width}m (W) × ${d.height}m (H) × ${d.depth}m (D)`;
    }
    if (specMaterialCount && stats.materialCount) {
      specMaterialCount.textContent = `${stats.materialCount} PBR Metallic Shaders`;
    }
  }

  // 6. Quick Action Companion Buttons
  const btnPet = document.getElementById('btnPet');
  const btnFeed = document.getElementById('btnFeed');
  const btnDance = document.getElementById('btnDance');
  const btnJoke = document.getElementById('btnJoke');
  const btnTrivia = document.getElementById('btnTrivia');
  const btnHighFive = document.getElementById('btnHighFive');

  if (btnPet) btnPet.addEventListener('click', () => robot.pet());
  if (btnFeed) btnFeed.addEventListener('click', () => robot.recharge());
  if (btnDance) btnDance.addEventListener('click', () => robot.danceParty());
  if (btnJoke) btnJoke.addEventListener('click', () => robot.tellJoke());
  if (btnTrivia) btnTrivia.addEventListener('click', () => robot.tellTrivia());
  if (btnHighFive) btnHighFive.addEventListener('click', () => robot.highFive());

  // 7. Mood Selector Pills
  document.querySelectorAll('.mood-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const mood = pill.getAttribute('data-mood');
      robot.setMood(mood);
    });
  });

  // 8. Theme Selector (Cyan, Magenta, Emerald, Amber, Violet)
  const themeHexMap = {
    cyan: 0x00f0ff,
    magenta: 0xff007f,
    emerald: 0x10b981,
    amber: 0xf59e0b,
    violet: 0xa855f7
  };

  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const theme = dot.getAttribute('data-color');
      document.body.setAttribute('data-theme', theme);
      document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      audio.playChirp();
      if (viewer && themeHexMap[theme]) {
        viewer.setThemeColor(themeHexMap[theme]);
      }
      robot.say(`Neon Core updated to ${theme.toUpperCase()}!`, 'curious');
    });
  });

  // 9. Audio Mute Toggle
  const audioToggleBtn = document.getElementById('audioToggleBtn');
  const audioStatusText = document.getElementById('audioStatusText');

  if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', () => {
      audio.init();
      const isMuted = audio.toggleMute();
      audioToggleBtn.classList.toggle('muted', isMuted);
      if (audioStatusText) audioStatusText.textContent = isMuted ? 'AUDIO MUTED' : 'AUDIO ON';
      if (!isMuted) audio.playChirp();
    });
  }

  // 10. System Clock
  const clockEl = document.getElementById('systemClock');
  const updateClock = () => {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    if (clockEl) {
      clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
  };
  setInterval(updateClock, 1000);
  updateClock();

  // 11. Mini-Games Tabs & Instances
  const tabs = document.querySelectorAll('.tab-btn');
  const gameContainers = {
    simon: document.getElementById('gameSimon'),
    rps: document.getElementById('gameRps'),
    reflex: document.getElementById('gameReflex')
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetGame = tab.getAttribute('data-game');
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      Object.keys(gameContainers).forEach(key => {
        if (gameContainers[key]) {
          gameContainers[key].classList.toggle('active', key === targetGame);
        }
      });

      audio.playTone(550, 'sine', 0.1, 0.08);
    });
  });

  new SimonGame(robot);
  new RpsGame(robot);
  new ReflexGame(robot);

  // 12. Chat Terminal
  new ChatHandler(robot);

  // 13. Audio Synthesizer Sandbox
  const btnTestSynth = document.getElementById('btnTestSynth');
  const pitchSlider = document.getElementById('pitchSlider');
  const tempoSlider = document.getElementById('tempoSlider');

  if (btnTestSynth) {
    btnTestSynth.addEventListener('click', () => {
      audio.init();
      audio.playCustomSynth(pitchSlider ? pitchSlider.value : 550, tempoSlider ? tempoSlider.value : 180);
      robot.say("Modulation frequency verified!", 'curious');
    });
  }

  // Unlock Audio Context on first touch
  window.addEventListener('click', () => audio.init(), { once: true });
  window.addEventListener('keydown', () => audio.init(), { once: true });
}

// Start app on DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
