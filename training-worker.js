'use strict';
const E=CreatureEngine;
let trial=null,job=0,limit=0,running=false,preview=true,speed=1,timer=null,last=0,budget=0,lastReport=0,finished=false;
function report(done=false,initial=false){postMessage({job,steps:trial.steps,done,initial,creatures:done||initial||preview?trial.snapshot():null})}
function schedule(delay=0){if(timer===null&&running&&trial&&!finished)timer=setTimeout(pump,delay)}
function pump(){timer=null;if(!running||!trial||finished)return;const now=performance.now();budget=preview?Math.min(8,budget+(now-last)/1000*speed):Infinity;last=now;const end=now+12;let n=0;while(trial.steps<limit&&budget>=E.DT){trial.step();budget-=E.DT;n++;if(performance.now()>=end)break}finished=trial.steps>=limit;if(finished||performance.now()-lastReport>=(preview?33:100)){report(finished);lastReport=performance.now()}schedule(preview&&n===0?4:0)}
onmessage=({data:d})=>{try{if(d.type==='start'){job=d.job;trial=new E.Trial(d.model,d.genes,d.rough,d.terrainSeed,d.goal,d.swimming,d.commands);limit=Math.round(d.duration/E.DT);finished=false;budget=0;last=performance.now();lastReport=last;report(false,true);schedule()}else if(d.type==='control'){running=d.running;preview=d.preview;speed=d.speed;budget=0;last=performance.now();schedule()}}catch(error){running=false;postMessage({job,error:error.message||String(error)})}};
