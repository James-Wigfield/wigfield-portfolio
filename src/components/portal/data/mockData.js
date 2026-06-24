/* ============================================================================
   PORTAL — MOCK DATA
   ----------------------------------------------------------------------------
   Seed data shaped to mirror a relational (Supabase/Postgres) schema so the
   transition to a real backend is a drop-in. Each array below is a "table":

     projects   (1) ──< milestones (N) ──< tasks (N)

   Conventions that match Postgres / Supabase:
     • `id`            uuid-style string primary key
     • `*_id`          foreign keys (milestone.project_id → project.id, etc.)
     • `created_at` /
       `updated_at`    ISO-8601 timestamps
     • status / enum   lowercase snake_case string "enums"
     • `order_index`   integer for stable manual ordering

   When Supabase is wired up these tables become rows returned by
   `supabase.from('milestones').select()` — the shapes are intentionally
   identical, so the UI and api layer need no changes.
   ========================================================================== */

// ── Enums (kept here so the UI and a future DB CHECK constraint agree) ──────
export const MILESTONE_STATUS = ['not_started', 'in_progress', 'completed', 'blocked'];
export const TASK_STATUS = ['todo', 'in_progress', 'done'];
export const TASK_PRIORITY = ['low', 'medium', 'high'];

// ── projects ────────────────────────────────────────────────────────────────
export const projects = [
  {
    id: 'proj_honours_2025',
    code: 'CITS4010',
    name: 'Optimising PSMA PET Segmentation using the Mamba Architecture',
    description:
      'A 3D State Space Model approach to whole-body [68Ga]Ga-PSMA-11 PET scan ' +
      'segmentation for automated detection of metastatic prostate cancer lesions.',
    supervisor: 'Dr. Jake Kendrick',
    institution: 'University of Western Australia',
    start_date: '2025-02-24',
    due_date: '2025-10-27',
    status: 'in_progress',
    created_at: '2025-02-24T08:00:00.000Z',
    updated_at: '2025-06-20T10:30:00.000Z',
  },
];

// ── milestones (FK: project_id) ──────────────────────────────────────────────
export const milestones = [
  {
    id: 'ms_lit_review',
    project_id: 'proj_honours_2025',
    title: 'Literature Review & Background',
    description:
      'Survey SSMs (Mamba-1/2), 3D medical image segmentation, and PSMA PET imaging. ' +
      'Establish the gap: O(L²) transformers vs O(L) selective scans on whole-body volumes.',
    due_date: '2025-04-11',
    status: 'completed',
    order_index: 1,
    created_at: '2025-02-24T08:00:00.000Z',
    updated_at: '2025-04-10T16:00:00.000Z',
  },
  {
    id: 'ms_proposal',
    project_id: 'proj_honours_2025',
    title: 'Research Proposal & Ethics',
    description:
      'Formal problem statement, hypothesis, methodology and dataset access plan. ' +
      'Submit proposal and any data-governance / ethics paperwork.',
    due_date: '2025-05-09',
    status: 'completed',
    order_index: 2,
    created_at: '2025-02-24T08:00:00.000Z',
    updated_at: '2025-05-08T11:20:00.000Z',
  },
  {
    id: 'ms_data_pipeline',
    project_id: 'proj_honours_2025',
    title: 'Data Pipeline & Preprocessing',
    description:
      'Ingest whole-body PSMA PET/CT volumes, resample, normalise SUV, patch-extract, ' +
      'and build the train/val/test splits with leakage controls.',
    due_date: '2025-06-27',
    status: 'in_progress',
    order_index: 3,
    created_at: '2025-02-24T08:00:00.000Z',
    updated_at: '2025-06-20T10:30:00.000Z',
  },
  {
    id: 'ms_architecture',
    project_id: 'proj_honours_2025',
    title: 'Hybrid CNN–Mamba Architecture',
    description:
      'Implement the 3D selective-scan encoder (multi-direction flatten) with CNN local ' +
      'feature stages. Validate VRAM scaling vs a transformer baseline.',
    due_date: '2025-08-08',
    status: 'not_started',
    order_index: 4,
    created_at: '2025-02-24T08:00:00.000Z',
    updated_at: '2025-02-24T08:00:00.000Z',
  },
  {
    id: 'ms_experiments',
    project_id: 'proj_honours_2025',
    title: 'Training, Experiments & Evaluation',
    description:
      'Run training sweeps, ablate scan directions and block depth, and evaluate Dice / ' +
      'lesion-level detection against nnU-Net and Swin-UNETR baselines.',
    due_date: '2025-09-19',
    status: 'not_started',
    order_index: 5,
    created_at: '2025-02-24T08:00:00.000Z',
    updated_at: '2025-02-24T08:00:00.000Z',
  },
  {
    id: 'ms_thesis',
    project_id: 'proj_honours_2025',
    title: 'Thesis Write-up & Submission',
    description:
      'Draft, revise and submit the honours dissertation; prepare the final seminar.',
    due_date: '2025-10-27',
    status: 'not_started',
    order_index: 6,
    created_at: '2025-02-24T08:00:00.000Z',
    updated_at: '2025-02-24T08:00:00.000Z',
  },
];

// ── tasks (FK: milestone_id) ──────────────────────────────────────────────────
export const tasks = [
  // Literature Review
  { id: 'task_001', milestone_id: 'ms_lit_review', title: 'Read Gu & Dao 2023 (Mamba) + Mamba-2 SSD paper', status: 'done', priority: 'high', due_date: '2025-03-07', created_at: '2025-02-24T08:00:00.000Z', updated_at: '2025-03-05T09:00:00.000Z' },
  { id: 'task_002', milestone_id: 'ms_lit_review', title: 'Survey 3D segmentation backbones (nnU-Net, Swin-UNETR, U-Mamba)', status: 'done', priority: 'high', due_date: '2025-03-21', created_at: '2025-02-24T08:00:00.000Z', updated_at: '2025-03-20T14:00:00.000Z' },
  { id: 'task_003', milestone_id: 'ms_lit_review', title: 'Summarise PSMA PET imaging & SUV normalisation literature', status: 'done', priority: 'medium', due_date: '2025-04-04', created_at: '2025-02-24T08:00:00.000Z', updated_at: '2025-04-02T13:30:00.000Z' },
  { id: 'task_004', milestone_id: 'ms_lit_review', title: 'Write the related-work chapter draft', status: 'done', priority: 'medium', due_date: '2025-04-11', created_at: '2025-02-24T08:00:00.000Z', updated_at: '2025-04-10T16:00:00.000Z' },

  // Proposal
  { id: 'task_005', milestone_id: 'ms_proposal', title: 'Formalise problem statement & hypothesis', status: 'done', priority: 'high', due_date: '2025-04-25', created_at: '2025-02-24T08:00:00.000Z', updated_at: '2025-04-24T10:00:00.000Z' },
  { id: 'task_006', milestone_id: 'ms_proposal', title: 'Secure dataset access / data-governance approval', status: 'done', priority: 'high', due_date: '2025-05-02', created_at: '2025-02-24T08:00:00.000Z', updated_at: '2025-05-01T12:00:00.000Z' },
  { id: 'task_007', milestone_id: 'ms_proposal', title: 'Submit proposal document', status: 'done', priority: 'high', due_date: '2025-05-09', created_at: '2025-02-24T08:00:00.000Z', updated_at: '2025-05-08T11:20:00.000Z' },

  // Data Pipeline (active milestone)
  { id: 'task_008', milestone_id: 'ms_data_pipeline', title: 'Write DICOM → NIfTI conversion + de-identification step', status: 'done', priority: 'high', due_date: '2025-06-06', created_at: '2025-05-12T08:00:00.000Z', updated_at: '2025-06-05T15:00:00.000Z' },
  { id: 'task_009', milestone_id: 'ms_data_pipeline', title: 'Implement resampling to isotropic spacing + SUV normalisation', status: 'in_progress', priority: 'high', due_date: '2025-06-20', created_at: '2025-05-12T08:00:00.000Z', updated_at: '2025-06-20T10:30:00.000Z' },
  { id: 'task_010', milestone_id: 'ms_data_pipeline', title: 'Build patch-extraction with foreground/background sampling', status: 'todo', priority: 'high', due_date: '2025-06-24', created_at: '2025-05-12T08:00:00.000Z', updated_at: '2025-05-12T08:00:00.000Z' },
  { id: 'task_011', milestone_id: 'ms_data_pipeline', title: 'Define patient-level train/val/test splits (no leakage)', status: 'todo', priority: 'medium', due_date: '2025-06-27', created_at: '2025-05-12T08:00:00.000Z', updated_at: '2025-05-12T08:00:00.000Z' },

  // Architecture
  { id: 'task_012', milestone_id: 'ms_architecture', title: 'Implement multi-direction 3D scan (flatten/unflatten)', status: 'todo', priority: 'high', due_date: '2025-07-11', created_at: '2025-05-12T08:00:00.000Z', updated_at: '2025-05-12T08:00:00.000Z' },
  { id: 'task_013', milestone_id: 'ms_architecture', title: 'Wire CNN stem + Mamba encoder stages', status: 'todo', priority: 'high', due_date: '2025-07-25', created_at: '2025-05-12T08:00:00.000Z', updated_at: '2025-05-12T08:00:00.000Z' },
  { id: 'task_014', milestone_id: 'ms_architecture', title: 'Benchmark VRAM vs Swin-UNETR at matched patch size', status: 'todo', priority: 'medium', due_date: '2025-08-08', created_at: '2025-05-12T08:00:00.000Z', updated_at: '2025-05-12T08:00:00.000Z' },

  // Experiments
  { id: 'task_015', milestone_id: 'ms_experiments', title: 'Run baseline training sweep + log to W&B', status: 'todo', priority: 'high', due_date: '2025-08-29', created_at: '2025-05-12T08:00:00.000Z', updated_at: '2025-05-12T08:00:00.000Z' },
  { id: 'task_016', milestone_id: 'ms_experiments', title: 'Ablate scan directions & block depth', status: 'todo', priority: 'medium', due_date: '2025-09-12', created_at: '2025-05-12T08:00:00.000Z', updated_at: '2025-05-12T08:00:00.000Z' },
  { id: 'task_017', milestone_id: 'ms_experiments', title: 'Lesion-level detection metrics vs baselines', status: 'todo', priority: 'high', due_date: '2025-09-19', created_at: '2025-05-12T08:00:00.000Z', updated_at: '2025-05-12T08:00:00.000Z' },

  // Thesis
  { id: 'task_018', milestone_id: 'ms_thesis', title: 'Draft methodology + results chapters', status: 'todo', priority: 'high', due_date: '2025-10-10', created_at: '2025-05-12T08:00:00.000Z', updated_at: '2025-05-12T08:00:00.000Z' },
  { id: 'task_019', milestone_id: 'ms_thesis', title: 'Supervisor review & revisions', status: 'todo', priority: 'medium', due_date: '2025-10-20', created_at: '2025-05-12T08:00:00.000Z', updated_at: '2025-05-12T08:00:00.000Z' },
  { id: 'task_020', milestone_id: 'ms_thesis', title: 'Submit dissertation + prepare final seminar', status: 'todo', priority: 'high', due_date: '2025-10-27', created_at: '2025-05-12T08:00:00.000Z', updated_at: '2025-05-12T08:00:00.000Z' },
];

// Default project id the tracker opens to (single-project mock).
export const DEFAULT_PROJECT_ID = 'proj_honours_2025';
