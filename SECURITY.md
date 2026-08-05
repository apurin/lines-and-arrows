# Security

## Reporting a vulnerability

Please use GitHub's private **Report a vulnerability** form in the repository's
Security tab. Do not open a public issue for an undisclosed vulnerability.
Security fixes target the current minor release line.

## Trust boundaries

- Diagram text is parsed as data and rendered with SVG text nodes, not as HTML.
  It cannot define scripts, links, styles, or arbitrary resources.
- Parsing rejects indentation deeper than 128 levels. Applications accepting
  attacker-controlled diagrams should also set a source-size limit before
  parsing and an item-count limit before rendering; 1 MiB and 10,000 timeline
  items are conservative starting points for an interactive page.
- Palettes, layout options, and custom icon resolvers are host-controlled
  configuration, not diagram syntax. Do not pass untrusted resolver code or
  unreviewed external resource URLs.
- The default Phosphor icon resolver fetches used icons from an exactly pinned
  jsDelivr package. Set `iconResolver` to `null` or provide same-origin URLs for
  offline or privacy-sensitive use.
- The renderer creates style elements and inline SVG styles. A strict Content
  Security Policy must allow those styles; loading the CDN module additionally
  requires jsDelivr in `script-src`, and default icons require it in `img-src`.
