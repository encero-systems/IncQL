import json, os, sys, glob, re
home = os.environ.get("INCAN_HOME") or os.path.join(os.path.expanduser("~"), ".incan")
entries = sorted(glob.glob(os.path.join(home, "oven", "store", "v2", "entries", "*")))
def short(s): return (s or "")[:20]
print(f"store entries: {len(entries)}")
for e in entries:
    mf = next((os.path.join(e, n) for n in ("loaf.json", "artifact.json") if os.path.isfile(os.path.join(e, n))), None)
    if not mf:
        print("  ", os.path.basename(e)[:30], "NO MANIFEST; files:", sorted(os.listdir(e))[:6]); continue
    d = json.load(open(mf))
    r = d.get("receipt") or {}
    intent = r.get("intent") or {}
    print("  ", os.path.basename(e)[:27], "kind=", d.get("kind"), "id=", short(d.get("identity")), "receipt=", short(r.get("identity")), "base=", short(d.get("base_loaf_identity")), "evidence=", d.get("source_evidence_key"), "profile=", intent.get("profile"), "logical=", (d.get("payload") or {}).get("logical_bytes"), "files=", len(d.get("materialized_files") or []))
    if d.get("kind") == "project_inspection_authority":
        try:
            p = json.load(open(os.path.join(e, "payload")))
            print("      constituents:", [(c.get("kind"), short(c.get("identity") or c.get("loaf_identity")), c.get("artifact_kind"), short(c.get("base_loaf_identity"))) for c in p.get("constituents", [])])
            env = p.get("test_dependency_envelope") or {}
            print("      envelope constituent_index:", env.get("constituent_index"), "generated_out_dirs:", len(p.get("generated_out_dirs") or []), "registry_sources:", len(p.get("registry_sources") or []))
        except Exception as ex:
            print("      payload unreadable:", ex)
for rf in sorted(glob.glob(os.path.join(sys.argv[1] if len(sys.argv) > 1 else ".", ".incan", "oven", "*.json"))):
    s = open(rf).read()
    ids = sorted(set(m[:12] for m in re.findall(r'sha256:([0-9a-f]{64})', s)))
    print("receipt", os.path.basename(rf)[:60], "ids:", ids)
