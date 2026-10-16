/* ===== Sound: theme music + click sfx (Web Audio API, tanpa file audio) ===== */
(()=>{
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC){const w=q('#snd');if(w)w.remove();return}

  // pengaturan tersimpan; default: semua nyala (musik baru bunyi setelah interaksi pertama karena autoplay diblokir browser)
  const KEY='azm-audio',st={sfx:true,music:true};
  try{Object.assign(st,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}};

  let ctx,sfxBus,musBus,delayIn,verbIn,timer=null,step=0,next=0;
  const hz=n=>440*Math.pow(2,(n-69)/12);

  function ensure(){
    if(!ctx){
      ctx=new AC({latencyHint:'playback'});
      const comp=ctx.createDynamicsCompressor();comp.connect(ctx.destination);
      const master=ctx.createGain();master.gain.value=.9;master.connect(comp);
      sfxBus=ctx.createGain();sfxBus.gain.value=.5;sfxBus.connect(master);
      musBus=ctx.createGain();musBus.gain.value=0;musBus.connect(master);
      // reverb (impuls noise yang meluruh)
      const len=Math.floor(ctx.sampleRate*1.8),buf=ctx.createBuffer(2,len,ctx.sampleRate);
      for(let c=0;c<2;c++){const d=buf.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3)}
      const conv=ctx.createConvolver();conv.buffer=buf;
      const wet=ctx.createGain();wet.gain.value=.5;conv.connect(wet);wet.connect(musBus);
      verbIn=ctx.createGain();verbIn.connect(conv);
      // delay berumpan balik
      const dl=ctx.createDelay(1);dl.delayTime.value=.5;
      const fb=ctx.createGain();fb.gain.value=.38;
      const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2200;
      delayIn=ctx.createGain();delayIn.connect(dl);dl.connect(lp);lp.connect(fb);fb.connect(dl);
      lp.connect(musBus);lp.connect(verbIn);
    }
    if(ctx.state==='suspended')ctx.resume();
    return ctx;
  }

  // satu nada pendek dengan envelope pluck
  function note(f,t,dur,o={}){
    const osc=ctx.createOscillator(),e=ctx.createGain(),a=o.a||.005,g=o.g||.2;
    osc.type=o.type||'sine';osc.frequency.value=f;
    e.gain.setValueAtTime(.0001,t);e.gain.linearRampToValueAtTime(g,t+a);e.gain.exponentialRampToValueAtTime(.0001,t+dur);
    let n=osc;
    if(o.lp){const fl=ctx.createBiquadFilter();fl.type='lowpass';fl.frequency.value=o.lp;osc.connect(fl);n=fl}
    n.connect(e);e.connect(o.dest);(o.sends||[]).forEach(x=>e.connect(x));
    osc.start(t);osc.stop(t+dur+.05);
  }

  // ---------- click sounds ----------
  const S={
    tick(){const t=ctx.currentTime,o=ctx.createOscillator(),e=ctx.createGain();
      o.type='triangle';o.frequency.setValueAtTime(1100,t);o.frequency.exponentialRampToValueAtTime(520,t+.05);
      e.gain.setValueAtTime(.0001,t);e.gain.linearRampToValueAtTime(.28,t+.004);e.gain.exponentialRampToValueAtTime(.0001,t+.07);
      o.connect(e);e.connect(sfxBus);o.start(t);o.stop(t+.09)},
    up(){const t=ctx.currentTime;[659.25,880].forEach((f,i)=>note(f,t+i*.07,.16,{type:'triangle',g:.22,dest:sfxBus}))},
    down(){const t=ctx.currentTime;[880,659.25].forEach((f,i)=>note(f,t+i*.07,.16,{type:'triangle',g:.2,dest:sfxBus}))},
    chip(i){const t=ctx.currentTime;note(hz(72+i*2),t,.14,{type:'square',g:.1,dest:sfxBus,lp:1800});note(hz(79+i*2),t+.055,.16,{type:'triangle',g:.16,dest:sfxBus})},
    cta(){const t=ctx.currentTime;[hz(81),hz(88)].forEach((f,i)=>{note(f,t+i*.09,.55,{g:.2,dest:sfxBus});note(f*2,t+i*.09,.3,{g:.05,dest:sfxBus})})},
    on(){const t=ctx.currentTime;[69,76,81].forEach((n,i)=>note(hz(n),t+i*.07,.22,{type:'triangle',g:.2,dest:sfxBus}))},
    off(){const t=ctx.currentTime;[81,76,69].forEach((n,i)=>note(hz(n),t+i*.07,.22,{type:'triangle',g:.18,dest:sfxBus}))}
  };

  document.addEventListener('click',e=>{
    if(!st.sfx)return;
    const el=e.target.closest('a,button');
    if(!el||el.closest('#snd'))return;
    ensure();
    if(el.matches('#svc button'))S[el.getAttribute('aria-expanded')==='true'?'up':'down']();
    else if(el.matches('#chips button'))S.chip(qa('#chips button').indexOf(el));
    else if(el.matches('.btn.p,.contact .btn'))S.cta();
    else S.tick();
  });

  // ---------- theme music: ambient generatif, A minor (Am - F - C - G) ----------
  const CH=[{r:45,n:[57,60,64,69]},{r:41,n:[57,60,65,69]},{r:48,n:[55,60,64,67]},{r:43,n:[55,59,62,67]}];
  const SD=60/74/2,BAR=16,PEN=[81,84,86,88,91],ARP=[0,2,1,3,2,1,3,1];

  function pad(f,t,dur){
    [-7,7].forEach((d,i)=>{
      const o=ctx.createOscillator(),e=ctx.createGain(),fl=ctx.createBiquadFilter();
      o.type=i?'triangle':'sine';o.frequency.value=f;o.detune.value=d;
      fl.type='lowpass';fl.frequency.value=1000;
      e.gain.setValueAtTime(.0001,t);e.gain.linearRampToValueAtTime(.045,t+1.6);
      e.gain.setValueAtTime(.045,t+dur-.4);e.gain.linearRampToValueAtTime(.0001,t+dur+1.8);
      o.connect(fl);fl.connect(e);e.connect(musBus);e.connect(verbIn);
      o.start(t);o.stop(t+dur+2);
    });
  }
  function play(s,t){
    const ch=CH[Math.floor(s/BAR)%4],k=s%BAR,send=[delayIn,verbIn];
    if(k===0)ch.n.forEach(n=>pad(hz(n),t,BAR*SD));
    if(k===0||k===8)note(hz(ch.r),t,3.4,{g:.22,a:.05,dest:musBus});
    if(Math.random()<.78)note(hz(ch.n[ARP[k%8]]+12),t,1.1,{type:'triangle',g:.06+Math.random()*.03,dest:musBus,sends:send,lp:3000});
    if(k%4===2&&Math.random()<.35)note(hz(PEN[Math.floor(Math.random()*PEN.length)]),t+.02,1.6,{g:.04,dest:musBus,sends:send});
  }
  function sched(){
    if(next<ctx.currentTime-.5)next=ctx.currentTime+.05; // tab lama di background: jangan kejar ketinggalan
    while(next<ctx.currentTime+1.2){play(step,next);next+=SD;step++}
  }
  function startMusic(){
    ensure();if(timer)return;
    step=0;next=ctx.currentTime+.08;sched();timer=setInterval(sched,250);
    musBus.gain.cancelScheduledValues(ctx.currentTime);musBus.gain.setTargetAtTime(.6,ctx.currentTime,.8);
  }
  function stopMusic(){
    if(!timer)return;clearInterval(timer);timer=null;
    musBus.gain.cancelScheduledValues(ctx.currentTime);musBus.gain.setTargetAtTime(0,ctx.currentTime,.25);
  }

  // ---------- tombol ----------
  const sb=q('#sfxBtn'),mb=q('#musBtn');
  function paint(){
    sb.setAttribute('aria-pressed',st.sfx);mb.setAttribute('aria-pressed',st.music);
    document.documentElement.classList.toggle('mus-on',st.music);
  }
  sb.addEventListener('click',()=>{
    if(st.sfx){ensure();S.off()}
    st.sfx=!st.sfx;save();paint();
    if(st.sfx){ensure();S.on()}
  });
  mb.addEventListener('click',()=>{
    st.music=!st.music;save();paint();
    st.music?startMusic():stopMusic();
  });
  paint();

  // pilihan musik "on" dari kunjungan sebelumnya baru bisa bunyi setelah interaksi pertama
  if(st.music){
    const evs=['click','keydown','touchend','pointerup'],go=()=>{
      evs.forEach(v=>removeEventListener(v,go,true));
      if(st.music)startMusic();
    };
    evs.forEach(v=>addEventListener(v,go,true));
  }

  // hemat baterai: berhenti saat tab disembunyikan
  document.addEventListener('visibilitychange',()=>{
    if(!ctx)return;
    if(document.hidden)ctx.suspend();else if(st.music||st.sfx)ctx.resume();
  });
})();
