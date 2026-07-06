Device: NVIDIA GeForce RTX 5070 Ti  |  torch 2.11.0+cu128

[1] Flatten/un-flatten reversibility (all 6 directions)
  [ OK ]  all 6 directions round-trip exactly

[2] Forward + backward on CUDA (shape preserved, gradients flow)
  [ OK ]  mamba1 · bidirectional (2 dir)  in=(1, 64, 16, 32, 16) L=  8192  params= 0.07M  fwd+bwd= 657.0ms  peakVRAM=  96.1MB
  [ OK ]  mamba1 · 6-direction            in=(1, 64, 16, 32, 16) L=  8192  params= 0.20M  fwd+bwd=  13.2ms  peakVRAM= 164.0MB
  [ OK ]  mamba2 · 6-direction (SSD)      in=(2, 128, 8, 16, 8) L=  1024  params= 0.81M  fwd+bwd=10815.0ms  peakVRAM= 368.1MB

ALL CHECKS PASSED - MambaBlock3D ready for step 3 (encoder assembly).