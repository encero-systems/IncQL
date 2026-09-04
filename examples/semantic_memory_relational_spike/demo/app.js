const facts = [
  {
    id: "activation",
    title: "Memory activation contract",
    reference: "KnowledgeRevision:northbridge-memory-activation-contract@1",
    detail:
      "A Minutary recall supplies a bounded atom set. Changing topic replaces the agent focus instead of rebuilding the conversation history.",
    source: "Northbridge architecture review, 28 August 2026",
    projections: {
      abstract: {
        content: "A recalled meeting swaps a bounded atom set; conversation history remains unchanged.",
        tokens: 12,
      },
      overview: {
        content:
          "Minutary supplies a bounded memory-atom set for one recall. A topic change replaces the active focus, preserving the original conversation history and its evidence trace.",
        tokens: 25,
      },
      evidence: {
        content:
          "Architecture decision: changing topic replaces the agent focus rather than rebuilding the conversation history.",
        tokens: 15,
      },
    },
  },
  {
    id: "local",
    title: "Local-only boundary",
    reference: "KnowledgeRevision:northbridge-local-only-boundary@1",
    detail:
      "Pilot knowledge stays in the on-device workspace. No client document or embedding is sent to a remote provider by default.",
    source: "Northbridge product checkpoint, 28 August 2026",
    projections: {
      abstract: {
        content: "Northbridge pilot knowledge remains on-device by default.",
        tokens: 7,
      },
      overview: {
        content:
          "The product checkpoint keeps client documents and embeddings in the local workspace. The approved pilot boundary remains pinned to the reviewed knowledge revision.",
        tokens: 24,
      },
      evidence: {
        content:
          "Reviewed pilot boundary: no client document or embedding is sent to a remote provider by default.",
        tokens: 17,
      },
    },
  },
  {
    id: "release",
    title: "Pilot release gate",
    reference: "KnowledgeRevision:northbridge-pilot-release-gate@1",
    detail:
      "Before the 17 September review, the build needs an inspectable package receipt and an offline fallback for every recalled answer.",
    source: "Northbridge architecture review, 28 August 2026",
    projections: {
      abstract: {
        content: "Pilot delivery needs an inspectable receipt and offline recalled answers.",
        tokens: 10,
      },
      overview: {
        content:
          "Before the 17 September review, the pilot must carry an inspectable package receipt and an offline fallback for every recalled answer.",
        tokens: 22,
      },
      evidence: {
        content:
          "Release evidence: attach a package receipt and an offline fallback for every recalled answer.",
        tokens: 16,
      },
    },
  },
  {
    id: "performance",
    title: "Memory performance budget",
    reference: "KnowledgeRevision:northbridge-memory-performance-budget@1",
    detail:
      "A recalled meeting may contribute at most 48 atoms. Focus switching and constrained retrieval are benchmarked separately.",
    source: "Northbridge architecture review, 28 August 2026",
    projections: {
      abstract: {
        content: "A recalled meeting contributes at most 48 active atoms.",
        tokens: 9,
      },
      overview: {
        content:
          "A recalled meeting may contribute no more than 48 atoms. Focus switching and bounded retrieval have separate performance measurements.",
        tokens: 19,
      },
      evidence: {
        content:
          "Performance constraint: benchmark a bounded 48-atom recall set separately from focus switching.",
        tokens: 14,
      },
    },
  },
  {
    id: "risk",
    title: "Finance export risk",
    reference: "KnowledgeRevision:northbridge-finance-export-risk@1",
    detail:
      "The finance workstream's export taxonomy remains under review and is not part of the product checkpoint or architecture recall.",
    source: "Northbridge finance status, 27 August 2026",
    projections: {
      abstract: {
        content: "Finance export taxonomy remains outside the active Northbridge recall.",
        tokens: 10,
      },
      overview: {
        content:
          "The finance workstream's export taxonomy is still under review and does not belong to the product checkpoint or architecture recall.",
        tokens: 21,
      },
      evidence: {
        content:
          "Scope exclusion: finance export taxonomy is not part of this product checkpoint or architecture recall.",
        tokens: 16,
      },
    },
  },
];

const focusStates = {
  product: {
    timeline: "product",
    name: "Product checkpoint focus",
    sourceMemory: "ConversationMemoryRevision:northbridge-product-checkpoint:turn-004@1",
    snapshot: 28,
    trace: "northbridge-product-checkpoint",
    receipt: "receipt:northbridge-product-checkpoint-v1",
    question: "What constraint should guide the product checkpoint?",
    atomIds: ["local", "release"],
    selectedId: "local",
    status: "Active now",
    scopePath: [
      {
        kind: "Conversation",
        title: "Northbridge product checkpoint",
        reference: "ConversationMemoryRevision:northbridge-product-checkpoint:turn-004@1",
      },
      {
        kind: "Memory atom",
        title: "Local-only boundary",
        reference: "KnowledgeRevision:northbridge-local-only-boundary@1",
      },
    ],
  },
  meeting: {
    timeline: "meeting",
    name: "Minutary architecture recall",
    sourceMemory:
      "ConversationMemoryRevision:northbridge-product-checkpoint:minutary:northbridge-architecture-2026-08-28@1",
    snapshot: 30,
    trace: "northbridge-architecture-recall",
    receipt: "receipt:northbridge-architecture-recall-v1",
    question: "What did the architecture review decide about meeting recall?",
    atomIds: ["activation", "performance", "release"],
    selectedId: "activation",
    status: "Recall active now",
    scopePath: [
      {
        kind: "Conversation",
        title: "Northbridge product checkpoint",
        reference: "ConversationMemoryRevision:northbridge-product-checkpoint:turn-004@1",
      },
      {
        kind: "Meeting",
        title: "Minutary architecture recall",
        reference:
          "ConversationMemoryRevision:northbridge-product-checkpoint:minutary:northbridge-architecture-2026-08-28@1",
      },
      {
        kind: "Decision",
        title: "Architecture review minutes",
        reference: "MeetingMinutesRevision:northbridge-architecture-2026-08-28@1",
      },
      {
        kind: "Memory atom",
        title: "Memory activation contract",
        reference: "KnowledgeRevision:northbridge-memory-activation-contract@1",
      },
    ],
  },
  restored: {
    timeline: "restored",
    name: "Product checkpoint restored",
    sourceMemory: "ConversationMemoryRevision:northbridge-product-checkpoint:turn-004@1",
    snapshot: 32,
    trace: "northbridge-product-checkpoint-restored",
    receipt: "receipt:northbridge-product-checkpoint-restored-v1",
    question: "What constraint should guide the product checkpoint?",
    atomIds: ["local", "release"],
    selectedId: "local",
    status: "Focus restored",
    scopePath: [
      {
        kind: "Conversation",
        title: "Northbridge product checkpoint",
        reference: "ConversationMemoryRevision:northbridge-product-checkpoint:turn-004@1",
      },
      {
        kind: "Memory atom",
        title: "Local-only boundary",
        reference: "KnowledgeRevision:northbridge-local-only-boundary@1",
      },
    ],
  },
};

const projectionNames = {
  abstract: "Abstract",
  overview: "Overview",
  evidence: "Evidence excerpt",
};

const atomList = document.querySelector("#atom-list");
const candidateList = document.querySelector("#candidate-list");
const scopePath = document.querySelector("#scope-path");
const focusButtons = [...document.querySelectorAll("[data-focus]")];
const projectionButtons = [...document.querySelectorAll("[data-projection]")];
const state = { focusId: "product", projectionLevel: "abstract" };

function factFor(id) {
  return facts.find((fact) => fact.id === id);
}

function candidateStatus(focus, fact) {
  if (fact.id === focus.selectedId) return { label: "Selected", className: "selected" };
  if (focus.atomIds.includes(fact.id)) return { label: "Bound limit", className: "bound" };
  return { label: "Focus excluded", className: "excluded" };
}

function renderAtoms(focus) {
  atomList.replaceChildren(
    ...focus.atomIds.map((atomId) => {
      const fact = factFor(atomId);
      const item = document.createElement("li");
      item.textContent = fact.title;
      const reference = document.createElement("span");
      reference.textContent = fact.reference;
      item.append(reference);
      return item;
    }),
  );
}

function renderScopePath(focus) {
  scopePath.replaceChildren(
    ...focus.scopePath.map((hop, index) => {
      const item = document.createElement("li");
      const ordinal = document.createElement("span");
      ordinal.className = "scope-ordinal";
      ordinal.textContent = String(index + 1).padStart(2, "0");
      const detail = document.createElement("div");
      const kind = document.createElement("span");
      kind.className = "scope-kind";
      kind.textContent = hop.kind;
      const title = document.createElement("strong");
      title.textContent = hop.title;
      const reference = document.createElement("span");
      reference.className = "scope-reference";
      reference.textContent = hop.reference;
      detail.append(kind, title, reference);
      item.append(ordinal, detail);
      return item;
    }),
  );
}

function renderCandidates(focus) {
  candidateList.replaceChildren(
    ...facts.map((fact, index) => {
      const treatment = candidateStatus(focus, fact);
      const row = document.createElement("div");
      row.className = `candidate ${treatment.className}`;
      row.innerHTML = `
        <span class="candidate-rank">${String(index + 1).padStart(2, "0")}</span>
        <div>
          <span class="candidate-title">${fact.title}</span>
          <span class="candidate-ref">${fact.reference}</span>
        </div>
        <span class="candidate-status">${treatment.label}</span>
      `;
      return row;
    }),
  );
}

function render() {
  const focus = focusStates[state.focusId];
  const selected = factFor(focus.selectedId);
  const projection = selected.projections[state.projectionLevel];
  const selectedCount = facts.filter((fact) => candidateStatus(focus, fact).className === "selected").length;
  const excludedCount = facts.length - selectedCount;
  document.querySelector("#response-title").textContent = selected.title;
  document.querySelector("#snapshot").textContent = `Input snapshot ${focus.snapshot}`;
  document.querySelector("#question").textContent = focus.question;
  document.querySelector("#answer").textContent = projection.content;
  document.querySelector("#source").textContent = selected.source;
  document.querySelector("#selected-atom").textContent = selected.reference.replace("KnowledgeRevision:", "");
  document.querySelector("#trace-result").textContent = `${selectedCount} selected / ${excludedCount} excluded`;
  document.querySelector("#projection-meta").textContent = `${projectionNames[state.projectionLevel]} / ${projection.tokens} declared tokens`;
  document.querySelector("#trace-id").textContent = `trace: ${focus.trace}`;
  document.querySelector("#run-receipt").textContent = focus.receipt;
  document.querySelector("#activation-name").textContent = focus.name;
  document.querySelector("#activation-status").textContent = focus.status;
  document.querySelector("#source-memory").textContent = focus.sourceMemory;
  document.querySelector("#atom-count").textContent = `${focus.atomIds.length} exact revisions`;

  focusButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.focus === state.focusId));
  });
  projectionButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.projection === state.projectionLevel));
  });
  document.querySelectorAll("[data-timeline]").forEach((item) => {
    item.classList.toggle("active", item.dataset.timeline === focus.timeline);
  });
  renderAtoms(focus);
  renderScopePath(focus);
  renderCandidates(focus);
}

focusButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.focusId = button.dataset.focus;
    render();
  });
});

projectionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.projectionLevel = button.dataset.projection;
    render();
  });
});

render();
