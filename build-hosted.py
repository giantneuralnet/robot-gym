"""Package the offline HTML into a Sites Worker with authenticated MCP tools."""
from pathlib import Path
import json, subprocess
root=Path(__file__).resolve().parent
subprocess.run(['python3',str(root/'assemble.py'),'--no-archive'],check=True)
html=(root/'dist/index.html').read_text()
protocol=(root/'agent-protocol.js').read_text()
server=(root/'worker/index.mjs').read_text().replace("import protocol from '../agent-protocol.js';",'const protocol=RobotGymProtocol;')
(root/'dist/server').mkdir(exist_ok=True)
(root/'dist/.openai').mkdir(exist_ok=True)
(root/'dist/server/index.js').write_text('const APP_HTML='+json.dumps(html)+';\n'+protocol+'\n'+server)
(root/'dist/.openai/hosting.json').write_text((root/'.openai/hosting.json').read_text())
subprocess.run(['python3',str(root/'assemble.py')],check=True)
print('Built hosted MCP Worker')
