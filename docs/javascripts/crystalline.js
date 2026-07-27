(() => {
  const layers = {
    author: {
      number: "01 · Checked intent",
      title: "Authoring surfaces",
      icon: "../shared/icons/code-braces-box.svg",
      summary: "Query blocks and typed carrier calls express relational work. Incan hosts the language extension; IncQL owns the relational vocabulary and public contracts.",
      owns: ["Typed query intent", "IncQL relational vocabulary", "Checked carrier calls"],
      excludes: ["Backend selection", "Physical execution", "Portable exchange"],
      input: "author intent",
      output: "checked carrier calls",
    },
    prism: {
      number: "02 · Semantic planning",
      title: "Prism",
      icon: "../shared/icons/vector-polyline.svg",
      summary: "IncQL's immutable internal logical plan state and the local source of schema, lineage, rewrites, and authored-origin mappings.",
      owns: ["Authored graph state", "Canonical rewrites", "Origin mappings"],
      excludes: ["Public authoring syntax", "Portable interchange", "Runtime execution"],
      input: "checked carrier calls",
      output: "rewritten Prism view",
    },
    substrait: {
      number: "03 · Portable exchange",
      title: "Substrait",
      icon: "../shared/icons/file-tree-outline.svg",
      summary: "The portable logical Plan / Rel boundary carries relational meaning across the runtime seam without source bindings, backend selection, or local evidence.",
      owns: ["Portable logical plan", "Schemas and expressions", "Extension declarations"],
      excludes: ["Source bindings", "plan_target evidence", "Physical execution policy"],
      input: "rewritten Prism view",
      output: "Substrait Plan / Rel",
    },
    session: {
      number: "04 · Bind + dispatch",
      title: "Session",
      icon: "../shared/icons/link-variant.svg",
      summary: "The runtime context validates logical reads, supplies registrations, selects the backend, dispatches the operation, and creates execution observations.",
      owns: ["Source registrations", "Backend selection", "Execution observation"],
      excludes: ["Semantic rewrites", "Backend physical planning", "IncQL syntax"],
      input: "Plan + registrations",
      output: "adapter dispatch",
    },
    adapter: {
      number: "05 · Plan + execute",
      title: "Backend adapter",
      icon: "../shared/icons/database-cog-outline.svg",
      summary: "The concrete engine bridge performs backend-specific planning and execution, then returns a materialization or typed error without becoming the semantic owner.",
      owns: ["Engine registration", "Physical planning", "Execution + materialization"],
      excludes: ["IncQL semantics", "Session policy", "Observation creation"],
      input: "Plan + BackendRegistration[]",
      output: "materialization or typed error",
    },
  };

  const layerOrder = Object.keys(layers);
  const tourDuration = 6500;
  const architectureTourContract = {
    nextLayer(currentLayer) {
      const currentIndex = layerOrder.indexOf(currentLayer);
      return layerOrder[(currentIndex + 1) % layerOrder.length];
    },

    keyboardIndex(currentIndex, key, length) {
      if (key === "ArrowLeft") return (currentIndex - 1 + length) % length;
      if (key === "ArrowRight") return (currentIndex + 1) % length;
      if (key === "Home") return 0;
      if (key === "End") return length - 1;
      return currentIndex;
    },

    startsAutomatically(prefersReducedMotion) {
      return !prefersReducedMotion;
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { architectureTourContract, layers };
  }
  if (typeof document === "undefined") {
    return;
  }

  const initializeCrystalArchitecture = () => {
    window.__incqlCrystalArchitectureDispose?.();

    const root = document.querySelector("[data-crystal-system-path]");
    if (!root) {
      window.__incqlCrystalArchitectureDispose = null;
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    const stageSelector = root.querySelector(".incql-layer-selector");
    const figure = root.querySelector(".incql-crystal-path");
    const inspector = root.querySelector("#incql-layer-inspector");
    const stageButtons = [...root.querySelectorAll("[data-crystal-layer]")];
    const hotspots = [...root.querySelectorAll("[data-crystal-visual-layer]")];
    const tourToggle = root.querySelector("[data-crystal-tour-toggle]");
    const tourStatus = root.querySelector("[data-crystal-tour-status]");
    const announcer = root.querySelector("[data-crystal-layer-announcer]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hoveredRegions = new Set();
    let currentLayer = "prism";
    let tourTimer = null;
    let tourGeneration = 0;
    let tourRequested = architectureTourContract.startsAutomatically(reducedMotion.matches);
    let explicitMotionOptIn = false;
    let systemPathVisible = true;
    let tourObserver = null;

    const targets = {
      number: inspector?.querySelector("[data-crystal-layer-number]"),
      title: inspector?.querySelector("[data-crystal-layer-title]"),
      icon: inspector?.querySelector("[data-crystal-layer-icon]"),
      summary: inspector?.querySelector("[data-crystal-layer-summary]"),
      owns: inspector?.querySelector("[data-crystal-layer-owns]"),
      excludes: inspector?.querySelector("[data-crystal-layer-excludes]"),
      input: inspector?.querySelector("[data-crystal-layer-input]"),
      output: inspector?.querySelector("[data-crystal-layer-output]"),
    };

    const replaceList = (target, values) => {
      if (!target) {
        return;
      }
      target.replaceChildren(...values.map((value) => {
        const item = document.createElement("li");
        item.textContent = value;
        return item;
      }));
    };

    const centerInScroller = (target, scroller) => {
      if (!target || !scroller || scroller.scrollWidth <= scroller.clientWidth + 32) {
        return;
      }
      const targetCenter = target.offsetLeft + target.offsetWidth / 2;
      const left = Math.max(0, targetCenter - scroller.clientWidth / 2);
      scroller.scrollTo({ left, behavior: reducedMotion.matches ? "auto" : "smooth" });
    };

    const clearTourTimer = () => {
      window.clearTimeout(tourTimer);
      tourTimer = null;
      tourGeneration += 1;
      root.classList.remove("is-touring");
    };

    const updateTourUi = () => {
      if (!tourToggle || !tourStatus) {
        return;
      }
      if (tourRequested) {
        tourToggle.textContent = "Stop automatic layer tour";
        if (hoveredRegions.size > 0) {
          tourStatus.textContent = "Tour paused while you inspect";
        } else if (!systemPathVisible) {
          tourStatus.textContent = "Tour waits until this path is visible";
        } else {
          tourStatus.textContent = `Automatic tour · ${layers[currentLayer].title}`;
        }
      } else {
        tourToggle.textContent = "Start automatic layer tour";
        tourStatus.textContent = reducedMotion.matches
          ? "Automatic tour paused for reduced motion"
          : "Automatic layer tour paused";
      }
    };

    const selectLayer = (layerName, options = {}) => {
      const layer = layers[layerName];
      if (!layer || !inspector) {
        return;
      }

      currentLayer = layerName;
      stageButtons.forEach((button) => {
        const selected = button.dataset.crystalLayer === layerName;
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
      hotspots.forEach((button) => {
        const selected = button.dataset.crystalVisualLayer === layerName;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });

      targets.number.textContent = layer.number;
      targets.title.textContent = layer.title;
      targets.icon.src = new URL(layer.icon, window.location.href).href;
      targets.summary.textContent = layer.summary;
      targets.input.textContent = layer.input;
      targets.output.textContent = layer.output;
      replaceList(targets.owns, layer.owns);
      replaceList(targets.excludes, layer.excludes);

      const activeButton = stageButtons.find((button) => button.dataset.crystalLayer === layerName);
      if (activeButton) {
        inspector.setAttribute("aria-labelledby", activeButton.id);
      }
      if (options.updateUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set("layer", layerName);
        url.hash = "system-path";
        history.replaceState(null, "", url);
      }
      if (options.focus) {
        activeButton?.focus();
      }
      if (options.announce && announcer) {
        const index = layerOrder.indexOf(layerName) + 1;
        announcer.textContent = `${layer.title}, layer ${index} of ${layerOrder.length}`;
      }
      if (options.scroll !== false) {
        centerInScroller(activeButton, stageSelector);
        centerInScroller(hotspots.find((button) => button.dataset.crystalVisualLayer === layerName), figure);
      }
      updateTourUi();
    };

    const canRunTour = () => tourRequested
      && document.visibilityState === "visible"
      && systemPathVisible
      && hoveredRegions.size === 0
      && (!reducedMotion.matches || explicitMotionOptIn);

    const scheduleTour = () => {
      clearTourTimer();
      updateTourUi();
      if (!canRunTour()) {
        return;
      }
      const generation = tourGeneration;
      void root.offsetWidth;
      root.classList.add("is-touring");
      tourTimer = window.setTimeout(() => {
        if (generation !== tourGeneration || !canRunTour()) {
          return;
        }
        selectLayer(architectureTourContract.nextLayer(currentLayer), {
          updateUrl: false,
          announce: false,
        });
        scheduleTour();
      }, tourDuration);
    };

    const stopTour = () => {
      tourRequested = false;
      explicitMotionOptIn = false;
      clearTourTimer();
      updateTourUi();
    };

    const selectManually = (layerName, options = {}) => {
      stopTour();
      selectLayer(layerName, {
        updateUrl: true,
        announce: true,
        focus: options.focus,
      });
    };

    stageButtons.forEach((button) => {
      const layerName = button.dataset.crystalLayer;
      button.id = `incql-architecture-layer-${layerName}`;
      button.setAttribute("aria-controls", "incql-layer-inspector");
      button.addEventListener("click", () => selectManually(layerName), { signal });
      button.addEventListener("pointerenter", () => {
        selectLayer(layerName, { updateUrl: false, announce: false });
      }, { signal });
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          return;
        }
        event.preventDefault();
        const currentIndex = stageButtons.indexOf(button);
        const nextIndex = architectureTourContract.keyboardIndex(
          currentIndex,
          event.key,
          stageButtons.length,
        );
        selectManually(stageButtons[nextIndex].dataset.crystalLayer, { focus: true });
      }, { signal });
    });

    hotspots.forEach((button) => {
      const layerName = button.dataset.crystalVisualLayer;
      button.setAttribute("aria-controls", "incql-layer-inspector");
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("pointerenter", () => {
        selectLayer(layerName, { updateUrl: false, announce: false });
      }, { signal });
      button.addEventListener("click", () => selectManually(layerName), { signal });
    });

    [stageSelector, figure, inspector].filter(Boolean).forEach((region) => {
      region.addEventListener("pointerenter", () => {
        hoveredRegions.add(region);
        clearTourTimer();
        updateTourUi();
      }, { signal });
      region.addEventListener("pointerleave", () => {
        hoveredRegions.delete(region);
        scheduleTour();
      }, { signal });
    });

    root.addEventListener("focusin", (event) => {
      if (!tourToggle?.contains(event.target)) {
        stopTour();
      }
    }, { signal });

    tourToggle?.addEventListener("click", () => {
      if (tourRequested) {
        stopTour();
      } else {
        tourRequested = true;
        explicitMotionOptIn = reducedMotion.matches;
        scheduleTour();
      }
    }, { signal });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        scheduleTour();
      } else {
        clearTourTimer();
      }
    }, { signal });

    reducedMotion.addEventListener?.("change", (event) => {
      if (event.matches) {
        stopTour();
      } else {
        updateTourUi();
      }
    }, { signal });

    window.addEventListener("popstate", () => {
      const layerName = new URL(window.location.href).searchParams.get("layer");
      if (layerName in layers) {
        stopTour();
        selectLayer(layerName, { updateUrl: false, announce: true });
      }
    }, { signal });

    if ("IntersectionObserver" in window) {
      tourObserver = new IntersectionObserver(([entry]) => {
        systemPathVisible = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.16);
        if (systemPathVisible) {
          scheduleTour();
        } else {
          clearTourTimer();
          updateTourUi();
        }
      }, { threshold: [0, 0.16, 0.4] });
      tourObserver.observe(root);
    }

    const initialLayer = new URL(window.location.href).searchParams.get("layer");
    selectLayer(initialLayer in layers ? initialLayer : "prism", {
      updateUrl: false,
      scroll: false,
      announce: false,
    });
    scheduleTour();

    window.__incqlCrystalArchitectureDispose = () => {
      clearTourTimer();
      tourObserver?.disconnect();
      controller.abort();
    };
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeCrystalArchitecture, { once: true });
  } else {
    initializeCrystalArchitecture();
  }

  // Material's instant-navigation stream does not replay the current document
  // consistently across releases. Initialize the first document above, then
  // subscribe only for subsequent page swaps. Re-initialization is safe because
  // the previous controller is disposed at the start of every pass.
  window.document$?.subscribe(initializeCrystalArchitecture);
})();
