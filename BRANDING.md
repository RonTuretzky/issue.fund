# issue.fund identity

issue.fund uses the [Decentral Park UI kit](https://github.com/decentralparknyc/decentralpark-ui-kit) at commit `7696b1b72460801ccc24abfa4e7d49c8abc72b9c`.

The selected identity is **Bounty Ticket**: a dark ticket with square perforated ends, a terminal `>_` prompt, and a bright green tab. It pairs with a condensed live-text wordmark in self-hosted Anton, giving the project the open-source hacker-zine character selected in logo option 3. The ticket is also the browser and home-screen icon. The asset and generation prompts are recorded in [the issue.fund brand directory](public/brand/issue-fund/README.md).

The wordmark uses an `issue.fund` glyph subset of [Anton](https://github.com/google/fonts/tree/main/ofl/anton), provided by Google Fonts and licensed under SIL OFL 1.1. Its license is bundled alongside the font; browsers load it from this site without contacting Google.

The **Decentral Park** name and official tree mark appear only in the footer; all navigation and protocol links are in the app and documentation.

The official tree mark and all six bundled WOFF2 files are copied without modification into `public/brand/decentralpark`. `src/brand.css` carries the kit's color tokens and self-hosted Park Display (Space Grotesk) and Park Body (Inter) font declarations. The application styles adapt its fund palette, bold uppercase headings, mint paper surfaces and square buttons with 4px grey shadows. Primary buttons use the kit's green-1 token for readable white labels at small sizes.

The npm package was unavailable when integrated. This is an explicitly scoped brand-asset integration, not a fork of the kit's component API or wallet providers. The upstream library remains unchanged. issue.fund retains its local and browser wallet implementations and its own accessible dialogs.

The upstream package identifies its license as P2P; its branding is not relicensed by this application. The font licenses are SIL Open Font License 1.1; copies are included beside the fonts. Source font projects: [Space Grotesk](https://github.com/floriankarsten/space-grotesk), [Inter](https://github.com/rsms/inter).
