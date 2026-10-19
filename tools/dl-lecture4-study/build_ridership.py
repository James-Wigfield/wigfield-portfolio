"""
DL LECTURE 4 STUDY - CTA ridership data builder
-------------------------------------------------------------------------------
Turns the Chicago Transit Authority daily ridership CSV (Geron, Hands-On ML
3rd ed., ch.15 - the dataset used on CITS5017 Lecture 4's slides) into the
study page's data file, after proving the slides' own printed numbers come
out of it.

  python -I tools/dl-lecture4-study/build_ridership.py <csv> <out.js> [sha256] [extracted]

    <csv>       the extracted CTA_-_Ridership_-_Daily_Boarding_Totals.csv
    <out.js>    the ES-module data file to write
    [sha256]    sha256 of ridership.tgz (embedded in the header; also checked
                against <csv>/../../ridership.tgz when that file exists)
    [extracted] YYYY-MM-DD the archive was extracted (default: today)

Gates (printed; any mismatch -> exit 1 and nothing is written):
  - slide 15 df.head() and slide 30 mulvar_train.head() rows
  - slide 18: 7-day naive forecast MAE / MAPE over 2019-03..2019-05
  - slides 19-21, 35-36: window / batch counts, mimicking
    tf.keras.utils.timeseries_dataset_from_array (real TF used too if present)
  - contiguity of the exported date range (else an explicit dates array)
"""
import hashlib
import sys
import datetime as dt
from pathlib import Path

import numpy as np
import pandas as pd

EXPORT_START, EXPORT_END = "2016-01-01", "2019-05-31"
EXPECT_MAE = {"bus": "43915.608696", "rail": "42143.271739"}     # slide 18
EXPECT_MAPE = {"bus": "0.082938", "rail": "0.089948"}            # slide 18
EXPECT_AHEAD_TRAIN_BATCHES = 33                                  # slide 36
PER_LINE = 20

failures = []


def gate(ok, label, got, want=None):
    tag = "PASS" if ok else "FAIL"
    tail = f"  (want {want})" if want is not None and not ok else ""
    print(f"  [{tag}] {label}: {got}{tail}")
    if not ok:
        failures.append(label)


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


# --- slide 15, as written on the slide (only `path` comes from the CLI) -------
def load_slide15(path):
    df = pd.read_csv(path, parse_dates=["service_date"])
    df.columns = ["date", "day_type", "bus", "rail", "total"]  # shorter names
    df = df.sort_values("date").set_index("date")
    df = df.drop("total", axis=1)  # no need for total, it's just bus + rail
    df = df.drop_duplicates()  # remove duplicated months (2011-10 and 2014-07)
    return df


# --- tf.keras.utils.timeseries_dataset_from_array, index logic only -----------
def timeseries_windows(data, targets, sequence_length, batch_size,
                       sequence_stride=1, sampling_rate=1):
    """Same start positions / batching as Keras (shuffle only permutes them)."""
    data = np.asarray(data)
    num_seqs = len(data) - (sequence_length - 1) * sampling_rate
    if targets is not None:
        num_seqs = min(num_seqs, len(targets))
    starts = np.arange(0, max(num_seqs, 0), sequence_stride)
    span = sequence_length * sampling_rate
    X = np.stack([data[s:s + span:sampling_rate] for s in starts]) if len(starts) else np.empty((0,))
    Y = np.asarray(targets)[starts] if targets is not None else None
    batches = [(X[i:i + batch_size], None if Y is None else Y[i:i + batch_size])
               for i in range(0, len(X), batch_size)]
    return X, Y, batches


def split_inputs_and_targets(mulvar_series, ahead=14, target_col=1):  # slide 35
    return mulvar_series[:, :-ahead], mulvar_series[:, -ahead:, target_col]


def tf_counts(series_list):
    """Cross-check with the real Keras function when TensorFlow is importable."""
    try:
        import tensorflow as tf  # noqa: F401
    except Exception as e:  # pragma: no cover - TF absent on this machine
        print(f"  [info] tensorflow not importable ({type(e).__name__}); numpy mimic only")
        return None
    out = []
    for data, targets, L in series_list:
        ds = tf.keras.utils.timeseries_dataset_from_array(
            data, targets=targets, sequence_length=L, batch_size=32)
        nb = int(ds.cardinality().numpy())
        nw = 0
        for b in ds:
            nw += int((b[0] if isinstance(b, tuple) else b).shape[0])
        out.append((nw, nb))
    return out


def js_int_rows(values, indent="    "):
    rows = []
    for i in range(0, len(values), PER_LINE):
        rows.append(indent + ", ".join(str(int(v)) for v in values[i:i + PER_LINE]) + ",")
    return "\n".join(rows)


def js_day_type_rows(codes, index, per_line=70, indent="    "):
    """String concatenation, 70 chars (10 weeks) a line, each tagged with its first date."""
    rows = []
    for i in range(0, len(codes), per_line):
        joiner = " +" if i + per_line < len(codes) else ""
        rows.append(f"{indent}'{codes[i:i + per_line]}'{joiner}  // {index[i].date().isoformat()}")
    return "\n".join(rows)


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 2
    csv_path, out_path = Path(argv[1]), Path(argv[2])
    tgz_sha = argv[3] if len(argv) > 3 and argv[3] else None
    extracted = argv[4] if len(argv) > 4 else dt.date.today().isoformat()

    print(f"pandas {pd.__version__} | numpy {np.__version__}")
    csv_sha = sha256_of(csv_path)
    print(f"csv    {csv_path.name}  sha256 {csv_sha}")
    if tgz_sha:
        tgz = csv_path.resolve().parent.parent / "ridership.tgz"
        if tgz.exists():
            got = sha256_of(tgz)
            gate(got == tgz_sha.lower(), "ridership.tgz sha256 matches the given hash", got, tgz_sha)
        else:
            print("  [info] ridership.tgz not beside the extract; sha256 embedded unchecked")

    df = load_slide15(csv_path)
    print(f"\ndf (slide 15): {len(df)} rows, {df.index.min().date()} .. {df.index.max().date()}, "
          f"columns {list(df.columns)}, duplicate dates left: {int(df.index.duplicated().sum())}")

    print("\nslide 15  df.head()")
    print(df.head().to_string())
    head_want = [("2001-01-01", "U", 297192, 126455), ("2001-01-02", "W", 780827, 501952),
                 ("2001-01-03", "W", 824923, 536432), ("2001-01-04", "W", 870021, 550011),
                 ("2001-01-05", "W", 890426, 557917)]
    head_got = [(d.strftime("%Y-%m-%d"), r.day_type, int(r.bus), int(r.rail))
                for d, r in df.head().iterrows()]
    gate(head_got == head_want, "df.head() matches slide 15", "ok" if head_got == head_want else head_got)

    # --- slide 18: 7-day naive forecast ---------------------------------------
    print("\nslide 17/18  diff_7 = df[['bus', 'rail']].diff(7)['2019-03':'2019-05']")
    diff_7 = df[["bus", "rail"]].diff(7)["2019-03":"2019-05"]
    mae = diff_7.abs().mean()
    print(">>> diff_7.abs().mean()")
    print(mae.to_string())
    targets = df[["bus", "rail"]]["2019-03":"2019-05"]
    mape = (diff_7 / targets).abs().mean()
    print(">>> (diff_7 / targets).abs().mean()")
    print(mape.to_string())
    print(f"  diff_7 rows: {len(diff_7)} ({diff_7.index.min().date()} .. {diff_7.index.max().date()})")
    for col in ("bus", "rail"):
        gate(f"{mae[col]:.6f}" == EXPECT_MAE[col], f"MAE {col}", f"{mae[col]:.6f}", EXPECT_MAE[col])
        gate(f"{mape[col]:.6f}" == EXPECT_MAPE[col], f"MAPE {col}", f"{mape[col]:.6f}", EXPECT_MAPE[col])

    # --- slide 19 toy example (validates the windowing mimic) -----------------
    print("\nslide 19  toy timeseries_dataset_from_array")
    my_series = [0, 1, 2, 3, 4, 5]
    _, _, toy = timeseries_windows(my_series, my_series[3:], 3, 2)
    toy_got = [(b[0].tolist(), b[1].tolist()) for b in toy]
    toy_want = [([[0, 1, 2], [1, 2, 3]], [3, 4]), ([[2, 3, 4]], [5])]
    gate(toy_got == toy_want, "toy windows match slide 19", toy_got)

    # --- slides 20-21: univariate rail windows ---------------------------------
    print("\nslides 20-21  rail_train / rail_valid, seq_length = 56, batch_size = 32")
    rail_train = df["rail"]["2016-01":"2018-12"] / 1e6
    rail_valid = df["rail"]["2019-01":"2019-05"] / 1e6
    seq_length = 56
    Xt, Yt, bt = timeseries_windows(rail_train.to_numpy(), rail_train[seq_length:], seq_length, 32)
    Xv, Yv, bv = timeseries_windows(rail_valid.to_numpy(), rail_valid[seq_length:], seq_length, 32)
    print(f"  rows: train {len(rail_train)}, valid {len(rail_valid)}")
    print(f"  train_ds: {len(Xt)} windows -> {len(bt)} batches (last batch {len(bt[-1][0])})")
    print(f"  valid_ds: {len(Xv)} windows -> {len(bv)} batches (last batch {len(bv[-1][0])})")
    shapes = [(b[0].shape, b[1].shape) for b in bt[:2]]
    gate(shapes == [((32, 56), (32,))] * 2, "train_ds first 2 minibatch shapes (slide 21)", shapes)
    gate(len(Xt) == len(rail_train) - seq_length, "train windows = rows - 56", len(Xt))
    gate(np.allclose(Yt, rail_train.to_numpy()[seq_length:]), "train target i = rail[i + 56]", "ok")
    rail_train_max = float(rail_train.max())
    rail_train_max_date = rail_train.idxmax().date().isoformat()
    rail_train_above1 = int((rail_train > 1.0).sum())
    print(f"  rail_train max: {rail_train_max:.6f} (millions) on {rail_train_max_date}; "
          f"{rail_train_above1} training days above 1.0 (tanh's ceiling); "
          f"min {rail_train.min():.6f}; full-series rail max {df['rail'].max() / 1e6:.6f} "
          f"on {df['rail'].idxmax().date()}")

    # --- slide 30: df_mulvar ---------------------------------------------------
    print("\nslide 30  df_mulvar")
    df_mulvar = df[["bus", "rail"]] / 1e6  # use both bus and rail series
    df_mulvar["next_day_type"] = df["day_type"].shift(-1)  # and tomorrow's type
    df_mulvar = pd.get_dummies(df_mulvar)  # one-hot encode the day type
    mulvar_train = df_mulvar["2016-01":"2018-12"]
    mulvar_valid = df_mulvar["2019-01":"2019-05"]
    mulvar_cols = list(df_mulvar.columns)
    print(f"  columns: {mulvar_cols}  dtypes: {dict(df_mulvar.dtypes.astype(str))}")
    print(mulvar_train.head().to_string())
    gate(mulvar_cols == ["bus", "rail", "next_day_type_A", "next_day_type_U", "next_day_type_W"],
         "df_mulvar column order", mulvar_cols)
    r0 = mulvar_train.iloc[0]
    head_ok = (f"{r0.bus:.6f}", f"{r0.rail:.6f}") == ("0.303321", "0.319835") and \
        [int(r0[c]) for c in mulvar_cols[2:]] == [1, 0, 0]
    gate(head_ok, "mulvar_train 2016-01-01 row matches slide 30",
         f"{r0.bus:.6f} {r0.rail:.6f} {[int(r0[c]) for c in mulvar_cols[2:]]}")

    # --- slides 35-36: 14-steps-ahead windows (targets=None) -------------------
    print("\nslides 35-36  ahead_train_ds / ahead_valid_ds, sequence_length = 70, targets=None")
    mt = mulvar_train.to_numpy(dtype=np.float32)
    mv = mulvar_valid.to_numpy(dtype=np.float32)
    At, _, abt = timeseries_windows(mt, None, seq_length + 14, 32)
    Av, _, abv = timeseries_windows(mv, None, seq_length + 14, 32)
    x0, y0 = split_inputs_and_targets(abt[0][0])
    print(f"  ahead_train_ds: {len(At)} windows -> {len(abt)} batches; first (x, y) {x0.shape} {y0.shape}")
    print(f"  ahead_valid_ds: {len(Av)} windows -> {len(abv)} batches")
    gate(len(abt) == EXPECT_AHEAD_TRAIN_BATCHES, "Number of batches in ahead_train_ds (slide 36)",
         len(abt), EXPECT_AHEAD_TRAIN_BATCHES)
    gate((x0.shape, y0.shape) == ((32, 56, 5), (32, 14)), "ahead minibatch shapes (slide 36)",
         (x0.shape, y0.shape))

    tfc = tf_counts([(rail_train.to_numpy(), rail_train[seq_length:], seq_length),
                     (rail_valid.to_numpy(), rail_valid[seq_length:], seq_length),
                     (mt, None, seq_length + 14), (mv, None, seq_length + 14)])
    if tfc is not None:
        mine = [(len(Xt), len(bt)), (len(Xv), len(bv)), (len(At), len(abt)), (len(Av), len(abv))]
        gate(tfc == mine, "real Keras counts match the mimic", tfc, mine)

    # --- export range ----------------------------------------------------------
    print(f"\nexport {EXPORT_START} .. {EXPORT_END}")
    exp = df[EXPORT_START:EXPORT_END]
    full = pd.date_range(EXPORT_START, EXPORT_END, freq="D")
    contiguous = len(exp) == len(full) and bool((exp.index == full).all())
    print(f"  rows {len(exp)} (calendar days {len(full)}); contiguous: {contiguous}")
    if not contiguous:
        missing = full.difference(exp.index)
        print(f"  missing dates: {[d.date().isoformat() for d in missing[:20]]}")
    gate(exp[["bus", "rail"]].notna().all().all(), "no missing bus/rail values in export", "ok")
    codes = sorted(exp["day_type"].unique())
    gate(set(codes) <= {"W", "A", "U"}, "day_type codes", codes)
    after = df.loc[df.index > pd.Timestamp(EXPORT_END)]
    day_type_after_end = after["day_type"].iloc[0] if len(after) else None
    after_date = after.index[0].date().isoformat() if len(after) else None

    if failures:
        print(f"\nFAILED gates: {failures}\nnothing written.")
        return 1

    bus = exp["bus"].astype("int64").tolist()
    rail = exp["rail"].astype("int64").tolist()
    day_type = "".join(exp["day_type"].tolist())

    lines = [
        "// CTA daily ridership (bus, rail), trimmed to 2016-01-01..2019-05-31.",
        "// Source: https://github.com/ageron/data/raw/main/ridership.tgz",
        f"// sha256 {tgz_sha or '(not given)'} · extracted {extracted} · "
        "generated by tools/dl-lecture4-study/build_ridership.py",
        f"// CSV {csv_path.name} sha256 {csv_sha}",
        "// Processing: slide 15's pandas steps as written (read_csv parse_dates=[\"service_date\"];",
        "//   columns -> date, day_type, bus, rail, total; sort_values(\"date\").set_index(\"date\");",
        "//   drop(\"total\", axis=1); drop_duplicates()), then sliced to the range above.",
        "//   Raw integer boardings, no scaling (the slides divide by 1e6).",
        "// Do not edit by hand: re-run the script (and node tools/dl-lecture4-study/check-ridership.mjs).",
        "",
        "export const RIDERSHIP = {",
        f"  start: '{EXPORT_START}',  // first date; one entry per consecutive day"
        if contiguous else f"  start: '{EXPORT_START}',  // NOT contiguous: see dates",
    ]
    if not contiguous:
        ds = [d.date().isoformat() for d in exp.index]
        lines.append("  dates: [")
        for i in range(0, len(ds), 10):
            lines.append("    " + ", ".join(f"'{d}'" for d in ds[i:i + 10]) + ",")
        lines.append("  ],")
    lines += [
        f"  end: '{EXPORT_END}',",
        f"  length: {len(exp)},",
        "  // one char per day, the CSV's own day_type codes: W = weekday, A = Saturday, U = Sunday/holiday",
        "  dayType: (",
        js_day_type_rows(day_type, exp.index),
        "  ),",
        f"  // day_type of the day after `end` ({after_date}): df_mulvar's next_day_type for the last row (slide 30)",
        f"  dayTypeAfterEnd: {repr(day_type_after_end) if day_type_after_end else 'null'},",
        "  bus: [",
        js_int_rows(bus),
        "  ],",
        "  rail: [",
        js_int_rows(rail),
        "  ],",
        "}",
        "",
        "// Numbers the script reproduced from the slides (cross-check for the page and tests).",
        "export const GATES = {",
        "  naive7: {  // slide 18: diff_7 = df[['bus','rail']].diff(7)['2019-03':'2019-05']",
        f"    from: '2019-03-01', to: '2019-05-31', days: {len(diff_7)},",
        f"    mae: {{ bus: {mae['bus']:.6f}, rail: {mae['rail']:.6f} }},",
        f"    mape: {{ bus: {mape['bus']:.6f}, rail: {mape['rail']:.6f} }},",
        "  },",
        f"  rows: {{ train: {len(rail_train)}, valid: {len(rail_valid)} }},  // 2016-01..2018-12, 2019-01..2019-05",
        "  univar: {  // slides 20-21: seq_length 56, targets = series[56:], batch 32",
        f"    seqLength: {seq_length}, batchSize: 32,",
        f"    train: {{ windows: {len(Xt)}, batches: {len(bt)} }},",
        f"    valid: {{ windows: {len(Xv)}, batches: {len(bv)} }},",
        "  },",
        "  ahead: {  // slides 35-36: sequence_length 56 + 14, targets=None, batch 32",
        f"    windowLength: {seq_length + 14}, batchSize: 32,",
        f"    train: {{ windows: {len(At)}, batches: {len(abt)} }},",
        f"    valid: {{ windows: {len(Av)}, batches: {len(abv)} }},",
        "  },",
        f"  mulvarColumns: [{', '.join(repr(c) for c in mulvar_cols)}],  // slide 30 pd.get_dummies order",
        "  // slide 26 says the series runs 'from 0 to about 1.4'; the real training max is lower,",
        "  // but one training day (2016-11-04, also the all-time rail max) exceeds tanh's +1 ceiling",
        f"  railTrainMax: {{ millions: {rail_train_max:.6f}, date: '{rail_train_max_date}', "
        f"daysAbove1: {rail_train_above1} }},",
        "}",
        "",
    ]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"\nwrote {out_path} ({out_path.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
