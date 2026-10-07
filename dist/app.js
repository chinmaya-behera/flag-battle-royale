(() => {
 'use strict';
 const $=id=>document.getElementById(id), countries=window.FLAG_COUNTRIES;
 const byCode=new Map(countries.map(c=>[c.code,c])),images=new Map();
 let selected=['in','br','jp','us','gb','de','fr','ca','au','za','es','ar','it','kr','mx','se'];
 let sound=false,audio=null,draft=new Set(),region='All';
 let accumulator=0,last=0,lastHUD=0,storageAvailable=true,session;
 try{const saved=JSON.parse(localStorage.getItem('flaglab-lineup'));if(Array.isArray(saved)){const valid=[...new Set(saved)].filter(c=>byCode.has(c));if(valid.length>=2)selected=valid;}}catch{storageAvailable=false;}
 const engine=new window.BattlePhysics(),canvas=$('arena'),ctx=canvas.getContext('2d');
 session=new window.BattlePhysics.EndlessBattle(engine,selected.map(code=>byCode.get(code)));
 const background=document.createElement('canvas');background.width=background.height=720;
 const bg=background.getContext('2d');bg.strokeStyle='#9abb6910';bg.lineWidth=1;
 for(let x=0;x<720;x+=24){bg.beginPath();bg.moveTo(x,0);bg.lineTo(x,720);bg.stroke();bg.beginPath();bg.moveTo(0,x);bg.lineTo(720,x);bg.stroke();}
 bg.strokeStyle='#80986412';for(const r of [90,180,260]){bg.beginPath();bg.arc(360,360,r,0,Math.PI*2);bg.stroke();}
 bg.setLineDash([2,9]);bg.strokeStyle='#69875d50';bg.beginPath();bg.arc(360,360,305,0,Math.PI*2);bg.stroke();
 bg.setLineDash([]);bg.font='9px monospace';bg.fillStyle='#6e817855';
 for(let i=0;i<72;i++){const a=i*Math.PI/36,r=i%6?313:309;bg.beginPath();bg.moveTo(360+Math.cos(a)*r,360+Math.sin(a)*r);bg.lineTo(360+Math.cos(a)*320,360+Math.sin(a)*320);bg.stroke();}
 for(const [label,x,y] of [['N',357,30],['S',357,699],['W',20,363],['E',691,363]])bg.fillText(label,x,y);
 bg.fillStyle='#eab6770c';for(let i=0;i<120;i++){const x=(i*173.3)%720,y=(i*83.7)%720;bg.fillRect(x,y,2+i%3,1);}
 // Rasterize vector artwork once. Drawing the SVG into every triangle is expensive.
 for(const c of countries){const image=new Image();image.onload=()=>{const texture=document.createElement('canvas');texture.width=128;texture.height=96;texture.getContext('2d').drawImage(image,0,0,128,96);images.set(c.code,texture);};image.src=c.flag;}
 function resize(){const size=Math.max(300,canvas.clientWidth),dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=canvas.height=Math.round(size*dpr);ctx.setTransform(canvas.width/720,0,0,canvas.height/720,0,0);draw();}
 new ResizeObserver(resize).observe($('arena-stage'));
 const flagHTML=c=>`<img src="${c.flag}" alt="" loading="lazy">`;
 function shuffleArray(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function saveLineup(){try{localStorage.setItem('flaglab-lineup',JSON.stringify(selected));}catch{storageAvailable=false;}}
 function updateSelection(){
  $('selected-preview').innerHTML=selected.slice(0,6).map(code=>{const c=byCode.get(code);return `<img src="${c.flag}" alt="${c.name}" title="${c.name}">`;}).join('')+(selected.length>6?`<span>+${selected.length-6}</span>`:'');
  $('size-badge').textContent=selected.length+' FLAGS';
  const old=$('battle-size').querySelector('option[data-custom]');if(old)old.remove();
  if(![8,16,32,64,128,250].includes(selected.length)){const option=new Option('Custom · '+selected.length+' flags',selected.length);option.dataset.custom='true';$('battle-size').add(option);}
  $('battle-size').value=selected.length;
 }
 function newArena(autostart=true){
  accumulator=0;lastSound=0;session.reset(selected.map(code=>byCode.get(code)));
  $('speed').disabled=false;$('speed').dispatchEvent(new Event('input'));
  $('winner').hidden=true;$('arena-hint').hidden=!autostart;
  $('feed').innerHTML='<div class="feed-empty"><svg viewBox="0 0 48 48"><path d="m27 5-16 23h11l-1 15 16-23H26z"/></svg><strong>Quiet before the chaos.</strong><p>Eliminations and big moments<br>will appear here.</p></div>';
  if(autostart)session.start();updateSelection();updateButtons();updateHUD();draw();
 }
 function beginSelectedArena(){newArena();}
 function updateTournamentHUD(){
  const tournament=session.tournament,waiting=session.remaining>0;
  $('tournament-banner').hidden=false;$('round-progress').hidden=false;
  $('round-label').textContent='CAMPAIGN '+session.cycle+' · '+(tournament.finished?'CHAMPION':'ROUND '+(tournament.index+1)+'/'+tournament.stages.length);
  $('round-target').textContent=tournament.finished?'LAST FLAG STANDING':waiting?tournament.contenders.length+' QUALIFIERS':tournament.target===1?'ONE SURVIVOR':'QUALIFY TOP '+tournament.target;
  $('round-duration').textContent=waiting?(session.running?'Auto starts in ':'On resume · ')+Math.ceil(session.remaining)+'s':'NO TIME LIMIT';
  $('round-path').innerHTML=tournament.stages.map((n,i)=>`<span class="${i<tournament.index||tournament.finished?'completed':i===tournament.index?'active':''}">${n}</span>`).join('<i>›</i>')+'<i>›</i><span class="'+(tournament.finished?'active':'')+'">🏆</span>';
  $('round-progress-fill').style.width=((engine.round.startCount-engine.aliveCount)/(engine.round.startCount-engine.round.target)*100)+'%';
  const gates=engine.exitOpen()?engine.getGates().length:0;
  $('exit-label').textContent=waiting?'AUTO · '+(tournament.finished?'NEXT CAMPAIGN':'NEXT ROUND'):gates+' OPEN GATE'+(gates===1?'':'S');
  $('gate-count').textContent=gates;$('cycle-count').textContent=String(session.cycle).padStart(2,'0');
  $('elimination-goal').textContent=(engine.round.startCount-engine.aliveCount)+' / '+(engine.round.startCount-engine.round.target)+' eliminated';
  $('gate-wave').textContent=waiting?'REARMING ARENA':engine.time<5?'GATES ARM IN '+Math.ceil(5-engine.time)+'s':'GATE WAVE '+(engine.gateWave+1)+' · RANDOM BREACHES';
 }
 function updateButtons(){
  $('start-label').textContent=session.running?'Pause battle':session.phase==='ready'?'Start campaign':'Resume campaign';
  $('start-symbol').textContent=session.running?'Ⅱ':'▶';$('status').classList.toggle('running',session.running);
  $('status').innerHTML='<span></span>'+({ready:'READY TO DEPLOY',running:'LIVE COMBAT · ENDLESS',intermission:'QUALIFIERS ADVANCE · AUTO',paused:'CAMPAIGN PAUSED',stopped:'CAMPAIGN STOPPED',champion:'CHAMPION · NEXT CAMPAIGN AUTO'}[session.phase]);
  $('stop').disabled=session.phase==='stopped'||session.phase==='ready';
 }
 function startPause(){if(session.running)session.pause();else session.start();$('arena-hint').hidden=true;accumulator=0;updateButtons();updateHUD();if(sound)ensureAudio();}
 function stopBattle(){session.stop();accumulator=0;updateButtons();updateHUD();showToast('Campaign stopped. Resume whenever you are ready.');}
 function updateHUD(){
  const alive=engine.bodies.filter(b=>!b.dead);$('alive').textContent=alive.length;$('out-count').textContent=(engine.bodies.length-alive.length)+' OUT';$('roster-count').textContent=alive.length;
  const seconds=Math.floor(engine.time);$('timer').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');$('timer').title='Elapsed round time · no time limit';
  $('roster').innerHTML=alive.map(b=>`<div class="roster-row">${flagHTML(b.country)}<span>${b.country.name}</span><span class="health"><i style="width:${Math.max(0,b.hp)}%;background:${b.hp>50?'#c7f36b':b.hp>25?'#edb85c':'#ed7560'}"></i></span></div>`).join('');
  updateTournamentHUD();
 }
 function addEvent(country,reason,win=false){
  const empty=$('feed').querySelector('.feed-empty');if(empty)empty.remove();const row=document.createElement('div');row.className='feed-event'+(win?' win':'');
  const seconds=Math.floor(engine.time+1e-7),stamp=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  row.innerHTML=(country?flagHTML(country):'<span>✳</span>')+`<div><strong>${country?country.name:'Arena command'}</strong><small>${reason}</small></div><time>${stamp}</time>`;$('feed').prepend(row);
  while($('feed').children.length>80)$('feed').lastElementChild.remove();
 }
 engine.onEliminate=(body,reason)=>{addEvent(body.country,reason);if(sound)tone(170,.12,.025);};
 let lastSound=0;engine.onImpact=strength=>{if(sound&&engine.time-lastSound>.09){lastSound=engine.time;tone(100+Math.min(400,strength),.035,.008);}};
 function showWinner(winner){
  addEvent(winner.country,'Campaign '+session.cycle+' champion',true);
  $('winner-name').textContent=winner.country.name;$('winner-copy').textContent='Campaign '+session.cycle+' won. The full lineup returns automatically.';
  $('winner-flag').hidden=!winner;if(winner){$('winner-flag').src=winner.country.flag;$('winner-flag').alt=winner.country.name+' flag';}
  $('winner').hidden=false;if(sound)tone(660,.22,.025);
 }
 session.onChampion=showWinner;
 session.onChange=()=>{
  accumulator=0;lastSound=0;updateButtons();updateHUD();
  if(session.phase==='running'){$('winner').hidden=true;$('arena-hint').hidden=true;}
  if(session.phase==='intermission')addEvent(null,'Top '+session.tournament.contenders.length+' qualified · next round auto',true);
 };
 function ensureAudio(){try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{sound=false;}}
 function tone(frequency,duration,volume){if(!audio||audio.state!=='running')return;const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.setValueAtTime(frequency,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(frequency*.4,audio.currentTime+duration);gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}
 // Affine-map the SVG flag texture onto every simulated cloth triangle.
 function triangle(image,p0,p1,p2){
  const sx=image.width,sy=image.height;
  const u0=p0.u*sx,v0=p0.v*sy,u1=p1.u*sx,v1=p1.v*sy,u2=p2.u*sx,v2=p2.v*sy;
  const d=u0*(v1-v2)+u1*(v2-v0)+u2*(v0-v1);if(Math.abs(d)<1e-8)return;
  const a=(p0.x*(v1-v2)+p1.x*(v2-v0)+p2.x*(v0-v1))/d;
  const b=(p0.y*(v1-v2)+p1.y*(v2-v0)+p2.y*(v0-v1))/d;
  const c=(p0.x*(u2-u1)+p1.x*(u0-u2)+p2.x*(u1-u0))/d;
  const e=(p0.y*(u2-u1)+p1.y*(u0-u2)+p2.y*(u1-u0))/d;
  const tx=(p0.x*(u1*v2-u2*v1)+p1.x*(u2*v0-u0*v2)+p2.x*(u0*v1-u1*v0))/d;
  const ty=(p0.y*(u1*v2-u2*v1)+p1.y*(u2*v0-u0*v2)+p2.y*(u0*v1-u1*v0))/d;
  ctx.save();ctx.beginPath();const cx=(p0.x+p1.x+p2.x)/3,cy=(p0.y+p1.y+p2.y)/3;
  for(const [i,p] of [p0,p1,p2].entries()){const dx=p.x-cx,dy=p.y-cy,length=Math.hypot(dx,dy)||1;const x=p.x+dx/length*.35,y=p.y+dy/length*.35;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
  ctx.closePath();ctx.clip();ctx.transform(a,b,c,e,tx,ty);ctx.drawImage(image,0,0);ctx.restore();
 }
 function drawBody(b){
  const image=images.get(b.country.code);if(!image)return;const nodes=b.mesh,w=b.cols+1;
  ctx.globalAlpha=.28;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(b.x+2,b.y+6,b.r*.9,b.r*.62,b.angle,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  for(let y=0;y<b.rows;y++)for(let x=0;x<b.cols;x++){const i=y*w+x;triangle(image,nodes[i],nodes[i+1],nodes[i+w]);triangle(image,nodes[i+1],nodes[i+w+1],nodes[i+w]);}
  ctx.strokeStyle=b.flash>0?'#f7ffdb':'#e2ecd559';ctx.lineWidth=b.flash>0?1.7:.6;ctx.beginPath();const outline=[];
  for(let x=0;x<=b.cols;x++)outline.push(nodes[x]);for(let y=1;y<=b.rows;y++)outline.push(nodes[y*w+b.cols]);for(let x=b.cols-1;x>=0;x--)outline.push(nodes[b.rows*w+x]);for(let y=b.rows-1;y>0;y--)outline.push(nodes[y*w]);
  outline.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();
  const bar=b.r*1.4;ctx.fillStyle='#314029';ctx.fillRect(b.x-bar/2,b.y-b.r-8,bar,2);ctx.fillStyle=b.hp>50?'#c7f36b':b.hp>25?'#edb85c':'#ed7560';ctx.fillRect(b.x-bar/2,b.y-b.r-8,bar*Math.max(0,b.hp)/100,2);
  if($('mesh').checked){ctx.strokeStyle='#c7f36b65';ctx.lineWidth=.6;ctx.beginPath();for(const s of b.springs){ctx.moveTo(nodes[s.i].x,nodes[s.i].y);ctx.lineTo(nodes[s.j].x,nodes[s.j].y);}ctx.stroke();ctx.strokeStyle='#c7f36b35';ctx.setLineDash([2,3]);ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#fff6b2';for(const p of nodes){ctx.beginPath();ctx.arc(p.x,p.y,1.2,0,Math.PI*2);ctx.fill();}}
 }
 function draw(){
  ctx.clearRect(0,0,720,720);ctx.drawImage(background,0,0);
  ctx.lineCap='butt';ctx.strokeStyle='#90a58a';ctx.lineWidth=5;ctx.shadowColor='#95b97844';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(360,360,engine.radius,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
  if(engine.exitOpen())for(const gate of engine.getGates()){
   const {angle:a,width:w}=gate;
   // Erase the wall stroke at every physical gate, then draw a breach marker.
   ctx.save();ctx.globalCompositeOperation='destination-out';ctx.lineWidth=10;ctx.beginPath();ctx.arc(360,360,engine.radius,a-w/2,a+w/2);ctx.stroke();ctx.restore();
   ctx.strokeStyle='#f5b766';ctx.lineWidth=2;ctx.setLineDash([3,7]);ctx.beginPath();ctx.arc(360,360,engine.radius+9,a-w/2,a+w/2);ctx.stroke();ctx.setLineDash([]);
   for(const edge of [-1,1]){const ea=a+edge*w/2;ctx.fillStyle='#ffc377';ctx.beginPath();ctx.arc(360+Math.cos(ea)*engine.radius,360+Math.sin(ea)*engine.radius,4,0,Math.PI*2);ctx.fill();}
  }
  for(const b of engine.bodies)if(!b.dead)drawBody(b);
  for(const p of engine.debris){ctx.globalAlpha=Math.max(0,p.life/p.maxLife);if(p.country){const image=images.get(p.country.code);if(image){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);const sw=image.width/6,sh=image.height/4;ctx.drawImage(image,Math.min(image.width-sw,p.u*image.width),Math.min(image.height-sh,p.v*image.height),sw,sh,-p.size/2,-p.size/2,p.size,p.size);ctx.restore();}}else{ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}}ctx.globalAlpha=1;
 }
 function advance(delta){
  if(session.running&&session.remaining>0){engine.updateDebris(delta);session.tick(delta);}
  else if(session.running){accumulator+=delta*Number($('speed').value)/100;let steps=0;while(accumulator>=window.BattlePhysics.DT&&steps<90&&session.running&&session.remaining===0){accumulator-=window.BattlePhysics.DT;engine.step();steps++;}if(steps===90)accumulator=0;}
 }
 function frame(now){
  const delta=last?Math.min((now-last)/1000,.08):0;last=now;
  if(!document.hidden)advance(delta);
  draw();if(now-lastHUD>250){if(session.running)updateHUD();lastHUD=now;}requestAnimationFrame(frame);
 }
 // Background tabs may be throttled by the browser, but never cancel autoplay.
 setInterval(()=>{if(document.hidden){advance(.25);if(session.running)updateHUD();}},250);
 function slider(id,display,format,apply){const input=$(id),update=()=>{const n=Number(input.value),percent=(n-Number(input.min))/(Number(input.max)-Number(input.min))*100;input.style.background=`linear-gradient(to right,var(--lime) ${percent}%,#313b32 ${percent}%)`;$(display).textContent=format(n);apply(n);};input.addEventListener('input',update);update();}
 slider('gravity','gravity-value',n=>n===0?'Zero-G':n===210?'Earth':(n/210).toFixed(1)+' g',n=>engine.options.gravity=n);
 slider('bounce','bounce-value',()=>'100% · forever',()=>{engine.options.restitution=1;});slider('speed','speed-value',n=>(n/100)+'×',()=>{});
 $('particles').onchange=()=>{engine.options.particles=$('particles').checked;if(!engine.options.particles)engine.debris=[];};
 $('start').onclick=startPause;$('stop').onclick=stopBattle;$('winner-stop').onclick=stopBattle;$('reset').onclick=()=>newArena();$('play-again').onclick=()=>{session.start();session.tick(session.remaining);};
 $('shuffle').onclick=()=>{selected=shuffleArray(countries.map(c=>c.code)).slice(0,selected.length);saveLineup();beginSelectedArena();};
 $('battle-size').onchange=()=>{selected=shuffleArray(countries.map(c=>c.code)).slice(0,Number($('battle-size').value));saveLineup();beginSelectedArena();};
 const normalize=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
 function visibleCountries(){const query=normalize($('country-search').value);return countries.filter(c=>{const matchesRegion=region==='All'||(region==='Americas'?c.region.includes('America'):region==='Other'?!['Africa','Asia','Europe','Oceania'].includes(c.region)&&!c.region.includes('America'):c.region===region);return matchesRegion&&(!query||normalize(c.name).includes(query)||c.code.includes(query));});}
 function draftCount(){const n=draft.size;$('draft-count').textContent=n;$('apply-selection').disabled=n<2;$('selection-error').textContent=n<2?'Select at least two flags to start a battle.':storageAvailable?'Your lineup is saved on this device.':'Your lineup will last for this session.';}
 function renderCountries(){const visible=visibleCountries();$('filter-count').textContent='· '+visible.length+' shown';$('country-grid').innerHTML=visible.length?visible.map(c=>`<button class="country-option" data-code="${c.code}" aria-pressed="${draft.has(c.code)}" title="${c.name} (${c.code.toUpperCase()})">${flagHTML(c)}<span>${c.name}</span><i>${draft.has(c.code)?'✓':''}</i></button>`).join(''):'<p class="empty-search">No matching countries. Try a name or country code.</p>';draftCount();}
 function openFlags(){draft=new Set(selected);region='All';$('country-search').value='';$('custom-list').value='';$('import-message').textContent='';document.querySelectorAll('[data-region]').forEach(b=>b.classList.toggle('active',b.dataset.region===region));renderCountries();$('flag-dialog').showModal();}
 $('custom-flags').onclick=openFlags;$('close-flags').onclick=()=>$('flag-dialog').close();$('country-search').oninput=renderCountries;
 $('region-tabs').onclick=event=>{const button=event.target.closest('[data-region]');if(!button)return;region=button.dataset.region;document.querySelectorAll('[data-region]').forEach(b=>b.classList.toggle('active',b===button));renderCountries();};
 $('country-grid').onclick=event=>{const button=event.target.closest('[data-code]');if(!button)return;const code=button.dataset.code;if(draft.has(code))draft.delete(code);else draft.add(code);const checked=draft.has(code);button.setAttribute('aria-pressed',String(checked));button.querySelector('i').textContent=checked?'✓':'';draftCount();};
 $('select-visible').onclick=()=>{visibleCountries().forEach(c=>draft.add(c.code));renderCountries();};$('select-all').onclick=()=>{countries.forEach(c=>draft.add(c.code));renderCountries();};$('clear-selection').onclick=()=>{draft.clear();renderCountries();};
 const aliases={usa:'us',unitedstatesofamerica:'us',america:'us',uk:'gb',unitedkingdom:'gb',britain:'gb',england:'gb',southkorea:'kr',northkorea:'kp',russia:'ru',vietnam:'vn',taiwan:'tw',czechrepublic:'cz',ivorycoast:'ci',palestine:'ps',turkey:'tr',uae:'ae',congo:'cg',drcongo:'cd'};
 function importList(){const values=$('custom-list').value.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean);if(!values.length){$('import-message').textContent='Enter country names or codes first.';return;}const missed=[];let count=0;for(const value of values){const key=normalize(value),code=aliases[key]||(byCode.has(key)?key:countries.find(c=>normalize(c.name)===key)?.code);if(code){if(!draft.has(code))count++;draft.add(code);}else missed.push(value);}$('import-message').textContent=missed.length?'Not found: '+missed.join(', '):count+' flags added to your lineup.';renderCountries();}
 $('import-list').onclick=importList;$('custom-list').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();importList();}};
 $('apply-selection').onclick=()=>{if(draft.size<2)return;selected=[...draft];saveLineup();$('flag-dialog').close();beginSelectedArena();showToast('Campaign started. Every round and rematch plays automatically.');};
 let toastTimer;function showToast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3200);}
 $('help').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();
 for(const dialog of [$('flag-dialog'),$('help-dialog')])dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
 $('sound').onclick=()=>{sound=!sound;if(sound)ensureAudio();$('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'Mute sound':'Enable sound');$('sound').style.color=sound?'var(--lime)':'';if(sound)tone(300,.08,.025);showToast(sound?'Sound on':'Sound off');};
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.arena-panel').requestFullscreen();}catch{showToast('Fullscreen is unavailable in this preview.');}};
 document.addEventListener('keydown',event=>{if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||document.querySelector('dialog[open]')||/INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName))return;if(event.code==='Space'){event.preventDefault();startPause();}else if(event.key.toLowerCase()==='r')newArena();else if(event.key.toLowerCase()==='f')openFlags();else if(event.key.toLowerCase()==='s')stopBattle();});
 document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;});
 function hover(event){const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*720,y=(event.clientY-rect.top)/rect.height*720,body=engine.bodies.find(b=>!b.dead&&Math.hypot(b.x-x,b.y-y)<b.r+4);if(!body){$('tooltip').hidden=true;return;}$('tooltip').textContent=body.country.name;$('tooltip').style.left=Math.max(50,Math.min(rect.width-50,event.clientX-rect.left))+'px';$('tooltip').style.top=(event.clientY-rect.top-13)+'px';$('tooltip').hidden=false;}
 canvas.addEventListener('pointermove',hover);canvas.addEventListener('pointerdown',hover);canvas.addEventListener('pointerleave',()=>$('tooltip').hidden=true);
 const context=document.modelContext;
 if(context?.registerTool){const controller=new AbortController(),register=tool=>{try{Promise.resolve(context.registerTool(tool,{signal:controller.signal})).catch(()=>{});}catch{}};
  register({name:'read_flag_battle',description:'Read the endless campaign, physical eliminations, gates, and survivors.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({state:session.phase,running:session.running,cycle:session.cycle,lineup:selected.slice(),survivors:engine.bodies.filter(b=>!b.dead).map(b=>({code:b.country.code})),elapsedSeconds:Math.floor(engine.time),gates:engine.exitOpen()?engine.getGates():[],tournament:{round:session.tournament.index+1,target:session.tournament.target,history:session.tournament.history,finished:session.tournament.finished},transitionRemaining:session.remaining})});
  register({name:'configure_flag_lineup',description:'Set valid country codes and automatically start an endless campaign.',inputSchema:{type:'object',properties:{codes:{type:'array',items:{type:'string'},minItems:2,maxItems:250}},required:['codes'],additionalProperties:false},execute:input=>{if(!input||!Array.isArray(input.codes)||input.codes.some(c=>typeof c!=='string'||!byCode.has(c))||Object.keys(input).some(k=>k!=='codes'))throw new Error('Provide valid lowercase country codes.');const codes=[...new Set(input.codes)];if(codes.length<2||codes.length>250)throw new Error('Choose between 2 and 250 unique flags.');selected=codes;saveLineup();newArena();return {state:session.phase,lineup:selected.slice()};}});
  register({name:'start_flag_battle',description:'Start or resume the endless campaign.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:()=>{if(!session.running)startPause();return {state:session.phase,flags:selected.length};}});
  register({name:'stop_flag_battle',description:'Stop the game and all automatic round transitions until the user resumes.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:()=>{stopBattle();return {state:session.phase};}});
  window.addEventListener('pagehide',()=>controller.abort(),{once:true});
 }
 newArena();resize();requestAnimationFrame(frame);
})();
