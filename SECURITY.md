# Security

## Reporting a vulnerability

Please use GitHub's private **Report a vulnerability** form in the repository's
Security tab. Do not open a public issue for an undisclosed vulnerability.
Security fixes target the current minor release line.

## Trust boundaries

- Diagram text is parsed as data and rendered with SVG text nodes, not as HTML.
  It cannot define scripts, links, styles, or arbitrary resources.
- Applications accepting attacker-controlled diagrams should set source-size
  and item-count limits appropriate to their interface before parsing or
  rendering.
- Palette values are host-controlled configuration, not diagram syntax.
- Named icons use an exactly pinned Phosphor package from jsDelivr. Hosts can
  omit icons from source or block those image requests through Content Security
  Policy when remote images are unsuitable.
- The renderer creates style elements and inline SVG styles. A strict Content
  Security Policy must allow those styles; loading the CDN module additionally
  requires jsDelivr in `script-src`, and default icons require it in `img-src`.
