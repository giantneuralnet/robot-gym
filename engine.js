/* Creature physics and evolution. Motion comes from joints, muscles, ground
   contacts, and optional surface water resistance. No artificial thrust. */
(function(global){
'use strict';
const P=global.planck,TAU=Math.PI*2,DT=1/60;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const clone=v=>JSON.parse(JSON.stringify(v));
const rotate=(p,a)=>({x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)});
function localAnchor(box,p){const q=rotate({x:p.x-box.x,y:p.y-box.y},-box.angle);return{x:q.x/box.w,y:q.y/box.h}}
function anchor(box,p){const q=rotate({x:p.x*box.w,y:p.y*box.h},box.angle);return{x:box.x+q.x,y:box.y+q.y}}
function connected(model,start,skipPin=null){const seen=new Set([start]);let changed=true;const edges=[...model.pins.filter(j=>j.id!==skipPin),...(model.muscles||[])];while(changed){changed=false;for(const j of edges){if(seen.has(j.a)&&!seen.has(j.b)){seen.add(j.b);changed=true}if(seen.has(j.b)&&!seen.has(j.a)){seen.add(j.a);changed=true}}}return seen}
function hasLoops(model){const parent=new Map(model.boxes.map(b=>[b.id,b.id]));const root=x=>{while(parent.get(x)!==x)x=parent.get(x);return x};for(const p of model.pins){const a=root(p.a),b=root(p.b);if(a===b)return true;parent.set(a,b)}return false}
function validate(model){if(!model.boxes.length)return'Add a part.';if(model.boxes.length>12)return'12 boxes maximum.';if(model.boxes.length>1&&!model.pins.length&&!(model.muscles||[]).length)return'Add a hinge or muscle.';if(connected(model,model.boxes[0].id).size!==model.boxes.length)return'Connect every box with hinges or muscles.';for(const j of model.pins){if(j.low>=j.high)return'Lower limit must be below upper limit.';if(!model.boxes.some(b=>b.id===j.a)||!model.boxes.some(b=>b.id===j.b))return'A hinge is missing its box.'}return''}
function layout(model){const boxes=clone(model.boxes),map=new Map(boxes.map(b=>[b.id,b]));for(const b of boxes){b.density=1;b.friction=.8}if(hasLoops(model)||!boxes.length)return boxes;const done=new Set();for(const root of boxes){if(done.has(root.id))continue;done.add(root.id);for(let pass=0;pass<boxes.length;pass++)for(const j of model.pins){let from,to,ap,bp;if(done.has(j.a)&&!done.has(j.b)){from=map.get(j.a);to=map.get(j.b);ap=j.pa;bp=j.pb}else if(done.has(j.b)&&!done.has(j.a)){from=map.get(j.b);to=map.get(j.a);ap=j.pb;bp=j.pa}else continue;const a=anchor(from,ap),off=rotate({x:bp.x*to.w,y:bp.y*to.h},to.angle);to.x=a.x-off.x;to.y=a.y-off.y;done.add(to.id)}}return boxes}
function regularPolygon(){return Array.from({length:6},(_,i)=>({x:Math.cos(i*TAU/6)*.5,y:Math.sin(i*TAU/6)*.5}))}
function polygonArea(v){return v.reduce((a,p,i)=>{const q=v[(i+1)%v.length];return a+p.x*q.y-p.y*q.x},0)/2}
function inPolygon(v,p){return v.every((a,i)=>{const b=v[(i+1)%v.length];return(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)>=-1e-7})}
function validPolygon(v){
 if(!Array.isArray(v)||v.length<3||v.length>8||v.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>.500001||Math.abs(p.y)>.500001))return false;
 if(polygonArea(v)<.04||!inPolygon(v,{x:0,y:0}))return false;
 return v.every((a,i)=>{const b=v[(i+1)%v.length];if(Math.hypot(b.x-a.x,b.y-a.y)<.06)return false;return v.every((p,j)=>j===i||j===(i+1)%v.length||(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)>1e-5)})
}
function shapeArea(b){return b.shape==='circle'?Math.PI*b.w*b.w/4:b.w*b.h*(b.shape==='polygon'?polygonArea(b.vertices):1)}
function bodyShape(b){return b.shape==='circle'?P.Circle(b.w/2):b.shape==='polygon'?P.Polygon(b.vertices.map(p=>P.Vec2(p.x*b.w,p.y*b.h))):P.Box(b.w/2,b.h/2)}
function bounds(boxes){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const b of boxes){const vertices=b.shape==='polygon'?b.vertices:[{x:-.5,y:-.5},{x:.5,y:-.5},{x:.5,y:.5},{x:-.5,y:.5}];for(const v of vertices){const p=rotate({x:v.x*b.w,y:v.y*b.h},b.shape==='circle'?0:b.angle);minX=Math.min(minX,p.x+b.x);maxX=Math.max(maxX,p.x+b.x);minY=Math.min(minY,p.y+b.y);maxY=Math.max(maxY,p.y+b.y)}}return{minX,minY,maxX,maxY}}
function example(){const boxes=[{id:1,x:0,y:-2.4,w:2.4,h:.55,angle:0,color:0},{id:2,x:-.9,y:-1.55,w:.36,h:1.55,angle:.15,color:1},{id:3,x:.9,y:-1.55,w:.36,h:1.55,angle:-.15,color:1},{id:4,x:-1.12,y:-.68,w:.85,h:.3,angle:0,color:2},{id:5,x:1.12,y:-.68,w:.85,h:.3,angle:0,color:2}],pins=[];function joint(a,b,p,low,high){pins.push({id:pins.length+1,a,b,pa:localAnchor(boxes[a-1],p),pb:localAnchor(boxes[b-1],p),low,high})}joint(1,2,{x:-.8,y:-2.23},-65,65);joint(1,3,{x:.8,y:-2.23},-65,65);joint(2,4,{x:-1.01,y:-.83},-40,40);joint(3,5,{x:1.01,y:-.83},-40,40);return{boxes,pins,muscles:[]}}
function gaussian(){let a=0,b=0;while(!a)a=Math.random();while(!b)b=Math.random();return Math.sqrt(-2*Math.log(a))*Math.cos(TAU*b)}
// Each physical link owns a compact recurrent controller. Parts relay two signals.
const MESSAGE_SIZE=2,LOCAL_INPUTS=24,LOCAL_OUTPUTS=7;
const INPUT_LABELS=['pulse sin','pulse cos','A tilt sin','A tilt cos','A vx','A vy','A spin','A contact','B tilt sin','B tilt cos','B vx','B vy','B spin','B contact','A signal 1','A signal 2','B signal 1','B signal 2','link state','link speed','memory 1','memory 2','command X','command Y'];
const OUTPUT_LABELS=['actuate','to A · 1','to A · 2','to B · 1','to B · 2','memory 1','memory 2'];
function networkSize(_,architecture={}){const inputs=LOCAL_INPUTS,hidden=clamp(Math.round(architecture.hidden||8),1,32),layers=clamp(Math.round(architecture.layers||1),1,4),outputs=LOCAL_OUTPUTS,sizes=[inputs,...Array(layers).fill(hidden),outputs];return{inputs,hidden,layers,outputs,sizes,count:sizes.slice(1).reduce((n,width,i)=>n+(sizes[i]+1)*width,0)}}
function jointMode(pin){return pin.mode|| (pin.powered===false?'unpowered':'servo')}
function genomeModel(model,genome){return{...(genome?.structure||model),brain:model.brain||(genome?.structure||model).brain}}
function networkFor(model){return networkSize(0,model.brain)}
const TRAINING_DEFAULTS={survivorRate:.25,crossoverRate:.5,mutationSize:.28,bodyMutationSize:.08,rotationMutationSize:5,vertexMutationSize:.08,newPartChance:.03,physics:true,neural:true};
function survivorCount(population,rate){return clamp(Math.round(population*rate),1,population)}
let innovation=0;
function newGeneId(){return 'g'+Date.now().toString(36)+'-'+(++innovation).toString(36)+'-'+Math.random().toString(36).slice(2,10)}
function graphLinks(model){return[...model.pins.map(spec=>({spec,kind:'pin',key:'P'+spec.id})),...(model.muscles||[]).map(spec=>({spec,kind:'muscle',key:'M'+spec.id}))]}
function identifyGraph(model){for(const b of model.boxes)b.geneId||='part:'+b.id;for(const {spec,kind} of graphLinks(model))spec.geneId||=kind+':'+spec.id+':'+spec.a+':'+spec.b;return model}
function sameLink(a,b){return a.geneId===b.geneId&&a.a===b.a&&a.b===b.b}
function makeBrain(net,source=null,randomize=true){
 if(source&&JSON.stringify(source.sizes)===JSON.stringify(net.sizes)&&source.weights.length===net.count)return clone(source);
 // Upgrade older 22-input brains without changing any learned connection.
 if(source&&source.sizes[0]===22&&net.inputs===24&&JSON.stringify(source.sizes.slice(1))===JSON.stringify(net.sizes.slice(1))&&source.weights.length===net.count-2*net.hidden){
  const weights=[];for(let i=0;i<net.hidden;i++)weights.push(...source.weights.slice(i*23,(i+1)*23),0,0);weights.push(...source.weights.slice(net.hidden*23));return{sizes:net.sizes.slice(),weights}
 }
 return{sizes:net.sizes.slice(),weights:Array.from({length:net.count},()=>randomize?gaussian()*.4:0)}
}
function attachGenes(shape,source=null,{fresh=false,randomize=true}={}){
 identifyGraph(shape);const net=networkFor(shape),old=source?graphLinks(identifyGraph(source)):[];
 for(const {spec,kind} of graphLinks(shape)){const match=old.find(e=>e.kind===kind&&sameLink(e.spec,spec));spec.brain=makeBrain(net,fresh?null:match?.spec.brain||spec.brain,randomize)}
 return shape
}
function validAnchor(p,b){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(b?.shape==='circle'?p.x*p.x+p.y*p.y<=.250001:b?.shape==='polygon'?inPolygon(b.vertices,p):Math.abs(p.x)<=.500001&&Math.abs(p.y)<=.500001)}
// When a component is split, keep its most complex remaining fragment.
// Already separate draft components are unaffected by deleting a link elsewhere.
function pruneDisconnected(model,previous=null){
 const groups=[],seen=new Set();
 if(previous){for(const b of previous.boxes)if(!seen.has(b.id)){const ids=connected(previous,b.id);ids.forEach(id=>seen.add(id));groups.push(ids)}}
 else groups.push(new Set(model.boxes.map(b=>b.id)));
 const remove=new Set(),edges=graphLinks(model);
 for(const group of groups){
  const remaining=model.boxes.filter(b=>group.has(b.id)),visited=new Set(),fragments=[];
  for(const b of remaining)if(!visited.has(b.id)){const ids=connected(model,b.id);ids.forEach(id=>visited.add(id));const parts=remaining.filter(p=>ids.has(p.id));fragments.push({ids,count:parts.length,links:edges.filter(e=>ids.has(e.spec.a)&&ids.has(e.spec.b)).length,area:parts.reduce((n,p)=>n+shapeArea(p),0)})}
  fragments.sort((a,b)=>b.count-a.count||b.links-a.links||b.area-a.area);
  for(const fragment of fragments.slice(1))fragment.ids.forEach(id=>remove.add(id))
 }
 if(remove.size){model.boxes=model.boxes.filter(b=>!remove.has(b.id));model.pins=model.pins.filter(j=>!remove.has(j.a)&&!remove.has(j.b));model.muscles=(model.muscles||[]).filter(j=>!remove.has(j.a)&&!remove.has(j.b))}
 return model
}
function cleanConnections(model){
 const previous={boxes:model.boxes,pins:model.pins,muscles:model.muscles||[]},ids=new Set(model.boxes.map(b=>b.id));
 const valid=j=>ids.has(j.a)&&ids.has(j.b)&&j.a!==j.b&&validAnchor(j.pa,model.boxes.find(b=>b.id===j.a))&&validAnchor(j.pb,model.boxes.find(b=>b.id===j.b));
 model.pins=model.pins.filter(valid);model.muscles=(model.muscles||[]).filter(valid);
 if(model.pins.length!==previous.pins.length||model.muscles.length!==previous.muscles.length)pruneDisconnected(model,previous);
 return model
}
function genomeFromModel(model,frequency=1.25){return{version:3,structure:attachGenes(clone(model)),frequency}}
// Validate file contents before replacing the current draft; never silently reset weights.
function readCreatureFile(value){
 const fail=message=>{throw new Error(message)},object=v=>v&&typeof v==='object'&&!Array.isArray(v),number=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
 if(!object(value))fail('Choose a creature JSON file.');
 if(value.format!==undefined&&(value.format!=='creature-lab'||value.version!==1))fail('Unsupported creature file version.');
 const g=value.format?value.genome:value;if(!object(g)||g.version!==3||!object(g.structure))fail('Choose a creature JSON file.');
 const m=g.structure;if(!Array.isArray(m.boxes)||m.boxes.length>12||!Array.isArray(m.pins)||!Array.isArray(m.muscles))fail('Invalid creature parts or connections.');
 if(m.pins.length+m.muscles.length>1024)fail('Too many connections.');
 if(!object(m.brain)||!Number.isInteger(m.brain.hidden)||!number(m.brain.hidden,1,32)||!Number.isInteger(m.brain.layers)||!number(m.brain.layers,1,4))fail('Invalid brain size.');
 if(!number(g.frequency,.01,100))fail('Invalid rhythm frequency.');
 const ids=new Set(),id=v=>Number.isSafeInteger(v)&&v>0,gene=(from,to)=>{if(from.geneId!==undefined){if(typeof from.geneId!=='string'||!from.geneId.length||from.geneId.length>160)fail('Invalid gene identifier.');to.geneId=from.geneId}return to};
 const boxes=m.boxes.map(b=>{
  if(!object(b)||!id(b.id)||ids.has(b.id)||!number(b.x,-1e6,1e6)||!number(b.y,-1e6,1e6)||!number(b.w,.01,100)||!number(b.h,.01,100)||!number(b.angle,-1e6,1e6)||!Number.isInteger(b.color)||!number(b.color,0,3))fail('Invalid body part.');
  if(b.shape!==undefined&&!['box','circle','polygon'].includes(b.shape))fail('Unknown part shape.');
  if(b.shape==='polygon'&&!validPolygon(b.vertices))fail('Invalid polygon vertices.');
  if(b.shape==='circle'&&b.w!==b.h)fail('Circle width and height must match.');
  ids.add(b.id);const part={id:b.id,x:b.x,y:b.y,w:b.w,h:b.h,angle:b.angle,color:b.color};if(b.shape!==undefined)part.shape=b.shape;if(b.shape==='polygon')part.vertices=b.vertices.map(p=>({x:p.x,y:p.y}));return gene(b,part)
 });
 const structure={boxes,pins:[],muscles:[],brain:{hidden:m.brain.hidden,layers:m.brain.layers}},net=networkFor(structure),byId=new Map(boxes.map(b=>[b.id,b]));
 const links=(list,kind)=>{const used=new Set();return list.map(j=>{
  if(!object(j)||!id(j.id)||used.has(j.id)||!ids.has(j.a)||!ids.has(j.b)||j.a===j.b||!validAnchor(j.pa,byId.get(j.a))||!validAnchor(j.pb,byId.get(j.b)))fail('Invalid connection or attachment point.');used.add(j.id);
  const link=gene(j,{id:j.id,a:j.a,b:j.b,pa:{x:j.pa.x,y:j.pa.y},pb:{x:j.pb.x,y:j.pb.y}});
  if(kind==='pin'){
   if(!number(j.low,-180,180)||!number(j.high,-180,180)||j.low>=j.high)fail('Invalid joint angle limits.');link.low=j.low;link.high=j.high;if(j.limits!==undefined){if(typeof j.limits!=='boolean')fail('Invalid joint limits flag.');link.limits=j.limits}
   if(j.mode!==undefined){if(!['servo','motor','unpowered'].includes(j.mode))fail('Invalid joint mode.');link.mode=j.mode}
   if(j.powered!==undefined){if(typeof j.powered!=='boolean')fail('Invalid joint mode.');link.powered=j.powered}
  }else{if(!number(j.restScale??1,.01,100))fail('Invalid muscle length.');if(j.restScale!==undefined)link.restScale=j.restScale}
  if(j.brain!==undefined){
   if(!object(j.brain)||!Array.isArray(j.brain.sizes)||!Array.isArray(j.brain.weights))fail('Invalid neural network weights.');
   const sizes=j.brain.sizes[0]===22?[22,...net.sizes.slice(1)]:net.sizes,count=sizes.slice(1).reduce((n,width,i)=>n+(sizes[i]+1)*width,0);
   if(JSON.stringify(j.brain.sizes)!==JSON.stringify(sizes)||j.brain.weights.length!==count||!j.brain.weights.every(w=>number(w,-1e6,1e6)))fail('Invalid neural network weights.');link.brain=makeBrain(net,j.brain)
 }
  return link
 })};
 structure.pins=links(m.pins,'pin');structure.muscles=links(m.muscles,'muscle');
 return genomeFromModel(structure,g.frequency)
}
function mutateStructure(genome,baseModel,opts){
 if(opts.body===false||opts.physics===false||!(opts.bodyMutationSize>0||opts.rotationMutationSize>0||opts.vertexMutationSize>0||opts.newPartChance>0))return genome;
 const previous=genomeModel(baseModel,genome),shape=clone(previous),get=id=>shape.boxes.find(b=>b.id===id),pick=list=>list[Math.floor(Math.random()*list.length)],size=opts.bodyMutationSize;
 // Only geometry and attachment points mutate. Materials are constant.
 const edits=size>0?(Math.random()<.2?2:1):0;
 for(let edit=0;edit<edits;edit++){
  const choices=['resize','resize'];if(shape.pins.length)choices.push('pin');if(shape.muscles.length)choices.push('muscle');const kind=pick(choices);
  if(kind==='resize'){
   const b=pick(shape.boxes),anchors=[];for(const j of [...shape.pins,...shape.muscles])for(const end of ['a','b'])if(j[end]===b.id)anchors.push({j,end,p:anchor(b,j[end==='a'?'pa':'pb'])});
   const axis=Math.random()<.5?'w':'h';b[axis]=clamp(b[axis]*(1+clamp(gaussian()*size,-.4,.4)),.2,4);if(b.shape==='circle')b.w=b.h=b[axis];
   for(const item of anchors)item.j[item.end==='a'?'pa':'pb']=localAnchor(b,item.p)
  }else if(kind==='pin'){
   const j=pick(shape.pins),a=get(j.a),b=get(j.b),p=anchor(a,j.pa),moved={x:p.x+clamp(gaussian()*size,-.3,.3),y:p.y+clamp(gaussian()*size,-.3,.3)};j.pa=localAnchor(a,moved);j.pb=localAnchor(b,moved)
  }else{
   const j=pick(shape.muscles),key=Math.random()<.5?'pa':'pb';j[key].x+=clamp(gaussian()*size,-.25,.25);j[key].y+=clamp(gaussian()*size,-.25,.25)
  }
  cleanConnections(shape)
 }
 // Move one vertex, rejecting concave or degenerate candidates.
 const polygons=shape.boxes.filter(b=>b.shape==='polygon');
 if(opts.vertexMutationSize>0&&polygons.length){
  const b=pick(polygons),index=Math.floor(Math.random()*b.vertices.length),v=b.vertices[index];
  for(let attempt=0;attempt<6;attempt++){const vertices=clone(b.vertices);vertices[index]={x:clamp(v.x+gaussian()*opts.vertexMutationSize,-.5,.5),y:clamp(v.y+gaussian()*opts.vertexMutationSize,-.5,.5)};if(validPolygon(vertices)){b.vertices=vertices;cleanConnections(shape);break}}
 }
 // Rotate one part about an attached pin, keeping attachment points in place.
 if(opts.rotationMutationSize>0&&shape.boxes.length){
  const b=pick(shape.boxes),pins=shape.pins.filter(j=>j.a===b.id||j.b===b.id),j=pins.length?pick(pins):null,pivot=j?anchor(b,j[j.a===b.id?'pa':'pb']):{x:b.x,y:b.y},attachments=[];
  for(const link of [...shape.pins,...shape.muscles])for(const end of ['a','b'])if(link[end]===b.id)attachments.push({link,key:end==='a'?'pa':'pb',p:anchor(b,link[end==='a'?'pa':'pb'])});
  const delta=clamp(gaussian(),-2,2)*opts.rotationMutationSize*Math.PI/180,offset=rotate({x:b.x-pivot.x,y:b.y-pivot.y},delta);
  b.x=pivot.x+offset.x;b.y=pivot.y+offset.y;b.angle=Math.atan2(Math.sin(b.angle+delta),Math.cos(b.angle+delta));
  for(const a of attachments)a.link[a.key]=localAnchor(b,a.p);
  cleanConnections(shape)
 }
 // One independent birth opportunity per offspring, even with resizing disabled.
 if(shape.boxes.length&&shape.boxes.length<12&&Math.random()<opts.newPartChance){
   const parent=pick(shape.boxes),id=Math.max(...shape.boxes.map(b=>b.id))+1,q={x:(Math.random()-.5)*.9,y:(Math.random()-.5)*.9},pivot=anchor(parent,validAnchor(q,parent)?q:(q.x=0,q.y=0,q)),w=.25+Math.random()*.65,h=.25+Math.random()*.65,angle=parent.angle+(Math.random()-.5)*Math.PI;
   const bp={x:(Math.random()-.5)*.7,y:(Math.random()-.5)*.7},offset=rotate({x:bp.x*w,y:bp.y*h},angle);
   const newBox={id,geneId:newGeneId(),x:pivot.x-offset.x,y:pivot.y-offset.y,w,h,angle,color:(id-1)%4};if(Math.random()<.25){newBox.shape='circle';newBox.h=w;const off=rotate({x:bp.x*w,y:bp.y*w},angle);newBox.x=pivot.x-off.x;newBox.y=pivot.y-off.y}else if(Math.random()<1/3){newBox.shape='polygon';newBox.vertices=regularPolygon();if(!validAnchor(bp,newBox)){bp.x=0;bp.y=0;newBox.x=pivot.x;newBox.y=pivot.y}}shape.boxes.push(newBox);
   shape.pins.push({id:Math.max(0,...shape.pins.map(j=>j.id))+1,geneId:newGeneId(),a:parent.id,b:id,pa:q,pb:bp,low:-60,high:60,mode:'servo'});
 }
 cleanConnections(shape);genome.structure=attachGenes(shape,previous,{randomize:opts.brain!==false});return genome
}
function randomGenome(model,base=null,opts={body:true,brain:true}){
 const shape=clone(genomeModel(model,base));attachGenes(shape,base?.structure,{fresh:!!opts.brain||!base,randomize:!!opts.brain||!base});
 const genome={version:3,structure:shape,frequency:opts.brain?.65+Math.random()*1.4:base?base.frequency:1.25};
 return mutateStructure(genome,model,{...TRAINING_DEFAULTS,...opts})
}
// Pick a connected patch of homologous parts. Novel topology stays with its parent.
function inheritancePatch(a,b){
 const compatible=new Set(a.boxes.filter(x=>b.boxes.some(y=>x.id===y.id&&x.geneId===y.geneId)).map(x=>x.id));
 if(!compatible.size)return new Set();const ids=[...compatible],patch=new Set([ids[Math.floor(Math.random()*ids.length)]]),target=Math.min(ids.length,2+Math.floor(Math.random()*Math.max(1,Math.ceil(ids.length/2)-1)));
 const edges=graphLinks(a).filter(x=>graphLinks(b).some(y=>x.kind===y.kind&&sameLink(x.spec,y.spec)));
 while(patch.size<target){const frontier=[];for(const {spec:j} of edges){if(patch.has(j.a)&&compatible.has(j.b)&&!patch.has(j.b))frontier.push(j.b);if(patch.has(j.b)&&compatible.has(j.a)&&!patch.has(j.a))frontier.push(j.a)}if(!frontier.length)break;patch.add(frontier[Math.floor(Math.random()*frontier.length)])}return patch
}
function breed(a,b,opts={},model=null){
 opts={...TRAINING_DEFAULTS,...opts};model||=a.structure;const child=clone(a),shape=child.structure;
 // Optional crossover transfers complete physical and neural modules from a survivor.
 if(b){
  const donor=b.structure,patch=inheritancePatch(shape,donor);
  for(let i=0;i<shape.boxes.length;i++){const part=shape.boxes[i],other=donor.boxes.find(x=>x.id===part.id&&x.geneId===part.geneId);if(opts.physics!==false&&other&&patch.has(part.id))shape.boxes[i]=clone(other)}
  const donorLinks=graphLinks(donor);for(const {spec,kind} of graphLinks(shape)){const other=donorLinks.find(e=>e.kind===kind&&sameLink(e.spec,spec));if(other&&patch.has(spec.a)&&patch.has(spec.b)){if(opts.physics===false){if(opts.neural!==false)spec.brain=clone(other.spec.brain)}else{const brain=spec.brain;Object.assign(spec,clone(other.spec));if(opts.neural===false)spec.brain=brain}}}
  if(opts.physics!==false){cleanConnections(shape);if(shape.pins.length)settle(shape)}
 }
 if(opts.neural!==false&&opts.mutationSize>0){
  for(const {spec} of graphLinks(shape))spec.brain.weights=spec.brain.weights.map(w=>Math.random()<.13?clamp(w+gaussian()*opts.mutationSize,-4,4):w);
  if(Math.random()<.25)child.frequency=clamp(child.frequency+gaussian()*opts.mutationSize*.5,.35,2.5)
 }
 return mutateStructure(child,model,{...opts,body:true,brain:opts.neural!==false&&opts.mutationSize>0})
}
function randomTerrainSeed(previous=null){const seed=(Math.random()*4294967296)>>>0;return seed===previous?(seed+1)>>>0:seed}
function terrainHeight(x,seed=0){const a=(seed&1023)/1024*TAU,b=((seed>>>10)&1023)/1024*TAU,c=(seed>>>20)/4096*TAU,sample=t=>.28+.13*Math.sin(t*1.3+a)+.09*Math.sin(t*4.8+b)+.06*Math.sin(t*9.1+c),left=Math.floor(x*2)/2,t=(x-left)*2;return sample(left)*(1-t)+sample(left+.5)*t}
// Cache local surface quadrature once per body. Two samples on each straight
// edge capture rotational motion even when its midpoint is stationary.
function waterBody(body,spec){
 const center=body.getLocalCenter(),mass=body.getMass(),inertia=body.getInertia()-mass*(center.x*center.x+center.y*center.y),samples=[];
 if(spec.shape==='circle'){
  const radius=spec.w/2;for(let i=0;i<12;i++){const angle=(i+.5)*TAU/12,nx=Math.cos(angle),ny=Math.sin(angle);samples.push({x:radius*nx-center.x,y:radius*ny-center.y,nx,ny,length:TAU*radius/12})}
 }else{
  const vertices=spec.shape==='polygon'?spec.vertices:[{x:-.5,y:-.5},{x:.5,y:-.5},{x:.5,y:.5},{x:-.5,y:.5}];
  for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length],dx=(b.x-a.x)*spec.w,dy=(b.y-a.y)*spec.h,length=Math.hypot(dx,dy),nx=dy/length,ny=-dx/length;for(const t of [.2113248654,.7886751346])samples.push({x:a.x*spec.w+dx*t-center.x,y:a.y*spec.h+dy*t-center.y,nx,ny,length:length/2})}
 }
 return{body,samples,invMass:1/mass,invInertia:inertia>0?1/inertia:0,force:P.Vec2()}
}
function waterResistance(c){
 if(!c.water||c.failed)return;
 for(const w of c.water){
  const b=w.body,angle=b.getAngle(),cs=Math.cos(angle),sn=Math.sin(angle),v=b.getLinearVelocity(),vx=cs*v.x+sn*v.y,vy=-sn*v.x+cs*v.y,spin=b.getAngularVelocity(),budget=w.samples.length*2;let fx=0,fy=0,torque=0;
  for(const e of w.samples){
   const ux=vx-spin*e.y,uy=vy+spin*e.x,vn=ux*e.nx+uy*e.ny,vt=-ux*e.ny+uy*e.nx,rn=e.x*e.ny-e.y*e.nx,rt=e.x*e.nx+e.y*e.ny;
   // Pressure on leading surfaces, plus weaker tangential skin resistance.
   // Effective-mass denominators limit the drag impulse at our fixed timestep.
   const kn=5*e.length*Math.max(0,vn),kt=.1*e.length*Math.abs(vt),fn=-kn*Math.max(0,vn)/(1+DT*kn*budget*(w.invMass+rn*rn*w.invInertia)),ft=-kt*vt/(1+DT*kt*budget*(w.invMass+rt*rt*w.invInertia));
   const x=fn*e.nx-ft*e.ny,y=fn*e.ny+ft*e.nx;fx+=x;fy+=y;torque+=e.x*y-e.y*x
  }
  w.force.set(cs*fx-sn*fy,sn*fx+cs*fy);b.applyForceToCenter(w.force);b.applyTorque(torque)
 }
}
function createWorld(rough=false,terrainSeed=0,swimming=false){
 const world=new P.World(P.Vec2(0,swimming?0:9.81)),ground=world.createBody(),options={friction:.85,filterCategoryBits:1,filterMaskBits:2};
 world.swimming=swimming;if(swimming)return{world,ground};
 if(rough){
  const chunks=new Map(),span=16,point=x=>P.Vec2(x,terrainHeight(x,terrainSeed));let ticks=0;
  world.terrain={chunks,generated:0,ensure(creatures,force=false){
   if(!force&&ticks++%6!==0)return;const needed=new Set();
   for(const c of creatures)if(!c.failed)for(let i=0;i<c.bodies.length;i++){const b=c.bodies[i],x=b.getPosition().x;if(!Number.isFinite(x)||Math.abs(x)>1600)continue;const radius=Math.hypot(c.specs[i].w,c.specs[i].h)/2,margin=8+radius+Math.abs(b.getLinearVelocity().x)*.15;for(let k=Math.floor((x-margin)/span);k<=Math.floor((x+margin)/span);k++)needed.add(k)}
   for(const k of needed)if(!chunks.has(k)){const left=k*span,right=left+span,points=[];for(let x=left;x<=right;x+=.5)points.push(point(x));const chain=P.Chain(points);chain.setPrevVertex(point(left-.5));chain.setNextVertex(point(right+.5));chunks.set(k,ground.createFixture(chain,options));this.generated++}
   for(const[k,fixture]of chunks)if(!needed.has(k)&&!needed.has(k-1)&&!needed.has(k+1)){ground.destroyFixture(fixture);chunks.delete(k)}
  }}
 }else ground.createFixture(P.Box(2000,1,P.Vec2(0,1)),options);
 return{world,ground}
}
// Independent 5% chance per physics frame, shared by the entire population.
function commandSequence(duration){
 const sequence=[];for(let step=0;step<Math.round(duration/DT);step++){if(step>0&&Math.random()>=.05)continue;const angle=Math.random()*TAU;sequence.push({step,x:Math.cos(angle),y:Math.sin(angle)})}return sequence
}
function applyCommands(run){
 if(!run.commands?.length)return;while(run.commandIndex+1<run.commands.length&&run.commands[run.commandIndex+1].step<=run.steps)run.commandIndex++;
 const command=run.commands[run.commandIndex];for(const c of run.creatures){c.command.x=command.x;c.command.y=command.y}
}
function createCreature(world,model,genome,index=0,goal='right'){
 model=genomeModel(model,genome);
 const specs=layout(model),bb=bounds(specs),total=specs.reduce((n,b)=>n+shapeArea(b)*b.density,0),center=specs.reduce((n,b)=>n+b.x*shapeArea(b)*b.density,0)/total,shiftY=world.swimming?-1.9-(bb.minY+bb.maxY)/2:-bb.maxY-.06;
 const bodies=specs.map(b=>{const body=world.createDynamicBody({position:P.Vec2(b.x-center,b.y+shiftY),angle:b.angle,angularDamping:world.swimming?0:.08,linearDamping:world.swimming?0:.015,allowSleep:false});body.createFixture(bodyShape(b),{density:b.density,friction:b.friction,restitution:0,filterCategoryBits:2,filterMaskBits:1,filterGroupIndex:-1});body.setUserData({creature:index,part:b.id});return body});
 const byId=new Map(specs.map((b,i)=>[b.id,i]));
 const joints=model.pins.map(p=>{const ai=byId.get(p.a),bi=byId.get(p.b),ba=specs[ai],bb=specs[bi];return world.createJoint(P.RevoluteJoint({bodyA:bodies[ai],bodyB:bodies[bi],localAnchorA:P.Vec2(p.pa.x*ba.w,p.pa.y*ba.h),localAnchorB:P.Vec2(p.pb.x*bb.w,p.pb.y*bb.h),referenceAngle:bb.angle-ba.angle,enableLimit:p.limits!==false&&jointMode(p)!=='motor',lowerAngle:p.low*Math.PI/180,upperAngle:p.high*Math.PI/180,enableMotor:jointMode(p)!=='unpowered',motorSpeed:0,maxMotorTorque:jointMode(p)==='unpowered'?0:32,collideConnected:false}))});
 const muscles=(model.muscles||[]).map(p=>{const ai=byId.get(p.a),bi=byId.get(p.b),ba=specs[ai],bb=specs[bi],a=P.Vec2(p.pa.x*ba.w,p.pa.y*ba.h),b=P.Vec2(p.pb.x*bb.w,p.pb.y*bb.h),wa=bodies[ai].getWorldPoint(a),wb=bodies[bi].getWorldPoint(b),rest=Math.max(.08,P.Vec2.distance(wa,wb)*(p.restScale||1));const joint=world.createJoint(P.DistanceJoint({bodyA:bodies[ai],bodyB:bodies[bi],localAnchorA:a,localAnchorB:b,length:rest,frequencyHz:3,dampingRatio:.65,collideConnected:false}));return{joint,rest,id:p.id}});
 const motorSpecs=model.pins.filter(p=>jointMode(p)!=='unpowered'),motors=joints.filter((_,i)=>jointMode(model.pins[i])!=='unpowered');
 const c={model,swimming:!!world.swimming,water:world.swimming?bodies.map((b,i)=>waterBody(b,specs[i])):null,bodies,joints,motors,motorSpecs,muscles,pinSpecs:model.pins,specs,genome,index,goal,command:{x:0,y:0},directedDistance:0,lastScoreX:0,lastScoreY:0,initialX:0,initialY:specs.reduce((sum,b)=>sum+(b.y+shiftY)*shapeArea(b)*b.density,0)/total,peak:0,score:0,failed:false,totalMass:total};const initial=centerOf(c);c.initialX=c.lastScoreX=initial.x;c.initialY=c.lastScoreY=initial.y;setupControllers(c);return c
}
function centerOf(c){let x=0,y=0,m=0;for(const b of c.bodies){const mass=b.getMass(),p=b.getWorldCenter();x+=p.x*mass;y+=p.y*mass;m+=mass}return{x:x/m,y:y/m}}
function setupControllers(c){
 const net=networkFor(c.model),byId=new Map(c.specs.map((b,i)=>[b.id,i]));
 c.net=net;c.signals=c.bodies.map(()=>new Float64Array(MESSAGE_SIZE));c.nextSignals=c.bodies.map(()=>new Float64Array(MESSAGE_SIZE));c.sensors=c.bodies.map(()=>new Float64Array(6));c.degree=new Uint16Array(c.bodies.length);c.controlTicks=0;
 const genes=graphLinks(c.genome.structure);
 c.controllers=graphLinks(c.model).map(({spec,kind,key},i)=>{const gene=genes.find(e=>e.kind===kind&&sameLink(e.spec,spec))?.spec||spec,ai=byId.get(spec.a),bi=byId.get(spec.b);c.degree[ai]++;c.degree[bi]++;const hiddenLayers=Array.from({length:net.layers},()=>new Float64Array(net.hidden)),outputs=new Float64Array(net.outputs);return{key,kind,spec,gene,ai,bi,joint:kind==='pin'?c.joints[i]:c.muscles[i-c.joints.length].joint,muscle:kind==='muscle'?c.muscles[i-c.joints.length]:null,net,inputs:new Float64Array(net.inputs),hiddenLayers,outputs,layers:[...hiddenLayers,outputs]}});
 // Aggregate actuator outputs are used only by the creature renderer.
 c.outputs=new Float64Array(c.motors.length+c.muscles.length);c.inputs=new Float64Array(0);c.hiddenLayers=[];c.hidden=new Float64Array(0)
}
function controllerSnapshot(c){return c.controllers.map(l=>({key:l.key,inputs:Array.from(l.inputs),hiddenLayers:l.hiddenLayers.map(a=>Array.from(a)),outputs:Array.from(l.outputs)}))}
function control(c,t){
 if(c.failed||c.controlTicks++%2)return; // 30 Hz brains, 60 Hz physics.
 const clock=t*TAU*c.genome.frequency,sin=Math.sin(clock),cos=Math.cos(clock);
 for(let i=0;i<c.bodies.length;i++){
  const b=c.bodies[i],s=c.sensors[i],v=b.getLinearVelocity(),angle=b.getAngle();s[0]=Math.sin(angle);s[1]=Math.cos(angle);s[2]=clamp(v.x/5,-1,1);s[3]=clamp(v.y/5,-1,1);s[4]=clamp(b.getAngularVelocity()/8,-1,1);s[5]=0;
  for(let edge=b.getContactList();edge;edge=edge.next)if(edge.other.getType()==='static'&&edge.contact.isTouching()){s[5]=1;break}
  c.nextSignals[i].fill(0)
 }
 let motor=0,muscle=0;
 for(const l of c.controllers){
  const input=l.inputs,j=l.joint;input[0]=sin;input[1]=cos;input.set(c.sensors[l.ai],2);input.set(c.sensors[l.bi],8);input.set(c.signals[l.ai],14);input.set(c.signals[l.bi],16);input[20]=l.outputs[5];input[21]=l.outputs[6];input[22]=c.goal==='joystick'?c.command.x:0;input[23]=c.goal==='joystick'?c.command.y:0;
  if(l.kind==='pin'){input[18]=jointMode(l.spec)==='motor'?Math.sin(j.getJointAngle()):clamp(j.getJointAngle()/Math.PI,-1,1);input[19]=clamp(j.getJointSpeed()/8,-1,1)}
  else{const a=j.getAnchorA(),b=j.getAnchorB(),dx=b.x-a.x,dy=b.y-a.y,len=Math.max(.01,Math.hypot(dx,dy)),va=j.getBodyA().getLinearVelocityFromWorldPoint(a),vb=j.getBodyB().getLinearVelocityFromWorldPoint(b);input[18]=clamp(len/l.muscle.rest-1,-1,1);input[19]=clamp(((vb.x-va.x)*dx+(vb.y-va.y)*dy)/len/5,-1,1)}
  const weights=l.gene.brain.weights;let at=0,previous=input;
  for(const layer of l.layers){for(let k=0;k<layer.length;k++){let value=weights[at++];for(let i=0;i<previous.length;i++)value+=previous[i]*weights[at++];layer[k]=Math.tanh(value)}previous=layer}
  const out=l.outputs[0];
  if(l.kind==='pin'&&jointMode(l.spec)!=='unpowered'){c.outputs[motor++]=out;if(jointMode(l.spec)==='motor')j.setMotorSpeed(out*7);else{const target=j.getLowerLimit()+(out+1)*.5*(j.getUpperLimit()-j.getLowerLimit());j.setMotorSpeed(clamp((target-j.getJointAngle())*7-j.getJointSpeed()*.3,-7,7))}}
  else if(l.kind==='muscle'){c.outputs[c.motors.length+muscle++]=out;const target=l.muscle.rest*(.65+(out+1)*.35);j.setLength(j.getLength()+(target-j.getLength())*.2775)}
  for(let k=0;k<MESSAGE_SIZE;k++){c.nextSignals[l.ai][k]+=l.outputs[1+k];c.nextSignals[l.bi][k]+=l.outputs[3+k]}
 }
 // Double buffering makes loops safe and independent of link traversal order.
 for(let i=0;i<c.signals.length;i++)for(let k=0;k<MESSAGE_SIZE;k++)c.signals[i][k]=c.nextSignals[i][k]/Math.max(1,c.degree[i]);
}
function goalDistance(c,p=centerOf(c)){return c.goal==='joystick'?c.directedDistance:c.goal==='height'?c.initialY-p.y:c.goal==='down'?p.y-c.initialY:(p.x-c.initialX)*(c.goal==='left'?-1:1)}
function observe(c){if(c.failed)return;const p=centerOf(c);if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||(!c.swimming&&(Math.abs(p.x)>1500||Math.abs(p.y)>200))){c.failed=true;c.score=-1e6;for(const b of c.bodies)b.setActive(false);return}if(c.goal==='joystick')c.directedDistance+=(p.x-c.lastScoreX)*c.command.x+(p.y-c.lastScoreY)*c.command.y;c.lastScoreX=p.x;c.lastScoreY=p.y;const distance=goalDistance(c,p);c.peak=Math.max(c.peak,distance);c.score=c.goal==='height'?c.peak:distance}
// A worker owns one shard of a generation. It never selects or breeds locally.
class Trial{
 constructor(model,genes,rough,terrainSeed,goal='right',swimming=false,commands=null){const{world,ground}=createWorld(rough,terrainSeed,swimming);this.world=world;this.ground=ground;this.creatures=genes.map((g,i)=>createCreature(world,model,g,i,goal));this.steps=0;this.commands=goal==='joystick'?(commands||commandSequence(60)):null;this.commandIndex=0;applyCommands(this);world.terrain?.ensure(this.creatures,true)}
 step(){applyCommands(this);const t=this.steps*DT;this.creatures.forEach(c=>{control(c,t);waterResistance(c)});this.world.terrain?.ensure(this.creatures||[this.creature]);this.world.step(DT,8,4);this.creatures.forEach(observe);this.steps++}
 snapshot(){return this.creatures.map(c=>({pinSpecs:c.pinSpecs.map(({brain,...pin})=>pin),motorCount:c.motors.length,score:c.score,peak:c.peak,goal:c.goal,command:{...c.command},directedDistance:c.directedDistance,initialX:c.initialX,initialY:c.initialY,failed:c.failed,specs:c.specs,bodies:c.bodies.map(b=>({p:{x:b.getPosition().x,y:b.getPosition().y},center:{x:b.getWorldCenter().x,y:b.getWorldCenter().y},angle:b.getAngle(),mass:b.getMass()})),joints:c.joints.map(j=>({a:{...j.getAnchorA()},powered:j.isMotorEnabled()})),muscles:c.muscles.map(m=>({a:{...m.joint.getAnchorA()},b:{...m.joint.getAnchorB()}})),controllers:controllerSnapshot(c),inputs:[],hiddenLayers:[],outputs:Array.from(c.outputs)}))}
}
class Evolution{
 constructor(model,{population=32,duration=12,seed=null,rough=false,swimming=false,goal='right',...training}={}){this.model=clone(model);this.population=population;this.duration=duration;this.rough=rough;this.swimming=swimming;this.goal=goal;this.opts={...TRAINING_DEFAULTS,...training};this.generation=1;this.steps=0;this.totalSteps=0;this.history=[];this.lastTrial=null;this.best=null;this.parents=0;this.lastScores=[];this.seed=seed?clone(seed):randomGenome(model,null,{body:false,brain:true});const genes=Array.from({length:population},(_,i)=>i===0?clone(this.seed):seed?breed(this.seed,null,this.opts,model):randomGenome(model,this.seed,{...this.opts,body:true,brain:this.opts.neural!==false&&this.opts.mutationSize>0}));this.spawn(genes)}
 spawn(genes){this.commands=this.goal==='joystick'?commandSequence(this.duration):null;this.commandIndex=0;this.terrainSeed=this.rough&&!this.swimming?randomTerrainSeed(this.terrainSeed):null;const{world,ground}=createWorld(this.rough,this.terrainSeed,this.swimming);this.world=world;this.ground=ground;this.creatures=genes.map((g,i)=>createCreature(world,this.model,g,i,this.goal));this.steps=0;applyCommands(this);this.leader=this.creatures[0];world.terrain?.ensure(this.creatures,true)}
 setSwimming(swimming){if(this.swimming===swimming)return;const genes=this.creatures.map(c=>clone(c.genome));this.swimming=swimming;this.seed=clone(genes[0]);this.best=null;this.recordSeen=null;this.history=[];this.lastScores=[];this.lastTrial=null;this.generation=1;this.totalSteps=0;this.parents=0;this.spawn(genes)}
 setTerrain(rough){if(this.rough===rough)return;const genes=this.creatures.map(c=>clone(c.genome));this.rough=rough;this.lastTrial=null;this.seed=clone(genes[0]);this.best=null;this.history=[];this.lastScores=[];this.generation=1;this.totalSteps=0;this.parents=0;this.spawn(genes)}
 configure({population=this.population,duration=this.duration}){if(population===this.population&&duration===this.duration)return;const durationChanged=duration!==this.duration,genes=this.creatures.map(c=>clone(c.genome));this.seed=clone(genes[0]);this.population=population;this.duration=duration;while(genes.length<population)genes.push(breed(this.seed,null,this.opts,this.model));genes.length=population;if(durationChanged){this.best=null;this.history=[]}this.lastScores=[];this.lastTrial=null;this.parents=0;this.spawn(genes)}
 setGoal(goal){if(this.goal===goal)return;const genes=this.creatures.map(c=>clone(c.genome));this.goal=goal;this.seed=clone(genes[0]);this.best=null;this.history=[];this.lastScores=[];this.lastTrial=null;this.generation=1;this.totalSteps=0;this.parents=0;this.spawn(genes)}
 resetBodies(){
  const restore=g=>({...clone(g),structure:attachGenes({...clone(this.model),brain:clone(g.structure.brain)},g.structure)}),genes=this.creatures.map(c=>restore(c.genome));
  this.seed=restore(this.best?.genome||this.seed);genes[0]=clone(this.seed);this.best=null;this.recordSeen=null;this.history=[];this.lastScores=[];this.lastTrial=null;this.generation=1;this.totalSteps=0;this.parents=0;this.crossbreeds=0;this.spawn(genes);return clone(this.seed)
 }
 setOptions(opts){this.opts={...this.opts,...opts}}
 step(){applyCommands(this);const t=this.steps*DT;this.creatures.forEach(c=>{control(c,t);waterResistance(c)});this.world.terrain?.ensure(this.creatures||[this.creature]);this.world.step(DT,8,4);this.creatures.forEach(observe);this.steps++;this.totalSteps++;if(this.steps%6===0)this.leader=this.creatures.reduce((a,b)=>a.score>b.score?a:b);if(this.steps>=Math.round(this.duration/DT))this.nextGeneration()}
 nextGeneration(){
  const ranked=[...this.creatures].sort((a,b)=>b.score-a.score),winner=ranked[0];this.lastScores=ranked.map(c=>c.score);
  if(!this.best||winner.score>this.best.score)this.best={genome:clone(winner.genome),score:winner.score,generation:this.generation,terrainSeed:this.terrainSeed,rough:this.rough,swimming:this.swimming,goal:this.goal,commands:clone(this.commands),brain:{links:winner.controllers?.map(l=>({key:l.key,inputs:Array.from(l.inputs),hiddenLayers:l.hiddenLayers.map(a=>Array.from(a)),outputs:Array.from(l.outputs)}))||[]}};
  const distance=Math.max(0,...ranked.filter(c=>!c.failed).map(c=>c.peak||0));
  this.history.push({generation:this.generation,best:this.best.score,current:winner.score,distance,mean:ranked.reduce((s,c)=>s+c.score,0)/ranked.length});if(this.history.length>120)this.history.shift();
  const count=survivorCount(this.population,this.opts.survivorRate),pool=ranked.slice(0,count);
  const children=pool.map(c=>clone(c.genome));this.parents=count;
  const offspring=this.population-count,crosses=count>1?Math.round(offspring*this.opts.crossoverRate):0;this.crossbreeds=crosses;
  for(let i=0;i<offspring;i++){
   const ai=Math.floor(Math.random()*pool.length),a=pool[ai].genome;
   const bi=(ai+1+Math.floor(Math.random()*Math.max(1,pool.length-1)))%pool.length;
   children.push(breed(a,i<crosses?pool[bi].genome:null,this.opts,this.model))
  }
  this.lastTrial={generation:this.generation,survivors:count,cutoff:pool.at(-1).score,duration:this.duration,rough:this.rough,swimming:this.swimming,goal:this.goal,terrainSeed:this.terrainSeed,commands:this.commands,creatures:this.creatures,leader:winner};this.generation++;this.spawn(children)
 }
 get time(){return this.steps*DT}
}
class Playback{
 constructor(model,genome,{rough=false,swimming=false,terrainSeed=null,goal='right',commands=null}={}){this.model=clone(model);this.genome=clone(genome);this.rough=rough;this.swimming=swimming;this.terrainSeed=rough&&!swimming?(terrainSeed??randomTerrainSeed()):null;const{world,ground}=createWorld(rough,this.terrainSeed,swimming);this.world=world;this.ground=ground;this.creature=createCreature(world,model,genome,0,goal);this.time=0;this.steps=0;this.commands=commands;this.commandIndex=0;this.creatures=[this.creature];applyCommands(this);this.mouse=null;world.terrain?.ensure([this.creature],true)}
 setCommand(x,y){const length=Math.max(1,Math.hypot(x,y));this.creature.command.x=x/length;this.creature.command.y=y/length}
 resetBrain(genome){this.genome=clone(genome);this.creature.genome=this.genome;this.time=0;this.steps=0;this.commandIndex=0;setupControllers(this.creature)}
 step(){applyCommands(this);control(this.creature,this.time);waterResistance(this.creature);this.world.terrain?.ensure(this.creatures||[this.creature]);this.world.step(DT,8,4);observe(this.creature);this.steps++;this.time=this.steps*DT}
 grab(p){this.release();for(const b of [...this.creature.bodies].reverse()){let f=b.getFixtureList();if(f.testPoint(P.Vec2(p.x,p.y))){this.mouse=this.world.createJoint(P.MouseJoint({maxForce:this.creature.totalMass*250,frequencyHz:5,dampingRatio:.8},this.ground,b,P.Vec2(p.x,p.y)));return true}}return false}
 move(p){if(this.mouse)this.mouse.setTarget(P.Vec2(p.x,p.y))}
 release(){if(this.mouse){this.world.destroyJoint(this.mouse);this.mouse=null}}
}
function createDraft(model,grabId=null,point=null){
 const world=new P.World(P.Vec2(0,0)),ground=world.createBody(),bodies=new Map(),roots=new Set(),seen=new Set();
 for(const b of model.boxes){if(!seen.has(b.id)){roots.add(b.id);connected(model,b.id).forEach(id=>seen.add(id))}}
 for(const b of model.boxes){const body=world.createBody({type:roots.has(b.id)?'static':'dynamic',position:P.Vec2(b.x,b.y),angle:b.angle,angularDamping:3,linearDamping:3,allowSleep:false});body.createFixture(bodyShape(b),{density:1,filterGroupIndex:-1});bodies.set(b.id,body)}
 const get=id=>model.boxes.find(b=>b.id===id);
 for(const p of model.pins){const a=get(p.a),b=get(p.b);world.createJoint(P.RevoluteJoint({bodyA:bodies.get(a.id),bodyB:bodies.get(b.id),localAnchorA:P.Vec2(p.pa.x*a.w,p.pa.y*a.h),localAnchorB:P.Vec2(p.pb.x*b.w,p.pb.y*b.h),referenceAngle:b.angle-a.angle,enableMotor:false,enableLimit:false,collideConnected:false}))}
 for(const p of model.muscles||[]){const a=get(p.a),b=get(p.b),pa=P.Vec2(p.pa.x*a.w,p.pa.y*a.h),pb=P.Vec2(p.pb.x*b.w,p.pb.y*b.h),rest=P.Vec2.distance(bodies.get(a.id).getWorldPoint(pa),bodies.get(b.id).getWorldPoint(pb))*(p.restScale||1);world.createJoint(P.DistanceJoint({bodyA:bodies.get(a.id),bodyB:bodies.get(b.id),localAnchorA:pa,localAnchorB:pb,length:Math.max(.08,rest),frequencyHz:3,dampingRatio:.9,collideConnected:false}))}
 const target=grabId!=null?bodies.get(grabId):null;let mouse=null;if(target&&target.isDynamic()&&point)mouse=world.createJoint(P.MouseJoint({maxForce:1000*Math.max(1,target.getMass()),frequencyHz:12,dampingRatio:1},ground,target,P.Vec2(point.x,point.y)));
 return{world,bodies,mouse,move(p){if(mouse)mouse.setTarget(P.Vec2(p.x,p.y))},step(count=4){for(let i=0;i<count;i++)world.step(DT,12,12)},apply(m){for(const b of m.boxes){const body=bodies.get(b.id),p=body.getPosition();b.x=p.x;b.y=p.y;b.angle=body.getAngle()}}}
}
function settle(model){const d=createDraft(model);d.step(45);d.apply(model);return model}
global.CreatureEngine={DT,clone,rotate,commandSequence,regularPolygon,validPolygon,jointMode,genomeModel,shapeArea,validAnchor,graphLinks,INPUT_LABELS,OUTPUT_LABELS,inheritancePatch,cleanConnections,pruneDisconnected,genomeFromModel,readCreatureFile,mutateStructure,localAnchor,anchor,connected,hasLoops,createDraft,settle,validate,layout,bounds,example,terrainHeight,randomTerrainSeed,networkSize,networkFor,survivorCount,randomGenome,breed,centerOf,goalDistance,TRAINING_DEFAULTS,Trial,Evolution,Playback};
})(typeof window!=='undefined'?window:globalThis);
