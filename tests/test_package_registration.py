"""Static guarantees about how the toobusy package registers its nodes.

These checks run without a ComfyUI runtime. They exist because the failures they
cover are invisible until a user installs the package: a node package that was
written but never wired into `__init__.py`, a node with no display name, one
broken optional dependency taking down every unrelated node, and unsafe pickle
deserialization creeping back into the vendored FlashVSR backend.
"""

import ast
import pathlib


ROOT = pathlib.Path(__file__).resolve().parents[1]
IGNORED_DIRS = {"tests", "js", "docs", ".github", ".git", "__pycache__"}


def _node_packages():
    packages = []
    for entry in sorted(ROOT.iterdir()):
        if not entry.is_dir() or entry.name in IGNORED_DIRS:
            continue
        if not (entry / "__init__.py").is_file():
            continue
        packages.append(entry)
    return packages


def _mapping_keys(path, mapping_name):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    keys = set()
    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue
        targets = {t.id for t in node.targets if isinstance(t, ast.Name)}
        if mapping_name not in targets or not isinstance(node.value, ast.Dict):
            continue
        for key in node.value.keys:
            if isinstance(key, ast.Constant) and isinstance(key.value, str):
                keys.add(key.value)
    return keys


def _package_mapping_keys(package, mapping_name):
    keys = set()
    for path in sorted(package.glob("*.py")):
        keys |= _mapping_keys(path, mapping_name)
    return keys


root_init = ROOT / "__init__.py"
root_tree = ast.parse(root_init.read_text(encoding="utf-8"))

# 1. Every node package is imported by the root entrypoint.
imported = {
    node.module
    for node in ast.walk(root_tree)
    if isinstance(node, ast.ImportFrom) and node.level == 1 and node.module
}
declared = {package.name for package in _node_packages()}
missing = sorted(declared - imported)
assert not missing, f"node packages missing from __init__.py: {missing}"

# 2. Every relative import sits inside its own try/except so one failing package
#    cannot remove the rest of the node set.
guarded = set()
for node in ast.walk(root_tree):
    if not isinstance(node, ast.Try):
        continue
    for child in node.body:
        if isinstance(child, ast.ImportFrom) and child.level == 1 and child.module:
            guarded.add(child.module)
unguarded = sorted(imported - guarded)
assert not unguarded, f"node package imports are not fault-isolated: {unguarded}"

# 3. Every registered node class has a display name.
for package in _node_packages():
    classes = _package_mapping_keys(package, "NODE_CLASS_MAPPINGS")
    names = _package_mapping_keys(package, "NODE_DISPLAY_NAME_MAPPINGS")
    undisplayed = sorted(classes - names)
    assert not undisplayed, f"{package.name} registers nodes with no display name: {undisplayed}"

# 4. No torch.load call may unpickle arbitrary objects, and 5. every console
#    message stays ASCII so a CJK Windows console (cp949/cp932/cp936) cannot
#    abort a running node with UnicodeEncodeError.
for path in sorted(ROOT.rglob("*.py")):
    if any(part in IGNORED_DIRS for part in path.relative_to(ROOT).parts):
        continue
    rel = path.relative_to(ROOT)
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue

        func = node.func
        if isinstance(func, ast.Attribute) and func.attr == "load":
            if isinstance(func.value, ast.Name) and func.value.id == "torch":
                weights_only = [kw for kw in node.keywords if kw.arg == "weights_only"]
                assert weights_only, f"{rel}:{node.lineno} torch.load without weights_only"
                value = weights_only[0].value
                assert isinstance(value, ast.Constant) and value.value is True, (
                    f"{rel}:{node.lineno} torch.load must use weights_only=True"
                )

        if isinstance(func, ast.Name) and func.id == "print":
            for sub in ast.walk(node):
                if not (isinstance(sub, ast.Constant) and isinstance(sub.value, str)):
                    continue
                offenders = sorted({ord(c) for c in sub.value if ord(c) > 127})
                assert not offenders, (
                    f"{rel}:{node.lineno} print() contains non-ASCII "
                    f"{[hex(code) for code in offenders]}; a cp949/cp932 console "
                    "raises UnicodeEncodeError and kills the node mid-run"
                )

print(f"Package registration tests passed ({len(declared)} node packages)")
