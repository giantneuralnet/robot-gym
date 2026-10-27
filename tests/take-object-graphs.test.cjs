const assert=require('assert');
const {run,els}=require('./gym.test.cjs');
run(`G.objects=[{id:5,shape:'cube',x:1,y:-1,angle:0},{id:9,shape:'circle',x:2,y:-1,angle:0}];
const objectGraphTake={sampleHz:20,frames:[
 {t:4,a:[0,1,2,3,4,5,6],cube:[1,2,0,3,4],objectIds:[5,9],objects:[[1,2,0,3,4],[11,12,0,13,14]]},
 {t:4.05,a:[1,2,3,4,5,6,7],cube:[5,6,0,7,8],objectIds:[9,5],objects:[[15,16,0,17,18],[5,6,0,7,8]]}
]};G.takes=[objectGraphTake];takePredictionState.selected=0;takePredictionState.points=[];G.policy=null;`);
assert.equal(run('takeObjectGraphSeries(G.takes[0])[1].label'),'Circle 9');
assert.equal(run('takeObjectGraphSeries(G.takes[0])[1].points[1].vx'),17,'Series follows recorded IDs even when order changes');
assert.equal(run('takeObjectGraphSeries(G.takes[0])[0].points[1].x'),5);
assert.equal(run('takeGraphGroups()[1].curves.length'),4);
assert.equal(run('takeGraphGroups()[2].curves[3].traces[0].points[0].v'),14,'Recorded Y velocity, not derived position differences');
assert.equal(run('takeGraphGroups()[0].curves[0].traces[0].points.length'),2,'Raw joints are visible without a model');
run('const objectBefore=JSON.stringify(G.takes);renderTakeJointLegend();drawTakePrediction();toggleTakeGraphCurve("o:9:vy")');
assert(run('takePredictionState.hiddenSeries.has("o:9:vy")'));
run('toggleTakeGraphCurve("o:9:vy");toggleTakeGraphGroup("position")');
assert(run('takeGraphGroups()[1].curves.every(c=>takePredictionState.hiddenSeries.has(c.key))'));
assert(!run('takePredictionState.hiddenSeries.has("o:5:vx")'),'Position group leaves velocities alone');
run('toggleTakeGraphGroup("position")');assert(!run('takePredictionState.hiddenSeries.has("o:5:x")'));
assert(run('JSON.stringify(G.takes)===objectBefore'),'Toggling and plotting never alter recordings');
run('const legacyGraph={frames:[{t:0,cube:[2,3,0,4,5]},{t:.1,cube:[6,7]}]};');
assert.equal(run('takeObjectGraphSeries(legacyGraph)[0].points[0].vy'),5);
assert(run('takeObjectGraphSeries(legacyGraph)[0].points[1].vy===undefined'),'Missing old velocities stay gaps');
console.log('Recorded multi-object positions/velocities, stable IDs, legacy gaps, individual/group switches, and immutable takes: pass');
