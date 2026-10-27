const assert=require('assert');const {run,els,windowListeners}=require('./gym.test.cjs');
run("switchGym('run')");assert(run('G.run&&G.auto'));assert.equal(els.runModel.textContent,'Pause');
els.runModel.click();assert(run('!G.run&&!G.auto'));assert.equal(els.runModel.textContent,'Run');
run('G.sim.cube.setTransform(planck.Vec2(3,-3),0)');els.resetGym.click();
assert(run('!G.run&&!G.auto'),'Reset preserves Pause');assert.equal(els.runModel.textContent,'Run');
assert(run('Math.abs(G.sim.cube.getPosition().x-G.cubeStart.x)<1e-9'));assert(run('G.sim.joints.every(j=>Math.abs(j.getJointAngle())<1e-9)'));
run('gymFrame(.1)');assert.equal(run('G.steps'),0,'Paused reset does not step physics');
els.runModel.click();assert(run('G.run&&G.auto'));els.resetGym.click();assert(run('G.run&&G.auto'),'Reset preserves active model execution');assert.equal(els.runModel.textContent,'Pause');
const key=windowListeners.keydown.find(h=>h.opts?.capture).fn;
function press(code,keyValue){key({code,key:keyValue,target:{tagName:'CANVAS'},preventDefault(){},stopImmediatePropagation(){}})}
press('Space',' ');assert(run('!G.run&&!G.auto'));press('KeyR','r');assert(run('!G.run&&!G.auto'),'R also preserves Pause');press('Space',' ');assert(run('G.run&&G.auto'),'Space resumes via same toggle');
run("G.policy=null;G.auto=false;G.run=true;refreshGym()");assert.equal(els.runModel.textContent,'Pause');els.runModel.click();assert(!run('G.run'));els.runModel.click();assert(run('G.run&&!G.auto'),'Manual physics can resume without a model');els.resetGym.click();assert(run('G.run&&!G.auto'),'Manual reset does not start a model');
run("G.run=false;firePointer('pointerdown',G.sim.bodies.get(3).getPosition());refreshRunToggle()");assert.equal(els.runModel.textContent,'Run');els.resetGym.click();assert(run('!G.run&&!G.auto&&!G.drag'),'Reset during a paused drag stays paused');
console.log('One Run/Pause toggle, Space, paused/playing reset, manual simulation and paused drag reset: pass');
