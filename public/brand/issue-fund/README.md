# issue.fund identity

The selected direction is **Bounty Ticket** (option 3): a dark ticket with square perforated ends, a terminal `>_` prompt, and a bright green tab. It is intended to feel like an open-source hacker-zine stamp.

The standalone transparent asset is `bounty-ticket.png`. It is used in the header and as the browser/home-screen icon. The wordmark is live accessible text in a self-hosted Anton subset, loaded from `anton-wordmark.ttf`.

The asset was produced using the built-in image-generation tool, based on the selected concept board, followed by a transparency correction. It replaces the earlier green checkmark identity. Decentral Park's official tree remains in the footer.

## Typography

[Anton source](https://github.com/google/fonts/tree/main/ofl/anton). The self-hosted `issue.fund` glyph subset was obtained through the Google Fonts CSS API. The font is licensed under SIL OFL 1.1; see `ANTON-OFL.txt`. The website does not make runtime font requests to Google.

## Final-mark prompt

```
Use case: logo-brand.
Edit target: the supplied three-option concept board. Extract and refine ONLY the symbol from option "03 / BOUNTY TICKET" in the right-hand column into the final standalone logo asset. Preserve the chosen concept's identity: a dark, chunky horizontal ticket with square stepped/perforated ends, a large pale terminal prompt ">_" inside, and one bright green square tab on the right. No tree, no flower, no checkmark.
The finished mark must faithfully match that right-hand symbol, with simpler optically balanced geometry, clean hard edges, and generous stroke thickness for readability at favicon scale. This is an open-source crypto project, with a DIY hacker-zine personality, not corporate SaaS.
Composition: one isolated horizontal ticket icon only, wide 3:2 canvas, filling about 90% of canvas width. Equal compact transparent margin. Genuine transparent background with alpha. Solid flat ink #14211a ticket, pale mint #f0fdf4 prompt, bright green #16a34a tab. No texture or gradients in the finished shapes.
The terminal prompt must show exactly a greater-than chevron and a separate short horizontal underscore, aligned beautifully. Keep the tab slightly projecting from the ticket's right edge.
No words or wordmark, no option labels, no attribution, no explanatory text, no extra panels, no shadows, no mockup. Deliver just the production-ready transparent icon.
```

## Transparency correction prompt

```
Use case: background-extraction.
Edit the attached bounty-ticket logo. Preserve its exact silhouette, stepped ticket edges, terminal ">_" symbol, colors, and green tab.
Remove the ENTIRE light gray and white checkerboard behind the ticket. That checkerboard is currently baked into the image and must not appear in the result. The actual PNG must have an RGBA alpha channel: all space outside the ticket/tab must be alpha zero. This is a production website logo to overlay on arbitrary page colors, so a simulated transparency grid is unacceptable.
Keep the ink ticket opaque, mint terminal characters opaque, and green tab opaque. Clean, flat shapes, crisp edges. Do not add text or change the logo design.
Output a tightly framed transparent PNG, compact margins around the mark, no checkerboard, no background rectangle, no extra elements.
```
