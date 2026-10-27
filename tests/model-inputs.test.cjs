const {run,box}=require('./gym.test.cjs'),assert=require('assert');
run('createGymModel();const inputBase=sample(),inputMotion=E.clone(inputBase);inputMotion.v=inputMotion.v.map(()=>123);inputMotion.cube[2]=2.3;inputMotion.cube[3]=456;inputMotion.cube[4]=-789;inputMotion.t+=25;inputMotion.b=inputMotion.b.map(p=>p.map(v=>v+1))');
assert.equal(run('features(inputBase).length'),run('model.pins.length+2'));
assert(run('JSON.stringify(features(inputBase))===JSON.stringify(features(inputMotion))'),'Velocity, cube orientation, time and body poses must not enter model inputs');
run('const inputAngle=E.clone(inputBase);inputAngle.a[0]+=.1;const inputPosition=E.clone(inputBase);inputPosition.cube[0]+=.1');
assert(run('JSON.stringify(features(inputBase))!==JSON.stringify(features(inputAngle))'));
assert(run('JSON.stringify(features(inputBase))!==JSON.stringify(features(inputPosition))'));
run('createGymModel();const inputRows=neuralExamples();');assert.equal(run('G.policy.architecture.input'),9);assert(run('inputRows.every(r=>r.sequence.every(x=>x.length===9))'));assert(run('predictPolicy(G.policy,features(inputMotion)).every(Number.isFinite)'));assert(run('validateProject({format:"robot-gym",version:1,model,clips:G.clips,takes:G.takes,policy:E.clone(G.policy)}).policy!==null'));
// Incompatible saved networks are removed while the demonstrations remain.
run('const oldInputsProject={format:"robot-gym",version:1,model,clips:G.clips,takes:G.takes,policy:{...RobotTransformer.create({input:25,output:7,width:16,heads:2,ff:32,context:16}),mean:Array(25).fill(0),scale:Array(25).fill(1),outputMean:Array(7).fill(0),outputScale:Array(7).fill(.1)}};validateProject(oldInputsProject)');assert(run('oldInputsProject.policy===null'));assert(run('oldInputsProject.takes.length===G.takes.length&&G.takes.length>0'));
console.log('Raw angles/cube-only inputs, all memory windows, inference, save validation and preserved old takes: pass');
