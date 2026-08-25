import { useState } from 'react';
import './HpcSetup.css';

/* ============================================================================
   HPC SETUP - run-4 setup walkthrough for the hospital GPU workstations
   ----------------------------------------------------------------------------
   Pick a machine at the top; every command below rewrites itself for that
   card's CUDA architecture. Written to be followed top-to-bottom on the day:
   short steps, copy buttons, no long paragraphs.

   NAMESPACE WARNING: this module's classes are `hpc-*`, never `hp-*`. The
   portal root is `.hp.portal` and home.css owns the whole single-class `.hp`
   / `.hp-*` namespace (the Reading Room). Using `hp` here both re-skinned this
   page with home.css tokens (so it ignored the portal's 3 themes) and applied
   layout rules to the entire portal shell.

   Everything else is built from the portal's own vocabulary - .pt-card,
   .mu-entry, .mu-steps, .mu-cmd, .mu-callout, .bk-seg - so it themes itself.

   The recipe is the tested WSL one from documentation/memory/env-setup-recipe.md,
   adapted for a shared native-Linux box: no sudo anywhere (conda supplies nvcc
   and gcc), and TORCH_CUDA_ARCH_LIST varies per GPU.

   To add a machine: append to MACHINES. Nothing else changes.
   ========================================================================== */

const HEAD = {
  kicker: 'University / Mamba_PSMA',
  intro:
    'Environment build and launch checklist for the hospital GPU workstations. Pick your machine and the ' +
    'commands adapt to its GPU. Follow top to bottom; each step gates the next.',
};

const MACHINES = [
  {
    id: 'atlas',
    name: 'ATLAS',
    former: 'The Beast',
    gpu: '4 x RTX 4090, 24 GB each',
    cpu: '128-core Threadripper',
    arch: 'Ada Lovelace, sm_89',
    archShort: 'Ada Lovelace',
    archList: '8.9+PTX',
    capability: '(8, 9)',
    jobs: 16,
    nGpu: 4,
    vram: 24,
    where: '3D-printing room',
    asset: 'NMHS-owned',
    verdict: 'Recommended',
    tone: 'good',
    why:
      'Best fit overall. The 128 cores make the one-off cache build and the dataloader fast, four GPUs mean you are not queueing behind anyone, and Ada is the best-supported architecture on this list.',
    note: null,
  },
  {
    id: 'apollo',
    name: 'APOLLO',
    former: null,
    gpu: '1 x RTX 5090, 32 GB',
    cpu: '128-core Threadripper',
    arch: 'Blackwell, sm_120',
    archShort: 'Blackwell',
    archList: '12.0+PTX',
    capability: '(12, 0)',
    jobs: 16,
    nGpu: 1,
    vram: 32,
    where: "Pejman's office",
    asset: 'DEP80133',
    verdict: 'Fastest / ask first',
    tone: 'good',
    why:
      'The quickest card here, and the only one whose architecture matches your home 5070 Ti exactly, so the recipe is already proven end-to-end on sm_120. Not a general-use machine: ask Pejman before claiming it.',
    note:
      'Blackwell REQUIRES CUDA 12.8 or newer. Older toolkits compile without complaint and then fail at runtime with "no kernel image is available for execution on the device". This is the one machine where the CUDA version is non-negotiable.',
  },
  {
    id: 'demeter',
    name: 'DEMETER',
    former: 'Dual 4090',
    gpu: '2 x RTX 4090, 24 GB each',
    cpu: null,
    arch: 'Ada Lovelace, sm_89',
    archShort: 'Ada Lovelace',
    archList: '8.9+PTX',
    capability: '(8, 9)',
    jobs: 8,
    nGpu: 2,
    vram: 24,
    where: 'Student room, western wall',
    asset: 'NMHS-owned',
    verdict: 'Solid fallback',
    tone: 'ok',
    why:
      'Same GPU and same recipe as ATLAS with half the cards. Fine for a single run-4 job, so take this if ATLAS is busy.',
    note: null,
  },
  {
    id: 'kronos',
    name: 'KRONOS',
    former: 'Alan',
    gpu: '1 x RTX 3090, 24 GB',
    cpu: null,
    arch: 'Ampere, sm_86',
    archShort: 'Ampere',
    archList: '8.6+PTX',
    capability: '(8, 6)',
    jobs: 8,
    nGpu: 1,
    vram: 24,
    where: 'Student room, southwest corner',
    asset: 'DEP64877',
    verdict: 'Works / slower',
    tone: 'ok',
    why:
      'Ampere is the oldest architecture that still does everything this project needs: 24 GB and native bf16. Expect roughly 1.5-2x the wall-clock of a 4090. Perfectly usable if the others are taken.',
    note: null,
  },
  {
    id: 'gaia',
    name: 'GAIA',
    former: 'Ada',
    gpu: '1 x TITAN, 12 GB',
    cpu: null,
    arch: 'Pascal or Volta - check',
    archShort: 'this card',
    archList: null,
    capability: 'n/a',
    jobs: 4,
    nGpu: 1,
    vram: 12,
    where: 'Student room, southeast corner',
    asset: 'DEP59365',
    verdict: 'Do not use',
    tone: 'avoid',
    why:
      'A 12 GB TITAN is Pascal or Volta, and neither supports bf16 in hardware. Training runs in bf16 by deliberate decision (ADR-004: fp16 silently collapses the loss scaler on Mamba). 12 GB is also tight against run 3 peaking at 10.2 GB.',
    note:
      'If you somehow have no other option, run nvidia-smi first to confirm which TITAN it is. Anything below sm_80 means switching amp_dtype to float32: slower, more memory, and no longer comparable to run 3. Take KRONOS instead.',
  },
];

const REPO = 'https://github.com/UWA-Medical-Physics-Research-Group/Mamba_PSMA.git';

/* -- Building blocks ------------------------------------------------------ */

function Copy({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className={`hpc-copy${done ? ' hpc-copy--done' : ''}`}
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function Cmd({ children }) {
  return (
    <div className="hpc-cmd">
      <div className="mu-cmd">{children}</div>
      <Copy text={children} />
    </div>
  );
}

function Step({ n, title, meta, children }) {
  return (
    <li className="mu-step">
      <span className="mu-step__n">{n}</span>
      <span className="mu-step__title">
        {title}
        {meta && <span className="mu-step__meta">{meta}</span>}
      </span>
      <div className="mu-step__body">{children}</div>
    </li>
  );
}

function Block({ kicker, title, children }) {
  return (
    <article className="pt-card mu-entry">
      <div className="mu-entry__head">
        <span className="mu-entry__kicker">{kicker}</span>
      </div>
      <h4 className="mu-entry__title">{title}</h4>
      <div className="mu-entry__body">{children}</div>
    </article>
  );
}

function Callout({ tone, label, children }) {
  return (
    <div className={`mu-callout${tone ? ` mu-callout--${tone}` : ''}`}>
      {label && <span className="mu-callout__label">{label}</span>}
      <p>{children}</p>
    </div>
  );
}

/* -- Claude Desktop context prompt ---------------------------------------- */

function claudePrompt(m) {
  return `I'm setting up a training environment on a hospital GPU workstation and I'm stuck. Here's the full context.

PROJECT
Honours thesis (UWA Medical Physics, CITS4010): "Mamba_PSMA" - a hybrid CNN-Mamba U-Net that segments prostate-cancer lesions in PSMA PET/CT. Standalone PyTorch + MONAI, benchmarked against PSMASegmentator (an nnU-Net fork).
Repo: ${REPO} (branch main)

WHAT I'M DOING TODAY
Launching "run 4", which adds auxiliary organ supervision: a second decoder head that also segments 25 TotalSegmentator organ classes, its cross-entropy loss summed with the lesion loss, head never called at inference. Purpose: run 3 false-alarmed on all 7 lesion-negative validation cases (25 spurious lesions, PPV 60.8%) and the reference model suppresses that by LEARNING anatomy rather than filtering afterwards.
All the code is implemented and verified. The only thing left is building the environment on this machine and launching.

THE MACHINE
${m.name}${m.former ? ` (formerly "${m.former}")` : ''} - ${m.gpu}${m.cpu ? `, ${m.cpu}` : ''}.
GPU architecture: ${m.arch}${m.archList ? ` -> TORCH_CUDA_ARCH_LIST="${m.archList}"` : ''}.
Native Linux, shared with other students, and I do NOT have sudo. Everything must come from conda/pip in my own home directory.

THE ENVIRONMENT RECIPE (proven on my home RTX 5070 Ti, sm_120)
- conda env "mamba", Python 3.11
- torch from the cu128 index: pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
- conda install -c nvidia cuda-toolkit=12.8   (supplies nvcc without sudo)
- conda install -c conda-forge gcc_linux-64=13 gxx_linux-64=13   (CUDA 12.8 rejects GCC >= 14)
- then build the Mamba kernels from source:
  export CUDA_HOME=$(dirname $(dirname $(which nvcc)))
  export TORCH_CUDA_ARCH_LIST="${m.archList || "<this machine's arch>"}"
  export CAUSAL_CONV1D_FORCE_BUILD=TRUE MAMBA_FORCE_BUILD=TRUE MAX_JOBS=${m.jobs}
  pip install causal-conv1d mamba-ssm --no-build-isolation --no-deps --force-reinstall --no-cache-dir --no-binary :all:
- pip install monai SimpleITK nibabel scipy wandb
- finish line: python check_env.py prints ALL CHECKS PASSED

TWO RULES THAT COST ME DAYS AT HOME
1. Never let pip upgrade torch while installing mamba-ssm - it silently swaps in an incompatible build. Always --no-deps.
2. The CUDA toolkit must be new enough for the GPU arch, or kernels compile fine and then fail at runtime with "no kernel image is available for execution on the device".

DATA ON THIS MACHINE
The autoPET-PSMA dataset is already here (imagesTr = <case>_0000.nii.gz CT + _0001.nii.gz PET, labelsTr = <case>.nii.gz).
Organ labels: autoPET-PSMA_ORGANS_combined_UPDATED, 597 files, 25 classes.
IMPORTANT: configs/baseline.yaml has a Windows/WSL path (/mnt/c/...) for organ_supervision.organs_dir, so on Linux I must override it with --organs on the command line or discovery silently finds nothing.

WHAT I NEED
Help me get past whatever I'm stuck on. Ask me to paste the exact error if you need it. Keep suggestions to things I can do WITHOUT sudo, and never suggest anything that reinstalls or upgrades torch as a side effect.

MY PROBLEM RIGHT NOW:
[describe it here]`;
}

/* -- Page ----------------------------------------------------------------- */

export default function HpcSetup() {
  const [active, setActive] = useState('atlas');
  const m = MACHINES.find((x) => x.id === active) || MACHINES[0];
  const arch = m.archList || '8.9+PTX';
  const dev = m.nGpu > 1 ? 'CUDA_VISIBLE_DEVICES=0 ' : '';

  return (
    <div className="pt-module mu hpc">

      <p className="mu-kicker">{HEAD.kicker}</p>
      <p className="pt-module__intro">{HEAD.intro}</p>

      {/* Machine picker - the portal's existing segmented control */}
      <div className="bk-seg" role="tablist" aria-label="GPU workstation">
        {MACHINES.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={x.id === active}
            className={`bk-seg__tab${x.id === active ? ' bk-seg__tab--active' : ''}`}
            onClick={() => setActive(x.id)}
          >
            {x.name}
          </button>
        ))}
      </div>

      {/* Machine banner */}
      <div className="pt-card hpc-machine">
        <div className="hpc-machine__top">
          <p className="hpc-machine__name">{m.name}</p>
          {m.former && <span className="hpc-machine__former">was &ldquo;{m.former}&rdquo;</span>}
          <span className={`hpc-machine__verdict hpc-machine__verdict--${m.tone}`}>{m.verdict}</span>
        </div>
        <p className="hpc-machine__why">{m.why}</p>
        <div className="hpc-specs">
          <span className="hpc-spec"><span className="hpc-spec__k">GPU</span><span className="hpc-spec__v">{m.gpu}</span></span>
          {m.cpu && <span className="hpc-spec"><span className="hpc-spec__k">CPU</span><span className="hpc-spec__v">{m.cpu}</span></span>}
          <span className="hpc-spec"><span className="hpc-spec__k">Arch</span><span className="hpc-spec__v">{m.arch}</span></span>
          {m.archList && <span className="hpc-spec"><span className="hpc-spec__k">Build target</span><span className="hpc-spec__v">{m.archList}</span></span>}
          <span className="hpc-spec"><span className="hpc-spec__k">Location</span><span className="hpc-spec__v">{m.where}</span></span>
          <span className="hpc-spec"><span className="hpc-spec__k">Asset</span><span className="hpc-spec__v">{m.asset}</span></span>
        </div>
      </div>

      {m.note && (
        <article className="pt-card mu-entry">
          <div className="mu-entry__body">
            <Callout tone="warn" label={`${m.name} - read this first`}>{m.note}</Callout>
          </div>
        </article>
      )}

      <Block kicker="Step 1 / Before you start" title="Claim the machine">
        <p>These are shared boxes. Thirty seconds now saves an evicted thirty-hour run.</p>
        <Cmd>{`nvidia-smi
nvidia-smi --query-compute-apps=pid,used_memory,process_name --format=csv
df -h ~`}</Cmd>
        <ul className="mu-list">
          <li>Empty process list means free. If someone is training, <strong>take another machine</strong> rather than sharing a card.</li>
          <li>Check <strong>CUDA Version</strong> top-right of <code>nvidia-smi</code>: needs <strong>12.8+</strong>{m.id === 'apollo' ? ', mandatory on Blackwell.' : '.'}</li>
          <li>You need about <strong>20 GB</strong> free in your home directory for the cache.</li>
        </ul>
      </Block>

      <Block kicker="Step 2 / Reference" title="Linux survival kit">
        <table className="hpc-keys">
          <tbody>
            <tr><td>ls / cd / pwd</td><td>list, move, where am I</td></tr>
            <tr><td>nano FILE</td><td>edit a file. Ctrl+O save, Ctrl+X exit</td></tr>
            <tr><td>df -h ~</td><td>free disk space</td></tr>
            <tr><td>nvidia-smi -l 2</td><td>GPU state, refreshing every 2 s</td></tr>
            <tr><td>tail -f FILE</td><td>watch a log grow live. Ctrl+C stops watching, not the job</td></tr>
            <tr><td>tmux new -s run4</td><td>session that survives disconnect</td></tr>
            <tr><td>Ctrl+b then d</td><td>detach, leaving it running</td></tr>
            <tr><td>tmux attach -t run4</td><td>come back to it</td></tr>
          </tbody>
        </table>
        <Callout tone="accent" label="Do this before anything long">
          Start tmux now and run everything inside it. Close the terminal without tmux and every running
          job dies with it.
        </Callout>
      </Block>

      <Block kicker="Step 3 / Code" title="Clone the repo">
        <Callout tone="warn" label="Do this on the Windows box FIRST">
          The organ-supervision work is uncommitted. A clone of <code>main</code> as it stands has no
          organ head at all and would quietly re-run run 3. Commit and push before you leave, then
          confirm below that the clone actually has it.
        </Callout>
        <Cmd>{`cd ~
git clone ${REPO}
cd Mamba_PSMA

# proof the push landed - both must print something
grep -n "organ_supervision" configs/baseline.yaml | head -3
ls scripts/verify_organ_supervision.py`}</Cmd>
        <ul className="mu-list">
          <li>If it asks for a password it wants a <strong>personal access token</strong>, not your GitHub password. Easiest route is <code>gh auth login</code> if the GitHub CLI is there.</li>
          <li><strong>Leave <code>splits/</code> alone.</strong> The train/val/test split is committed and byte-identical to run 3, which is what makes run 4 comparable. It only regenerates if the files are missing.</li>
        </ul>
      </Block>

      <Block kicker="Step 4 / Data" title="Find the data, set two variables">
        <p>Everything downstream reads these two.</p>
        <Cmd>{`find / -maxdepth 6 -type d -name "*ORGANS_combined_UPDATED*" 2>/dev/null
find / -maxdepth 6 -type d -name "imagesTr" 2>/dev/null`}</Cmd>
        <Cmd>{`export DATA=/path/to/PSMA-PET-CT-Lesions_v3
export ORGANS=/path/to/autoPET-PSMA_ORGANS_combined_UPDATED

ls $DATA/imagesTr | wc -l    # expect 1194
ls $DATA/labelsTr | wc -l    # expect 597
ls $ORGANS | wc -l           # expect 597`}</Cmd>
        <Callout tone="warn" label="The one that will bite you">
          <code>configs/baseline.yaml</code> holds a Windows path (<code>/mnt/c/...</code>) for the organ
          directory. On Linux it resolves to nothing and discovery silently finds zero organ files, so
          always pass <code>--organs $ORGANS</code> explicitly.
        </Callout>
      </Block>

      <Block kicker="Step 5 / Environment" title={`Build the env for ${m.archShort}`}>
        <Callout tone="accent" label="No sudo needed">
          Conda supplies the CUDA toolkit and the compiler, so everything lives in your home directory.
          Never touch the system NVIDIA driver.
        </Callout>
        <ol className="mu-steps">
          <Step n="1" title="Miniconda" meta="skip if conda works">
            <Cmd>{`cd ~
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh
# close and reopen the terminal afterwards`}</Cmd>
          </Step>
          <Step n="2" title="Env and PyTorch" meta="cu128">
            <Cmd>{`conda create -n mamba python=3.11 -y
conda activate mamba
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128`}</Cmd>
            <Cmd>{`python -c "import torch; print(torch.__version__, torch.version.cuda, torch.cuda.is_available(), torch.cuda.get_device_capability())"`}</Cmd>
            <p>
              Expect something like <code>2.11.0+cu128 12.8 True {m.capability}</code>. The torch version
              may be newer than the home box, which is fine. What must match is{' '}
              <code>+cu128</code>, <code>True</code>, and the capability{' '}
              <code>{m.capability}</code>. If <code>is_available()</code> is False, stop and fix that
              first.
            </p>
          </Step>
          <Step n="3" title="Build tools" meta="nvcc + GCC 13">
            <Cmd>{`conda install -c nvidia cuda-toolkit=12.8 -y
conda install -c conda-forge gcc_linux-64=13 gxx_linux-64=13 -y

conda deactivate && conda activate mamba
nvcc --version                        # expect 12.8
x86_64-conda-linux-gnu-c++ --version  # expect 13.x`}</Cmd>
            <p>CUDA 12.8 refuses GCC 14+, so pinning 13 avoids the most confusing error in the build.</p>
          </Step>
          <Step n="4" title="Compile the Mamba kernels" meta={`arch ${arch}`}>
            <p>One block, one terminal. Several minutes of nvcc output is normal.</p>
            <Cmd>{`export CUDA_HOME=$(dirname $(dirname $(which nvcc)))
export TORCH_CUDA_ARCH_LIST="${arch}"
export CAUSAL_CONV1D_FORCE_BUILD=TRUE
export MAMBA_FORCE_BUILD=TRUE
export MAX_JOBS=${m.jobs}

pip install causal-conv1d mamba-ssm --no-build-isolation --no-deps \\
  --force-reinstall --no-cache-dir --no-binary :all:`}</Cmd>
            <ul className="mu-list">
              <li><code>--no-deps</code> stops pip swapping your working torch. <strong>Never drop it.</strong></li>
              <li><code>TORCH_CUDA_ARCH_LIST</code> is the line that differs per machine.</li>
            </ul>
          </Step>
          <Step n="5" title="Project deps and first gate" meta="check_env.py">
            <Cmd>{`pip install monai SimpleITK nibabel scipy wandb

cd ~/Mamba_PSMA
python check_env.py`}</Cmd>
            <p>
              Expect <code>ALL CHECKS PASSED</code>. Do not move on without it, since everything below
              assumes a working GPU stack.
            </p>
          </Step>
        </ol>
      </Block>

      <Block kicker="Step 6 / Data check" title="Verify the organ labels">
        <p>Cheap, and it has already caught one silent data disaster.</p>
        <Cmd>{`python scripts/verify_organ_supervision.py \\
  --organs $ORGANS --data $DATA/imagesTr --labels $DATA/labelsTr`}</Cmd>
        <p>
          Expect <strong>ALL CHECKS PASSED</strong> across both stages, including{' '}
          <code>class 5 really is lung</code> and <code>classes 10-21 really are bone</code>. Those two
          exist because the first label delivery was mislabelled and passed everything else.
        </p>
      </Block>

      <Block kicker="Step 7 / Dry run" title="VRAM probe and smoke test">
        <p>
          150 iterations. Catches everything before you commit thirty hours, and starts filling the cache
          (about 487 cases, roughly 14 GB). Point it at a fresh directory: the cache is keyed by case ID
          alone and knows nothing about which labels built it.
        </p>
        <Cmd>{`mkdir -p ~/psma-cache-organs

${dev}python -u training/train.py \\
  --config configs/baseline.yaml \\
  --data $DATA/imagesTr --labels $DATA/labelsTr --organs $ORGANS \\
  --cache-dir ~/psma-cache-organs \\
  --checkpoint-dir /tmp/smoke-run4 \\
  --max-iters 150`}</Cmd>
        <p>Watch VRAM in a second tmux pane, <code>Ctrl+b</code> then <code>%</code>:</p>
        <Cmd>{`nvidia-smi -l 2`}</Cmd>
        <ul className="hpc-check">
          <li>Console prints <code>organ supervision=ON (weight 1.0, 25 classes)</code></li>
          <li><code>organ</code> loss falls quickly from about 3.2, which is ln(25)</li>
          <li>Total loss finite and falling, no non-finite warnings</li>
          <li>Peak VRAM well under {m.vram} GB, expect somewhat above run 3&rsquo;s 10.2 GB</li>
        </ul>
        <Callout tone="warn" label="Non-negotiable">
          Always pass <code>--checkpoint-dir</code> for smoke tests. A fresh run starts at{' '}
          <code>best_dice = 0.0</code>, so its first validation always overwrites{' '}
          <code>checkpoint_best.pth</code>. That is how run 1&rsquo;s weights were destroyed.
        </Callout>
      </Block>

      <Block kicker="Step 8 / Go" title="Launch run 4">
        <Cmd>{`tmux new -s run4
conda activate mamba && cd ~/Mamba_PSMA

${dev}python -u training/train.py \\
  --config configs/baseline.yaml \\
  --data $DATA/imagesTr --labels $DATA/labelsTr --organs $ORGANS \\
  --cache-dir ~/psma-cache-organs \\
  --checkpoint-dir checkpoints/run4 \\
  --wandb > train-run4.log 2>&1

# Ctrl+b then d to detach`}</Cmd>
        <Cmd>{`tmux attach -t run4
tail -f ~/Mamba_PSMA/train-run4.log`}</Cmd>
        <ul className="mu-list">
          <li>
            <strong>Keep patch size at [96, 192, 96]</strong> even with {m.vram} GB free. Changing it
            breaks comparability with run 3: a bigger patch is a separate experiment, not a freebie.
          </li>
          <li>W&amp;B stays <strong>offline</strong>. Sync afterwards with <code>scripts/post_run.py</code>.</li>
          <li>If it dies partway: <code>--resume checkpoints/run4/checkpoint_last.pth</code>.</li>
        </ul>
        <Callout tone="accent" label="What run 4 has to beat">
          Run 3 on val: sensitivity 73.5%, PPV 60.8%, F1 66.5%, with all 7 lesion-negative cases
          false-alarming for 25 spurious lesions. Success is fewer false alarms and higher PPV, with
          sensitivity no worse.
        </Callout>
      </Block>

      <Block kicker="Step 9 / Afterwards" title="Capture the run">
        <p>
          One command archives, evaluates, sweeps thresholds and writes the run card. Run it on the HPC
          while the checkpoints are still there.
        </p>
        <Cmd>{`python scripts/post_run.py \\
  --run-number 4 --run-name organ-supervision \\
  --checkpoint checkpoints/run4/checkpoint_best.pth \\
  --checkpoint-last checkpoints/run4/checkpoint_last.pth \\
  --train-log train-run4.log \\
  --cache-dir ~/psma-cache-organs \\
  --data $DATA/imagesTr --labels $DATA/labelsTr`}</Cmd>
        <ul className="mu-list">
          <li>
            <strong><code>--data</code> and <code>--labels</code> are required here.</strong> Without
            them the eval step falls back to a Windows path, finds no cases and dies after the archive
            is already written.
          </li>
          <li>
            The archive lands in <code>~/run-archives/</code> on the HPC with a SHA-256 manifest.{' '}
            <strong>Copy it back</strong> - it holds the only copy of the weights.
          </li>
          <li>
            W&amp;B was offline, so the run syncs from the archived offline directory. The checkpoint
            carries its own <code>wandb_id</code>, so post_run finds it automatically.
          </li>
        </ul>
        <Callout tone="accent" label="What gets captured either way">
          Checkpoints, <code>train-run4.log</code>, the W&amp;B offline directory, the exact config and
          splits, plus per-case eval CSV and threshold sweep. W&amp;B also records the machine and
          package versions automatically, so the run is traceable to whichever workstation you used.
        </Callout>
      </Block>

      <Block kicker="If you get stuck" title="Context prompt for Claude">
        <p>
          Everything Claude needs about the project and this machine. Copy it, add your error at the
          bottom, send.
        </p>
        <div className="hpc-cmd hpc-prompt">
          <div className="mu-cmd">{claudePrompt(m)}</div>
          <Copy text={claudePrompt(m)} />
        </div>
      </Block>

    </div>
  );
}
