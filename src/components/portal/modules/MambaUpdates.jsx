import Icon from '../icons';

/* ============================================================================
   MAMBA UPDATES — honours project explainer feed  (University)
   ----------------------------------------------------------------------------
   A living feed of "explainer pages" for the Mamba_PSMA honours project. The
   idea: whenever James wants to understand a part of the project being built,
   the assisting Claude instance writes a new entry here — a self-contained
   page explaining that slice (the what / why / how).

   Each update is one object appended to UPDATES below (newest first); the
   render path is already wired, so adding an explainer is a single array entry:

     {
       id:      'ssm-basics',                 // unique slug
       date:    '2026-07-05',                 // ISO date
       kicker:  'Architecture',               // short mono tag
       title:   'Why a state-space backbone?',
       body: (                                // any JSX
         <>
           <p>…</p>
         </>
       ),
     }

   Styled with the portal's Reading Room tokens via the shared .pt-* classes and
   the .mu-* block in portal.css — re-skins automatically with the active theme.
   ========================================================================== */

const HEAD = {
  kicker: 'University · Mamba_PSMA',
  title: 'Mamba Updates',
  intro:
    'A running feed of explainer pages for the honours project. Whenever a part of the build needs ' +
    'unpacking, a new entry lands here — a focused write-up of that slice: what it is, why it exists, ' +
    'and how it fits the whole.',
};

// Explainer entries — newest first.
const UPDATES = [
  /* === SETUP: THE COMPLETE, TESTED ENVIRONMENT RECIPE (newest) === */
  {
    id: 'env-setup-recipe',
    date: '2026-07-06',
    kicker: 'Setup · Definitive',
    title: 'Environment setup: the complete, tested recipe (WSL2 + CUDA + Mamba)',
    body: (
      <>
        <p className="mu-lead">
          This is the exact, tested recipe that got the training environment working on the home PC
          (RTX&nbsp;5070&nbsp;Ti). It was a fight - the GPU is brand-new (Blackwell), so a lot of the tooling
          needed coaxing. Follow Parts A-E in order and you'll skip every dead end we hit; the fixes are already
          baked in. A future you - or a future Claude instance - can rebuild the whole thing from this page.
        </p>

        <div className="mu-callout mu-callout--accent">
          <span className="mu-callout__label">The end state you're aiming for</span>
          <p>
            WSL2 Ubuntu&nbsp;22.04, a conda env called <code>mamba</code> (Python&nbsp;3.11), with{' '}
            <code>torch 2.11.0+cu128</code>, <code>nvcc 12.8</code>, <code>GCC 13</code>, and <code>mamba-ssm</code>{' '}
            compiled for your Blackwell GPU (sm_120). The finish line is <code>check_env.py</code> printing{' '}
            <code>ALL CHECKS PASSED</code>.
          </p>
        </div>

        <div className="mu-callout mu-callout--warn">
          <span className="mu-callout__label">Three golden rules (learned the hard way)</span>
          <ul className="mu-list">
            <li><strong>Never install an NVIDIA driver inside WSL.</strong> The Windows driver already passes the GPU through to Linux; adding a Linux driver breaks it.</li>
            <li><strong>Never let pip upgrade torch</strong> while installing mamba-ssm - it silently swaps your working torch for an incompatible one. Always pass <code>--no-deps</code>.</li>
            <li><strong>Your GPU is Blackwell (sm_120)</strong>, so it needs CUDA <strong>12.8 or newer</strong> tools. Older CUDA (e.g. 12.4) compiles fine but produces kernels that won't run on the card.</li>
          </ul>
        </div>

        <p className="mu-h">Part A · WSL2 + Ubuntu (in Windows PowerShell)</p>
        <ol className="mu-steps">
          <li className="mu-step">
            <span className="mu-step__n">1</span>
            <span className="mu-step__title">Install WSL2 + Ubuntu<span className="mu-step__meta">admin PowerShell</span></span>
            <p className="mu-step__body">
              Open PowerShell <strong>as Administrator</strong>, run this, and reboot if it asks. Ubuntu&nbsp;22.04
              LTS is the safe pick - widest CUDA support and closest to the SCGH HPC.
            </p>
            <div className="mu-cmd">{`wsl --install -d Ubuntu-22.04`}</div>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">2</span>
            <span className="mu-step__title">Create your Linux user + update<span className="mu-step__meta">Ubuntu</span></span>
            <p className="mu-step__body">
              Launch <strong>Ubuntu</strong> from the Start menu; it asks for a new username + password (separate
              from Windows). Then update the system:
            </p>
            <div className="mu-cmd">{`sudo apt update && sudo apt upgrade -y`}</div>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">3</span>
            <span className="mu-step__title">Confirm the GPU is visible<span className="mu-step__meta">nvidia-smi</span></span>
            <p className="mu-step__body">
              You should see &ldquo;NVIDIA GeForce RTX 5070 Ti&rdquo;. If you do, the GPU passes through and no
              driver install is needed (golden rule #1).
            </p>
            <div className="mu-cmd">{`nvidia-smi`}</div>
          </li>
        </ol>

        <p className="mu-h">Part B · Conda env + PyTorch (inside Ubuntu)</p>
        <ol className="mu-steps">
          <li className="mu-step">
            <span className="mu-step__n">4</span>
            <span className="mu-step__title">Miniconda + a clean env<span className="mu-step__meta">python 3.11</span></span>
            <p className="mu-step__body">
              Install Miniconda, then make a Python&nbsp;3.11 env. Close and reopen Ubuntu after the installer so{' '}
              <code>conda</code> is on your path.
            </p>
            <div className="mu-cmd">{`wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh
conda create -n mamba python=3.11 -y
conda activate mamba`}</div>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">5</span>
            <span className="mu-step__title">PyTorch - the Blackwell build<span className="mu-step__meta">cu128</span></span>
            <p className="mu-step__body">
              The <code>cu128</code> index gives you a torch built for CUDA&nbsp;12.8, which is what your Blackwell
              card needs.
            </p>
            <div className="mu-cmd">{`pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128`}</div>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">6</span>
            <span className="mu-step__title">Verify torch sees the GPU<span className="mu-step__meta">the proof</span></span>
            <p className="mu-step__body">
              You want <code>2.11.0+cu128</code>, then <code>12.8</code>, <code>True</code>, and <code>(12, 0)</code>.
              That <code>(12, 0)</code> is the key - it means torch has kernels for your GPU.
            </p>
            <div className="mu-cmd">{`python -c "import torch; print(torch.__version__, torch.version.cuda, torch.cuda.is_available(), torch.cuda.get_device_capability())"`}</div>
          </li>
        </ol>

        <p className="mu-h">Part C · The build tools - set these up BEFORE Mamba</p>
        <p>
          <code>mamba-ssm</code> compiles CUDA code from scratch, so it needs a matching compiler toolchain ready
          first. Getting these two right up front is what avoids the confusing build errors (see the last section).
        </p>
        <ol className="mu-steps">
          <li className="mu-step">
            <span className="mu-step__n">7</span>
            <span className="mu-step__title">CUDA 12.8 toolkit (gives you nvcc)<span className="mu-step__meta">nvidia channel</span></span>
            <p className="mu-step__body">
              A fresh Ubuntu has no CUDA compiler, and any system one is likely too old for Blackwell. Install a
              matching 12.8 toolkit into the env:
            </p>
            <div className="mu-cmd">{`conda install -c nvidia cuda-toolkit=12.8 -y`}</div>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">8</span>
            <span className="mu-step__title">A compatible C++ compiler<span className="mu-step__meta">GCC 13</span></span>
            <p className="mu-step__body">
              CUDA&nbsp;12.8 refuses host compilers newer than GCC&nbsp;13. conda envs often ship GCC&nbsp;14, so
              pin it down to 13:
            </p>
            <div className="mu-cmd">{`conda install -c conda-forge gcc_linux-64=13 gxx_linux-64=13 -y`}</div>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">9</span>
            <span className="mu-step__title">Re-activate and verify<span className="mu-step__meta">nvcc + g++</span></span>
            <p className="mu-step__body">
              Re-activate so the new tools land on your path, then confirm <code>nvcc</code> reports{' '}
              <strong>12.8</strong> and the C++ compiler reports <strong>13.x</strong>:
            </p>
            <div className="mu-cmd">{`conda deactivate && conda activate mamba
nvcc --version
x86_64-conda-linux-gnu-c++ --version`}</div>
          </li>
        </ol>

        <p className="mu-h">Part D · Build the Mamba libraries (the exact incantation)</p>
        <p>
          This one block forces a clean, from-source compile that targets your GPU and refuses to touch torch.
          Run it all in one terminal with <code>(mamba)</code> active. It compiles for several minutes - lots of{' '}
          <code>nvcc</code> output is normal.
        </p>
        <div className="mu-cmd">{`export CUDA_HOME=$(dirname $(dirname $(which nvcc)))
export TORCH_CUDA_ARCH_LIST="12.0+PTX"
export CAUSAL_CONV1D_FORCE_BUILD=TRUE
export MAMBA_FORCE_BUILD=TRUE
export MAX_JOBS=4
pip install causal-conv1d mamba-ssm --no-build-isolation --no-deps --force-reinstall --no-cache-dir --no-binary :all:`}</div>
        <p>What each part is for, in plain English:</p>
        <ul className="mu-list">
          <li><code>--no-build-isolation</code> - build against <em>your</em> torch, not a random one pip pulls into a sandbox.</li>
          <li><code>--no-deps</code> - don't let it upgrade or replace torch (golden rule #2).</li>
          <li><code>--no-cache-dir --no-binary :all:</code> - genuinely recompile from source instead of reusing a stale cached wheel.</li>
          <li><code>MAMBA_FORCE_BUILD</code> / <code>CAUSAL_CONV1D_FORCE_BUILD</code> - compile from source rather than download a prebuilt wheel that lacks Blackwell.</li>
          <li><code>TORCH_CUDA_ARCH_LIST="12.0+PTX"</code> - build the kernels for your Blackwell GPU (sm_120), with a PTX fallback for safety.</li>
          <li><code>CUDA_HOME</code> - point the build at the 12.8 toolkit you just installed.</li>
          <li><code>MAX_JOBS=4</code> - cap parallel compile jobs so the build doesn't exhaust your RAM.</li>
        </ul>

        <p className="mu-h">Part E · Project deps + the final check</p>
        <ol className="mu-steps">
          <li className="mu-step">
            <span className="mu-step__n">10</span>
            <span className="mu-step__title">Install the remaining dependencies<span className="mu-step__meta">explicitly</span></span>
            <p className="mu-step__body">
              Install these by name - <strong>not</strong> via <code>pip install -r requirements.txt</code>, which
              re-lists torch and can trigger the swap from rule #2.
            </p>
            <div className="mu-cmd">{`pip install monai SimpleITK nibabel scipy`}</div>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">11</span>
            <span className="mu-step__title">Run the check<code>check_env.py</code></span>
            <p className="mu-step__body">
              From the repo root. It confirms torch + GPU, runs a real mamba-ssm forward pass on the GPU, and
              checks every dependency.
            </p>
            <div className="mu-cmd">{`cd /mnt/c/Users/james/Documents/university/cits4010/Mamba_PSMA
python check_env.py`}</div>
          </li>
        </ol>

        <div className="mu-callout mu-callout--ok">
          <span className="mu-callout__label">Done</span>
          <p>
            When <code>check_env.py</code> prints <code>ALL CHECKS PASSED</code>, the environment is ready.
            Rebuilding later? Just follow Parts A-E again - every fix is baked in, so you shouldn't see the errors
            below. Moving to the SCGH HPC? Expect the same class of issues (Blackwell + CUDA + GCC + source build);
            this recipe transfers directly.
          </p>
        </div>

        <p className="mu-h">If something breaks · the errors we actually hit, and the fix</p>
        <p>These are the real errors from setting this up, in the order they appeared. If one shows up again, here's the cause and the fix.</p>
        <div className="mu-callout">
          <span className="mu-callout__label">1 · build-time CUDA mismatch</span>
          <p>
            "The detected CUDA version (12.4) mismatches ... PyTorch (13.0)" while building - pip's build isolation
            pulled a different torch into a sandbox. <strong>Fix:</strong> add <code>--no-build-isolation</code> so
            it builds against your real torch.
          </p>
        </div>
        <div className="mu-callout">
          <span className="mu-callout__label">2 · torch silently swapped to 2.12.1</span>
          <p>
            You get a "torchvision ... incompatible" warning, and the mamba step later fails. Installing mamba-ssm
            let its dependencies upgrade torch, breaking the cu128 setup. <strong>Fix:</strong> put the good torch
            back, then always build mamba with <code>--no-deps</code>:
          </p>
          <div className="mu-cmd">{`pip install torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cu128`}</div>
        </div>
        <div className="mu-callout">
          <span className="mu-callout__label">3 · "no kernel image is available for execution on the device"</span>
          <p>
            The kernels were compiled without Blackwell (sm_120) support - usually because nvcc was too old (12.4).
            <strong> Fix:</strong> install nvcc&nbsp;12.8 (Part&nbsp;C) and rebuild with{' '}
            <code>TORCH_CUDA_ARCH_LIST="12.0+PTX"</code>.
          </p>
        </div>
        <div className="mu-callout">
          <span className="mu-callout__label">4 · rebuild changes nothing (same error repeats)</span>
          <p>
            pip reused a cached wheel instead of recompiling, so the new flags never applied. <strong>Fix:</strong>{' '}
            add <code>--no-cache-dir --no-binary :all:</code> plus the <code>*_FORCE_BUILD</code> env vars to force
            a real source build.
          </p>
        </div>
        <div className="mu-callout">
          <span className="mu-callout__label">5 · "c++ (14.3.0) is greater than the maximum required by CUDA 12.8 (&lt;14.0)"</span>
          <p>
            Your host GCC is too new for CUDA&nbsp;12.8. <strong>Fix:</strong> install GCC&nbsp;13 (Part&nbsp;C,
            step&nbsp;8):
          </p>
          <div className="mu-cmd">{`conda install -c conda-forge gcc_linux-64=13 gxx_linux-64=13 -y`}</div>
        </div>

        <div className="mu-tags">
          <span className="mu-tag">torch 2.11.0+cu128</span>
          <span className="mu-tag">nvcc 12.8</span>
          <span className="mu-tag">GCC 13.4</span>
          <span className="mu-tag">sm_120 (Blackwell)</span>
          <span className="mu-tag">mamba-ssm</span>
        </div>
      </>
    ),
  },

  /* ────────────────────────────────────────────────────────────────────────
     1 · THE FORWARD PLAN
     ──────────────────────────────────────────────────────────────────────── */
  {
    id: 'mamba-dev-plan',
    date: '2026-07-05',
    kicker: 'Plan · Roadmap',
    title: 'Starting the Mamba model: the build plan',
    body: (
      <>
        <p className="mu-lead">
          The data pipeline is finished and verified. The next milestone on the proposal timeline is a{' '}
          <strong>working Mamba model</strong> (Jul–Sep 2026). This page lays out where the repo stands
          today and the exact order we&rsquo;ll build the model in.
        </p>

        <p className="mu-h">Where we are today</p>
        <p>
          The whole <strong>data-preparation pipeline is built and tested end-to-end</strong> on real
          autoPET scans: discover CT/PET pairs, register the CT onto the PET grid, resample to a fixed
          ~4&nbsp;mm spacing, apply CTNormalization, crop lesion-biased patches, and batch into
          <code>(B, 2, 64, 128, 64)</code> tensors. It is config-driven — <code>baseline.yaml</code> carries
          the exact spacing / normalisation / patch recipe lifted from the deployed nnU-Net{' '}
          <code>plans.json</code>, so the comparison against the baseline stays fair.
        </p>
        <div className="mu-flow" aria-label="Preprocessing pipeline status">
          <span className="mu-flow__node mu-flow__node--done">Load</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node mu-flow__node--done">Register</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node mu-flow__node--done">Resample</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node mu-flow__node--done">Normalise</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node mu-flow__node--done">Patch</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node mu-flow__node--done">Batch</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node mu-flow__node--next">Model</span>
        </div>
        <p>
          Everything downstream of the pipeline is still <strong>scaffolding</strong> — the four model
          files, the three training files, the three evaluation files, the three entry-point scripts and the
          two experiment configs are all comment-only stubs describing intent. That is the deliberate starting
          line for this phase.
        </p>
        <div className="mu-callout mu-callout--warn">
          <span className="mu-callout__label">One real blocker</span>
          <p>
            There are <strong>no labelled training cases on the dev machine yet</strong> — the local autoPET
            volumes are inference-only. Training needs the labelled autoPET-PSMA set (which ships masks) or the
            SCGH data with RTSTRUCT → ground-truth mask conversion. Model code can be written and shape-tested
            without it, but no real training run starts until labels are in place.
          </p>
        </div>

        <p className="mu-h">The build order</p>
        <ol className="mu-steps">
          <li className="mu-step">
            <span className="mu-step__n">1</span>
            <span className="mu-step__title">Stand up the training environment<span className="mu-step__meta">HPC</span></span>
            <p className="mu-step__body">
              Install <code>torch</code>, <code>monai</code>, <code>mamba-ssm</code> and{' '}
              <code>causal-conv1d</code> on the SCGH HPC (they need CUDA and aren&rsquo;t on the dev laptop).
              First job: prove the existing MONAI DataLoader stage actually runs on a GPU — right now it is
              only syntax-checked.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">2</span>
            <span className="mu-step__title">Build the Mamba block<span className="mu-step__meta">the atom</span></span>
            <p className="mu-step__body">
              Implement <code>mamba_block_3d.py</code> first — flatten a 3D feature map to a 1D sequence, run
              the selective scan, reshape back. Validate on a single patch: correct output shape, sane memory,
              runs on GPU. Nothing else can be tested until this works.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">3</span>
            <span className="mu-step__title">Assemble the network<span className="mu-step__meta">encoder · decoder · head</span></span>
            <p className="mu-step__body">
              Wire <code>encoder.py</code> → bottleneck → <code>decoder.py</code> → segmentation head in{' '}
              <code>psma_mamba.py</code>. Prove it can learn by <strong>overfitting a single case</strong> —
              the classic sanity check that the forward/backward path and skip connections are correct.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">4</span>
            <span className="mu-step__title">Loss + training loop<span className="mu-step__meta">Tversky</span></span>
            <p className="mu-step__body">
              <code>loss.py</code> (asymmetric Tversky + BCE), <code>train.py</code> (mixed-precision loop,
              checkpointing on best lesion-F1, logging) and <code>scheduler.py</code> (warmup + cosine to steady
              the large Mamba init). Train on a handful of labelled cases to confirm the loss goes down.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">5</span>
            <span className="mu-step__title">Evaluation<span className="mu-step__meta">lesion-F1</span></span>
            <p className="mu-step__body">
              <code>metrics.py</code> (connected-component lesion detection — 25&nbsp;mm³ filter, 10% overlap),{' '}
              <code>inference.py</code> (overlap-tile sliding window with Gaussian stitching), and{' '}
              <code>evaluate.py</code> to score against the baseline&rsquo;s F1 = 79.9%, PPV = 88.2%,
              sensitivity = 73%.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">6</span>
            <span className="mu-step__title">Experiments<span className="mu-step__meta">fill the configs</span></span>
            <p className="mu-step__body">
              Populate <code>mamba1_tversky.yaml</code> / <code>mamba2_tversky.yaml</code> and sweep the
              questions the proposal poses: Mamba-1 vs Mamba-2, the Tversky β, hybrid CNN-Mamba vs pure Mamba,
              and larger patch sizes that Mamba&rsquo;s linear scaling makes affordable.
            </p>
          </li>
        </ol>

        <div className="mu-callout mu-callout--accent">
          <span className="mu-callout__label">Immediate next actions</span>
          <p>
            (1)&nbsp;Get the HPC environment installed and the DataLoader running on GPU.
            (2)&nbsp;Implement <code>mamba_block_3d.py</code> and shape-test it.
            (3)&nbsp;Secure labelled data (autoPET-PSMA masks or SCGH + RTSTRUCT→GT) so a real training run can begin.
          </p>
        </div>

        <div className="mu-callout">
          <span className="mu-callout__label">Guiding principle</span>
          <p>
            Keep <strong>baseline parity</strong> everywhere it doesn&rsquo;t matter, and only diverge where
            Mamba&rsquo;s advantage is the whole point (bigger patches / global context). Same recipe — just swap
            the model. That is what makes the head-to-head against nnU-Net honest.
          </p>
        </div>

        <div className="mu-tags">
          <span className="mu-tag">✓ Model design</span>
          <span className="mu-tag">→ Working Mamba model · Jul–Sep</span>
          <span className="mu-tag">Evaluation · Sep–Oct</span>
          <span className="mu-tag">Dissertation</span>
        </div>
      </>
    ),
  },

  /* ────────────────────────────────────────────────────────────────────────
     2 · THE ARCHITECTURE
     ──────────────────────────────────────────────────────────────────────── */
  {
    id: 'mamba-architecture',
    date: '2026-07-05',
    kicker: 'Architecture',
    title: 'The model we’re building: a 3D hybrid CNN–Mamba U-Net',
    body: (
      <>
        <p className="mu-lead">
          A familiar U-Net shell — encoder, decoder, skip connections — but with{' '}
          <strong>Mamba blocks</strong> woven in. The CNN layers extract local detail; the Mamba layers add
          global, whole-body context in <em>linear</em> time. The design follows U-Mamba, SegMamba and
          SegResMamba from the literature review.
        </p>
        <p>
          Input is a 2-channel volume <code>(B, 2, D, H, W)</code> — channel&nbsp;0 CT, channel&nbsp;1 PET —
          and the output is a single-channel binary lesion logit map at full patch resolution.
        </p>

        <div className="mu-flow" aria-label="Network dataflow">
          <span className="mu-flow__node">Input · 2ch</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node">Conv</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node">Conv + Mamba×2</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node">Conv + Mamba×2</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node mu-flow__node--next">Bottleneck · Mamba×4</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node">Upsample + skips</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node">1×1×1 head</span>
        </div>

        <p className="mu-h">The four model files</p>
        <ol className="mu-steps">
          <li className="mu-step">
            <span className="mu-step__n">1</span>
            <span className="mu-step__title">The atom<code>mamba_block_3d.py</code></span>
            <p className="mu-step__body">
              Turns a 3D feature map into a 1D sequence, runs a <strong>multi-directional selective scan</strong>{' '}
              (forward/reverse along each axis, so the model isn&rsquo;t biased by one flattening order — the
              SegMamba &ldquo;tri-orientated&rdquo; idea), then reshapes back to 3D. Built to swap Mamba-1 ↔
              Mamba-2 (SSD) with a config flag.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">2</span>
            <span className="mu-step__title">Encoder<code>encoder.py</code></span>
            <p className="mu-step__body">
              Convolutional residual stages capture local texture; Mamba blocks are added at the deeper, lower-
              resolution stages where long-range context matters and the sequence is short enough to be cheap.
              Downsamples ×2 per stage.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">3</span>
            <span className="mu-step__title">Decoder + head<code>decoder.py</code></span>
            <p className="mu-step__body">
              Transposed-convolution upsampling, <strong>skip connections</strong> concatenated from the matching
              encoder stage to restore fine spatial detail, and a <code>1×1×1</code> convolution producing the
              lesion logit.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">4</span>
            <span className="mu-step__title">Top-level wiring<code>psma_mamba.py</code></span>
            <p className="mu-step__body">
              Assembles encoder → bottleneck → decoder → head into one module. Housekeeping note: the current
              header comment says &ldquo;channel&nbsp;0: PET&rdquo; — that is <strong>wrong</strong>. The config
              sets CT&nbsp;=&nbsp;0, PET&nbsp;=&nbsp;1; fix the comment when the file is implemented.
            </p>
          </li>
        </ol>

        <div className="mu-callout">
          <span className="mu-callout__label">Why Mamba, not a Transformer</span>
          <p>
            Self-attention costs <code>O(L²)</code>. A single <code>128³</code> patch is a sequence of{' '}
            <strong>262,144</strong> tokens — enough to run vanilla attention out of memory on an A100. Mamba&rsquo;s
            selective state-space scan is <code>O(L)</code> and its input-dependent gating lets it ignore vast
            tracts of healthy tissue while keeping the tokens for tiny lesions.
          </p>
        </div>

        <div className="mu-callout mu-callout--accent">
          <span className="mu-callout__label">The loss — the sensitivity lever</span>
          <p>
            Asymmetric <strong>Tversky loss (α = 0.3, β = 0.7)</strong> combined with a light BCE term. The higher
            β penalises <strong>false negatives</strong> — missed metastases — harder than false positives, aimed
            squarely at lifting the baseline&rsquo;s 73% lesion sensitivity without giving up its 88.2% PPV. β is a
            dataset-specific knob and will be tuned empirically on the PSMA data, not assumed.
          </p>
        </div>

        <p className="mu-h">Questions the experiments will settle</p>
        <ul className="mu-list">
          <li><strong>Hybrid vs pure</strong> — CNN-Mamba hybrid against pure Mamba blocks (efficiency vs accuracy).</li>
          <li><strong>Mamba-1 vs Mamba-2</strong> — the SSD variant, swapped via the block&rsquo;s config flag.</li>
          <li><strong>Patch size</strong> — push beyond nnU-Net&rsquo;s 64×128×64; linear scaling makes far more whole-body context affordable, which is the core thesis.</li>
        </ul>
        <div className="mu-tags">
          <span className="mu-tag">ref VRAM · SegMamba-V2 ≈ 13 GB @ 128³</span>
          <span className="mu-tag">SegResMamba 2.2–4.8 GB</span>
        </div>
      </>
    ),
  },

  /* ────────────────────────────────────────────────────────────────────────
     3 · INFERENCE ALIGNMENT — SWAP THE MODEL WITH ONE FLAG
     ──────────────────────────────────────────────────────────────────────── */
  {
    id: 'model-swap-inference',
    date: '2026-07-05',
    kicker: 'Inference · Alignment',
    title: 'One command, either model: aligning inference with PSMASegmentator',
    body: (
      <>
        <p className="mu-lead">
          The end goal is simple to state: at inference time you pick the segmentation model with a{' '}
          <strong>single command-line flag</strong>, and everything else — how scans go in, how masks come
          out — stays identical. This page explains how the reference tool selects its model, and how we mirror
          that so the Mamba model drops in as just another choice.
        </p>

        <p className="mu-h">How the reference tool runs today</p>
        <p>
          <code>PSMASegmentator</code> is a fork of nnU-Net v2 wrapped in a thin CLI. A user runs one command;
          the model itself is fixed by the weights bundle it downloads:
        </p>
        <div className="mu-cmd">{`# reference tool — the network is fixed by the downloaded weights
python -m psma_segmentator.cli -i INPUT_DIR -pat TOKEN
#   input : 2-channel NIfTI  ->  _0000 = CT,  _0001 = PET (SUV)
#   model : checkpoint_final.pth + plans.json   (--fast = lighter variant)
#   output: lesion mask via nnU-Net sliding-window predictor`}</div>

        <div className="mu-callout mu-callout--accent">
          <span className="mu-callout__label">The seam we&rsquo;re copying</span>
          <p>
            nnU-Net doesn&rsquo;t hard-wire its network — it builds it from a <strong>plain text string</strong>.
            The factory <code>get_network_from_plans</code> calls <code>pydoc.locate(network_class_name)</code>,
            so any module accepting <code>input_channels</code> / <code>num_classes</code> plus the plans&rsquo;{' '}
            <code>arch_kwargs</code> is a valid network. The PSMA fork already uses this: its custom
            <code>autoPET3_Trainer</code> simply overrides that string to swap in{' '}
            <code>ResidualEncoderUNetOrgan</code>. In other words, &ldquo;which network&rdquo; is <em>already</em>{' '}
            a swappable, string-selected decision — we plug into the exact same seam.
          </p>
        </div>

        <p className="mu-h">Why alignment is already most of the way there</p>
        <p>
          Our standalone pipeline was built to the same data contract: <code>_0000</code> = CT,{' '}
          <code>_0001</code> = PET, CTNormalization on <em>both</em> channels, resample to a fixed spacing,
          sliding-window inference. Because the input and output are identical, the <strong>only thing that
          changes between models is the network object and its checkpoint</strong> — which is precisely what a
          CLI flag should select.
        </p>

        <p className="mu-h">Two ways to wire the switch</p>
        <div className="mu-grid">
          <div className="mu-cell mu-cell--accent">
            <span className="mu-cell__k">Route A · recommended</span>
            <p>
              A <code>--model</code> flag in our repo. <code>evaluation/inference.py</code> and{' '}
              <code>scripts/run_eval.py</code> take <code>--model {'{'}nnunet | mamba1 | mamba2{'}'}</code>; a
              tiny registry maps each name to a (network builder, checkpoint) pair. Same data in, same mask out.
            </p>
          </div>
          <div className="mu-cell">
            <span className="mu-cell__k">Route B · full drop-in</span>
            <p>
              A Mamba trainer inside a PSMASegmentator-style tree: add <code>MambaUNet</code> to{' '}
              <code>architecture/</code> and a <code>MambaTrainer</code> that hardcodes it (mirroring{' '}
              <code>autoPET3_Trainer</code>), so <code>nnUNetv2_predict -tr MambaTrainer</code> picks it. Heavier,
              but true parity with the reference command surface.
            </p>
          </div>
        </div>

        <p>
          Route A is the near-term target — it keeps this repo self-contained (PyTorch + MONAI, no nnU-Net
          dependency) while giving exactly the one-flag switch we want:
        </p>
        <div className="mu-cmd">{`python scripts/run_eval.py --model mamba1 -i INPUT_DIR -o OUT_DIR
# swap the network only — nothing else changes:
python scripts/run_eval.py --model nnunet -i INPUT_DIR -o OUT_DIR`}</div>

        <div className="mu-callout">
          <span className="mu-callout__label">Keep the contract fixed</span>
          <p>
            Whichever route, the rule is the same: hold the pre/post-processing constant across models — channel
            order, CTNormalization, sliding-window with Gaussian stitching and mirror TTA, and the connected-
            component lesion post-processing (25&nbsp;mm³ filter, 10% overlap). Only then is the head-to-head a
            fair benchmark <em>and</em> a genuine drop-in switch.
          </p>
        </div>
      </>
    ),
  },
];

export default function MambaUpdates() {
  return (
    <div className="pt-module mu">
      <div>
        <p className="mu-kicker">{HEAD.kicker}</p>
        <p className="pt-module__intro">{HEAD.intro}</p>
      </div>

      {UPDATES.length === 0 ? (
        <div className="pt-card mu-empty">
          <span className="mu-empty__icon" aria-hidden="true"><Icon name="mamba" size={30} /></span>
          <p className="mu-empty__label">// AWAITING FIRST UPDATE</p>
          <p className="mu-empty__title">No explainer pages yet</p>
          <p className="mu-empty__hint">
            When you ask the honours-project assistant to explain a part of the build, its write-up will
            appear here as a dated entry.
          </p>
        </div>
      ) : (
        <div className="mu-feed">
          {UPDATES.map((u) => (
            <article className="pt-card mu-entry" key={u.id}>
              <header className="mu-entry__head">
                {u.kicker && <span className="mu-entry__kicker">{u.kicker}</span>}
                {u.date && <time className="mu-entry__date">{u.date}</time>}
              </header>
              <h2 className="mu-entry__title">{u.title}</h2>
              <div className="mu-entry__body">{u.body}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
