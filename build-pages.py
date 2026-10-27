"""Build the static GitHub Pages version of Robot Gym."""
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parent
subprocess.run(['python3', str(root / 'assemble.py'), '--no-archive', '--output', str(root / 'dist/index.html')], check=True)
page = root / 'dist/index.html'
html = page.read_text()
# GitHub Pages has no Worker backend; browser-local control still works.
for control in ['toggleAgentBridge', 'agentBridgeStatus']:
    html = html.replace('id="' + control + '"', 'hidden id="' + control + '"')
page.write_text(html)
(root / 'dist/.nojekyll').touch()
print('Built GitHub Pages site')
