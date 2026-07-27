/* ============================================================================
   MODEL & TRAINING — CODE REFERENCES
   ----------------------------------------------------------------------------
   Verbatim excerpts from the Mamba_PSMA repo, used by ModelTraining.jsx to back
   each plain-English claim with the code that actually implements it.

   GENERATED, NOT HAND-WRITTEN. Every entry was sliced straight out of the source
   file at the recorded line range, so `from`/`to` are real line numbers you can
   jump to in the repo. If a source file changes, re-extract rather than editing
   these strings by hand — a stale snippet here is worse than none, because the
   whole point is that the line numbers are trustworthy.

   Shape: { file, from, to, lines[] }  — one array entry per source line, so the
   renderer can print a real line-number gutter.
   ========================================================================== */

export const CODE = {
  "dirs": {
    "file": "models/mamba_block_3d.py",
    "from": 28,
    "to": 39,
    "lines": [
      "# Spatial axes of (B, C, D, H, W) are (D, H, W) == index (0, 1, 2). Each direction is",
      "# (perm, flip): `perm` reorders the spatial axes so the *last* one varies fastest in the",
      "# flattened sequence — i.e. the scan runs primarily along that axis; `flip` reverses it.",
      "# Ordered so n_directions=1 -> +x, 2 -> +/-x (the bidirectional MVP), ... 6 -> all six.",
      "_DIRECTIONS = [",
      "    ((0, 1, 2), False),  # +x : (D, H, W), scan along W",
      "    ((0, 1, 2), True),   # -x",
      "    ((0, 2, 1), False),  # +y : (D, W, H), scan along H",
      "    ((0, 2, 1), True),   # -y",
      "    ((1, 2, 0), False),  # +z : (H, W, D), scan along D",
      "    ((1, 2, 0), True),   # -z",
      "]"
    ]
  },
  "core": {
    "file": "models/mamba_block_3d.py",
    "from": 83,
    "to": 88,
    "lines": [
      "    def _make_core(self):",
      "        if self.version == \"mamba1\":",
      "            return Mamba(d_model=self.dim, d_state=self.d_state,",
      "                         d_conv=self.d_conv, expand=self.expand)",
      "        return Mamba2(d_model=self.dim, d_state=self.d_state, d_conv=self.d_conv,",
      "                      expand=self.expand, headdim=self.headdim)"
    ]
  },
  "flatten": {
    "file": "models/mamba_block_3d.py",
    "from": 93,
    "to": 100,
    "lines": [
      "    @staticmethod",
      "    def _flatten(x, perm, flip):",
      "        \"\"\"(B, C, D, H, W) -> (B, L, C) for a given spatial axis order + direction.\"\"\"",
      "        full = (0, 1, 2 + perm[0], 2 + perm[1], 2 + perm[2])",
      "        seq = x.permute(*full).flatten(2).transpose(1, 2).contiguous()  # (B, L, C)",
      "        if flip:",
      "            seq = seq.flip(1)",
      "        return seq"
    ]
  },
  "unflatten": {
    "file": "models/mamba_block_3d.py",
    "from": 102,
    "to": 113,
    "lines": [
      "    @staticmethod",
      "    def _unflatten(seq, B, C, spatial, perm, flip):",
      "        \"\"\"(B, L, C) -> (B, C, D, H, W), inverting the matching _flatten call.\"\"\"",
      "        if flip:",
      "            seq = seq.flip(1)",
      "        permuted_shape = tuple(spatial[p] for p in perm)                # (s0, s1, s2)",
      "        x = seq.transpose(1, 2).reshape(B, C, *permuted_shape)         # (B, C, s0, s1, s2)",
      "        full = (0, 1, 2 + perm[0], 2 + perm[1], 2 + perm[2])",
      "        inv = [0] * 5",
      "        for i, p in enumerate(full):",
      "            inv[p] = i",
      "        return x.permute(*inv).contiguous()"
    ]
  },
  "blockForward": {
    "file": "models/mamba_block_3d.py",
    "from": 115,
    "to": 133,
    "lines": [
      "    def forward(self, x):",
      "        \"\"\"x: (B, C, D, H, W) with C == dim  ->  same shape.\"\"\"",
      "        if x.shape[1] != self.dim:",
      "            raise ValueError(f\"expected {self.dim} channels, got {x.shape[1]} (shape {tuple(x.shape)})\")",
      "        B, C, D, H, W = x.shape",
      "        spatial = (D, H, W)",
      "        residual = x",
      "",
      "        # channels-last so LayerNorm normalises over C, then back to channels-first.",
      "        xn = self.norm(x.movedim(1, -1)).movedim(-1, 1)",
      "",
      "        out = None",
      "        for mamba, (perm, flip) in zip(self.mambas, self.directions):",
      "            seq = self._flatten(xn, perm, flip)     # (B, L, C)",
      "            y = mamba(seq)                          # selective scan, (B, L, C)",
      "            vol = self._unflatten(y, B, C, spatial, perm, flip)",
      "            out = vol if out is None else out + vol",
      "",
      "        return residual + out"
    ]
  },
  "convBlock": {
    "file": "models/encoder.py",
    "from": 51,
    "to": 69,
    "lines": [
      "    def __init__(self, in_ch, out_ch, stride=1):",
      "        super().__init__()",
      "        self.conv1 = nn.Conv3d(in_ch, out_ch, 3, stride=stride, padding=1, bias=False)",
      "        self.norm1 = nn.InstanceNorm3d(out_ch, affine=True)",
      "        self.conv2 = nn.Conv3d(out_ch, out_ch, 3, stride=1, padding=1, bias=False)",
      "        self.norm2 = nn.InstanceNorm3d(out_ch, affine=True)",
      "        self.act = nn.LeakyReLU(0.01, inplace=True)",
      "",
      "        need_proj = stride != 1 or in_ch != out_ch",
      "        self.proj = (",
      "            nn.Conv3d(in_ch, out_ch, 1, stride=stride, bias=False)",
      "            if need_proj else nn.Identity()",
      "        )",
      "",
      "    def forward(self, x):",
      "        res = self.proj(x)",
      "        h = self.act(self.norm1(self.conv1(x)))",
      "        h = self.norm2(self.conv2(h))",
      "        return self.act(h + res)"
    ]
  },
  "encStage": {
    "file": "models/encoder.py",
    "from": 76,
    "to": 87,
    "lines": [
      "    def __init__(self, in_ch, out_ch, n_mamba=0, stride=1, mamba_cfg=None):",
      "        super().__init__()",
      "        self.conv = ConvBlock3D(in_ch, out_ch, stride=stride)",
      "        self.mambas = nn.ModuleList(",
      "            [MambaBlock3D.from_config(out_ch, mamba_cfg) for _ in range(n_mamba)]",
      "        )",
      "",
      "    def forward(self, x):",
      "        x = self.conv(x)",
      "        for mamba in self.mambas:",
      "            x = mamba(x)",
      "        return x"
    ]
  },
  "encInit": {
    "file": "models/encoder.py",
    "from": 101,
    "to": 116,
    "lines": [
      "    def __init__(self, in_channels=2, features=(32, 64, 128, 256, 320),",
      "                 strides=(1, 2, 2, 2, 2), mamba_blocks=(0, 0, 2, 2, 4), mamba_cfg=None):",
      "        super().__init__()",
      "        if not (len(features) == len(strides) == len(mamba_blocks)):",
      "            raise ValueError(",
      "                f\"features ({len(features)}), strides ({len(strides)}) and \"",
      "                f\"mamba_blocks ({len(mamba_blocks)}) must be the same length\"",
      "            )",
      "        self.features = tuple(features)",
      "        self.strides = tuple(strides)",
      "",
      "        self.stages = nn.ModuleList()",
      "        prev = in_channels",
      "        for f, s, n_mamba in zip(features, strides, mamba_blocks):",
      "            self.stages.append(EncoderStage(prev, f, n_mamba=n_mamba, stride=s, mamba_cfg=mamba_cfg))",
      "            prev = f"
    ]
  },
  "encForward": {
    "file": "models/encoder.py",
    "from": 118,
    "to": 129,
    "lines": [
      "    def forward(self, x):",
      "        \"\"\"x: (B, in_channels, D, H, W) -> list of per-stage features, deepest last.\"\"\"",
      "        if x.shape[1] != self.stages[0].conv.conv1.in_channels:",
      "            raise ValueError(",
      "                f\"expected {self.stages[0].conv.conv1.in_channels} input channels, \"",
      "                f\"got {x.shape[1]} (shape {tuple(x.shape)})\"",
      "            )",
      "        skips = []",
      "        for stage in self.stages:",
      "            x = stage(x)",
      "            skips.append(x)",
      "        return skips"
    ]
  },
  "decInit": {
    "file": "models/decoder.py",
    "from": 33,
    "to": 53,
    "lines": [
      "    def __init__(self, features=(32, 64, 128, 256, 320),",
      "                 strides=(1, 2, 2, 2, 2), num_classes=1):",
      "        super().__init__()",
      "        if len(features) != len(strides):",
      "            raise ValueError(",
      "                f\"features ({len(features)}) and strides ({len(strides)}) must match\"",
      "            )",
      "        self.features = tuple(features)",
      "        # levels to reconstruct, deep -> shallow: n-2, ..., 1, 0",
      "        self.levels = list(reversed(range(len(features) - 1)))",
      "",
      "        self.ups = nn.ModuleList()",
      "        self.convs = nn.ModuleList()",
      "        for i in self.levels:",
      "            deep_ch, skip_ch, up_stride = features[i + 1], features[i], strides[i + 1]",
      "            self.ups.append(",
      "                nn.ConvTranspose3d(deep_ch, skip_ch, kernel_size=up_stride, stride=up_stride)",
      "            )",
      "            self.convs.append(ConvBlock3D(skip_ch * 2, skip_ch))  # concat(skip, upsampled)",
      "",
      "        self.head = nn.Conv3d(features[0], num_classes, kernel_size=1)"
    ]
  },
  "decForward": {
    "file": "models/decoder.py",
    "from": 55,
    "to": 66,
    "lines": [
      "    def forward(self, skips):",
      "        \"\"\"skips: list of per-stage encoder features, deepest last -> (B, num_classes, D, H, W).\"\"\"",
      "        if len(skips) != len(self.features):",
      "            raise ValueError(f\"expected {len(self.features)} skips, got {len(skips)}\")",
      "        x = skips[-1]",
      "        for up, conv, i in zip(self.ups, self.convs, self.levels):",
      "            x = up(x)",
      "            skip = skips[i]",
      "            if x.shape[2:] != skip.shape[2:]:   # guard odd dims / axis-swapping augmentation",
      "                x = F.interpolate(x, size=skip.shape[2:], mode=\"trilinear\", align_corners=False)",
      "            x = conv(torch.cat([x, skip], dim=1))",
      "        return self.head(x)"
    ]
  },
  "netInit": {
    "file": "models/psma_mamba.py",
    "from": 32,
    "to": 46,
    "lines": [
      "class PSMAMamba(nn.Module):",
      "    def __init__(self, in_channels=2, features=(32, 64, 128, 256, 320),",
      "                 strides=(1, 2, 2, 2, 2), mamba_blocks=(0, 0, 2, 2, 4),",
      "                 mamba_cfg=None, num_classes=1):",
      "        super().__init__()",
      "        self.encoder = MambaEncoder(",
      "            in_channels=in_channels, features=features, strides=strides,",
      "            mamba_blocks=mamba_blocks, mamba_cfg=mamba_cfg,",
      "        )",
      "        self.decoder = MambaDecoder(",
      "            features=features, strides=strides, num_classes=num_classes,",
      "        )",
      "",
      "    def forward(self, x):",
      "        return self.decoder(self.encoder(x))"
    ]
  },
  "netConfig": {
    "file": "models/psma_mamba.py",
    "from": 48,
    "to": 59,
    "lines": [
      "    @classmethod",
      "    def from_config(cls, config):",
      "        \"\"\"Build the full network from a parsed baseline.yaml-style config.\"\"\"",
      "        m = config.get(\"model\", {})",
      "        return cls(",
      "            in_channels=len(config[\"preprocessing\"][\"channel_order\"]),",
      "            features=tuple(m.get(\"features\", (32, 64, 128, 256, 320))),",
      "            strides=tuple(m.get(\"strides\", (1, 2, 2, 2, 2))),",
      "            mamba_blocks=tuple(m.get(\"mamba_blocks\", (0, 0, 2, 2, 4))),",
      "            mamba_cfg=m.get(\"mamba\"),",
      "            num_classes=m.get(\"num_classes\", 1),",
      "        )"
    ]
  },
  "lossFlatten": {
    "file": "training/loss.py",
    "from": 22,
    "to": 26,
    "lines": [
      "def _flatten_probs(logits, target):",
      "    \"\"\"sigmoid(logits) and target, each flattened to (B, N) float.\"\"\"",
      "    p = torch.sigmoid(logits).flatten(1)",
      "    g = target.flatten(1).float()",
      "    return p, g"
    ]
  },
  "lossTversky": {
    "file": "training/loss.py",
    "from": 37,
    "to": 50,
    "lines": [
      "class TverskyLoss(nn.Module):",
      "    \"\"\"Generalised Dice; alpha weights FP, beta weights FN (beta>alpha => sensitivity).\"\"\"",
      "",
      "    def __init__(self, alpha=0.3, beta=0.7):",
      "        super().__init__()",
      "        self.alpha, self.beta = alpha, beta",
      "",
      "    def forward(self, logits, target):",
      "        p, g = _flatten_probs(logits, target)",
      "        tp = (p * g).sum(1)",
      "        fp = (p * (1 - g)).sum(1)",
      "        fn = ((1 - p) * g).sum(1)",
      "        tversky = (tp + EPS) / (tp + self.alpha * fp + self.beta * fn + EPS)",
      "        return 1.0 - tversky.mean()"
    ]
  },
  "lossCombined": {
    "file": "training/loss.py",
    "from": 68,
    "to": 79,
    "lines": [
      "class CombinedLoss(nn.Module):",
      "    \"\"\"A region loss (Tversky or Dice) plus a weighted BCE term.\"\"\"",
      "",
      "    def __init__(self, region, bce_weight=0.3):",
      "        super().__init__()",
      "        self.region = region",
      "        self.bce_weight = bce_weight",
      "",
      "    def forward(self, logits, target):",
      "        return self.region(logits, target) + self.bce_weight * F.binary_cross_entropy_with_logits(",
      "            logits, target.float()",
      "        )"
    ]
  },
  "lossBuild": {
    "file": "training/loss.py",
    "from": 82,
    "to": 99,
    "lines": [
      "def build_loss(config):",
      "    \"\"\"Construct the loss named in config['training']['loss'].\"\"\"",
      "    lc = config.get(\"training\", {}).get(\"loss\", {})",
      "    name = lc.get(\"name\", \"tversky_bce\")",
      "    alpha, beta = lc.get(\"alpha\", 0.3), lc.get(\"beta\", 0.7)",
      "    bce_w = lc.get(\"bce_weight\", 0.3)",
      "",
      "    if name == \"dice\":",
      "        return DiceLoss()",
      "    if name == \"tversky\":",
      "        return TverskyLoss(alpha, beta)",
      "    if name == \"focal\":",
      "        return FocalLoss(lc.get(\"focal_alpha\", 0.75), lc.get(\"gamma\", 2.0))",
      "    if name == \"dice_bce\":",
      "        return CombinedLoss(DiceLoss(), bce_w)",
      "    if name == \"tversky_bce\":",
      "        return CombinedLoss(TverskyLoss(alpha, beta), bce_w)",
      "    raise ValueError(f\"unknown loss '{name}'\")"
    ]
  },
  "lossDice": {
    "file": "training/loss.py",
    "from": 102,
    "to": 109,
    "lines": [
      "@torch.no_grad()",
      "def dice_score(logits, target, threshold=0.5):",
      "    \"\"\"Hard Dice for monitoring: mean over the batch.\"\"\"",
      "    p = (torch.sigmoid(logits) > threshold).flatten(1).float()",
      "    g = target.flatten(1).float()",
      "    inter = (p * g).sum(1)",
      "    dice = (2 * inter + EPS) / (p.sum(1) + g.sum(1) + EPS)",
      "    return dice.mean().item()"
    ]
  },
  "sched": {
    "file": "training/scheduler.py",
    "from": 15,
    "to": 27,
    "lines": [
      "def build_scheduler(optimizer, warmup_iters, total_iters, min_lr_ratio=0.0):",
      "    \"\"\"Return a per-iteration LambdaLR: linear warmup then cosine decay.\"\"\"",
      "    warmup_iters = max(int(warmup_iters), 0)",
      "    total_iters = max(int(total_iters), warmup_iters + 1)",
      "",
      "    def lr_lambda(step):",
      "        if step < warmup_iters:",
      "            return (step + 1) / max(warmup_iters, 1)",
      "        progress = (step - warmup_iters) / max(total_iters - warmup_iters, 1)",
      "        cosine = 0.5 * (1 + math.cos(math.pi * min(progress, 1.0)))",
      "        return min_lr_ratio + (1 - min_lr_ratio) * cosine",
      "",
      "    return LambdaLR(optimizer, lr_lambda)"
    ]
  },
  "trainOptim": {
    "file": "training/train.py",
    "from": 37,
    "to": 42,
    "lines": [
      "def build_optimizer(model, tc):",
      "    lr, wd = tc.get(\"lr\", 1e-3), tc.get(\"weight_decay\", 3e-5)",
      "    if tc.get(\"optimizer\", \"adamw\") == \"sgd\":",
      "        return torch.optim.SGD(model.parameters(), lr=lr, momentum=0.99,",
      "                               weight_decay=wd, nesterov=True)",
      "    return torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=wd)"
    ]
  },
  "trainSplit": {
    "file": "training/train.py",
    "from": 57,
    "to": 71,
    "lines": [
      "def make_splits(cases, config, overfit=0):",
      "    \"\"\"Overfit: use the first N foreground cases as both train and val. Else patient-level split.\"\"\"",
      "    if overfit:",
      "        import SimpleITK as sitk",
      "        fg = []",
      "        for c in cases:",
      "            if len(fg) == overfit:",
      "                break",
      "            if (sitk.GetArrayFromImage(sitk.ReadImage(str(c[\"label\"]))) > 0).sum() > 500:",
      "                fg.append(c)",
      "        return {\"train\": fg, \"val\": fg}",
      "    by_id = {c[\"case_id\"]: c for c in cases}",
      "    splits = generate_splits(list(by_id), ratios=tuple(config[\"splits\"][\"ratios\"]),",
      "                             seed=config[\"splits\"][\"seed\"])",
      "    return {k: [by_id[cid] for cid in v if cid in by_id] for k, v in splits.items()}"
    ]
  },
  "trainSetup": {
    "file": "training/train.py",
    "from": 87,
    "to": 103,
    "lines": [
      "def train(config, cases_by_split, device=\"cuda\", max_iters=None, log_every=10):",
      "    tc = config.get(\"training\", {})",
      "    device = torch.device(device)",
      "",
      "    cache_dir = config[\"data\"].get(\"cache_dir\", \"data/preprocessed\")",
      "    train_loader, val_loader = build_dataloaders(cases_by_split, config, cache_dir=cache_dir)",
      "",
      "    model = PSMAMamba.from_config(config).to(device)",
      "    criterion = build_loss(config)",
      "    optimizer = build_optimizer(model, tc)",
      "    amp = tc.get(\"amp\", True) and device.type == \"cuda\"",
      "    scaler = torch.amp.GradScaler(\"cuda\", enabled=amp)",
      "",
      "    iters_per_epoch = tc.get(\"iters_per_epoch\", 250)",
      "    max_epochs = tc.get(\"max_epochs\", 1000)",
      "    total_iters = max_iters or iters_per_epoch * max_epochs",
      "    scheduler = build_scheduler(optimizer, tc.get(\"warmup_iters\", 50), total_iters)"
    ]
  },
  "trainStep": {
    "file": "training/train.py",
    "from": 114,
    "to": 135,
    "lines": [
      "    while it < total_iters:",
      "        for batch in train_loader:",
      "            if it >= total_iters:",
      "                break",
      "            x, y = _batch_to_device(batch, device)",
      "            optimizer.zero_grad(set_to_none=True)",
      "            with torch.amp.autocast(\"cuda\", enabled=amp):",
      "                logits = model(x)",
      "                loss = criterion(logits, y)",
      "            scaler.scale(loss).backward()",
      "            scaler.step(optimizer)",
      "            scaler.update()",
      "            scheduler.step()",
      "",
      "            running_loss.append(loss.item())",
      "            running_dice.append(dice_score(logits, y))",
      "            it += 1",
      "",
      "            if it % log_every == 0:",
      "                print(f\"  iter {it:5d}/{total_iters}  loss {np.mean(running_loss):.4f}  \"",
      "                      f\"train-Dice {np.mean(running_dice):.3f}  lr {scheduler.get_last_lr()[0]:.2e}\")",
      "                running_loss, running_dice = [], []"
    ]
  },
  "trainCkpt": {
    "file": "training/train.py",
    "from": 137,
    "to": 142,
    "lines": [
      "    # final validation + checkpoint",
      "    val_dice = validate(model, val_loader, device, max_batches=len(cases_by_split.get(\"val\", [])) or 1)",
      "    best_dice = val_dice",
      "    torch.save({\"model\": model.state_dict(), \"config\": config, \"val_dice\": val_dice},",
      "               ckpt_dir / \"checkpoint_last.pth\")",
      "    print(f\"final val-Dice {val_dice:.3f}  ->  saved {ckpt_dir/'checkpoint_last.pth'}\")"
    ]
  }
};

export default CODE;
