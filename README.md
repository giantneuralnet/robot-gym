# Robot Gym

[Open Robot Gym](https://giantneuralnet.github.io/robot-gym/)

## GitHub Pages

Run `python3 build-pages.py` to build `dist/`. Pushes to `main` automatically deploy with GitHub Actions. The app, physics, teaching, local storage, training and inference run in the browser. The hosted MCP bridge requires the separate Worker backend and is hidden on Pages; browser-local WebMCP remains available.


A fullscreen, offline robot editor, teaching simulator and neural controller built on Creature Lab. No package installation is needed.

## Use

- **Build:** assemble parts and servo joints. Follow point, heart objects and the shape/edit tools share one toolbar row. Use Follow point to attach the draggable marker to a movable part. Use ♥ Cube / ♥ Circle and click the scene to place loose objects; Pose drags them, and their popup has Duplicate / Delete. Their Build positions set reset positions. Select a part to anchor it. Save exports the current in-memory project; Load validates an imported project. A full browser store displays an export warning and warns before leaving the page. Export still contains all current takes, settings and weights even if browser autosave failed.
- **Clips:** press record to start a clip, pose the robot and press **+** to capture each set of angles, then **Done** to save. Only explicit captures become keyframes; moving, waiting and playback are never recorded automatically. One pose is enough; multiple poses play in order with 0.35-second transitions. Keys 1–9 play mutually exclusive clips and hold their final targets. Re-recording a slot keeps its key.
- **Teach:** click the follow marker to start following and recording. Click again to stop following. Space / Save session saves the take and resets the robot and cube; R / Reset discards the unfinished session. Drag empty background to pan. The Joints and Takes panels stay visible; click their headings to fold or unfold their contents. Teach settings and session actions share the bottom row, with clips on their own row above. Follow-point tools are in Build only. Esc discards the unfinished session and resets, without saving a take. Resets, saved sessions and replay preserve the camera. Dragging parts or the cube does not start a take. Physics and floor collisions stay active. Clip keys share the Save session / Reset row.
- **Network:** choose Feedforward, Recurrent, LSTM, Transformer or ACT, Model Hz, width, layers and memory (up to 1,024 observations). Architecture changes create fresh weights. The diagram shares the grid camera: drag to pan, scroll/pinch to zoom. There are no on-screen scale controls. Hover blocks for compact, pointer-transparent parameter heatmaps. Weights or Change shows real committed checkpoints. Reset model is available only on Train; the R shortcut does not reset models.
- **Train:** choose CPU or an available GPU backend, set the learning rate/noise and toggle Train/Stop. Reset model is explicit. One row of controls sits below the loss plot and the selected take plot. All joints share the take plot: solid recorded curves, dashed predictions, a color per joint. Selecting another take replaces the open graph. The take graph has separate sections for joint angles/actions (degrees), every cube/circle’s X/Y position (metres), and recorded X/Y velocity (metres/second), sharing one time axis. Click individual legend buttons or the Joints / Position / Velocity group buttons to show or hide curves. Missing legacy velocities appear as gaps; velocities are displayed observations, not extra model inputs.
- **Run:** applies model servo targets to live physics. Evaluation Hz is selectable separately from memory sampling. Inference runs in a dedicated worker, with one request in flight and only the latest observation queued. Actual achieved evaluation Hz is shown. The Joints panel stays visible and folds from its heading. Drag empty Run background to pan and scroll to zoom. Pause cancels pending inference; dragging during pause temporarily simulates physics, then restores pause on release. R resets the robot/cube, preserving weights.

**Manual joint controls:** Joints opens a compact panel in Clips, Teach and Run. Each J1/J2/… row has negative/positive pulse buttons, with 15/30/60° per second speed and 0.1/0.25/0.5/1 second duration. Pulses advance servo targets on the physics clock, allow unrestricted rotation on the arm (including its gripper) and respect limits on the balance rig, and hold their targets afterward. Different joints can move concurrently. Stop cancels pulses, follow, clips and model inference, then holds the current angles while physics continues. Manual commands take control from playback/model inference without changing weights or Build poses; they do not start a Teach recording. Joint labels on the canvas match the panel. Reset and tab changes cancel pending pulses.

Teach Hz changes only the rate of new recordings. It never replaces an existing network. Model Hz is a separate Network setting. Memory seconds are observation count / Model Hz.

## Current learning contract

The base input is **raw current joint angles in radians plus each heart object’s X/Y** (J+2×object-count channels). Network has optional **Reaction force** (Fx/Fy per joint) and **Motor torque** (one channel per joint) inputs. Enabling either creates a fresh model and updates the diagram, training, inference and take inspector together. Selected sensors are normalized with training-only scaling and remain clean during observation augmentation. For the original four models, the output is **absolute joint angles at the next original recorded sample**, without adding the current angles or a mean motion afterward. Output normalization is zero mean and unit scale. The arm has unrestricted servo rotation; the balance rig keeps its angle limits.

Feedforward uses the current observation only. RNN and LSTM process the selected finite history window from zero initial state, matching training and Run. Transformer uses a stacked causal decoder with learned positional embeddings, multi-head attention, RMSNorm, GELU feed-forward blocks and residuals. Width/layers apply to all models; attention heads and expansion width apply only to Transformer.

Training uses only takes whose original recording cadence matches Model Hz. A 10 Hz take predicts 0.1 seconds ahead and a 20 Hz take predicts 0.05 seconds ahead. Other-rate takes remain stored, replayable, and labeled “Other rate”; they are not interpolated or silently mixed. Missing legacy rate metadata is inferred only when timestamps match a supported uniform rate. Unsupported/irregular timing remains playback-only.

Each take receives a stable ID and saved training/validation role when recorded, independently for each rate: first take trains, second validates, then every fifth validates. Roles never reshuffle when takes are reordered, deleted, added, or filtered by rate. Existing takes in older trained projects without saved roles are conservatively migrated to training; new validation recordings are required. Trained take IDs are retained in checkpoints to prevent reclassifying seen data as validation.

Input mean/spread uses training takes only. It is recomputed when training starts at epoch zero with no optimizer updates, including networks created before recording and after Reset weights. Continued training freezes scaling so learned weights keep their meaning. Validation is clean and unavailable until a matching-rate validation take exists.

Training Noise adds bounded joint observation noise (±1°) and cube observation noise (±1 cm), using a consistent per-take bias plus light frame jitter. Overlapping windows agree on each noisy frame; absolute angle targets are unchanged. Teach Noise is separate: reset randomization up to ±12° per joint and ±0.8 m horizontal / ±0.4 m vertical cube displacement, above the floor.

Reaction force and motor torque input switches live in Network. They also control their corresponding arrows/rings in Teach and Run. Numeric badges remain hidden. Takes always record these sensors; a legacy take missing a selected sensor is playback-only for that model. Velocity is still recorded but is not a model input. Old compatible angle/cube-only models keep their weights; input schema `joint-angles-cube-selectable-v4` supports the new optional channels while preserving absolute next-sample targets.

The take graph is teacher-forced next-sample prediction using clean recorded history, not an autonomous physics rollout. It shows aggregate joint RMSE in degrees and the checkpoint epoch. Evaluation uses a separate cancellable worker and samples at most 160 evenly spaced windows (fewer for expensive configurations).

## Training implementation

`transformer.js` implements portable forward passes and manual gradients/BPTT for all four model types. CPU gradient work is split across up to eight workers. Gradients are summed before clipping and one shared Adam update per balanced batch of at most 256 examples; weights are not averaged from independent optimizers.

`gpu-training.js` implements tensor forward/backward passes using bundled TensorFlow.js and explicitly selected WebGPU or WebGL. Discovery does not train or run a CPU comparison. WebGL requires float32 rendering. GPU chunks have fixed shapes/padded rows of zero weight and shrink for long memory windows. Gradients are downloaded for float64 accumulation, clipping and Adam, then updated weights are uploaded. This transfer costs time but avoids tiny optimizer moments underflowing in GPU arithmetic. Non-finite/allocation failures retry smaller uncommitted chunks; failed epochs preserve the last checkpoint. CPU Stop finishes the current round; GPU Stop cancels immediately. Initialization and training have timeouts/progress heartbeats. No silent device fallback occurs.

Checkpoint metadata includes inputSchema=`joint-angles-cube-selectable-v4` (or compatible older angle/cube-only v3), outputMode=`absolute`, targetOffsetSamples=1 and validationScheme=`fixed-take-v2`. Projects also retain model/recording rates and stable take-role metadata. Loading from browser storage and Import use the same project/cube-position validation.

## Build and checks

```
python3 assemble.py
```

This writes a self-contained `dist/index.html`, an identical `../outputs/robot-gym.html`, and `../outputs/robot-gym-source.zip`. Every source script and stylesheet is inlined, including worker sources and bundled GPU libraries. Use `--output /path/robot-gym.html` to choose the deliverable location, or `--no-archive` to skip the ZIP. Open the HTML directly or serve `dist/`. No CDN is required.

Tests are standalone Node scripts in `tests/`. `review-safety`, `review-training`, `run-inference` and `build` cover the review fixes. `absolute-targets`/`next-sample` cover the current learning contract. Gradient/temporal learning, real workers, tensor learning, padding, cleanup, resume/noise, NaN rollback and physics interactions have dedicated tests. Hardware GPU execution has not been verified here; tensor tests use TensorFlow’s CPU backend to check algorithmic behavior.

`training-stability` reproduces the singleton-tail batching problem with 129 examples. The old scheduler makes three Adam updates per epoch (including an overweighted singleton); balanced batching makes one. The test requires the old >1% loss jumps to reproduce, no such jumps with the fixed scheduler, a smaller largest jump and improved final loss. It does not require an arbitrary tenfold reduction. `training-parity` separately checks CPU/tensor scheduling and numerical agreement. Ordinary increasing losses are neither hidden nor smoothed.

Third-party licenses: `PLANCK-LICENSE.txt`, `EARCUT-LICENSE.txt`, `TENSORFLOW-LICENSE.txt`.

The UI uses shared control height, type, radius and blue action colors over dark-gray panels. Robot parts use light-gray fills. Bottom panels group settings first, secondary/reset actions next, and primary actions to the right. Plot series and signed matrix colors retain distinct data encodings. `tests/ui-input-options.test.cjs` covers Takes visibility, camera preservation/panning and sensor input consistency through inference, take graphs, augmentation and saved models.

## ACT

Choose **ACT** in Network. Chunk length is 1–64 future actions, with its duration shown as samples / Model Hz (20 actions at 20 Hz = 1 second). Memory still controls past observations separately. Changing chunk length creates fresh weights. Temporal ensembling is an execution option and preserves weights when toggled.

New Teach samples contain `commands`, a copy of the actual servo targets, separately from measured `a` angles. Follow IK, clip playback and manually dragged joints all update these targets. Direct dragging still uses a physical mouse constraint, so its forces are not themselves action labels. Playback restores recorded commanded targets for accurate target/error rings while holding recorded physical poses. Older takes remain usable with the original model types and replay; ACT requires new takes with recorded commands. It never silently substitutes measured angles for missing commands.

ACT uses a state-based observation transformer encoder and learned future action queries in a self-/cross-attention decoder. A training-only transformer CVAE encodes the current normalized observation plus the demonstrated future command chunk into an 8-dimensional Gaussian style latent. Training uses masked L1 reconstruction plus 1.0 times mean KL divergence; Run and graph predictions use z = 0 with no future action access. This compact implementation uses RMSNorm/GELU and a residual feed-forward stage after each attention sublayer, rather than copying the original image-based ACT network. CPU workers and the tensor trainer implement the same objective and gradients. Normalizing/clipping observations never perturbs command labels.

Observation i supervises commands i+1 through i+K from the same take at its native Model Hz. Padded tail actions are masked out of reconstruction and CVAE attention. Takes never cross boundaries. Graph loss reports masked inference-time MSE (z = 0), including every valid future action; the training gradient uses L1 + KL. This keeps validation comparable to the policy actually executed.

Run predicts fresh chunks at Eval Hz and advances their action slots at Model Hz. Results carry the observation's simulation timestamp, so worker latency skips expired slots instead of replaying late commands. Temporal ensembling averages predictions aligned to the current simulation time, using exp(-0.1 × action age) weights that favor recent observations. With it off, the newest valid chunk supplies the current action. Physics remains 60 Hz. Pause/reset/tab switches cancel inference and clear queued chunks.

The Train take graph shows only solid recorded **commanded targets** and dashed **ACT next-action predictions** for all joints. Overlapping future-chunk traces are hidden to keep this comparison readable. Predictions refresh as committed training checkpoints arrive; these are predictions from recorded observations, not autonomous rollouts. ACT graph RMSE compares the displayed next-action predictions with the corresponding take commands. The Network grid diagram exposes observation, CVAE, action-query and decoder matrices on hover.

`act-runtime` checks finite-difference gradients across every parameter group, masked padding, no future-action leakage during inference, CPU/tensor numerical parity, learning and tensor cleanup. `act-gym` checks commands, chunk alignment, graph data, import/export and ensemble controls. `act-workers` exercises actual parallel training, prediction and Run workers. Hardware GPU execution still needs browser verification.

ACT regularization fix: the previous 0.01 KL default allowed a large gap between the demonstration-conditioned training latent and the zero latent used for graphs/Run. The default is now 1.0 on CPU and tensor backends, including existing checkpoints without an explicit KL weight. Continuing training preserves weights, Adam state and takes. `act-observation-learning` checks actual observation-dependent commands after 60 updates, rather than only learning a constant target; it reproduces the weak-regularization failure from a fixed seed.

## Build scene objects

Up to 12 loose heart cubes/circles can be placed independently of robot parts. They collide with the arm, floor and each other. Build edits set their reset poses; Teach Noise, when enabled, adds random offsets around those poses. Pose drags objects; the object popup duplicates/deletes them. The Build follow-point tool places or drags the marker on an unanchored robot part. Undo supports these edits and restores the compatible model when undoing an object-count change. Changing tools or Escape cancels placement.

Takes record every object's position, angle and velocity with stable IDs. Playback restores every recorded object without stepping physics. All five models and take prediction workers use X/Y for every object, in stable layout order; optional sensors follow those channels. Changing object count clears the incompatible model, retaining clips/takes; repositioning objects preserves the model. Takes from different object layouts stay available for playback and are excluded from training. Older projects migrate to a single cube at their saved cubeStart; old single-cube checkpoints remain compatible. Empty scenes are supported with joint-only base inputs. Multi-object checkpoints use joint-angles-objects-v5. Save/Load includes object shapes and Build poses.

`build-objects` covers placement/follow UI, editing, duplicate/delete/undo, collision/reset, multi-object recording/playback, empty scenes, all model types, optional sensors/noise, graph data and project migration.

## Arm and Balance rig templates

The upper-left Build buttons load fresh **Arm** and **Balance rig** templates, including when clicking the same template again. Template buttons replace the current robot, objects, follow point, clips, takes and model with the template defaults. There are no separately saved rig versions. Ordinary Save/Load still applies to the current project. Old multi-rig files can load their active project; inactive rig snapshots are no longer retained.

The balance template has an anchored pedestal, a 4.2 m plate, one ±35° servo joint and a heart ball resting above the plate. Teach Noise starts off so reset starts the ball on its plate. Click the follow marker in Teach and move the pointer above/below a horizontal line from the pivot to tilt the plate. A center marker uses the plate's rightward axis, so it still rotates. The arm keeps its multi-joint IK and wrist-orientation behavior. Train your own balancing policy from takes.

`balance-rig` checks fresh templates, same-button reset, single-joint motion in both directions, center marker placement, recording/models, current-project Save/Load and eight seconds of physical balancing driven through mouse targets.

## Agent control and hosted MCP

On the hosted gym, open Teach, Clips or Run, open Joints, and toggle **MCP** to Connected. Keep the tab visible. The private Site's MCP server exposes `robot_sessions`, `robot_observe`, `robot_move` and `robot_stop`. The same four tools register with WebMCP when supported, so a browser agent can use the current page directly without an extra server round trip.

`robot_move` accepts a `commands` array with one-based `joint`, signed `velocity_deg_s` (nonzero, ±60 maximum), `duration_ms` (1–3000), and optional `start_ms` (0–5000). All commands are validated before the batch starts. They share the existing 60 Hz physics clock, rounded to physics steps. Different joints start together; nonoverlapping commands on one joint may be scheduled in sequence. The arm rotates without angle limits, including saved arm scenes; other limited mechanisms retain their bounds. A delayed finger opening can happen during an elbow swing. Example:

```json
{"commands":[{"joint":2,"velocity_deg_s":-60,"duration_ms":1000},{"joint":4,"velocity_deg_s":60,"start_ms":300,"duration_ms":500},{"joint":6,"velocity_deg_s":-60,"start_ms":300,"duration_ms":500}],"wait_ms":1200}
```

The response includes a PNG of the scene canvas and only mode, joint count and a physics-running flag. It does not expose measured joint angles, object coordinates, targets or model state. The default screenshot time is the last pulse end plus 150 ms; `wait_ms` can request an earlier image while the plan continues. It is limited to 8000 ms. Only one movement plan runs at a time; observe and Stop remain available. No tool pauses physics or turns off collisions. Browser throttling can slow simulation time; stalled plans time out rather than replaying later.

Stop holds current angles and keeps physics running. Manual movement/drag, follow, clips, model controls, reset, tab changes or disconnect cancel scheduled movements. MCP mode does not start a Teach recording. The browser remains the only simulation authority; the server relays authenticated commands to the connected tab and returns that tab's rendered screenshot. Sessions are isolated by the Site-scoped signed-in user ID; the Site audience stays private. Movement IDs can be supplied as `request_id` UUIDs to make retries idempotent. Expired commands are not retried. Small screenshots (up to 128 KiB of base64) travel inline in the temporary D1 RPC result; larger screenshots use R2. Queue records remain in D1, and old results are cleaned up as clients reconnect. These are temporary control results, not project/take uploads.

`python3 build-hosted.py` first builds the offline HTML, then embeds it in `dist/server/index.js` with the `/mcp` endpoint and `/bridge/*` routes. `build-hosted.py` is an optional Worker build and requires your own `.openai/hosting.json` with `DB`, `BUCKET` and MCP capability. Deployment-specific configuration is excluded from this repository. `drizzle/0000_robot_bridge.sql` is a schema-only initial migration; published migrations must not be rewritten. `assemble.py` remains the reproducible offline build. `agent-control.test.cjs` checks the actual simulator and WebMCP registration; `mcp-server.test.cjs` exercises the server against real SQLite with authenticated queue/image round trips.

### MCP timing diagnostics

Observation and movement responses include a `timing` object in the text metadata beside the PNG. It records UTC request, enqueue, claim, browser receipt/first-step/capture/upload, result storage/detection and response-ready timestamps. Browser render/copy/PNG encoding and execution durations use its monotonic clock. The hosted server reports session lookup, queue write, delivery/upload residual, R2 store/read, result detection and total durations. Cross-worker UTC intervals are approximate; browser timestamps are never subtracted from server timestamps. Compare an outer caller stopwatch with `server_total` to identify MCP/platform overhead outside the app. Retry responses are marked `cached` and should be excluded from fresh-call benchmarks. No joint or object state is added.

The fast hosted path holds the browser's poll for up to eight seconds, checking for commands every 150 ms, rather than issuing a separate HTTP request after each 400 ms idle delay. MCP result detection also checks at 150 ms. Small frames skip the R2 write/read round trip without changing PNG quality. Large frames retain R2, and request IDs still deduplicate retries. The `image_transport` timing field identifies which path was used. Browser poll RTT includes the deliberate long-poll hold; `poll_transport_residual_ms` subtracts that server-measured hold. When an agent already has the open page, WebMCP avoids the hosted relay entirely and is the preferred low-latency path. Platform/tool routing time still remains outside the app.
