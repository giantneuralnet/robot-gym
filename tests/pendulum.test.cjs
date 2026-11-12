const {run,els}=require('./gym.test.cjs'),assert=require('assert'),fs=require('fs'),path=require('path');
run("selectRig('pendulum');G.manual=true;switchGym('run');G.run=true");
assert.equal(run('G.sim.joints[0].getType()'),'prismatic-joint');
assert(!run('G.sim.joints[1].isMotorEnabled()'));
assert.equal(run('parseJointAnglePoses("[1.2, 30]")[0][0]'),1.2);
assert.equal(run('controllerObservation().jointTypes.join()'),'linear,rotary');
assert.equal(run('controllerObservation().parts[2].omega'),0);
assert.equal(run('pendulumControllerSource()'),fs.readFileSync(path.join(__dirname,'../controllers/inverted-pendulum.js'),'utf8'));
run('var balanceControl=new Function("state","memory",pendulumControllerSource());');
for(const delay of [1,2,4]){
 const result=run(`(()=>{resetSimulation();G.run=true;let pending=null,maxAngle=0,maxX=0;for(let i=0;i<7200;i++){
 if(i===1200)G.sim.bodies.get(3).applyAngularImpulse(.06,true);
 if(i===2400)G.sim.bodies.get(2).applyLinearImpulse(planck.Vec2(-.3,0),G.sim.bodies.get(2).getWorldCenter(),true);
 if(i%3===0&&!pending)pending={due:i+${delay},action:balanceControl(controllerObservation(),{})};
 if(pending&&i>=pending.due){G.sim.linearForces=pending.action.forces;pending=null}gymStep();
 maxAngle=Math.max(maxAngle,Math.abs(G.sim.bodies.get(3).getAngle()));maxX=Math.max(maxX,Math.abs(G.sim.bodies.get(2).getPosition().x));
 if(G.sim.joints[1].isMotorEnabled())throw Error('Pole motor enabled');
 }return {maxAngle,maxX,angle:G.sim.bodies.get(3).getAngle(),x:G.sim.bodies.get(2).getPosition().x}})()`);
 assert(result.maxAngle<.15,JSON.stringify(result));assert(result.maxX<.5);assert(Math.abs(result.angle)<.001);assert(Math.abs(result.x)<.01);console.log('120 s balancing with disturbances and '+delay+'-step delay:',result);
}
run('stopUserController()');assert(!run('G.sim.linearForces'));
run('resetSimulation();G.run=true;for(let i=0;i<240;i++)gymStep()');assert(run('Math.abs(G.sim.bodies.get(3).getAngle())>1'),'Uncontrolled pole actually falls');
run('resetSimulation();G.sim.targets[0]=1;for(let i=0;i<180;i++)gymStep()');assert(run('Math.abs(G.sim.joints[0].getJointTranslation()-1)<.02'),'Position servo works');
assert(run('Math.abs(G.sim.bodies.get(2).getAngle())<1e-8'),'Slider locks cart rotation');
run('const pendulumSave=JSON.parse(JSON.stringify(projectSnapshot()));selectRig("arm");adoptProject(pendulumSave);switchGym("run")');assert.equal(run('G.activeRig'),'pendulum');assert.equal(run('G.sim.joints[0].getType()'),'prismatic-joint');assert(!run('G.sim.joints[1].isMotorEnabled()'));
assert.throws(()=>run('validateProject({...projectSnapshot(),model:{...model,pins:model.pins.map(j=>({...j,kind:"linear",axis:NaN}))}})'));
run('switchGym("build");model.pins=[];addPinAt({x:0,y:-.45},true)');assert.equal(run('model.pins[0].kind'),'linear');assert.equal(run('model.pins[0].a'),1);
console.log('Linear tool, units, save/load, free hinge, force cleanup and genuine cart-pole balance pass');
// Exercise the real asynchronous result handler, including units and invalid force inputs.
const {box}=require('./gym.test.cjs');box.clearTimeout=()=>{};box.Worker=class{postMessage(){}terminate(){}};
run("selectRig('pendulum');G.manual=true;switchGym('run');G.run=true;$('enableController').checked=true;stepUserController();G.userController.worker.onmessage({data:{targets:[1,20],forces:[12,null]}})");
assert.equal(run('G.sim.targets[0]'),1);assert(Math.abs(run('G.sim.targets[1]')-Math.PI/9)<1e-9);assert.equal(run('G.sim.linearForces[0]'),12);
run("G.userController.worker.onmessage({data:{targets:[1,20],forces:[12,9]}})");assert(!run('G.userController'));assert(!run('G.sim.linearForces'));assert(!els.enableController.checked);
run("$('enableController').checked=true;stepUserController();G.userController.worker.onmessage({data:{targets:[.5,0]}})");assert.equal(run('G.sim.targets[0]'),.5);assert(!run('G.sim.linearForces'));run('stopUserController()');
console.log('Worker result validation, position/force modes and cleanup pass');
