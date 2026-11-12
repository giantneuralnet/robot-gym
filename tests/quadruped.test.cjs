const {run,els}=require('./gym.test.cjs'),assert=require('assert'),fs=require('fs'),path=require('path');
run("selectRig('quadruped');G.objects=[];G.manual=true;switchGym('run');G.run=true;var walk=new Function('state','memory',quadrupedControllerSource());");
assert.equal(run('model.boxes.length'),14);assert.equal(run('model.pins.length'),13);assert(!run('model.boxes.some(b=>b.anchored)'));assert.equal(run('E.validate(model)'),'');
assert.equal(run('quadrupedControllerSource()'),fs.readFileSync(path.join(__dirname,'../controllers/quadruped-walk.js'),'utf8'));
for(const delay of [0,2]){
 const result=run(`(()=>{resetSimulation();G.run=true;let memory={},pending=null,maxAngle=0,maxY=-99,maxArmError=0;for(let i=0;i<1800;i++){if(i%3===0)pending={due:i+${delay},targets:walk(controllerObservation(),memory)};if(pending&&i>=pending.due){G.sim.targets=pending.targets.map(v=>v*Math.PI/180);pending=null}gymStep();const body=G.sim.bodies.get(1);maxAngle=Math.max(maxAngle,Math.abs(body.getAngle()));maxY=Math.max(maxY,body.getPosition().y);for(let j=8;j<13;j++)maxArmError=Math.max(maxArmError,Math.abs(G.sim.joints[j].getJointAngle()-G.sim.targets[j]))}return {distance:G.sim.bodies.get(1).getPosition().x,maxAngle,maxY,maxArmError}})()`);
 assert(result.distance>5,JSON.stringify(result));assert(result.maxAngle<.2);assert(result.maxY< -1.2);assert(result.maxArmError<.15);console.log('30 second physical walk, '+delay+'-step control delay:',result);
}
run('const quadrupedSave=JSON.parse(JSON.stringify(projectSnapshot()));selectRig("arm");adoptProject(quadrupedSave)');assert.equal(run('G.activeRig'),'quadruped');assert.equal(run('model.pins.length'),13);assert.equal(run('G.follow.id'),12);run("switchGym('run');$('loadWalkController').click()");assert(els.enableController.checked);assert(run('G.manual'));assert(!els.loadWalkController.hidden);
run("resetSimulation();G.run=true;G.sim.bodies.get(1).setPosition(planck.Vec2(2,-1.43));$('followWalker').checked=true;const beforeCamera=cameras.gym.x;gymFrame(.01)");assert(run('cameras.gym.x>beforeCamera'));
console.log('Quadruped template, 14-part import/export, walk loader and following camera pass');

run("selectRig('quadruped');G.manual=true;switchGym('run');G.run=true;var pickup=new Function('state','memory',quadrupedPickupSource()),pickupMemory={}");
for(const delay of [0,1,2,3]){
const lifted=run(`(()=>{resetSimulation();G.run=true;let pending,memory={};for(let i=0;i<3600;i++){if(i%3===0&&!pending)pending={due:i+${delay},targets:pickup(controllerObservation(),memory)};if(pending&&i>=pending.due){G.sim.targets=pending.targets.map((v,j)=>clamp(v*Math.PI/180,jointLow(model.pins[j]),jointHigh(model.pins[j])));pending=null}gymStep()}const cube=G.sim.cube.getPosition(),wrist=G.sim.joints[10].getAnchorB();return {cubeY:cube.y,bodyAngle:G.sim.bodies.get(1).getAngle(),gripOffset:cube.y-wrist.y,gripX:Math.abs(cube.x-wrist.x)}})()`);
assert(lifted.cubeY < -1.15,JSON.stringify(lifted));assert(Math.abs(lifted.bodyAngle)<.15);assert(lifted.gripOffset>.15&&lifted.gripOffset<.7);assert(lifted.gripX<.2);console.log('60 second pickup and hold, delay '+delay+':',lifted);
}
