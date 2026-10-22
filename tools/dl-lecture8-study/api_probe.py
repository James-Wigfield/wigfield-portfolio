"""
DL LECTURE 8 STUDY - Keras API probe (read-only; trains nothing)
-------------------------------------------------------------------------------
  python -I tools/dl-lecture8-study/api_probe.py [--out <json>]

Prints, from the installed Keras, the documentation the Lecture 8 page quotes:
  - keras.layers.Attention.__doc__ and Attention.call's signature / docstring
  - keras.layers.AdditiveAttention.__doc__ and its call's signature / docstring
  - whether tf.keras.layers.InputLayer(input_shape=[None, 2]) (slide 9, verbatim)
    is accepted, with any warning, versus InputLayer(shape=[None, 2])
  - a numeric check of which tensor Attention uses as the key when only
    [query, value] is given (key = value), and that [query, value, key] uses key
    for the scores and value for the weighted sum
"""
import argparse
import inspect
import json
import os
import warnings

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402
import keras  # noqa: E402


def doc_of(obj):
    return inspect.getdoc(obj) or ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    out = dict(tf=tf.__version__, keras=keras.__version__)

    for name in ("Attention", "AdditiveAttention"):
        cls = getattr(keras.layers, name)
        out[name] = dict(
            module=cls.__module__,
            classDoc=doc_of(cls),
            initSignature=str(inspect.signature(cls.__init__)),
            callSignature=str(inspect.signature(cls.call)),
            callDoc=doc_of(cls.call),
        )
        print("=" * 78)
        print(f"keras.layers.{name}  ({cls.__module__})")
        print("-" * 78)
        print(out[name]["classDoc"])
        print("-" * 78)
        print(f"call{out[name]['callSignature']}")
        print(out[name]["callDoc"] or "(call has no docstring of its own)")

    # tf.keras is keras 3 here?
    out["tfKerasIsKeras"] = tf.keras.layers.Attention is keras.layers.Attention
    print("=" * 78)
    print("tf.keras.layers.Attention is keras.layers.Attention:", out["tfKerasIsKeras"])

    # numeric behaviour: two inputs -> key = value
    rng = np.random.default_rng(0)
    q = rng.standard_normal((1, 3, 4)).astype("float32")
    v = rng.standard_normal((1, 5, 4)).astype("float32")
    k = rng.standard_normal((1, 5, 4)).astype("float32")
    att = keras.layers.Attention()
    two = att([q, v], return_attention_scores=True)
    three = att([q, v, k], return_attention_scores=True)

    def ref(qq, kk, vv):
        s = qq @ np.swapaxes(kk, -1, -2)
        w = np.exp(s - s.max(-1, keepdims=True))
        w /= w.sum(-1, keepdims=True)
        return w @ vv, w

    o2, w2 = ref(q, v, v)
    o3, w3 = ref(q, k, v)
    out["numeric"] = dict(
        twoInputsKeyIsValue=bool(np.allclose(two[1], w2, atol=1e-5) and np.allclose(two[0], o2, atol=1e-5)),
        threeInputsOrderQueryValueKey=bool(np.allclose(three[1], w3, atol=1e-5) and np.allclose(three[0], o3, atol=1e-5)),
    )
    print("numeric: [query, value] -> scores = q.v^T, output = w.v:", out["numeric"]["twoInputsKeyIsValue"])
    print("numeric: [query, value, key] -> scores = q.k^T, output = w.v:", out["numeric"]["threeInputsOrderQueryValueKey"])

    # slide 9's InputLayer(input_shape=[None, 2])
    res = {}
    for label, kwargs in (("input_shape", dict(input_shape=[None, 2])), ("shape", dict(shape=[None, 2]))):
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            try:
                layer = tf.keras.layers.InputLayer(**kwargs)
                m = tf.keras.Sequential([layer, tf.keras.layers.Dense(2)])
                ok, err = True, None
                shape = [None if d is None else int(d) for d in m.inputs[0].shape]
            except Exception as e:  # noqa: BLE001
                ok, err, shape = False, f"{type(e).__name__}: {e}", None
        res[label] = dict(ok=ok, error=err, inputShape=shape,
                          warnings=[f"{w.category.__name__}: {w.message}" for w in caught])
        print(f"InputLayer({label}=[None, 2]): ok={ok} shape={shape} err={err}")
        for w in res[label]["warnings"]:
            print("    warning:", w)
    out["inputLayer"] = res

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=1)
        print("wrote", args.out)


if __name__ == "__main__":
    main()
