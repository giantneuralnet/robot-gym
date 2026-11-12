// Four independent legs, with alternating diagonal pairs in this 2D rig.
// J1–J8: hips/knees. J9–J13: front arm and gripper, tucked back for walking.
if (state.joints.length !== 13) return state.targets;
if (memory.start === undefined) memory.start = state.time;
const t = Math.max(0, state.time - memory.start - .6);
const ramp = Math.min(1, t / 1.5);
const period = 1.5, stance = .65, stride = .36, lift = .17;
const L = .68, height = 1.12;
const neutralHip = -Math.acos(height / (2 * L));
const targets = Array(13).fill(0);
for (let leg = 0; leg < 4; leg++) {
  const phase = (t / period + [0, .5, .5, 0][leg]) % 1;
  let x, y = height;
  if (phase < stance) x = stride * (.5 - phase / stance);
  else {
    const u = (phase - stance) / (1 - stance);
    x = stride * (-.5 + u);
    y -= lift * Math.sin(Math.PI * u);
  }
  x *= ramp; y = height + (y - height) * ramp;
  const distance = Math.min(2*L-.005, Math.hypot(x,y));
  const bend = Math.acos(distance / (2 * L));
  const hip = Math.atan2(y,x) - bend - Math.PI/2;
  targets[2*leg] = (hip - neutralHip) * 180/Math.PI;
  targets[2*leg+1] = (2*bend + 2*neutralHip) * 180/Math.PI;
}
const tuck = Math.min(1, (state.time-memory.start)/2);
[-60,100,-40].forEach((angle,i)=>targets[8+i]=angle*tuck);
return targets;
