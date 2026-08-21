import "./runtime.js?v=20260821-1";
import { initializeSiteTheme } from "./site.js?v=20260806-2";

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
  },
};

const theme = initializeSiteTheme();

const braidedShowcase = document.querySelector("[data-braided-showcase]");
if (braidedShowcase) {
  const diagram = braidedShowcase.querySelector("#braided-ancestry-diagram");
  const closeButton = braidedShowcase.querySelector("[data-braided-close]");
  const media = braidedShowcase.querySelector("[data-braided-media]");
  const mediaImage = media.querySelector("img");
  const title = braidedShowcase.querySelector("[data-braided-title]");
  const story = braidedShowcase.querySelector("[data-braided-story]");
  const storyParagraphs = [...story.children];
  const sources = braidedShowcase.querySelector("[data-braided-sources]");
  const sourceItems = [
    ...sources.querySelectorAll("[data-braided-source-item]"),
  ];

  let activeDetailName = null;

  const themedDetailValue = (value, scheme) =>
    typeof value === "string" ? value : value[scheme] ?? value.light;

  const updateMedia = (detail, scheme) => {
    const src = detail.images[scheme] ?? detail.images.light;
    mediaImage.src = src;
    mediaImage.alt = themedDetailValue(detail.alt, scheme);
  };

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

    updateMedia(detail, scheme);

    title.textContent = detail.title;
    for (const [index, paragraph] of storyParagraphs.entries()) {
      paragraph.textContent = detail.story[index] ?? "";
      paragraph.hidden = index >= detail.story.length;
    }

    for (const [index, item] of sourceItems.entries()) {
      const source = detail.sources[index];
      item.hidden = source === undefined;
      if (source) {
        const [label, url] = source;
        const link = item.querySelector("a");
        link.href = url;
        link.textContent = label;
      }
    }
  };

  diagram.palette = {
    background: "var(--braided-paper)",
    foreground: "var(--braided-ink)",
    accent: "var(--braided-blue)",
    danger: "var(--braided-ochre)",
  };

  for (const button of document.querySelectorAll("[data-site-theme]")) {
    button.addEventListener("click", () => {
      renderDetail(activeDetailName);
    });
  }

  renderDetail();

  diagram.addEventListener("la-actor-select", ({ detail }) => {
    renderDetail(detail?.name ?? null);
  });
  closeButton.addEventListener("click", () => {
    diagram.selectActor(null);
  });
}
