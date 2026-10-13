"""Gate G1, second half: every machine-readable manifest value matches its source file.

Reads the seminar decks' fact manifest (shared/facts.js, via node) and re-reads the
Mamba_PSMA result files, comparing value and display rounding. Entries whose source
is a PDF, a chapter or a README are listed as "manual" (checked by hand, facts.md).
Run from the portfolio root:  python -I tools/seminar-decks/verify_facts.py [out.json]
"""
import csv
import json
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MP = r'C:\Users\james\Documents\university\cits4010\Mamba_PSMA'
R = os.path.join(MP, 'evaluation', 'results')

facts = json.loads(subprocess.check_output(
    ['node', '--input-type=module', '-e',
     "import { FACTS } from './src/components/portal/modules/seminar-decks/shared/facts.js';"
     "process.stdout.write(JSON.stringify(FACTS));"], cwd=ROOT))

t5 = json.load(open(os.path.join(R, 'run5-test', 'test_summary.json')))
rows = t5['rows']['thr0.5_min10']
cv = json.load(open(os.path.join(R, 'run5-cv', 'cv_summary.json')))
cmp_ = json.load(open(os.path.join(R, 'run4-vs-baseline-deeppsma', 'scored', 'comparison.json')))
pd10 = cmp_['paired_vs_run4']['min10']


def csv_rows(p):
    return list(csv.DictReader(open(p, encoding='utf-8')))


boot = {(r['min_voxels'], r['cohort']): r for r in csv_rows(os.path.join(R, 'run5-test', 'bootstrap', 'results.csv'))}
r6c = {(r['dataset'], r['min_voxels'], r['comparison'].split('.')[0]): r for r in csv_rows(os.path.join(R, 'run6-analysis', 'comparisons.csv'))}
r6d = {(r['min_voxels'], r['model']): r for r in csv_rows(os.path.join(R, 'run6-analysis', 'results_deeppsma.csv'))}
r6a = {(r['min_voxels'], r['model']): r for r in csv_rows(os.path.join(R, 'run6-analysis', 'results_autopet-test.csv'))}
fair = json.load(open(os.path.join(ROOT, 'public', 'seminar-decks', 'data', 'fair-per-case.json')))
percase = [r for r in csv_rows(os.path.join(R, 'run5-test', 'ensemble', 'ensemble5_test_threshold_sweep_per_case.csv'))
           if r['threshold'] == '0.5' and r['min_voxels'] == '10']
case = {r['case_id']: r for r in percase}
A = case['psma_7e25beff54698eb8_2021-06-21']
B = case['psma_37328a98c70706f3_2020-11-06']
pe = rows['pooled']['ensemble']
ap = rows['autoPET']['ensemble']
dp = rows['DeepPSMA']['ensemble']
sp = rows['pooled']['spread']

# key -> (source value, scale applied before display rounding, decimals or None for integers)
S = {
    'r5.f1': (pe['lesion_f1'], 100, 1), 'r5.ppv': (pe['lesion_ppv'], 100, 1), 'r5.sens': (pe['lesion_sensitivity'], 100, 1),
    'r5.dsc': (pe['voxel_dsc_mean'], 100, 1), 'r5.patacc': (pe['patient_accuracy'], 100, 1),
    'r5.tp': (pe['lesion_tp'], 1, None), 'r5.fp': (pe['lesion_fp'], 1, None), 'r5.fn': (pe['lesion_fn'], 1, None),
    'r5.lesions': (pe['lesion_tp'] + pe['lesion_fn'], 1, None),
    'r5.f1_lo': (float(boot[('10', 'pooled')]['f1_ci_lo']), 1, 1), 'r5.f1_hi': (float(boot[('10', 'pooled')]['f1_ci_hi']), 1, 1),
    'r5.nf_f1': (float(boot[('0', 'pooled')]['f1']), 1, 1), 'r5.nf_ppv': (float(boot[('0', 'pooled')]['ppv']), 1, 1),
    'r5.nf_sens': (float(boot[('0', 'pooled')]['sens']), 1, 1),
    'r5.ap_f1': (ap['lesion_f1'], 100, 1), 'r5.ap_ppv': (ap['lesion_ppv'], 100, 1), 'r5.ap_sens': (ap['lesion_sensitivity'], 100, 1),
    'r5.ap_dsc': (ap['voxel_dsc_mean'], 100, 1),
    'r5.dp_f1': (dp['lesion_f1'], 100, 1), 'r5.dp_ppv': (dp['lesion_ppv'], 100, 1), 'r5.dp_sens': (dp['lesion_sensitivity'], 100, 1),
    'r5.dp_dsc': (dp['voxel_dsc_mean'], 100, 1),
    'r5.single_f1': (sp['lesion_f1']['mean'], 100, 1), 'r5.single_sd': (sp['lesion_f1']['std'], 100, 1),
    'r5.ens_f1_gain': (pe['lesion_f1'] - sp['lesion_f1']['mean'], 100, 1), 'r5.ens_ppv_gain': (pe['lesion_ppv'] - sp['lesion_ppv']['mean'], 100, 1),
    'r5.percase_mean': (pe['lesion_f1_per_case_mean'], 100, 1), 'r5.neg_flag': (pe['negative_cases_false_alarm'], 1, None),
    'r5.percase_n': (sum(1 for r in percase if r['f1'] not in ('', 'nan')), 1, None),
    'data.test': (t5['n_test_cases'], 1, None), 'data.test_autopet': (ap['n_cases'], 1, None), 'data.test_deeppsma': (dp['n_cases'], 1, None),
    'data.test_neg': (pe['n_cases_lesion_negative'], 1, None), 'data.test_pos': (pe['voxel_dsc_n'], 1, None),
    'data.pool': (cv['pooled']['n_cases'], 1, None), 'data.pool_deeppsma': (cv['by_cohort']['deeppsma']['n_cases'], 1, None),
    'cv.f1': (cv['pooled']['lesion_f1'], 100, 1), 'cv.ppv': (cv['pooled']['lesion_ppv'], 100, 1), 'cv.sens': (cv['pooled']['lesion_sensitivity'], 100, 1),
    'cv.sd': (cv['spread']['lesion_f1']['std'], 100, 1),
    'fair.n': (cmp_['n_cases'], 1, None),
    'fair.r4_f1': (cmp_['headline']['run4_min10']['f1'], 100, 1), 'fair.psm_f1': (cmp_['headline']['baseline_min10']['f1'], 100, 1),
    'fair.r4_sens': (cmp_['headline']['run4_min10']['sens'], 100, 1), 'fair.psm_sens': (cmp_['headline']['baseline_min10']['sens'], 100, 1),
    'fair.r4_ppv': (cmp_['headline']['run4_min10']['ppv'], 100, 1), 'fair.psm_ppv': (cmp_['headline']['baseline_min10']['ppv'], 100, 1),
    'fair.r4_dsc': (cmp_['headline']['run4_min10']['dsc'], 100, 1), 'fair.psm_dsc': (cmp_['headline']['baseline_min10']['dsc'], 100, 1),
    'fair.df1': (-pd10['pooled_diff']['f1']['point'], 100, 1), 'fair.df1_abs': (-pd10['pooled_diff']['f1']['point'], 100, 1),
    'fair.df1_lo': (-pd10['pooled_diff']['f1']['ci95'][1], 100, 1), 'fair.df1_hi': (-pd10['pooled_diff']['f1']['ci95'][0], 100, 1),
    'fair.dsens': (-pd10['pooled_diff']['sens']['point'], 100, 1), 'fair.dsens_abs': (-pd10['pooled_diff']['sens']['point'], 100, 1),
    'fair.dppv': (-pd10['pooled_diff']['ppv']['point'], 100, 1), 'fair.dppv_abs': (pd10['pooled_diff']['ppv']['point'], 100, 1),
    'fair.ddsc': (-pd10['pooled_diff']['dsc']['point'], 100, 1), 'fair.ddsc_abs': (-pd10['pooled_diff']['dsc']['point'], 100, 1),
    'fair.pc_df1': (-pd10['percase_diff']['f1']['mean'], 100, 1),
    'fair.pc_lo': (-pd10['percase_diff']['f1']['ci95'][1], 100, 1), 'fair.pc_hi': (-pd10['percase_diff']['f1']['ci95'][0], 100, 1),
    'fair.better': (fair['checks']['better'], 1, None), 'fair.worse': (fair['checks']['worse'], 1, None), 'fair.tied': (fair['checks']['tied'], 1, None),
    'fair.lt20_n': (fair['checks']['lt20_n'], 1, None), 'fair.lt20_lower': (fair['checks']['lt20_lower'], 1, None),
    'fair.ge100_n': (fair['checks']['ge100_n'], 1, None), 'fair.ge100_higher': (fair['checks']['ge100_higher'], 1, None),
    'fair.nf_df1': (-cmp_['paired_vs_run4']['min0']['pooled_diff']['f1']['point'], 100, 1),
    'r6.h_small': (float(r6d[('10', 'run4')]['f1']), 1, 1), 'r6.h_large': (float(r6d[('10', 'mamba-big')]['f1']), 1, 1),
    'r6.c_small': (float(r6d[('10', 'cnn-small')]['f1']), 1, 1), 'r6.c_large': (float(r6d[('10', 'cnn-big')]['f1']), 1, 1),
    'r6.hl_sens': (float(r6d[('10', 'mamba-big')]['sens']), 1, 1), 'r6.hl_ppv': (float(r6d[('10', 'mamba-big')]['ppv']), 1, 1),
    'r6.ap_h_small': (float(r6a[('10', 'run4')]['f1']), 1, 1), 'r6.ap_h_large': (float(r6a[('10', 'mamba-big')]['f1']), 1, 1),
    'r6.ap_c_small': (float(r6a[('10', 'cnn-small')]['f1']), 1, 1), 'r6.ap_c_large': (float(r6a[('10', 'cnn-big')]['f1']), 1, 1),
    'r6.h_patch': (float(r6c[('deeppsma', '10', '4a')]['effect']), 1, 2), 'r6.h_patch_abs': (-float(r6c[('deeppsma', '10', '4a')]['effect']), 1, 2),
    'r6.c_patch': (float(r6c[('deeppsma', '10', '4b')]['effect']), 1, 2), 'r6.c_patch_abs': (-float(r6c[('deeppsma', '10', '4b')]['effect']), 1, 2),
    'r6.inter': (float(r6c[('deeppsma', '10', '3')]['effect']), 1, 2), 'r6.inter_abs': (-float(r6c[('deeppsma', '10', '3')]['effect']), 1, 2),
    'r6.inter_lo': (float(r6c[('deeppsma', '10', '3')]['ci_lo']), 1, 2), 'r6.inter_hi': (float(r6c[('deeppsma', '10', '3')]['ci_hi']), 1, 2),
    'r6.ap_inter': (float(r6c[('autopet-test', '10', '3')]['effect']), 1, 2),
    'r6.ap_inter_lo': (float(r6c[('autopet-test', '10', '3')]['ci_lo']), 1, 2), 'r6.ap_inter_hi': (float(r6c[('autopet-test', '10', '3')]['ci_hi']), 1, 2),
    'r6.gap_small_dp': (float(r6c[('deeppsma', '10', '2')]['effect']), 1, 2), 'r6.gap_small_ap': (float(r6c[('autopet-test', '10', '2')]['effect']), 1, 2),
    'r6.gap_large_dp': (float(r6c[('deeppsma', '10', '1')]['effect']), 1, 2),
    'a.gt': (int(A['n_gt']), 1, None), 'a.found': (int(A['tp']), 1, None), 'a.missed': (int(A['fn']), 1, None), 'a.fa': (int(A['fp']), 1, None),
    'a.f1': (float(A['f1']), 100, 1), 'a.sens': (float(A['sensitivity']), 100, 1), 'a.ppv': (float(A['ppv']), 100, 1), 'a.dsc': (float(A['dsc']), 100, 1),
    'a.regions_after': (int(A['n_pred']), 1, None),
    'b.gt': (int(B['n_gt']), 1, None), 'b.found': (int(B['tp']), 1, None), 'b.fa': (int(B['fp']), 1, None),
    'b.f1': (float(B['f1']), 100, 1), 'b.ppv': (float(B['ppv']), 100, 1), 'b.sens': (float(B['sensitivity']), 100, None), 'b.dsc': (float(B['dsc']), 100, 1),
}
# Added 2026-10-14 for the plain deck's backups.
neg = [m['negative_cases_false_alarm'] for m in rows['pooled']['per_model'].values()]
S.update({
    'fair.dppv_lo': (-pd10['pooled_diff']['ppv']['ci95'][1], 100, 1), 'fair.dppv_hi': (-pd10['pooled_diff']['ppv']['ci95'][0], 100, 1),
    'fair.dsens_lo': (-pd10['pooled_diff']['sens']['ci95'][1], 100, 1), 'fair.dsens_hi': (-pd10['pooled_diff']['sens']['ci95'][0], 100, 1),
    'fair.ddsc_lo': (-pd10['percase_diff']['dsc']['ci95'][1], 100, 1), 'fair.ddsc_hi': (-pd10['percase_diff']['dsc']['ci95'][0], 100, 1),
    'r5.neg_fold_min': (min(neg), 1, None), 'r5.neg_fold_max': (max(neg), 1, None),
    **{f'r5.{m}_{e}': (float(boot[('10', 'pooled')][f'{m}_ci_{e}']), 1, 1) for m in ('ppv', 'sens') for e in ('lo', 'hi')},
    **{f'r5.{c}_{m}_{e}': (float(boot[('10', coh)][f'{m}_ci_{e}']), 1, 1)
       for c, coh in (('ap', 'autoPET'), ('dp', 'DeepPSMA')) for m in ('f1', 'ppv', 'sens') for e in ('lo', 'hi')},
})


def shown(display):
    """The numeric part of a display string ('84.3%' -> 84.3, '+3.0' -> 3.0, '1,035' -> 1035)."""
    t = display.replace(',', '').replace('%', '').replace('+', '').split()[0]
    try:
        return float(t)
    except ValueError:
        return None


out = {'checked': [], 'fail': [], 'manual': []}
for k, f in facts.items():
    if k not in S:
        out['manual'].append(k)
        continue
    v, scale, dec = S[k]
    want = round(v * scale, dec) if dec is not None else round(v * scale)
    got = shown(f['display'])
    if got is None or abs(got - want) > 1e-9:
        out['fail'].append(f'{k}: display {f["display"]!r} but source gives {want}')
    else:
        out['checked'].append(k)

print(f"G1 manifest: {len(out['checked'])} entries match their source files, {len(out['fail'])} mismatches, "
      f"{len(out['manual'])} checked by hand (PDF, chapter, README or config arithmetic; see facts.md)")
for m in out['fail']:
    print('  FAIL', m)
if len(sys.argv) > 1:
    json.dump(out, open(sys.argv[1], 'w'), indent=1)
sys.exit(1 if out['fail'] else 0)
