(() => {
  const ROWS=7, COLS=6, TOTAL=42;
  let roster = Array.from({length:TOTAL},(_,i)=>`${i+1}番`);
  let remaining = [...roster];
  let assignments = Array(TOTAL).fill(null);
  let rolling = false;
  let musicEnabled = true;
  let directMode = false;
  let directSeatIndex = null;
  let teacherView = false;

  const seatsEl=document.getElementById('seats');
  const roomEl=document.getElementById('room');
  const chipsEl=document.getElementById('chips');
  const fixedCount=document.getElementById('fixedCount');
  const remainCount=document.getElementById('remainCount');
  const statusEl=document.getElementById('status');
  const rouletteText=document.getElementById('rouletteText');
  const rouletteSub=document.getElementById('rouletteSub');
  const doneBanner=document.getElementById('doneBanner');
  const viewBadge=document.getElementById('viewBadge');
  const exportPanel=document.getElementById('exportPanel');
  const studentPreview=document.getElementById('studentPreview');
  const teacherPreview=document.getElementById('teacherPreview');
  const studentCopyStatus=document.getElementById('studentCopyStatus');
  const teacherCopyStatus=document.getElementById('teacherCopyStatus');
  const flash=document.getElementById('flash');
  const winnerPop=document.getElementById('winnerPop');
  const winnerWho=document.getElementById('winnerWho');
  const winnerWhere=document.getElementById('winnerWhere');

  // ---------- Audio ----------
  let ac=null, master=null, bgmGain=null, bgmTimer=null, beat=0;
  let idleGain=null, idleTimer=null, idleBeat=0, audioStarted=false;
  function ensureAudio(){
    if(ac) { if(ac.state==='suspended') ac.resume(); return; }
    ac=new (window.AudioContext||window.webkitAudioContext)();
    master=ac.createGain(); master.gain.value=.62; master.connect(ac.destination);
    bgmGain=ac.createGain(); bgmGain.gain.value=.36; bgmGain.connect(master);
    idleGain=ac.createGain(); idleGain.gain.value=.25; idleGain.connect(master);
  }
  function tone(freq,dur,type='triangle',vol=.12,when=0, destination=null){
    if(!musicEnabled) return;
    ensureAudio();
    const t=ac.currentTime+when;
    const o=ac.createOscillator(), g=ac.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(vol,t+.012);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g); g.connect(destination||master);
    o.start(t); o.stop(t+dur+.03);
  }
  function pluck(freq,when=0,vol=.07,destination=null){
    if(!musicEnabled) return;
    ensureAudio();
    const t=ac.currentTime+when;
    const o=ac.createOscillator(), f=ac.createBiquadFilter(), g=ac.createGain();
    o.type='sawtooth'; o.frequency.value=freq;
    f.type='lowpass'; f.frequency.setValueAtTime(2500,t); f.Q.value=2;
    g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.008);
    g.gain.exponentialRampToValueAtTime(.0001,t+.16);
    o.connect(f); f.connect(g); g.connect(destination||bgmGain);
    o.start(t);o.stop(t+.18);
  }
  const scale=[261.63,329.63,392.00,523.25,392.00,329.63,293.66,349.23,440.00,587.33,440,349.23];
  function startBgm(){
    if(!musicEnabled || bgmTimer) return;
    ensureAudio();
    beat=0;
    const tick=()=>{
      if(!musicEnabled){stopBgm();return;}
      const root=scale[beat%scale.length];
      pluck(root,0,.095);
      pluck(root*2,.09,.045);
      if(beat%2===0) tone(root/2,.16,'triangle',.045,0,bgmGain);
      if(beat%4===0){ tone(130.81,.10,'sine',.10,0,bgmGain); tone(65.41,.12,'triangle',.06,.02,bgmGain); }
      beat++;
    };
    tick(); bgmTimer=setInterval(tick,145);
  }
  function stopBgm(){ if(bgmTimer){clearInterval(bgmTimer); bgmTimer=null;} }

  // 待機中BGM：明るいクラシカル調のループ
  const idleMelody=[
    523.25,659.25,783.99,659.25,
    587.33,698.46,880.00,698.46,
    659.25,783.99,987.77,783.99,
    698.46,880.00,1046.50,880.00
  ];
  const idleBass=[130.81,146.83,164.81,174.61];

  function startIdleBgm(){
    if(!musicEnabled || rolling || idleTimer) return;
    ensureAudio();
    audioStarted=true;
    idleBeat=0;
    const tick=()=>{
      if(!musicEnabled || rolling){ stopIdleBgm(); return; }

      const m=idleMelody[idleBeat % idleMelody.length];
      const bass=idleBass[Math.floor(idleBeat/4) % idleBass.length];

      // 軽やかな主旋律
      pluck(m,0,.050,idleGain);
      if(idleBeat%2===1) pluck(m*1.5,.08,.022,idleGain);

      // 4拍ごとに柔らかい低音と和音
      if(idleBeat%4===0){
        tone(bass,.38,'triangle',.038,0,idleGain);
        tone(bass*2,.32,'sine',.025,.03,idleGain);
        tone(bass*2.5,.28,'triangle',.018,.06,idleGain);
      }

      // 8拍ごとに小さなアクセント
      if(idleBeat%8===7){
        tone(1046.50,.12,'triangle',.030,.02,idleGain);
        tone(1318.51,.10,'sine',.018,.08,idleGain);
      }
      idleBeat++;
    };
    tick();
    idleTimer=setInterval(tick,235);
  }

  function stopIdleBgm(){
    if(idleTimer){ clearInterval(idleTimer); idleTimer=null; }
  }

  function resumeIdleBgm(delay=0){
    if(!musicEnabled) return;
    setTimeout(()=>{
      if(!rolling && musicEnabled) startIdleBgm();
    },delay);
  }
  function clickFx(){ tone(520,.05,'square',.055); tone(780,.07,'triangle',.05,.035); }
  function suspenseFx(step){
    const f=220*Math.pow(2,(step%12)/12);
    tone(f,.06,'triangle',.055);
  }
  function winnerFx(){
    [523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(f,.5,'triangle',.12,i*.075));
    [261.63,392,523.25].forEach((f,i)=>tone(f,.75,'sawtooth',.035,i*.02));
  }

  // ---------- UI ----------
  function seatLabel(index){
    const physicalRow=Math.floor(index/COLS);
    const physicalCol=index%COLS;
    const displayRow=teacherView ? (ROWS-physicalRow) : (physicalRow+1);
    const displayCol=teacherView ? (COLS-physicalCol) : (physicalCol+1);
    return `画面上から${displayRow}列目・左から${displayCol}番`;
  }
  function renderSeats(){
    seatsEl.innerHTML='';
    for(let displayIndex=0; displayIndex<TOTAL; displayIndex++){
      const displayRow=Math.floor(displayIndex/COLS);
      const displayCol=displayIndex%COLS;

      // 教員目線では前後・左右の両方を反転（座席表全体を180°回転）
      const physicalRow=teacherView ? (ROWS-1-displayRow) : displayRow;
      const physicalCol=teacherView ? (COLS-1-displayCol) : displayCol;
      const i=physicalRow*COLS+physicalCol;
      const person=assignments[i];

      const b=document.createElement('button');
      b.className='seat'+(person?' filled':'');
      b.dataset.index=i;
      b.innerHTML=`<span class="pos">${displayRow+1}-${displayCol+1}</span>
                   <span class="person">${person??'？'}</span>
                   <span class="hint">${person?'決定済み':'この席を選ぶ'}</span>`;
      if(!person) {
        b.addEventListener('click',()=>{
          if(directMode) openDirectAssign(i);
          else runRoulette(i,b);
        });
      }
      seatsEl.appendChild(b);
    }
  }
  function getStudentNumber(person){
    const idx=roster.indexOf(person);
    return idx>=0 ? idx+1 : '';
  }
  function gridNumbers(isTeacher){
    const rows=[];
    for(let displayRow=0;displayRow<ROWS;displayRow++){
      const vals=[];
      for(let displayCol=0;displayCol<COLS;displayCol++){
        const physicalRow=isTeacher ? (ROWS-1-displayRow) : displayRow;
        const physicalCol=isTeacher ? (COLS-1-displayCol) : displayCol;
        const person=assignments[physicalRow*COLS+physicalCol];
        vals.push(person ? getStudentNumber(person) : '');
      }
      rows.push(vals);
    }
    return rows;
  }
  function gridToTSV(rows){
    return rows.map(row=>row.join('\t')).join('\n');
  }
  function updateExport(){
    const finished=remaining.length===0;
    exportPanel.classList.toggle('show',finished);
    if(!finished) return;
    studentPreview.textContent=gridToTSV(gridNumbers(false));
    teacherPreview.textContent=gridToTSV(gridNumbers(true));
  }
  function updateInfo(){
    fixedCount.textContent=TOTAL-remaining.length;
    remainCount.textContent=remaining.length;
    chipsEl.innerHTML=remaining.map(x=>`<span class="chip">${escapeHtml(x)}</span>`).join('');
    doneBanner.classList.toggle('show',remaining.length===0);
    updateExport();
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function lockSeats(on){
    [...document.querySelectorAll('.seat')].forEach(x=>x.classList.toggle('locked',on));
  }


  function setDirectMode(on){
    if(rolling) return;
    directMode=on;
    const btn=document.getElementById('directModeBtn');
    const note=document.getElementById('modeNote');
    btn.classList.toggle('mode-active',directMode);
    btn.textContent=directMode?'🎯 指定席モード ON':'📌 指定席モード';
    note.classList.toggle('show',directMode);
    if(directMode){
      statusEl.textContent='指定席モード';
      rouletteText.textContent='SELECT';
      rouletteSub.textContent='空いている席をクリックしてください';
    }else{
      resetDisplay();
    }
  }

  const directOverlay=document.getElementById('directOverlay');
  const studentList=document.getElementById('studentList');
  const directSeatLabel=document.getElementById('directSeatLabel');

  function openDirectAssign(index){
    if(rolling || assignments[index] || remaining.length===0) return;
    directSeatIndex=index;
    directSeatLabel.textContent=`${seatLabel(index)} に座る生徒を選んでください。`;
    studentList.innerHTML='';
    remaining.forEach(person=>{
      const btn=document.createElement('button');
      btn.className='student-choice';
      btn.textContent=person;
      btn.addEventListener('click',()=>assignDirect(person));
      studentList.appendChild(btn);
    });
    directOverlay.classList.add('show');
  }

  function assignDirect(person){
    if(directSeatIndex===null) return;
    const idx=remaining.indexOf(person);
    if(idx<0) return;
    assignments[directSeatIndex]=person;
    remaining.splice(idx,1);
    stopIdleBgm();
    clickFx();
    winnerFx();
    winnerWho.textContent=person;
    winnerWhere.textContent=`→ ${seatLabel(directSeatIndex)}`;
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    winnerPop.classList.remove('show'); void winnerPop.offsetWidth; winnerPop.classList.add('show');
    burstConfetti(false);
    directOverlay.classList.remove('show');
    directSeatIndex=null;
    renderSeats();
    updateInfo();
    if(remaining.length===0){
      statusEl.textContent='全員決定！';
      rouletteText.textContent='DONE!';
      rouletteSub.textContent='席替え完了 🎉';
      finale();
    }else{
      statusEl.textContent='指定席を設定しました';
      rouletteText.textContent=person;
      rouletteSub.textContent=directMode?'次の空いている席をクリック！':'次の席を選んでください';
    }
    resumeIdleBgm(900);
  }

  async function runRoulette(index, seat){
    if(rolling || assignments[index] || remaining.length===0) return;
    rolling=true; lockSeats(true); seat.classList.add('rolling');
    stopIdleBgm();
    clickFx(); startBgm();
    statusEl.textContent='ルーレット中…';
    rouletteSub.textContent=`${seatLabel(index)} の席を決めています`;
    let elapsed=0, tick=48, shown='';
    const totalTime=2900;
    while(elapsed<totalTime){
      shown=remaining[Math.floor(Math.random()*remaining.length)];
      rouletteText.textContent=shown;
      suspenseFx(Math.floor(elapsed/80));
      await wait(tick);
      elapsed+=tick;
      tick=Math.min(210,tick*1.075);
    }
    const winnerIndex=Math.floor(Math.random()*remaining.length);
    const winner=remaining[winnerIndex];
    remaining.splice(winnerIndex,1);
    assignments[index]=winner;

    stopBgm();
    winnerFx();
    rouletteText.textContent=winner;
    statusEl.textContent='決定！';
    rouletteSub.textContent=seatLabel(index);
    winnerWho.textContent=winner;
    winnerWhere.textContent=`→ ${seatLabel(index)}`;
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    winnerPop.classList.remove('show'); void winnerPop.offsetWidth; winnerPop.classList.add('show');
    burstConfetti();

    renderSeats(); updateInfo();
    await wait(1150);
    if(remaining.length){
      statusEl.textContent='次の席を選んでください';
      rouletteSub.textContent='空いている席をクリック！';
    }else{
      statusEl.textContent='全員決定！';
      rouletteSub.textContent='席替え完了 🎉';
      finale();
    }
    rolling=false; lockSeats(false);
    resumeIdleBgm(250);
  }
  const wait=ms=>new Promise(r=>setTimeout(r,ms));

  // ---------- Confetti ----------
  const canvas=document.getElementById('confetti'),ctx=canvas.getContext('2d');
  let particles=[],confettiRunning=false;
  function sizeCanvas(){canvas.width=innerWidth*devicePixelRatio;canvas.height=innerHeight*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}
  addEventListener('resize',sizeCanvas);sizeCanvas();
  function burstConfetti(big=false){
    const n=big?260:110;
    const shapes=['■','●','▲','★'];
    for(let i=0;i<n;i++){
      particles.push({
        x:innerWidth/2+(Math.random()-.5)*(big?500:180),y:innerHeight*.43,
        vx:(Math.random()-.5)*(big?16:11),vy:-Math.random()*(big?14:10)-3,
        g:.22+Math.random()*.12,rot:Math.random()*6.28,vr:(Math.random()-.5)*.28,
        life:80+Math.random()*60,size:5+Math.random()*8,
        hue:Math.random()*360,shape:shapes[Math.floor(Math.random()*shapes.length)]
      });
    }
    if(!confettiRunning){confettiRunning=true;requestAnimationFrame(drawConfetti)}
  }
  function drawConfetti(){
    ctx.clearRect(0,0,innerWidth,innerHeight);
    particles.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.rot+=p.vr;p.life--;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
      ctx.fillStyle=`hsl(${p.hue} 90% 60%)`;ctx.font=`${p.size*1.5}px sans-serif`;
      ctx.fillText(p.shape,-p.size/2,p.size/2);ctx.restore();
    });
    particles=particles.filter(p=>p.life>0&&p.y<innerHeight+40);
    if(particles.length) requestAnimationFrame(drawConfetti);
    else {confettiRunning=false;ctx.clearRect(0,0,innerWidth,innerHeight);}
  }
  function finale(){
    burstConfetti(true);
    if(musicEnabled){
      [261.63,329.63,392,523.25].forEach((f,i)=>tone(f,1.1,'triangle',.13,i*.08));
      setTimeout(()=>burstConfetti(true),550);
    }
  }

  // ---------- View / Excel copy ----------
  function updateViewUi(){
    const viewBtn=document.getElementById('viewBtn');
    roomEl.classList.toggle('teacher-view',teacherView);
    if(teacherView){
      viewBtn.textContent='🧑‍🎓 生徒目線に切替';
      viewBtn.classList.add('mode-active');
      viewBadge.textContent='👨‍🏫 教員目線（前後・左右を180°反転）';
    }else{
      viewBtn.textContent='👨‍🏫 教員目線に切替';
      viewBtn.classList.remove('mode-active');
      viewBadge.textContent='🧑‍🎓 生徒目線（黒板に向かって見た並び）';
    }
  }

  async function copyForExcel(textToCopy, statusEl){
    let ok=false;
    try{
      if(navigator.clipboard && window.isSecureContext){
        await navigator.clipboard.writeText(textToCopy);
        ok=true;
      }
    }catch(e){}
    if(!ok){
      const ta=document.createElement('textarea');
      ta.value=textToCopy;
      ta.style.position='fixed';
      ta.style.left='-9999px';
      ta.style.top='0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try{ ok=document.execCommand('copy'); }catch(e){ ok=false; }
      ta.remove();
    }
    statusEl.textContent=ok?'✓ コピーしました。Excelに貼り付けてください。':'コピーできませんでした。下の番号を選択してコピーしてください。';
    setTimeout(()=>statusEl.textContent='',2600);
  }

  // ---------- Controls ----------
  const overlay=document.getElementById('overlay');
  const rosterInput=document.getElementById('rosterInput');
  document.getElementById('directModeBtn').onclick=()=>{
    if(rolling)return;
    setDirectMode(!directMode);
  };

  document.getElementById('viewBtn').onclick=()=>{
    if(rolling)return;
    teacherView=!teacherView;
    updateViewUi();
    renderSeats();
  };

  document.getElementById('copyStudentBtn').onclick=()=>{
    copyForExcel(gridToTSV(gridNumbers(false)),studentCopyStatus);
  };
  document.getElementById('copyTeacherBtn').onclick=()=>{
    copyForExcel(gridToTSV(gridNumbers(true)),teacherCopyStatus);
  };

  document.getElementById('cancelDirect').onclick=()=>{
    directOverlay.classList.remove('show');
    directSeatIndex=null;
  };

  document.getElementById('editBtn').onclick=()=>{
    if(rolling)return;
    rosterInput.value=roster.join('\n');overlay.classList.add('show');
  };
  document.getElementById('cancelEdit').onclick=()=>overlay.classList.remove('show');
  document.getElementById('saveRoster').onclick=()=>{
    const lines=rosterInput.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if(lines.length!==42){alert(`42人分入力してください。現在 ${lines.length} 人です。`);return;}
    if(new Set(lines).size!==42){alert('同じ名前・番号が重複しています。42人を区別できるようにしてください。');return;}
    roster=lines;remaining=[...roster];assignments=Array(TOTAL).fill(null);
    overlay.classList.remove('show');
    setDirectMode(false);
    resetDisplay(); renderSeats();updateInfo();
    if(audioStarted) resumeIdleBgm(150);
  };
  document.getElementById('resetBtn').onclick=()=>{
    if(rolling)return;
    if((TOTAL-remaining.length)>0 && !confirm('現在の席順をすべて消して、最初からやり直しますか？'))return;
    remaining=[...roster];assignments=Array(TOTAL).fill(null);stopBgm();stopIdleBgm();
    setDirectMode(false);
    resetDisplay();renderSeats();updateInfo();
    if(audioStarted) resumeIdleBgm(150);
  };
  function resetDisplay(){
    statusEl.textContent='席を1つ選んでください';
    rouletteText.textContent='START!';
    rouletteSub.textContent='クリックすると音楽とルーレットが始まります';
  }
  document.getElementById('musicBtn').onclick=(e)=>{
    musicEnabled=!musicEnabled;
    e.currentTarget.textContent=musicEnabled?'🔊 BGM ON':'🔇 BGM OFF';
    if(!musicEnabled){
      stopBgm();
      stopIdleBgm();
    }else{
      ensureAudio();
      audioStarted=true;
      clickFx();
      if(!rolling) resumeIdleBgm(120);
    }
  };

  // ブラウザの自動再生制限対策：
  // 最初のユーザー操作をきっかけに待機BGMを開始する。
  const startAudioOnce=()=>{
    if(audioStarted || !musicEnabled) return;
    ensureAudio();
    audioStarted=true;
    if(!rolling) startIdleBgm();
  };
  document.addEventListener('pointerdown',startAudioOnce,{once:true});
  document.addEventListener('keydown',startAudioOnce,{once:true});

  updateViewUi();
  renderSeats();updateInfo();
})();
