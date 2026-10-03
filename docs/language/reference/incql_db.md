# IncQL-DB foundation

`incql-db` is the dependency-clean, embedded storage member in the IncQL workspace. It opens a local `.inqldb` directory as one exclusive writer and stores the first semantic-memory control-plane records without requiring a server, DataFusion, Substrait, Protobuf, or `protoc`.

```incan
from pub::incql_db import open

session = open(".inqldb")?
```

The initial implementation is deliberately a durable metadata foundation, not a completed analytic engine. It persists typed record-family declarations and immutable revision entries in snapshot partitions. Each commit writes and synchronizes all new entries, publishes a binary snapshot manifest, then atomically replaces the binary `CURRENT` pointer. Readers that open after an interruption therefore observe the previously committed snapshot; unpublished staging and snapshot partitions are discarded.

The physical layout is inspectable:

```text
.inqldb/
  FORMAT
  CURRENT
  catalog/<snapshot>/<record-family>/<schema-version>.family
  tables/<snapshot>/<record-family>/<schema-version>/<logical-record>/<revision>.revision
  payloads/<snapshot>/<record-family>/<schema-version>/<kind>/<payload>.payload
  payloads/<snapshot>/<record-family>/<schema-version>/<kind>/<payload>.payloadentry
  snapshots/<snapshot>.manifest
  staging/
```

A payload is an immutable file a record family owns under a named kind, for example a retrieval index built when a package is made. A transaction stages its bytes with `append_payload`, which checks them against the proposed fingerprint; the commit moves the file into the snapshot partition beside an entry that records its fingerprint and length. `Session.payloads()` lists what a snapshot made visible, `read_payload` returns the whole file only when it still matches its recorded identity, and `read_payload_range` reads a slice for callers that verified the file once and then touch small parts of it.

This control plane does not yet persist Arrow/Parquet column segments, typed vectors, Prism graph nodes, or retrieval traces; payloads are opaque files. Those are the next storage slices. The foundational invariant already applies: logical records and revisions are immutable, and only a fully synchronized snapshot becomes visible.
