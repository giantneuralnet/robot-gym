'use strict';
// Physics lives exclusively in workers; this coordinator owns the shared gene pool.
(function(E){
let workerURL;
function sourceURL(){if(!workerURL){const source=['physicsSource','engineSource','trainingWorkerSource'].map(id=>document.getElementById(id).textContent).join('\n');workerURL=URL.createObjectURL(new Blob([source],{type:'text/javascript'}))}return workerURL}
function hydrate(data,genome,index,model){return{...data,genome,index,pinSpecs:data.pinSpecs,hidden:data.hiddenLayers[0],motors:Array(data.motorCount),bodies:data.bodies.map(b=>({getPosition:()=>b.p,getWorldCenter:()=>b.center||b.p,getMass:()=>b.mass,getAngle:()=>b.angle})),joints:data.joints.map(j=>({getAnchorA:()=>j.a,isMotorEnabled:()=>j.powered})),muscles:data.muscles.map(m=>({joint:{getAnchorA:()=>m.a,getAnchorB:()=>m.b}}))}}
class ParallelEvolution extends E.Evolution{
 constructor(model,options){super(model,options);this.disposed=false;this.control={running:false,preview:true,speed:1};this.workers=[];this.workerCount=Math.min(8,Math.max(1,(navigator.hardwareConcurrency||2)-1),Math.ceil(this.population/4));this.failed=false;try{for(let i=0;i<this.workerCount;i++){const worker=new Worker(sourceURL(),{name:'Creature physics '+(i+1)});worker.onmessage=event=>this.receive(i,event.data);worker.onerror=event=>{event.preventDefault();this.fail(event.message||'Worker could not start')};this.workers.push(worker)}this.dispatch()}catch(error){setTimeout(()=>this.fail(error.message),0)}}
 spawn(genes){this.commands=this.goal==='joystick'?E.commandSequence(this.duration):null;if(!this.breeding){this.boundaryFrames=[];this.maxFrame=null}this.initialTrial=null;this.initialCreatures=new Array(genes.length);this.terrainSeed=this.rough&&!this.swimming?E.randomTerrainSeed(this.terrainSeed):null;this.genes=genes;this.creatures=genes.map((genome,index)=>({genome,index,score:0,failed:true}));this.steps=0;this.leader=this.creatures[0];this.world={};this.job=(this.job||0)+1;if(this.workers)this.dispatch()}
 dispatch(){if(this.disposed||this.failed)return;this.shards=this.workers.map((worker,i)=>{const start=Math.floor(i*this.genes.length/this.workers.length),end=Math.floor((i+1)*this.genes.length/this.workers.length);worker.postMessage({type:'start',job:this.job,model:this.model,genes:this.genes.slice(start,end),rough:this.rough,swimming:this.swimming,terrainSeed:this.terrainSeed,goal:this.goal,commands:this.commands,duration:this.duration});return{start,end,steps:0,done:false}})}
 queueBoundary(phase,trial){this.boundaryFrames.push({phase,trial});if(this.boundaryFrames.length>8)this.boundaryFrames.splice(0,this.boundaryFrames.length-8)}
 receive(index,data){
  if(this.disposed||this.failed||data.job!==this.job)return;if(data.error){this.fail(data.error);return}
  const shard=this.shards[index];if(shard.done)return;shard.steps=data.steps;shard.done=data.done;
  if(data.creatures)data.creatures.forEach((c,i)=>{const at=shard.start+i,creature=hydrate(c,this.genes[at],at,this.model);this.creatures[at]=creature;if(data.initial)this.initialCreatures[at]=creature});
  if(data.initial)shard.initial=true;
  if(!this.initialTrial&&this.shards.every(s=>s.initial)){
   this.initialTrial={generation:this.generation,duration:this.duration,rough:this.rough,swimming:this.swimming,goal:this.goal,terrainSeed:this.terrainSeed,commands:this.commands,creatures:this.initialCreatures.slice(),leader:this.initialCreatures[0]};
   this.queueBoundary('start',this.initialTrial)
  }
  const steps=Math.min(...this.shards.map(s=>s.steps)),delta=steps-this.steps;this.steps=steps;this.totalSteps+=delta;this.onProgress?.(delta);
  const visible=this.creatures.filter(c=>c.bodies);if(visible.length)this.leader=visible.reduce((a,b)=>a.score>b.score?a:b);
  if(this.shards.every(s=>s.done)){this.breeding=true;this.nextGeneration();this.breeding=false;this.queueBoundary('final',this.lastTrial);this.onGeneration?.()}
 }
 setRunning(running,preview,speed){const next={running:!!running&&!this.failed,preview:!!preview,speed:Number.isFinite(speed)?speed:1};if(Object.keys(next).every(k=>next[k]===this.control[k]))return;this.control=next;for(const w of this.workers)w.postMessage({type:'control',...next})}
 fail(message){if(this.disposed||this.failed)return;this.failed=true;this.error=message;this.workers.forEach(w=>w.terminate());this.onError?.(message)}
 dispose(){this.disposed=true;this.workers.forEach(w=>w.terminate())}
 step(){/* Only Test playback steps on the page thread. */}
}
E.ParallelEvolution=ParallelEvolution;
})(CreatureEngine);
