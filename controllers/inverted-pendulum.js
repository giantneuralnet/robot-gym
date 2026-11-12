// Inverted pendulum: J1 is the cart actuator, J2 is a free hinge.
// Meters, seconds, degrees; pole omega is degrees/second.
const cart = state.parts.find(p => p.id === 2);
const pole = state.parts.find(p => p.id === 3);
const rail = state.parts.find(p => p.id === 1);
if (!cart || !pole || !rail || state.jointTypes[0] !== 'linear')
  return state.targets;
const theta = Math.atan2(Math.sin(pole.angle*Math.PI/180),
                         Math.cos(pole.angle*Math.PI/180));
const omega = pole.omega * Math.PI/180;
const x = cart.x - rail.x, v = cart.vx;
// Feedback pushes the cart underneath the pole and recenters the cart.
// Force control avoids fighting a position servo while catching a fall.
// Recover small disturbances; Reset if the pole has already fallen.
const force = Math.abs(theta) < .65
  ? Math.max(-35, Math.min(35, 50*theta + 16*omega + 2*x + 4*v))
  : Math.max(-10, Math.min(10, -4*x - 5*v));
return {targets: state.targets, forces: [force, null]};
