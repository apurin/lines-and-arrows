import "./runtime.js?v=20260818-2";
import { initializeSiteTheme } from "./site.js?v=20260806-2";

const braidedSource = `@Neanderthals
  icon users-three
  tag sister group
  tooltip A close human lineage adapted to western Eurasia; ancient DNA records contact with both Homo sapiens and Denisovans.
  tooltip-icon fingerprint

@Denisovans
  icon mountains
  tag DNA-defined
  tooltip Discovered through DNA, then traced through a skull, jaws, teeth, and living genomes across Asia and Oceania.
  tooltip-icon dna

@Homo sapiens
  icon globe-hemisphere-west
  tag living
  tooltip Our lineage originated in Africa, then dispersing populations met other human groups across Eurasia.
  tooltip-icon globe-hemisphere-west

parallel Encounters across Eurasia, ~100-45 ka
  | Western Eurasia, ~60-45 ka
    Neanderthals -> Neanderthals: Build a life in Eurasia
      tag deep roots
      tooltip Neanderthals controlled fire, made clothing and sophisticated tools, and weathered immense climate swings across Europe and western Asia.
      tooltip-icon campfire
    Homo sapiens -> Neanderthals: Meet and have children
      tag gene flow
      tooltip Ancient genomes record repeated contact rather than a single encounter.
      tooltip-icon dna
  | Denisova Cave, Siberia, ~90 ka
    Neanderthals -> Denisovans: Denisova 11 is born
      tag F1 hybrid
      tooltip Her genome shows a Neanderthal mother and a Denisovan father.
      tooltip-icon identification-card
  | Asia, several encounters
    Homo sapiens -> Denisovans: Populations meet
      tag gene flow
      tooltip Living genomes suggest contact with more than one Denisovan-related population.
      tooltip-icon users-three

gap Hundreds of generations pass

legacy Living genomes
  Neanderthals --> Homo sapiens: Inherited fragments persist
    tag widespread
    tooltip Neanderthal-derived DNA is distributed across living populations in different proportions.
    tooltip-icon fingerprint
  Denisovans --> Homo sapiens: EPAS1 crosses time
    tag adaptation
    tooltip A Denisovan-like EPAS1 haplotype contributes to high-altitude adaptation in Tibetan populations.
    tooltip-icon mountains`;

const braidedDetails = {
  general: {
    title: "Human prehistory",
    story: [
      "For most of human prehistory, humanity was plural. Across Pleistocene Eurasia, Neanderthals, Denisovans and arriving groups of Homo sapiens occupied overlapping worlds. The diagram is a family story told sideways: populations separated, met again and sometimes had children.",
      "Ancient DNA turned that possibility into biographies. A bone from Denisova Cave belonged to a girl whose mother was Neanderthal and whose father was Denisovan. Some early Homo sapiens in Europe had Neanderthal ancestors only a few generations back.",
      "Neanderthals and Denisovans later disappeared as distinct populations, but not completely. Their DNA survives in living people, broken into smaller pieces and reshuffled with every generation. Click a lineage to follow one strand of that inheritance.",
    ],
    sources: [
      [
        "Nature: a Neanderthal-Denisovan child",
        "https://www.nature.com/articles/s41586-018-0455-x",
      ],
      [
        "Nature: recent Neanderthal ancestors",
        "https://www.nature.com/articles/s41586-021-03335-3",
      ],
    ],
    images: {
      light: "./assets/prehistory-tools-light.jpg",
      dark: "./assets/prehistory-tools-dark.jpg",
    },
    alt: {
      light: "Prehistoric tools resting inside a daylight rock shelter",
      dark: "Used prehistoric tools scattered across a firelit cave floor",
    },
    position: "center",
    zoom: true,
  },
  Neanderthals: {
    title: "Neanderthals",
    story: [
      "Neanderthals were not a rough draft of us. For roughly 400,000 years they made lives across Europe and western Asia, adapting to huge swings in climate rather than one endless ice age. They were stocky, strong and close enough to us for their children with Homo sapiens to be fertile.",
      "They controlled fire, built shelters, made clothing and hunted large animals with carefully planned tools. Some communities used pigments and ornaments. The familiar cave brute is therefore a historical artifact, not an archaeological conclusion.",
      "Neanderthals disappeared as a distinct population around 40,000 years ago, near the end of several millennia of overlap with Homo sapiens. Their genetic afterlife is enormous: about 2-3% of the ancestry of most present-day people outside Africa is Neanderthal.",
    ],
    sources: [
      [
        "Smithsonian: Neanderthal life",
        "https://humanorigins.si.edu/evidence/human-fossils/species/homo-neanderthalensis",
      ],
      [
        "Nature: timing the interbreeding",
        "https://www.nature.com/articles/s41586-024-08420-x",
      ],
    ],
    images: {
      light: "./assets/neanderthal-light.jpg",
      dark: "./assets/neanderthal-dark.jpg",
    },
    alt: {
      light: "Speculative portrait of a Neanderthal woman in daylight",
      dark: "Speculative portrait of a Neanderthal woman by torchlight",
    },
    position: "center",
  },
  Denisovans: {
    title: "Denisovans",
    story: [
      "The Denisovans were discovered backwards. In 2010, DNA from a small finger bone in Siberia revealed a human population no one had recognized from anatomy. For years their known body amounted mostly to teeth, bone fragments and a jaw, while their genomes pointed to a range across Asia.",
      "That changed in 2025. Proteins linked the remarkably complete Harbin cranium, at least 146,000 years old, to a Denisovan population. The skull once called Dragon Man finally gave Denisovans a face as well as a genome.",
      "Their family ties were equally wide. One girl at Denisova Cave had a Neanderthal mother and a Denisovan father. Denisovan ancestry survives in parts of Asia and Oceania, and a Denisovan-like EPAS1 variant helps many Tibetans live at high altitude.",
    ],
    sources: [
      [
        "Science: the Harbin proteome",
        "https://www.science.org/doi/10.1126/science.adu9677",
      ],
      [
        "Nature: a Neanderthal-Denisovan child",
        "https://www.nature.com/articles/s41586-018-0455-x",
      ],
      [
        "Nature: Denisovan-like EPAS1",
        "https://www.nature.com/articles/nature13408",
      ],
    ],
    images: {
      light: "./assets/denisovan-light.jpg",
      dark: "./assets/denisovan-dark.jpg",
    },
    alt: {
      light: "Speculative portrait of a Denisovan woman in daylight",
      dark: "Speculative portrait of a Denisovan woman by firelight",
    },
    position: "center",
  },
  "Homo sapiens": {
    title: "Homo sapiens",
    story: [
      "Homo sapiens did not appear fully formed in one tiny cradle. Fossils from Jebel Irhoud in Morocco, about 315,000 years old, combine a face close to ours with a more archaic braincase. Together with finds elsewhere in Africa, they point to a long, continent-wide emergence.",
      "Later populations moved into Eurasia in more than one wave. By 45,000 years ago, Homo sapiens groups in Europe were already genetically distinct from one another. Some left no detectable descendants, while others belong to branches that continued into later populations.",
      "Their lives were built from cumulative culture. Specialized tools made other tools, ornaments travelled through social networks, and pigments and bone flutes preserve a symbolic world. Our species is the only human lineage still living as a distinct population, but our genomes keep the others in the family.",
    ],
    sources: [
      [
        "Nature: Jebel Irhoud",
        "https://www.nature.com/articles/nature22336",
      ],
      [
        "Nature: the earliest Eurasian genomes",
        "https://www.nature.com/articles/s41586-024-08420-x",
      ],
      [
        "Smithsonian: Homo sapiens",
        "https://humanorigins.si.edu/evidence/human-fossils/species/homo-sapiens",
      ],
    ],
    images: {
      light: "./assets/homo-sapiens-light.jpg",
      dark: "./assets/homo-sapiens-dark.jpg",
    },
    alt: {
      light: "Illustrative portrait of an Upper Paleolithic Homo sapiens in daylight",
      dark: "Illustrative portrait of an Upper Paleolithic Homo sapiens by torchlight",
    },
    position: "center",
  },
};

const appendLinks = (container, links, emptyText = "") => {
  container.replaceChildren();
  if (links.length === 0) {
    container.textContent = emptyText;
    return;
  }

  for (const [index, [label, url]] of links.entries()) {
    if (index > 0) {
      container.append(document.createTextNode(", "));
    }
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = label;
    container.append(link);
  }
};

const technicalShowcases = [
  {
    id: "compatible-migration",
    area: "Software engineering",
    title: "Rename a column without waking the pager",
    description:
      "An expand-and-contract migration keeps old and new application versions compatible while a canary decides when the legacy column can disappear.",
    loading: "Rendering the compatible migration",
    label:
      "An application evolves a shared database column without breaking mixed versions",
    source: `@Release
  icon rocket-launch
  tooltip Orchestrates flags and migration steps across releases
  tooltip-icon git-branch
@Application
  icon app-window
@Database
  icon database
  tag shared schema
@Backfill Worker
  icon arrows-clockwise
@Telemetry
  icon pulse

Release -> Database: Add nullable display_name
  tooltip Expanding first keeps the old application compatible
  tooltip-icon plus-circle
Release -> Application: Enable dual writes
parallel Compatibility window
  | live profile updates
    repeat Every accepted write
      Application -> Database: Write name and display_name
  | historical profiles
    repeat Batches under load
      Backfill Worker -> Database: Copy name into display_name
      Database --> Backfill Worker: Batch committed
Application -> Telemetry: Report read mismatches
choice Canary reads
  | mismatch rate is zero
    Telemetry --> Release: New column is ready
    Release -> Application: Prefer display_name
  | mismatches appear
    Telemetry -> Release: Hold the rollout
      tag SLO guardrail
      tooltip Keeps the compatible path while engineers inspect the cohort
      tooltip-icon warning
    Release -> Application: Keep reading name
gap One release after every old reader retires
Release -> Database: Require display_name
Release -> Database: Drop name`,
  },
  {
    id: "checkout-saga",
    area: "Service-oriented architecture",
    title: "A checkout that knows how to unwind",
    description:
      "An order saga coordinates payment and stock, then compensates earlier work when a later service cannot commit.",
    loading: "Rendering the checkout saga",
    label:
      "An order saga compensates a payment hold when inventory cannot commit",
    source: `@Storefront
  icon storefront
@Order Service
  icon receipt
  tag saga owner
  tooltip Owns the saga state without sharing a database
  tooltip-icon flow-arrow
@Payment Service
  icon credit-card
@Inventory Service
  icon warehouse
@Delivery Service
  icon truck

Storefront -> Order Service: Place order
Order Service -> Payment Service: Authorize payment
choice Payment result
  | authorized
    Payment Service --> Order Service: Hold approved
    Order Service -> Inventory Service: Reserve items
    choice Stock result
      | reserved
        Inventory Service --> Order Service: Reservation confirmed
        Order Service -> Delivery Service: Schedule shipment
        Delivery Service --> Order Service: Delivery window
        Order Service --> Storefront: Confirm order
      | unavailable
        Inventory Service --> Order Service: Reservation rejected
        critical Compensate prior work
          Order Service -> Payment Service: Release hold
          Payment Service --> Order Service: Hold released
        Order Service --> Storefront: Explain stock conflict
  | declined
    Payment Service --> Order Service: Authorization declined
    Order Service --> Storefront: Request another payment method`,
  },
  {
    id: "streaming-watermarks",
    area: "Data flow and streaming",
    title: "The window waits for watermarks",
    description:
      "A fraud pipeline joins live payments with recent behavior, emits alerts, and revises evidence when late events cross the watermark.",
    loading: "Rendering the event-time window",
    label:
      "A streaming risk pipeline handles watermarks and late payment events",
    source: `@Payment Edge
  icon credit-card
@Event Stream
  icon queue
  tooltip Partitioned by account to preserve local ordering
  tooltip-icon info
@Window Processor
  icon funnel
  tag event-time
@Risk Model
  icon gauge
@Risk Desk
  icon shield-warning

Payment Edge -> Event Stream: Publish payment
repeat For each account partition
  Event Stream -> Window Processor: Deliver payment event
  Window Processor -> Window Processor: Update five-minute features
  Window Processor -> Risk Model: Score current window
  choice Score result
    | suspicious
      Risk Model --> Window Processor: High risk
      Window Processor -> Risk Desk: Emit alert
    | routine
      Risk Model --> Window Processor: Below threshold
gap Watermark advances
choice Arrival timing
  | within allowed lateness
    Event Stream -> Window Processor: Deliver late payment
    Window Processor -> Window Processor: Revise window
    Window Processor -> Risk Model: Rescore corrected features
    Risk Model --> Window Processor: Corrected score
    Window Processor -> Risk Desk: Amend alert evidence
  | past retention
    Event Stream ->x Window Processor: Drop expired event
      tooltip Window state has already been compacted
      tooltip-icon clock-countdown`,
  },
  {
    id: "grounded-diagnosis",
    area: "LLM agents",
    title: "The diagnosis earns its citations",
    description:
      "An investigation agent retrieves versioned evidence, cites every diagnosis, and leaves the consequential rollback decision with a human reviewer.",
    loading: "Rendering the grounded investigation",
    label:
      "An LLM investigation agent grounds a deployment diagnosis in cited evidence",
    source: `@Engineer
  icon terminal
@Research Agent
  icon robot
  tag advisory only
  tooltip Builds claims from retrieved evidence but cannot approve action
  tooltip-icon shield-check
@Search Index
  icon magnifying-glass
@Source Documents
  icon books
@Human Reviewer
  icon user-check
  tag approval gate

Engineer -> Research Agent: Investigate the failed deployment
Research Agent -> Search Index: Query errors and change history
parallel Gather grounded context
  Search Index --> Research Agent: Return relevant records
  Research Agent -> Source Documents: Open exact passages
  Source Documents --> Research Agent: Return versioned evidence
Research Agent -> Research Agent: Draft a diagnosis with citations
Research Agent -> Human Reviewer: Propose cause and rollback
  tag cited evidence
  tooltip Every claim points to a retrieved passage
  tooltip-icon file-text
Human Reviewer -> Source Documents: Verify cited passages
choice Review outcome
  | evidence holds
    Human Reviewer --> Engineer: Approve the rollback plan
  | evidence conflicts
    Human Reviewer --> Research Agent: Request a narrower claim
    Research Agent -> Search Index: Search for the missing evidence`,
  },
  {
    id: "opening-auction",
    area: "Stock trading",
    title: "One bell, one opening price",
    description:
      "An opening auction collects queued buy and sell orders, finds one price that matches the most shares, then publishes the opening trades.",
    loading: "Rendering the opening auction",
    label:
      "A stock exchange opening auction discovers one price for queued orders",
    source: `@Investor
  icon user
@Broker
  icon buildings
@Opening Auction
  icon arrows-left-right
  tooltip Collects eligible orders before continuous trading begins
  tooltip-icon chart-line-up
@Market Data
  icon chart-line-up
@Trade Tape
  icon broadcast

Investor -> Broker: Submit a market-on-open order
Broker -> Opening Auction: Route the eligible order
repeat Until the opening cutoff
  Opening Auction -> Opening Auction: Add and cancel auction orders
  Opening Auction -> Market Data: Publish indicative price and imbalance
  Market Data --> Investor: Show the changing auction signal
gap Opening auction cutoff
Opening Auction -> Opening Auction: Choose the price that matches the most shares
choice Executable cross
  | enough opposing volume
    Opening Auction --> Broker: Fill at one opening price
      tooltip All matched auction orders execute at the same opening price
      tooltip-icon scales
    Broker --> Investor: Confirm shares filled
    Opening Auction -> Trade Tape: Publish opening trades
  | not enough opposing volume
    Opening Auction --> Broker: Report no opening execution
    Broker --> Investor: Report no opening fill`,
  },
];

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const renderShowcase = ({
  id,
  area,
  title,
  description,
  loading,
  label,
  source,
}) => `
      <section class="showcase-case section-shell" id="${id}" data-showcase>
        <header class="showcase-case-header">
          <p class="showcase-area">${escapeHtml(area)}</p>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(description)}</p>
        </header>
        <figure class="showcase-figure">
          <div class="showcase-toolbar">
            <div
              class="surface-switcher showcase-mode-switcher"
              role="group"
              aria-label="${escapeHtml(title)} diagram mode"
            >
              <button
                type="button"
                data-showcase-surface="view"
                aria-pressed="true"
              >
                View
              </button>
              <button
                type="button"
                data-showcase-surface="edit"
                aria-pressed="false"
              >
                Edit
              </button>
              <button
                type="button"
                data-showcase-surface="source"
                aria-pressed="false"
              >
                Source
              </button>
            </div>
          </div>
          <div class="showcase-stage" data-showcase-diagram-pane>
            <div class="diagram-loading">${escapeHtml(loading)}</div>
            <lines-and-arrows
              data-showcase-diagram
              theme="light"
              mode="view"
              label="${escapeHtml(label)}"
            ></lines-and-arrows>
          </div>
          <div
            class="showcase-source-editor"
            data-showcase-source-pane
            hidden
          >
            <label for="${id}-source">Diagram source</label>
            <textarea
              id="${id}-source"
              data-showcase-source
              spellcheck="false"
              aria-describedby="${id}-error"
            >${escapeHtml(source)}</textarea>
            <div class="showcase-source-actions">
              <button type="button" data-apply-showcase-source>
                Apply source
              </button>
            </div>
          </div>
          <p
            class="showcase-error"
            id="${id}-error"
            data-showcase-error
            role="alert"
            aria-live="polite"
          ></p>
          <p
            class="visually-hidden"
            data-showcase-status
            aria-live="polite"
          >
            View mode. Read-only diagram.
          </p>
        </figure>
      </section>`;

document
  .querySelector("[data-showcase]")
  ?.insertAdjacentHTML(
    "beforebegin",
    technicalShowcases.map(renderShowcase).join(""),
  );

document.body.classList.remove("is-loading");

const theme = initializeSiteTheme();

const braidedShowcase = document.querySelector("[data-braided-showcase]");
if (braidedShowcase) {
  const diagram = braidedShowcase.querySelector("#braided-ancestry-diagram");
  const diagramPane = braidedShowcase.querySelector(
    "[data-braided-diagram-pane]",
  );
  const closeButton = braidedShowcase.querySelector("[data-braided-close]");
  const media = braidedShowcase.querySelector("[data-braided-media]");
  const title = braidedShowcase.querySelector("[data-braided-title]");
  const story = braidedShowcase.querySelector("[data-braided-story]");
  const sources = braidedShowcase.querySelector("[data-braided-sources]");
  const sourcePane = braidedShowcase.querySelector(
    "[data-braided-source-pane]",
  );
  const sourceInput = braidedShowcase.querySelector("[data-braided-source]");
  const status = braidedShowcase.querySelector("[data-braided-status]");
  const surfaceButtons = [
    ...braidedShowcase.querySelectorAll("[data-braided-surface]"),
  ];
  const error = braidedShowcase.querySelector("[data-braided-error]");

  let activeDetailName = null;

  const themedDetailValue = (value, scheme) =>
    typeof value === "string" ? value : value[scheme] ?? value.light;

  const renderDetail = (name = activeDetailName) => {
    activeDetailName = Object.hasOwn(braidedDetails, name) ? name : null;
    const detail = braidedDetails[activeDetailName] ?? braidedDetails.general;
    const scheme = theme.theme === "dark" ? "dark" : "light";

    closeButton.hidden = activeDetailName === null;
    closeButton.setAttribute(
      "aria-label",
      activeDetailName
        ? `Close ${detail.title} details`
        : "Close species details",
    );

    const image = document.createElement("img");
    image.src = detail.images[scheme];
    image.alt = themedDetailValue(detail.alt, scheme);
    image.width = 768;
    image.height = 512;
    image.decoding = "async";
    image.style.objectPosition = detail.position;
    image.classList.toggle("is-contain", detail.fit === "contain");
    image.classList.toggle("is-zoomed", detail.zoom === true);
    media.replaceChildren(image);

    title.textContent = detail.title;
    story.replaceChildren();
    for (const paragraphText of detail.story) {
      const paragraph = document.createElement("p");
      paragraph.textContent = paragraphText;
      story.append(paragraph);
    }

    sources.replaceChildren(document.createTextNode("Further reading: "));
    const sourceLinks = document.createElement("span");
    appendLinks(sourceLinks, detail.sources);
    sources.append(sourceLinks);
  };

  diagram.branding = false;
  diagram.palette = {
    background: "var(--braided-paper)",
    foreground: "var(--braided-ink)",
    accent: "var(--braided-blue)",
    danger: "var(--braided-ochre)",
  };
  sourceInput.value = braidedSource;

  const setSurface = (surface) => {
    for (const button of surfaceButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.braidedSurface === surface),
      );
    }

    const showSource = surface === "source";
    diagramPane.hidden = showSource;
    sourcePane.hidden = !showSource;
    status.textContent = showSource
      ? "Source mode. Diagram source is read-only."
      : "View mode. Select an actor to see its evidence.";
    if (showSource) {
      sourceInput.focus();
    }
  };

  for (const button of surfaceButtons) {
    button.addEventListener("click", () => {
      setSurface(button.dataset.braidedSurface);
    });
  }

  for (const button of document.querySelectorAll("[data-site-theme]")) {
    button.addEventListener("click", () => {
      renderDetail(activeDetailName);
    });
  }

  renderDetail();

  try {
    diagram.source = braidedSource;
    diagramPane.classList.add("is-ready");
    diagram.addEventListener("la-actor-select", ({ detail }) => {
      renderDetail(detail?.name ?? null);
    });
    closeButton.addEventListener("click", () => {
      diagram.selectActor(null);
    });
  } catch (problem) {
    diagramPane.classList.add("is-failed");
    error.textContent =
      problem instanceof Error
        ? problem.message
        : "Unable to render braided ancestry.";
  }
}

const showcaseRenderers = new Map();
const showcaseObserver =
  typeof globalThis.IntersectionObserver === "function"
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) {
              continue;
            }

            showcaseRenderers.get(entry.target.id)?.();
          }
        },
        { rootMargin: "900px 0px" },
      )
    : null;

for (const showcase of document.querySelectorAll("[data-showcase]")) {
  const diagram = showcase.querySelector("[data-showcase-diagram]");
  const diagramPane = showcase.querySelector("[data-showcase-diagram-pane]");
  const sourcePane = showcase.querySelector("[data-showcase-source-pane]");
  const sourceInput = showcase.querySelector("[data-showcase-source]");
  const applySourceButton = showcase.querySelector(
    "[data-apply-showcase-source]",
  );
  const error = showcase.querySelector("[data-showcase-error]");
  const status = showcase.querySelector("[data-showcase-status]");
  const surfaceButtons = [
    ...showcase.querySelectorAll("[data-showcase-surface]"),
  ];
  const initialSource = sourceInput.value.trim();

  diagram.branding = false;
  diagram.theme = theme.theme;

  let rendered = false;

  const ensureRendered = () => {
    if (rendered) {
      return true;
    }

    try {
      diagram.source = initialSource;
      diagramPane.classList.add("is-ready");
      rendered = true;
      showcaseObserver?.unobserve(showcase);
      return true;
    } catch (problem) {
      diagramPane.classList.add("is-failed");
      error.textContent =
        problem instanceof Error
          ? problem.message
          : "Unable to render example.";
      return false;
    }
  };

  showcaseRenderers.set(showcase.id, ensureRendered);

  const setSurface = (surface) => {
    if (!ensureRendered()) {
      return;
    }

    for (const button of surfaceButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.showcaseSurface === surface),
      );
    }

    if (surface === "source") {
      diagram.mode = "edit";
      diagram.hidden = true;
      diagramPane.hidden = true;
      sourcePane.hidden = false;
      sourceInput.value = diagram.source;
      status.textContent =
        "Source mode. Apply with the button or Command-Enter.";
      sourceInput.focus();
      return;
    }

    sourcePane.hidden = true;
    diagramPane.hidden = false;
    diagram.hidden = false;
    diagram.mode = surface;
    status.textContent =
      surface === "edit"
        ? "Edit mode. Select an object to change it, then drag to reorder."
        : "View mode. Read-only diagram.";
  };

  for (const button of surfaceButtons) {
    button.addEventListener("click", () => {
      setSurface(button.dataset.showcaseSurface);
    });
  }

  const applySource = () => {
    if (!ensureRendered()) {
      return;
    }

    error.textContent = "";

    try {
      diagram.source = sourceInput.value;
      sourceInput.value = diagram.source;
    } catch (problem) {
      error.textContent =
        problem instanceof Error ? problem.message : "Unable to apply source.";
    }
  };

  applySourceButton.addEventListener("click", applySource);
  sourceInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      applySource();
    }
  });

  diagram.addEventListener("la-change", (event) => {
    sourceInput.value = event.detail.source;
    error.textContent = "";
  });

  diagram.addEventListener("la-error", (event) => {
    error.textContent =
      event.detail.error?.message ?? "Unable to apply source.";
  });

  if (showcaseObserver) {
    showcaseObserver.observe(showcase);
  } else {
    ensureRendered();
  }
}

const revealHashTarget = () => {
  let id = "";

  try {
    id = decodeURIComponent(globalThis.location.hash.slice(1));
  } catch {
    return;
  }

  const target = document.getElementById(id);
  if (!target?.matches("[data-showcase]")) {
    return;
  }

  showcaseRenderers.get(target.id)?.();
  const previousScrollBehavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = "auto";
  target.scrollIntoView({ block: "start" });
  document.documentElement.style.scrollBehavior = previousScrollBehavior;
};

globalThis.addEventListener("hashchange", revealHashTarget);
globalThis.requestAnimationFrame(revealHashTarget);
