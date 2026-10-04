/* Fixed-step rigid particle collisions with a spring-connected cloth skin.
   Units are pixels, seconds, and arbitrary mass. No frame-count-dependent forces. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2, DT = 1 / 120;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const angleDiff = (a, b) => Math.atan2(Math.sin(a-b), Math.cos(a-b));
  class BattlePhysics {
    constructor(options = {}) {
      this.center = 360; this.radius = 290; this.gapWidth = .6;
      this.options = {gravity:210, restitution:1, damage:false, elastic:true, particles:true, ...options};
      this.onEliminate = () => {}; this.onImpact = () => {}; this.onFinish = () => {}; this.onRoundFinish = () => {};
      this.bodies = []; this.debris = []; this.time = 0; this.gapAngle = Math.PI/2;
      this.impacts = 0; this.finished = false; this.started = false;
    }
    reset(countries, random = Math.random) {
      this.time = 0; this.gapAngle = Math.PI/2; this.debris = []; this.impacts = 0;
      this.finished = false; this.started = false; this.random = random; this.round = null; this.aliveCount = countries.length;
      const n = countries.length, r = clamp(79 / Math.sqrt(n), 10, 24);
      this.bodies = countries.map((country, i) => {
        const theta = i * 2.399963229728653 + random()*.08;
        const distance = Math.sqrt((i+.5)/n) * (this.radius-r-34);
        const v = 65 + random()*90, a = random()*TAU;
        const body = {country, id:i, x:this.center+Math.cos(theta)*distance,
          y:this.center+Math.sin(theta)*distance, vx:Math.cos(a)*v, vy:Math.sin(a)*v,
          r, mass:1, invMass:1, angle:(random()-.5)*.32, omega:(random()-.5)*1.1,
          hp:100, dead:false, flash:0, mesh:[], springs:[], cols:n>64?2:6, rows:n>64?2:3};
        this.makeMesh(body); return body;
      });
      return this.bodies;
    }
    setRound(target, duration) {
      if(!Number.isInteger(target)||target<1||target>=this.bodies.length||!Number.isFinite(duration)||duration<35||duration>50)throw new Error('Invalid timed qualification round.');
      this.round={target,duration,startCount:this.bodies.length};
      this.options.elastic=true;this.options.restitution=1;this.options.damage=false;
    }
    get restitution(){return this.options.elastic?1:this.options.restitution;}
    exitOpen() {
      if(!this.round)return true;
      // Pace exits across the countdown, reserving enough places for the next stage.
      const {target,duration,startCount}=this.round;
      const allowed=Math.floor((startCount-target)*clamp((this.time-8)/(duration-8),0,1));
      return startCount-this.aliveCount<allowed&&this.aliveCount>target;
    }
    finishRound() {
      // A timed qualifier guarantees the advertised length. At the buzzer,
      // center-most flags fill any places not decided by physical gap exits.
      const contenders=this.bodies.filter(b=>!b.dead).sort((a,b)=>
        Math.hypot(a.x-this.center,a.y-this.center)-Math.hypot(b.x-this.center,b.y-this.center)||a.id-b.id);
      const survivors=contenders.slice(0,this.round.target);
      for(const b of contenders.slice(this.round.target))this.eliminate(b,'Round cutoff · outside top '+this.round.target);
      this.finished=true;
      this.onRoundFinish({survivors,startCount:this.round.startCount,target:this.round.target,duration:this.round.duration,elapsed:this.time});
    }
    makeMesh(b) {
      const c=Math.cos(b.angle), s=Math.sin(b.angle);
      for(let y=0;y<=b.rows;y++) for(let x=0;x<=b.cols;x++) {
        const u=x/b.cols, v=y/b.rows, lx=(u-.5)*b.r*1.74, ly=(v-.5)*b.r*1.3;
        b.mesh.push({x:b.x+lx*c-ly*s,y:b.y+lx*s+ly*c,vx:b.vx,vy:b.vy,lx,ly,u,v});
      }
      const add=(i,j)=>b.springs.push({i,j,length:Math.hypot(b.mesh[i].lx-b.mesh[j].lx,b.mesh[i].ly-b.mesh[j].ly)});
      for(let y=0;y<=b.rows;y++) for(let x=0;x<=b.cols;x++) {
        const i=y*(b.cols+1)+x;
        if(x<b.cols)add(i,i+1); if(y<b.rows)add(i,i+b.cols+1);
        if(x<b.cols&&y<b.rows){add(i,i+b.cols+2);add(i+1,i+b.cols+1);}
      }
    }
    isGap(angle, bodyRadius=0) {
      const margin=Math.asin(clamp(bodyRadius/this.radius,0,.95));
      return Math.abs(angleDiff(angle,this.gapAngle))<this.gapWidth/2-margin;
    }
    step(dt=DT) {
      if(this.finished){this.updateDebris(dt);return;}
      // Adaptive integration protects lossless fast-moving flags without a speed cap.
      let ratio=1;for(const b of this.bodies)if(!b.dead)ratio=Math.max(ratio,(Math.hypot(b.vx,b.vy)+Math.abs(this.options.gravity)*dt)*dt/(b.r*.45));
      const steps=Math.ceil(ratio);for(let i=0;i<steps&&!this.finished;i++)this.stepOnce(dt/steps);
    }
    stepOnce(dt) {
      this.time+=dt; this.gapAngle=(Math.PI/2+this.time*.34)%TAU;
      const alive=this.bodies.filter(b=>!b.dead);
      for(const b of alive) {
        b.vy+=this.options.gravity*dt;
        // Small air drag dissipates energy without adding artificial random kicks.
        if(!this.options.elastic){const drag=Math.exp(-.018*dt);b.vx*=drag;b.vy*=drag;
          const speed=Math.hypot(b.vx,b.vy);if(speed>460){b.vx*=460/speed;b.vy*=460/speed;}b.omega*=Math.exp(-.6*dt);}
        b.x+=b.vx*dt;b.y+=b.vy*dt;b.angle+=b.omega*dt;
        b.flash=Math.max(0,b.flash-dt);this.collideWall(b);
      }
      // Spatial hash: inspect nearby bodies rather than every pair in a world battle.
      const maxRadius=alive.reduce((m,b)=>Math.max(m,b.r),10), cell=maxRadius*2+2;
      for(let iteration=0;iteration<2;iteration++) {
        const grid=new Map();
        for(const b of alive){if(b.dead)continue;const x=Math.floor(b.x/cell),y=Math.floor(b.y/cell);const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(b);}
        for(const a of alive) {
          if(a.dead)continue;const x=Math.floor(a.x/cell),y=Math.floor(a.y/cell);
          for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++) {
            const candidates=grid.get(xx+','+yy);if(!candidates)continue;
            for(const b of candidates)if(b.id>a.id&&!b.dead)this.collidePair(a,b);
          }
        }
      }
      for(const b of alive){if(b.dead)continue;this.collideWall(b);if(this.options.damage&&!this.options.elastic&&b.hp<=0){this.eliminate(b,'Knocked out');continue;}this.updateMesh(b,dt);}
      this.updateDebris(dt);
      const survivors=this.bodies.filter(b=>!b.dead);
      if(this.started&&this.round){if(this.time+1e-8>=this.round.duration)this.finishRound();}
      else if(this.started&&survivors.length<=1){this.finished=true;this.onFinish(survivors[0]||null);}
    }
    collidePair(a,b) {
      const dx=b.x-a.x,dy=b.y-a.y,rr=a.r+b.r,d2=dx*dx+dy*dy;if(d2>=rr*rr)return false;
      const distance=Math.sqrt(d2),nx=distance>1e-6?dx/distance:1,ny=distance>1e-6?dy/distance:0;
      const invMass=a.invMass+b.invMass,overlap=rr-distance;
      a.x-=nx*overlap*a.invMass/invMass;b.x+=nx*overlap*b.invMass/invMass;
      a.y-=ny*overlap*a.invMass/invMass;b.y+=ny*overlap*b.invMass/invMass;
      const rvx=b.vx-a.vx,rvy=b.vy-a.vy,vn=rvx*nx+rvy*ny;
      if(vn>=0)return true;
      const impulse=-(1+this.restitution)*vn/invMass;
      a.vx-=impulse*nx*a.invMass;a.vy-=impulse*ny*a.invMass;
      b.vx+=impulse*nx*b.invMass;b.vy+=impulse*ny*b.invMass;
      const tx=-ny,ty=nx;
      const surface=(b.vx-a.vx)*tx+(b.vy-a.vy)*ty-b.omega*b.r-a.omega*a.r;
      const inertiaA=.5*a.mass*a.r*a.r,inertiaB=.5*b.mass*b.r*b.r;
      const friction=this.options.elastic?0:clamp(-surface/(invMass+a.r*a.r/inertiaA+b.r*b.r/inertiaB),-impulse*.14,impulse*.14);
      a.vx-=friction*tx*a.invMass;a.vy-=friction*ty*a.invMass;
      b.vx+=friction*tx*b.invMass;b.vy+=friction*ty*b.invMass;
      a.omega-=friction*a.r/inertiaA;b.omega-=friction*b.r/inertiaB;
      a.flash=b.flash=.1;
      if(-vn>70){const damage=clamp((-vn-90)*.022,0,12);if(this.options.damage&&!this.options.elastic){a.hp-=damage;b.hp-=damage;}this.impact(a.x+nx*a.r,a.y+ny*a.r,-vn,a,b);}
      return true;
    }
    collideWall(b) {
      if(b.dead)return;
      const dx=b.x-this.center,dy=b.y-this.center,dist=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
      if(dist+b.r>=this.radius) {
        if(this.isGap(angle,b.r)&&this.exitOpen()) {if(dist>this.radius+b.r+2)this.eliminate(b,'Escaped through the gap');}
        else if(dist>0) {
          const nx=dx/dist,ny=dy/dist;
          b.x=this.center+nx*(this.radius-b.r);b.y=this.center+ny*(this.radius-b.r);
          const vn=b.vx*nx+b.vy*ny;
          if(vn>0){b.vx-=(1+this.restitution)*vn*nx;b.vy-=(1+this.restitution)*vn*ny;
            if(!this.options.elastic){const tangent=-b.vx*ny+b.vy*nx;b.vx+=tangent*ny*.025;b.vy-=tangent*nx*.025;b.omega+=tangent/b.r*.015;}
            if(vn>130){if(this.options.damage&&!this.options.elastic)b.hp-=(vn-100)*.006;this.impact(b.x+nx*b.r,b.y+ny*b.r,vn,b);}}
        }
      }
      // Rounded gap endpoints also collide: flags cannot tunnel through the lips.
      if(!this.exitOpen()||this.gapWidth<=0)return;
      for(const edge of [-1,1]) {
        const a=this.gapAngle+edge*this.gapWidth/2,ex=this.center+Math.cos(a)*this.radius,ey=this.center+Math.sin(a)*this.radius;
        const xx=b.x-ex,yy=b.y-ey,d=Math.hypot(xx,yy),contact=b.r+2;
        if(d>=contact||d<1e-6)continue;
        const nx=xx/d,ny=yy/d;b.x+=nx*(contact-d);b.y+=ny*(contact-d);
        const wallVX=-Math.sin(a)*this.radius*.34,wallVY=Math.cos(a)*this.radius*.34;
        const vn=(b.vx-wallVX)*nx+(b.vy-wallVY)*ny;
        if(vn<0){b.vx-=(1+this.restitution)*vn*nx;b.vy-=(1+this.restitution)*vn*ny;}
      }
    }
    updateMesh(b,dt) {
      const c=Math.cos(b.angle),s=Math.sin(b.angle);
      for(const p of b.mesh) {
        const tx=b.x+p.lx*c-p.ly*s,ty=b.y+p.lx*s+p.ly*c;
        const wind=Math.sin(this.time*5+b.id+p.u*4)*10*p.u;
        p.vx+=((tx-p.x)*320+(b.vx-p.vx)*20)*dt;
        p.vy+=((ty-p.y)*320+(b.vy-p.vy)*20+wind)*dt;
        p.x+=p.vx*dt;p.y+=p.vy*dt;
      }
      for(let iteration=0;iteration<2;iteration++)for(const spring of b.springs) {
        const a=b.mesh[spring.i],d=b.mesh[spring.j],dx=d.x-a.x,dy=d.y-a.y,length=Math.hypot(dx,dy)||.001;
        const correction=(length-spring.length)/length*.32;
        a.x+=dx*correction;a.y+=dy*correction;d.x-=dx*correction;d.y-=dy*correction;
      }
      for(const p of b.mesh) {
        const dx=p.x-this.center,dy=p.y-this.center,d=Math.hypot(dx,dy);
        if(d>this.radius-1&&(!this.isGap(Math.atan2(dy,dx))||!this.exitOpen())) {
          const nx=dx/d,ny=dy/d;p.x=this.center+nx*(this.radius-1);p.y=this.center+ny*(this.radius-1);
          const vn=p.vx*nx+p.vy*ny;if(vn>0){p.vx-=(1+this.restitution)*vn*nx;p.vy-=(1+this.restitution)*vn*ny;}
        }
      }
    }
    impact(x,y,strength,a,b) {
      this.impacts++;this.onImpact(strength,a,b);
      if(!this.options.particles)return;
      const count=clamp(Math.round(strength/26),3,12);
      for(let i=0;i<count;i++){const angle=this.random()*TAU,v=25+this.random()*strength*.48;
        this.debris.push({x,y,vx:Math.cos(angle)*v,vy:Math.sin(angle)*v,life:.25+this.random()*.35,maxLife:.6,size:1+this.random()*1.5,color:i%2?'#c7f36b':'#eef6df'});}
      if(this.debris.length>450)this.debris.splice(0,this.debris.length-450);
    }
    eliminate(b,reason) {
      if(b.dead)return;b.dead=true;this.aliveCount--;b.hp=Math.max(0,b.hp);
      if(this.options.particles)for(const p of b.mesh){this.debris.push({x:p.x,y:p.y,vx:p.vx+(this.random()-.5)*90,vy:p.vy+(this.random()-.5)*90,life:.8+this.random()*.5,maxLife:1.3,size:b.r/4,color:'#c7f36b',country:b.country,u:p.u,v:p.v,angle:b.angle});}
      if(this.debris.length>900)this.debris.splice(0,this.debris.length-900);
      this.onEliminate(b,reason);
    }
    updateDebris(dt) {
      for(const p of this.debris){p.life-=dt;p.vy+=this.options.gravity*dt*.55;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.angle!==undefined)p.angle+=dt*2;}
      this.debris=this.debris.filter(p=>p.life>0);
    }
  }
  class WorldTournament {
    constructor(countries,random=Math.random) {
      if(countries.length!==250||new Set(countries.map(c=>c.code)).size!==250)throw new Error('A world tournament needs 250 unique flags.');
      this.stages=[250,128,64,32,16,8,4,2];this.contenders=countries.slice();this.random=random;
      this.index=0;this.finished=false;this.history=[];this.durations=this.stages.map(()=>35+Math.floor(random()*16));
    }
    get target(){return this.stages[this.index+1]||1;}
    prepare(engine){engine.reset(this.contenders,this.random);engine.setRound(this.target,this.durations[this.index]);}
    complete(result){
      if(this.finished||result.startCount!==this.contenders.length||result.duration!==this.durations[this.index]||result.elapsed+1e-8<result.duration||result.target!==this.target||result.survivors.length!==this.target||new Set(result.survivors.map(b=>b.country.code)).size!==this.target||result.survivors.some(b=>b.dead||!this.contenders.some(c=>c.code===b.country.code)))throw new Error('Invalid qualification results.');
      this.history.push({stage:this.contenders.length,target:this.target,duration:result.elapsed,qualifiers:result.survivors.map(b=>b.country.code)});
      this.contenders=result.survivors.map(b=>b.country);if(this.target===1)this.finished=true;else this.index++;
    }
  }
  BattlePhysics.WorldTournament=WorldTournament;
  BattlePhysics.DT=DT;BattlePhysics.angleDiff=angleDiff;
  if(typeof module!=='undefined'&&module.exports)module.exports=BattlePhysics;
  else root.BattlePhysics=BattlePhysics;
})(typeof window!=='undefined'?window:globalThis);
