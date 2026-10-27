const {run,els}=require('./gym.test.cjs'),assert=require('assert');
run("switchGym('learn');createGymModel();renderNetworkView()");
assert(!els.networkView.hidden);assert(els.networkEmpty.hidden);assert(!els.networkContents.hidden);
assert.equal(run('networkInputLabels(G.policy).length'),run('G.policy.architecture.input'));
assert.equal(run('networkViewState.cards.length'),run('Object.keys(G.policy.params).length'));
assert.equal(run('networkViewState.cards.reduce((n,c)=>n+c.rows*c.cols,0)'),run('Object.values(G.policy.params).reduce((n,p)=>n+p.length,0)'));
assert.equal(run('paintNetworkMatrices().changed'),0);
const cards=run('networkViewState.cards');
run('const nextParams=Object.fromEntries(Object.entries(G.policy.params).map(([k,v])=>[k,v.slice()]));nextParams.query[3]+=.0125;G.policy={...G.policy,params:nextParams,epoch:1};renderNetworkView()');
assert.strictEqual(run('networkViewState.cards'),cards,'Epoch keeps diagram elements');assert.equal(run('paintNetworkMatrices().changed'),1);assert(els.networkCheckpoint.textContent.includes('Epoch 1'));
const card=run("networkViewState.cards.find(c=>c.name==='query')");card.canvas.onpointermove({clientX:3.5/card.cols*1000,clientY:.5/card.rows*650});assert(els.networkProbe.textContent.includes('[0, 3]'));assert(els.networkProbe.textContent.includes('0.012500'));
els.networkColorMode.value='delta';els.networkColorMode.onchange();assert.equal(run('networkViewState.colorMode'),'delta');assert.equal(run('paintNetworkMatrices().changed'),1,'Switching color mode retains checkpoint difference');
run('G.modelConfig.layers=3;G.modelConfig.width=32;G.modelConfig.heads=4;G.modelConfig.ff=64;G.modelConfig.context=64;createGymModel();renderNetworkView()');assert.equal(run('networkViewState.cards.length'),39);assert.equal(run('paintNetworkMatrices().changed'),0,'New model starts with no change');assert.equal(run("networkViewState.cards.find(c=>c.name==='layer2_query').cols"),32);assert.equal(run("networkViewState.cards.find(c=>c.name==='position').rows"),64);
// Real optimizer updates, rather than generated animation, drive all displayed values.
run('const p=G.policy,g=RobotTransformer.zeros(p),seq=[Array(p.architecture.input).fill(.2)];RobotTransformer.accumulate(p,seq,Array(p.architecture.output).fill(.3),g);const trained={...p,params:Object.fromEntries(Object.entries(p.params).map(([k,v])=>[k,v.slice()]))};RobotTransformer.step(trained,g,1,RobotTransformer.optimizer(trained),.001);G.policy={...trained,epoch:1};renderNetworkView()');assert(run('paintNetworkMatrices().changed>100'));
run("const originalRenderBox=renderBox;renderBox=()=>{throw Error('Arm rendered in Train')};gymRender();renderBox=originalRenderBox;switchGym('teach')");assert(els.networkView.hidden);
run("switchGym('learn');G.policy=null;renderNetworkView()");assert(!els.networkEmpty.hidden);assert(els.networkContents.hidden);
console.log('Network diagram: all parameter cells, settings dimensions, real optimizer deltas, hover, modes and Train-only visibility pass');
run('createGymModel();renderNetworkView()');
const pixelCard=run('networkViewState.cards[0]');let image;pixelCard.canvas.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:p=>image=p});run('paintNetworkMatrices()');assert.equal(image.data.length,pixelCard.rows*pixelCard.cols*4);assert(image.data.every((v,i)=>i%4!==3||v===255));els.networkColorMode.value='weights';els.networkColorMode.onchange();assert(image.data.some((v,i)=>i%4!==3&&v>32),'Real weights have signed heatmap colors');
console.log('Heatmap raster contains one opaque pixel per parameter: pass');

run('renderNetworkView()');assert(els.networkMatrixPanel.hidden,'Matrices hidden until hover');
const queryNode=run("networkViewState.nodes.find(n=>n.keys.length===1&&n.keys[0]==='query')");queryNode.el.onpointerenter();assert(!els.networkMatrixPanel.hidden);assert(run("networkViewState.cards.every(c=>c.card.hidden===(c.name!=='query'))"));
queryNode.el.onclick();els.networkMain.onpointerleave();assert(els.networkMatrixPanel.hidden,'Mouse departure dismisses non-interactive preview');els.networkCloseMatrices.onclick();assert(els.networkMatrixPanel.hidden);queryNode.el.onfocus();assert(!els.networkMatrixPanel.hidden);els.networkMain.onkeydown({key:'Escape'});assert(els.networkMatrixPanel.hidden);
assert(run("networkViewState.nodes.some(n=>n.keys.includes('ff1')&&n.keys.includes('ff2'))"));console.log('Transformer block hover, exact matrix filtering, click pin, keyboard inspect and dismissal: pass');
