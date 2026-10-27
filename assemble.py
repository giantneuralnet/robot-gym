"""Build the self-contained app and its source archive. No npm install required."""
from pathlib import Path
import argparse
import re
import shutil
import zipfile

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=root.parent / 'outputs' / 'robot-gym.html')
parser.add_argument('--no-archive', action='store_true')
args = parser.parse_args()
html = (root / 'app.html').read_text()
for key, filename in [('GPU_TENSOR', 'tf.min.js'), ('GPU_BACKEND', 'tf-backend-webgpu.js'), ('PHYSICS_LIB', 'planck.min.js'), ('ENGINE', 'engine.js'), ('WORKER', 'training-worker.js'), ('TRAINING', 'training.js'), ('APP', 'app.js')]:
    attrs = {'GPU_TENSOR': ' id="gpuTensorSource" type="text/plain"', 'GPU_BACKEND': ' id="gpuBackendSource" type="text/plain"', 'PHYSICS_LIB': ' id="physicsSource"', 'ENGINE': ' id="engineSource"', 'WORKER': ' id="trainingWorkerSource" type="text/plain"'}.get(key, '')
    html = html.replace('<!-- ' + key + ' -->', '<script' + attrs + '>\n' + (root / filename).read_text() + '\n</script>')
html = re.sub(r'<script src="([^"]+)"></script>', lambda m: '<script>\n' + (root / m[1]).read_text() + '\n</script>', html)
html = html.replace('<link rel="stylesheet" href="gym.css">', '<style>\n' + (root / 'gym.css').read_text() + '\n</style>')
html = html.replace('<!-- LICENSE -->', '<!--\n' + (root / 'PLANCK-LICENSE.txt').read_text() + '\nTensorFlow.js / WebGPU backend, Copyright 2024 Google LLC.\n' + (root / 'TENSORFLOW-LICENSE.txt').read_text() + '\n-->')
assert not re.search(r'<script[^>]+src=', html), 'Unbundled script remains'
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / 'index.html').write_text(html)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(html)
for name in ['transformer.js', 'gpu-training.js', 'network-view.js', 'take-predictions.js', 'run-inference.js', 'gym.js', 'gym.css']:
    shutil.copyfile(root / name, root / 'dist' / name)
if not args.no_archive:
    archive = args.output.with_name('robot-gym-source.zip')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for file in sorted(root.rglob('*')):
            if file.is_file() and not any(part.startswith('.') or part == '__pycache__' for part in file.relative_to(root).parts):
                bundle.write(file, file.relative_to(root.parent))
print('Built ' + str(args.output))
