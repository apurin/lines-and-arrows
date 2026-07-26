import {
  defineLinesAndArrows,
  parse,
  phosphorIconCatalog,
  phosphorIconResolver,
} from "../src/index.js";

defineLinesAndArrows();

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
  tag rollout
  tooltip Orchestrates flags and migration steps across releases
  tooltip-icon git-branch
@Application
  icon app-window
  tag mixed versions
@Database
  icon database
  tag shared schema
@Backfill Worker
  icon arrows-clockwise
@Telemetry
  icon pulse
  tag error budget

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
      tag protect the SLO
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
  tag client
@Order Service
  icon receipt
  tag orchestrator
  tooltip Owns the saga state without sharing a database
  tooltip-icon flow-arrow
@Payment Service
  icon credit-card
@Inventory Service
  icon warehouse
@Delivery Service
  icon truck

Storefront -> Order Service: Place order
  tag command
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
  tag source
@Event Stream
  icon queue
  tooltip Partitioned by account to preserve local ordering
  tooltip-icon info
@Window Processor
  icon funnel
  tag stateful
@Risk Model
  icon gauge
@Risk Desk
  icon shield-warning

Payment Edge -> Event Stream: Publish payment
  tag event
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
  tag drafts only
  tooltip Builds claims from retrieved evidence but cannot approve action
  tooltip-icon shield-check
@Search Index
  icon magnifying-glass
@Source Documents
  icon books
@Human Reviewer
  icon user-check
  tag accountable

Engineer -> Research Agent: Investigate the failed deployment
Research Agent -> Search Index: Query errors and change history
parallel Gather grounded context
  Search Index --> Research Agent: Return relevant records
  Research Agent -> Source Documents: Open exact passages
  Source Documents --> Research Agent: Return versioned evidence
Research Agent -> Research Agent: Draft a diagnosis with citations
Research Agent -> Human Reviewer: Propose cause and rollback
  tag evidence packet
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
  tag price discovery
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
      tag single print
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
              class="hero-segmented showcase-mode-switcher"
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
              selectable="false"
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
              wrap="off"
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

const root = document.documentElement;
const themeButtons = [...document.querySelectorAll("[data-site-theme]")];
const diagrams = [...document.querySelectorAll("[data-showcase-diagram]")];
const showcaseLayout = {
  actorHeight: 48,
  actorGap: 82,
  marginX: 42,
  marginTop: 26,
  timelineTopGap: 28,
  messageHeight: 54,
  gapHeight: 58,
  groupHeaderHeight: 28,
  sectionHeaderHeight: 25,
  groupPaddingBottom: 12,
  groupGap: 10,
  bottomPadding: 28,
};

const readSavedTheme = () => {
  try {
    const saved = localStorage.getItem("lines-and-arrows-theme");
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
};

const systemTheme = matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";
let activeTheme = readSavedTheme() ?? systemTheme;

const applyTheme = (theme, persist = false) => {
  activeTheme = theme === "dark" ? "dark" : "light";
  root.dataset.theme = activeTheme;

  for (const diagram of diagrams) {
    diagram.theme = activeTheme;
  }

  for (const button of themeButtons) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.siteTheme === activeTheme),
    );
  }

  if (persist) {
    try {
      localStorage.setItem("lines-and-arrows-theme", activeTheme);
    } catch {
      // The theme still applies when storage is unavailable.
    }
  }
};

for (const button of themeButtons) {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.siteTheme, true);
  });
}

applyTheme(activeTheme);

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

  diagram.iconResolver = phosphorIconResolver;
  diagram.iconCatalog = phosphorIconCatalog;
  diagram.layout = showcaseLayout;
  diagram.theme = activeTheme;

  const setSurface = (surface) => {
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
    diagram.selectable = surface === "edit";
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
    error.textContent = "";

    try {
      const result = diagram.replaceSource(sourceInput.value);
      if (result !== null && result !== false) {
        sourceInput.value = diagram.source;
      }
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

  try {
    parse(initialSource);
    diagram.source = initialSource;
    setSurface("view");
    diagramPane.classList.add("is-ready");
  } catch (problem) {
    error.textContent =
      problem instanceof Error ? problem.message : "Unable to render example.";
  }

  diagram.addEventListener("la-change", (event) => {
    sourceInput.value = event.detail.source;
    error.textContent = "";
  });

  diagram.addEventListener("la-error", (event) => {
    error.textContent =
      event.detail.error?.message ?? "Unable to apply source.";
  });
}
