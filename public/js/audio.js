(function () {
  "use strict";

  function create(getSettings) {
    let audio = null;
    let musicState='silent', musicTimer=null, musicGain=null, beat=0;
    let lastVibration=0;
    function vibrate(duration){const now=performance.now();if(settings().haptics&&navigator.vibrate&&now-lastVibration>90){lastVibration=now;navigator.vibrate(duration);}}

    function settings() {
      return getSettings ? getSettings() : { volume: 0.7 };
    }

    function ensureAudio() {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") void audio.resume().catch(()=>{});
      if(!musicGain){musicGain=audio.createGain();musicGain.gain.value=0;musicGain.connect(audio.destination);}
    }

    function tone(freq, duration, type = "sine", volume = 0.05, end = null) {
      const current = settings();
      if (current.volume <= 0) return;
      ensureAudio();
      const now = audio.currentTime;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
      gain.gain.setValueAtTime(volume * current.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(now);
      osc.stop(now + duration);
    }

    function noise(duration = 0.06, volume = 0.12) {
      const current = settings();
      if (current.volume <= 0) return;
      ensureAudio();
      const len = Math.max(1, Math.floor(audio.sampleRate * duration));
      const buffer = audio.createBuffer(1, len, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.createBufferSource();
      const gain = audio.createGain();
      src.buffer = buffer;
      gain.gain.value = volume * current.volume;
      src.connect(gain);
      gain.connect(audio.destination);
      src.start();
    }

    const sfx = {
      gun() { noise(0.065, 0.18); tone(105, 0.085, "square", 0.07, 50); vibrate(12); },
      hit() { tone(520, 0.045, "square", 0.035, 350); },
      headshot() { tone(1100,.075,'sine',.055,1600); },
      kill() { tone(230, 0.09, "sawtooth", 0.04, 110); },
      reload() {
        tone(180, 0.06, "square", 0.03, 120);
        setTimeout(() => tone(320, 0.05, "square", 0.025, 200), 650);
      },
      hurt() { tone(80, 0.15, "sawtooth", 0.05, 45); vibrate(30); }
    };
    // Original synthesized score: no downloaded recording or licensing dependency.
    function setMusic(state) {
      if(musicState===state)return;
      musicState=state;
      if(!audio)return;
      clearInterval(musicTimer);musicTimer=null;
      const now=audio.currentTime;musicGain.gain.cancelScheduledValues(now);musicGain.gain.setTargetAtTime(0,now,.22);
      if(state==='silent')return;
      const notes=state==='boss'?[55,58.27,65.41,51.91]:state==='battle'?[65.41,77.78,73.42,58.27]:[65.41,82.41,98,73.42];
      const play=()=>{const now=audio.currentTime;musicGain.gain.setTargetAtTime(settings().volume*.1,now,.3);const osc=audio.createOscillator(),g=audio.createGain();osc.type=state==='boss'?'sawtooth':'triangle';osc.frequency.value=notes[beat++%notes.length];g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(.25,now+.07);g.gain.exponentialRampToValueAtTime(.0001,now+(state==='home'?1.2:.45));osc.connect(g);g.connect(musicGain);osc.start(now);osc.stop(now+1.3);osc.onended=()=>{osc.disconnect();g.disconnect();};};
      play();musicTimer=setInterval(play,state==='boss'?230:state==='battle'?420:900);
    }
    function zombie(position,listener,yaw) {
      if(!audio || settings().volume<=0)return;
      const distance=Math.hypot(position.x-listener.x,position.z-listener.z);if(distance>22)return;
      const now=audio.currentTime,osc=audio.createOscillator(),gain=audio.createGain(),pan=audio.createStereoPanner();
      pan.pan.value=Math.max(-1,Math.min(1,((position.x-listener.x)*Math.cos(yaw)-(position.z-listener.z)*Math.sin(yaw))/Math.max(distance,1)));
      osc.type='sawtooth';osc.frequency.setValueAtTime(50+Math.random()*20,now);gain.gain.setValueAtTime(.035*settings().volume/(1+distance*.25),now);gain.gain.exponentialRampToValueAtTime(.0001,now+.35);osc.connect(gain);gain.connect(pan);pan.connect(audio.destination);osc.start();osc.stop(now+.36);osc.onended=()=>{osc.disconnect();gain.disconnect();pan.disconnect();};
    }
    function dispose(){clearInterval(musicTimer);if(audio)void audio.close().catch(()=>{});}
    return { ensureAudio, sfx, setMusic, zombie, dispose };
  }

  window.DeadSectorAudio = { create };
})();
