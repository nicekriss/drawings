"""Regression tests for the ABC 악보 스튜디오 nodes.

The nodes must stay dependency free at import time: they only move text around,
so a user without any audio library still gets them. The score reader is checked
against a real two-voice ABC tune because its numbers drive what the YuE2
Generate Song node is told about the melody.
"""

import importlib.util
import os
import sys


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load():
    path = os.path.join(ROOT, "abc_studio_node", "abc_studio.py")
    spec = importlib.util.spec_from_file_location("toobusy.abc_studio_node.abc_studio", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


_BEFORE_LOAD = set(sys.modules)
_mod = _load()
_PULLED_IN = set(sys.modules) - _BEFORE_LOAD

SCORE = "\n".join([
    "X:1",
    "T:demo",
    "M:3/4",
    "L:1/8",
    "Q:1/4=132",
    "% a comment line with | pipes | that must not count as bars",
    "V: Vocal clef=treble",
    "K:Gm",
    "V: Vocal",
    "GABc|d2z4|",
    "V: Ins",
    "G4z2|G6|",
])


def test_input_node_is_passthrough():
    node = _mod.ABCScoreInput()
    assert node.run(SCORE) == (SCORE,)
    # An empty score is still valid: YuE2 falls back to generating its own melody.
    assert node.run("") == ("",)


def test_input_node_default_parses_as_a_score():
    key, meter, bpm, bars = _mod.ABCScoreInfo().run(_mod.DEFAULT_ABC)
    assert key == "Am"
    assert meter == "4/4"
    assert bpm == 91
    assert bars == 4


def test_info_node_reads_header_and_counts_bars():
    key, meter, bpm, bars = _mod.ABCScoreInfo().run(SCORE)
    assert key == "Gm", "the first K: line wins, later voice switches must not overwrite it"
    assert meter == "3/4"
    assert bpm == 132
    assert bars == 4, "two music lines of two bars each; comments and headers excluded"


def test_info_node_survives_an_empty_or_headerless_score():
    assert _mod.ABCScoreInfo().run("") == ("C", "4/4", 120, 0)
    assert _mod.ABCScoreInfo().run(None) == ("C", "4/4", 120, 0)


def test_nodes_are_registered_with_display_names():
    for name in ("ABCScoreInput", "ABCScoreInfo"):
        assert name in _mod.NODE_CLASS_MAPPINGS
        assert _mod.NODE_DISPLAY_NAME_MAPPINGS.get(name)


def test_import_pulls_no_heavy_dependency():
    heavy = {name for name in _PULLED_IN if name.split(".")[0] in {"torch", "numpy", "PIL", "scipy"}}
    assert not heavy, f"importing the ABC nodes must stay cheap, but it loaded {sorted(heavy)}"


if __name__ == "__main__":
    for name, fn in sorted(list(globals().items())):
        if name.startswith("test_") and callable(fn):
            fn()
            print("ok", name)
    print("ABC studio tests passed")
