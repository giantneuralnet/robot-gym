const assert=require('assert');const {run,els}=require('./gym.test.cjs');
run("G.showJointControls=false;G.showTakes=false;switchGym('teach')");assert(!els.jointControlPanel.hidden&&!els.takesPanel.hidden);assert(els.toggleJointControls.hidden&&els.toggleTakes.hidden);
run('const panelStep=G.steps,panelRun=G.run;');els.jointPanelTitle.click();els.takesPanelTitle.click();assert(run('G.jointPanelCollapsed&&G.takesPanelCollapsed'));assert(run('G.steps===panelStep&&G.run===panelRun'),'Panel toggles preserve physics');els.jointPanelTitle.click();els.takesPanelTitle.click();assert(!run('G.jointPanelCollapsed||G.takesPanelCollapsed'));
run("G.showJointControls=false;switchGym('run')");assert(!els.jointControlPanel.hidden&&els.toggleJointControls.hidden);els.jointPanelTitle.click();assert(run('G.jointPanelCollapsed'));
console.log('Teach/Run panels always available, header collapse/expand, no bottom switches, and untouched physics: pass');
