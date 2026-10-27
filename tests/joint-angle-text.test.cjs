const assert=require('assert');
const {run,els}=require('./gym.test.cjs');
run("switchGym('teach');G.teachNoise=false;resetSimulation();$('jointAngleInput').value='[30, -12, 0, 5, 0, -5, 0] [0, 20, 0, 0, 0, 0, 0]';applyJointAngleText()");
assert(run('G.run&&!G.auto&&!G.followEngaged&&!G.sessionRecording'));
assert.equal(run('G.playing.clip.frames.length'),3);
run('for(let i=0;i<45;i++)gymStep()');
assert(Math.abs(run('G.sim.targets[0]')-Math.PI/6)<1e-8);
run('for(let i=0;i<60;i++)gymStep();gymFrame(0)');
assert(!run('G.playing'));
assert(Math.abs(run('G.sim.targets[1]')-20*Math.PI/180)<1e-8);
assert.equal(els.jointAngle1.textContent,run("'J1 '+Math.round(G.sim.joints[0].getJointAngle()*180/Math.PI)+'°'"));
assert.equal(els.jointControlRows.children[0].children[1].textContent,'↺');
assert.equal(els.jointControlRows.children[0].children[2].textContent,'↻');
const oldTargets=run('JSON.stringify(G.sim.targets)');
for(const text of ['[1,2]','[0,,0,0,0,0,0]','[NaN,0,0,0,0,0,0]','[0,0,0,0,0,0,0] nope','[[0,0,0,0,0,0,0]]']){
 els.jointAngleInput.value=text;run('applyJointAngleText()');assert(!els.jointAngleError.hidden);assert.equal(run('JSON.stringify(G.sim.targets)'),oldTargets);
}
run("$('jointAngleInput').value='[90,0,0,0,0,0,0]';applyJointAngleText();$('stopJoints').click()");assert(!run('G.playing'));
run("applyJointAngleText();resetSimulation()");assert(!run('G.playing'));
run("switchGym('clips');recordClipSlot(G.clips.length,'Angles');applyJointAngleText()");assert.equal(run('G.clipRecording.moved.size'),7);assert.equal(run('G.clipRecording.frames.length'),0,'Only + captures a clip pose');
run("switchGym('run');G.policy=null;applyJointAngleText();for(let i=0;i<50;i++)gymStep()");assert(Math.abs(run('G.sim.targets[0]')-Math.PI/2)<1e-8);
console.log('Bracketed poses, live angles, rotation icons, validation, Stop/reset, manual clips, Run without a model: pass');
