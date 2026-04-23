export class VinylAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.crackleGain = null;
    this.hissGain = null;
    this.crackleSource = null;
    this.hissSource = null;
    this.started = false;

    // Config (0–1 range internally)
    this.crackleLevel = 0.5;
    this.hissLevel = 0.3;
    this.masterLevel = 0.7;
  }

  _init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterLevel;
    this.masterGain.connect(this.ctx.destination);

    this.crackleGain = this.ctx.createGain();
    this.crackleGain.gain.value = this.crackleLevel * 0.6;
    this.crackleGain.connect(this.masterGain);

    this.hissGain = this.ctx.createGain();
    this.hissGain.gain.value = this.hissLevel * 0.15;
    this.hissGain.connect(this.masterGain);
  }

  _buildCrackleBuffer() {
    const sampleRate = this.ctx.sampleRate;
    const duration = 3;
    const bufferSize = sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Sparse random pops with varying amplitude
      if (Math.random() < 0.00015) {
        const popLen = Math.floor(Math.random() * 80 + 20);
        const amp = Math.random() * 0.9 + 0.1;
        for (let j = 0; j < popLen && i + j < bufferSize; j++) {
          const env = Math.sin((j / popLen) * Math.PI);
          data[i + j] += (Math.random() * 2 - 1) * amp * env;
        }
      }
      // Low-level dust noise
      data[i] += (Math.random() * 2 - 1) * 0.004;
    }
    return buffer;
  }

  _buildHissBuffer() {
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    // Coloured noise — simple first-order low-pass on white noise
    let prev = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      prev = prev * 0.97 + white * 0.03;
      data[i] = prev * 4 + white * 0.1;
    }
    return buffer;
  }

  start() {
    this._init();
    if (this.started) return;
    this.started = true;

    // Crackle — looped buffer source
    const crackleBuffer = this._buildCrackleBuffer();
    this.crackleSource = this.ctx.createBufferSource();
    this.crackleSource.buffer = crackleBuffer;
    this.crackleSource.loop = true;
    // Slight pitch variation to avoid periodicity
    this.crackleSource.playbackRate.value = 0.98 + Math.random() * 0.04;
    this.crackleSource.connect(this.crackleGain);
    this.crackleSource.start();

    // Hiss — looped filtered noise
    const hissBuffer = this._buildHissBuffer();
    this.hissSource = this.ctx.createBufferSource();
    this.hissSource.buffer = hissBuffer;
    this.hissSource.loop = true;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6000;
    lp.Q.value = 0.5;

    this.hissSource.connect(lp);
    lp.connect(this.hissGain);
    this.hissSource.start();
  }

  stop() {
    if (!this.started) return;
    this.crackleSource?.stop();
    this.hissSource?.stop();
    this.started = false;
  }

  setCrackle(v) {
    this.crackleLevel = v;
    if (this.crackleGain) {
      this.crackleGain.gain.setTargetAtTime(v * 0.6, this.ctx.currentTime, 0.1);
    }
  }

  setHiss(v) {
    this.hissLevel = v;
    if (this.hissGain) {
      this.hissGain.gain.setTargetAtTime(v * 0.15, this.ctx.currentTime, 0.1);
    }
  }

  setMaster(v) {
    this.masterLevel = v;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
    }
  }

  resume() {
    this.ctx?.resume();
  }
}
