const {run,els}=require('./gym.test.cjs'),assert=require('assert');
run("switchGym('network');createGymModel();renderNetworkView()");
assert(els.networkEmpty.hidden);assert.equal(run('networkInputLabels(G.policy).length'),run('G.policy.architecture.input'));
assert(run("networkScene.nodes.some(n=>n.title==='Causal multi-head attention')"));
const nodes=run('networkViewState.nodes');
run("const realParams=G.policy.params;G.policy={...G.policy,epoch:99,params:new Proxy(realParams,{get(){throw Error('Architecture view read a weight')},ownKeys(){throw Error('Architecture view scanned weights')}})};renderNetworkView()");
assert.strictEqual(run('networkViewState.nodes'),nodes,'Training changes do not rebuild architecture');
run('G.policy={...G.policy,params:realParams};G.modelConfig.layers=3;G.modelConfig.width=32;G.modelConfig.heads=4;G.modelConfig.ff=64;G.modelConfig.context=64;createGymModel();renderNetworkView()');
assert.equal(run('networkScene.layers.length'),3);assert(run("networkScene.nodes.some(n=>n.title==='Feed forward · GELU'&&n.detail==='32 → 64 → 32')"));
for(const type of ['feedforward','rnn','lstm','act','transformer']){run(`G.modelConfig.type=${JSON.stringify(type)};createGymModel();renderNetworkView()`);assert(run('networkScene.nodes.length>0'));assert.equal(run('networkScene.type'),type)}
run('G.policy=null;renderNetworkView()');assert(!els.networkEmpty.hidden);assert.equal(run('networkScene.nodes.length'),0);
const html=require('fs').readFileSync(require('path').join(__dirname,'../app.html'),'utf8');assert(!html.includes('id="networkMatrixPanel"')&&!html.includes('id="networkColorMode"'));
console.log('Architecture-only diagram: no parameter reads or checkpoint updates, changing dimensions, all model types and no matrix UI: pass');
