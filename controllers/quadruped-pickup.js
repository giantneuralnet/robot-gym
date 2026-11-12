// Front-arm pickup for the Quadruped template. Reset before starting.
// Stand still, approach above the cube, descend, grip, then lift and hold.
if (state.joints.length !== 13 || !state.cube) return state.targets;
if (memory.start === undefined) {
  memory.start = state.time;
  memory.cubeX = state.cube.x;
  memory.previous = state.joints.slice(8);
}
let elapsed = state.time - memory.start - 1;
if (elapsed < 0) return Array(13).fill(0);
const phases = [[3,memory.cubeX-.1,-1.5,0], [4,memory.cubeX,-.67,0],
                [2,memory.cubeX,-.67,.4], [4,memory.cubeX-.5,-1.8,.4]];
let index=0;
while(index<phases.length-1 && elapsed>=phases[index][0]) elapsed-=phases[index++][0];
if(memory.phase!==index){memory.phase=index;memory.previous=state.targets.slice(8)}
const [duration,x,y,grip]=phases[index],body=state.parts.find(p=>p.id===1);
if(!memory.base) memory.base={x:body.x,y:body.y,angle:body.angle};
// Keep the settled stance as the reference, avoiding feedback oscillation.
const base=memory.base.angle*Math.PI/180,dx=x-(memory.base.x+.85*Math.cos(base)+.21*Math.sin(base));
const dy=y-(memory.base.y+.85*Math.sin(base)-.21*Math.cos(base));
const L1=Math.hypot(.3,.75),L2=.9;
const beta=Math.acos(Math.max(-1,Math.min(1,(dx*dx+dy*dy-L1*L1-L2*L2)/(2*L1*L2))));
const alpha=Math.atan2(dy,dx)-Math.atan2(L2*Math.sin(beta),L1+L2*Math.cos(beta));
const upper=alpha-Math.PI/2,forearm=alpha+beta-Math.PI/2;
const restUpper=Math.atan2(-.3,-.75),restForearm=-Math.PI/2;
const pose=[upper-base-restUpper,forearm-upper-(restForearm-restUpper),
            Math.PI/2-forearm+restForearm,grip,-grip].map(v=>v*180/Math.PI);
const blend=Math.min(1,elapsed/(duration*.75));
return [...Array(8).fill(0),...pose.map((v,i)=>memory.previous[i]+(v-memory.previous[i])*blend)];
