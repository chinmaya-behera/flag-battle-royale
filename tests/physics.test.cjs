const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const Physics = require('../dist/physics.js');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(require.resolve('../dist/countries.js'),'utf8'),context);
const countries = context.window.FLAG_COUNTRIES;
function seeded(seed=99){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function make(n=2,options={}){const engine=new Physics({gravity:0,damage:false,particles:false,elastic:false,...options});engine.reset(countries.slice(0,n),seeded());return engine;}
test('all 250 flags are unique, valid SVG textures, including country edge cases',()=>{
 assert.equal(countries.length,250);assert.equal(new Set(countries.map(c=>c.code)).size,250);
 for(const code of ['in','us','gb','np','va','ps','tw','xk'])assert.ok(countries.some(c=>c.code===code));
 for(const c of countries){const svg=Buffer.from(c.flag.split(',')[1],'base64').toString();assert.match(svg,/<svg/);assert.ok(c.name&&c.region);}
});
test('head-on elastic collision exchanges velocity and conserves momentum',()=>{
 const e=make(2,{restitution:1}),[a,b]=e.bodies;a.x=300;a.y=360;b.x=300+a.r+b.r-2;b.y=360;a.vx=100;b.vx=-40;a.vy=b.vy=0;a.omega=b.omega=0;
 e.collidePair(a,b);assert.ok(Math.abs(a.vx+40)<1e-8);assert.ok(Math.abs(b.vx-100)<1e-8);assert.ok(Math.abs(a.vx+b.vx-60)<1e-8);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=a.r+b.r-1e-8);
});
test('inelastic collision dissipates energy and obeys restitution',()=>{
 const e=make(2,{restitution:.5}),[a,b]=e.bodies;a.x=300;a.y=360;b.x=300+a.r+b.r-1;b.y=360;a.vx=100;b.vx=-100;a.vy=b.vy=0;a.omega=b.omega=0;
 e.collidePair(a,b);assert.equal(a.vx,-50);assert.equal(b.vx,50);
});
test('wall reflects approaching bodies but does not reflect separating ones',()=>{
 const e=make(2,{restitution:.8}),b=e.bodies[0];b.x=e.center+e.radius-b.r+1;b.y=e.center;b.vx=100;b.vy=0;e.collideWall(b);assert.ok(Math.abs(b.vx+80)<1e-8);assert.ok(b.x<=e.center+e.radius-b.r);
 b.vx=-100;e.collideWall(b);assert.equal(b.vx,-100);
});
test('gap requires clearance, eliminates once, and solid wall prevents escape',()=>{
 const e=make(),b=e.bodies[0];let eliminations=0;e.onEliminate=()=>eliminations++;
 assert.ok(e.isGap(Math.PI/2,b.r));assert.ok(!e.isGap(Math.PI/2+.29,b.r));
 b.x=e.center;b.y=e.center+e.radius+b.r+5;e.collideWall(b);e.collideWall(b);assert.equal(eliminations,1);assert.ok(b.dead);
 const c=e.bodies[1];c.x=e.center+e.radius+c.r+5;c.y=e.center;e.collideWall(c);assert.ok(!c.dead);assert.ok(c.x<=e.center+e.radius-c.r);
});
test('particle skin deforms after an impulse and remains finite',()=>{
 const e=make(),b=e.bodies[0],old=b.mesh[0].x;b.x+=20;b.vx=250;e.updateMesh(b,Physics.DT);
 assert.ok(b.mesh[0].x!==old);for(let i=0;i<360;i++)e.updateMesh(b,Physics.DT);assert.ok(b.mesh.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('fixed timestep gives identical outcomes under 30 and 144 Hz rendering',()=>{
 function simulate(fps){const e=make(16,{gravity:210,damage:true});e.started=true;let acc=0;for(let i=0;i<fps*8;i++){acc+=1/fps;while(acc+1e-12>=Physics.DT){e.step();acc-=Physics.DT;}}return e;}
 const a=simulate(30),b=simulate(144);assert.ok(Math.abs(a.time-b.time)<1e-9);for(let i=0;i<a.bodies.length;i++){assert.ok(Math.abs(a.bodies[i].x-b.bodies[i].x)<1e-7);assert.equal(a.bodies[i].dead,b.bodies[i].dead);}
});
test('whole-world simulation stays finite under heavy gravity and completes',()=>{
 const e=make(250,{gravity:400,damage:true,particles:true});e.started=true;let winnerCount=0,eliminations=0;e.onFinish=()=>winnerCount++;e.onEliminate=()=>eliminations++;
 for(let i=0;i<120*240&&!e.finished;i++)e.step();
 assert.ok(e.finished,'battle must finish within four simulated minutes');assert.equal(winnerCount,1);assert.ok(eliminations>=249);assert.ok(e.bodies.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)&&Number.isFinite(b.vx)&&Number.isFinite(b.vy)));assert.ok(e.bodies.flatMap(b=>b.mesh).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('particle switch suppresses debris and reset clears battle state',()=>{
 const e=make(2,{particles:false});e.eliminate(e.bodies[0],'test');assert.equal(e.debris.length,0);e.reset(countries.slice(0,8),seeded());assert.equal(e.bodies.length,8);assert.ok(e.bodies.every(b=>!b.dead&&b.hp===100));assert.equal(e.time,0);assert.equal(e.finished,false);
});
test('perfect elasticity preserves oblique collision energy despite lower restitution and damage settings',()=>{
 const e=make(2,{elastic:true,restitution:.2,damage:true}),[a,b]=e.bodies;
 a.x=300;a.y=300;b.x=300+a.r+b.r-2;b.y=300;a.vx=220;a.vy=85;b.vx=-170;b.vy=-65;a.omega=2;b.omega=-3;
 const energy=()=>e.bodies.reduce((sum,p)=>sum+.5*p.mass*(p.vx*p.vx+p.vy*p.vy)+.25*p.mass*p.r*p.r*p.omega*p.omega,0);
 const before=energy();e.collidePair(a,b);assert.ok(Math.abs(energy()-before)<1e-8);assert.equal(a.hp,100);assert.equal(b.hp,100);assert.equal(e.restitution,1);
});
test('lossless bodies keep speed and rotation over 60 seconds of closed-wall bounces',()=>{
 const e=make(2,{elastic:true}),a=e.bodies[0];e.bodies[1].dead=true;e.aliveCount=1;e.gapWidth=0;
 a.x=e.center;a.y=e.center;a.vx=900;a.vy=120;a.omega=2;const speed=Math.hypot(a.vx,a.vy);
 for(let i=0;i<120*60;i++)e.step();
 assert.ok(Math.abs(Math.hypot(a.vx,a.vy)-speed)<1e-7);assert.equal(a.omega,2);assert.equal(a.hp,100);assert.ok(Math.hypot(a.x-e.center,a.y-e.center)<=e.radius-a.r+1e-7);
});
test('world tournament qualifies every exact bracket size within 35–50 seconds',()=>{
 for(const seed of [11,89]){
  const tournament=new Physics.WorldTournament(countries,seeded(seed));const engine=new Physics({particles:false});let result;
  engine.onRoundFinish=r=>{result=r;};
  while(!tournament.finished){
   tournament.prepare(engine);engine.started=true;result=null;let steps=0;
   while(!engine.finished&&steps++<120*51)engine.step();
   assert.ok(result);assert.ok(result.elapsed>=35-1e-8&&result.elapsed<=50+Physics.DT);
   assert.equal(result.survivors.length,tournament.target);assert.equal(engine.aliveCount,tournament.target);
   assert.ok(engine.bodies.every(b=>b.hp===100&&Number.isFinite(b.x)&&Number.isFinite(b.y)));
   assert.ok(engine.bodies.flatMap(b=>b.mesh).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
   tournament.complete(result);
  }
  assert.deepEqual(tournament.history.map(r=>r.stage),[250,128,64,32,16,8,4,2]);
  assert.deepEqual(tournament.history.map(r=>r.target),[128,64,32,16,8,4,2,1]);
  assert.equal(tournament.contenders.length,1);
 }
});
test('round pacing prevents early completion, overshooting qualifiers, and stale callbacks',()=>{
 const e=make(2,{elastic:true});e.setRound(1,35);e.started=true;let completions=0;e.onRoundFinish=()=>completions++;
 for(let i=0;i<120*34;i++)e.step();assert.equal(e.aliveCount,2);assert.equal(e.finished,false);
 for(let i=0;i<120*2;i++)e.step();assert.equal(e.aliveCount,1);assert.equal(completions,1);assert.ok(e.time>=35-1e-8);
 e.reset(countries.slice(0,16),seeded());assert.equal(e.round,null);assert.equal(e.aliveCount,16);assert.equal(e.finished,false);
});
test('tournament rejects duplicate entrants and premature or invalid round results',()=>{
 assert.throws(()=>new Physics.WorldTournament([...countries.slice(0,249),countries[0]]));
 const t=new Physics.WorldTournament(countries,seeded());assert.throws(()=>t.complete({target:128,startCount:250,duration:t.durations[0],elapsed:1,survivors:[]}));
 assert.equal(t.index,0);assert.equal(t.contenders.length,250);
});
