# Prompt library

Templates follow the structure in SKILL.md. Replace angle-bracket fields and
keep the style block identical across a set. All subjects are original.

## Style blocks (pick one per set)

```text
Flat vector: flat vector illustration, clean geometric shapes, no gradients, 2px consistent stroke, palette <#hex1>, <#hex2>, <#hex3>, plenty of negative space.
Soft 3D: soft 3D render, rounded clay-like materials, subtle ambient occlusion, studio lighting from upper left, palette <#hex...>, pastel background.
Product photo: commercial product photography, 85mm lens, shallow depth of field, softbox key light with rim light, seamless <color> backdrop, natural reflections.
Pixel art: 32x32 pixel art sprite, limited 16-color palette <#hex...>, crisp pixel edges, no anti-aliasing, transparent background.
Painterly concept: digital painting, loose brushwork, strong silhouette, atmospheric perspective, muted palette with one accent color <#hex>.
```

Pixel-art and sprite prompts produce illustrations of sprites, not
engine-ready sprite sheets: expect to clean up, re-grid and re-palette them.

## App icon

```text
Subject: a single stylized <object/symbol> representing <app purpose>.
Composition: centered, the symbol fills about 75% of a square canvas, generous even margin.
Medium: <flat vector | soft 3D> icon.
Style block: <paste>.
Constraints: one symbol only, bold simple silhouette readable at 32 px, transparent background, no text, no letters, no drop shadow, no device mockup.
```

## Logo exploration (mark only)

```text
Subject: an abstract logo mark for "<company type>", suggesting <two qualities, e.g. speed and trust>.
Composition: centered mark on a plain white background, symmetric or balanced, large margin.
Medium: flat vector, solid fills, at most two colors (<#hex1>, <#hex2>).
Constraints: no text, no gradients, no photorealism, no existing brand symbols.
```

Generate 4 directions, pick one, then iterate on that image with edits.

## Hero or banner with space for a headline

```text
Subject: <scene>.
Composition: wide shot, subject on the right third, calm uncluttered left half for a headline, horizon low.
Lighting: <soft morning light | dramatic dusk backlight>.
Medium/lens: <style>.
Style block: <paste>.
Constraints: no text, no watermark, no logos.
```

## Video thumbnail background

```text
Subject: <single expressive object or original character> reacting to <topic cue>.
Composition: close-up, subject large on one side, high contrast against a simple background, room for 3-4 large words on the other side.
Lighting: punchy key light, saturated colors.
Constraints: no text, no real people, no brand logos.
```

Add the words later in `image-processing-canvas` so they are crisp and spelled correctly.

## Game concept art and assets

```text
Subject: <original creature/character/prop> for a <genre> game, <distinctive traits>.
Composition: full body, neutral three-quarter view, centered, plain light-gray background (turnaround: front, side, back in one row).
Medium: <painterly concept | soft 3D | pixel art>.
Style block: <paste>.
Constraints: original design, no resemblance to existing franchises, no text.
```

For environment tiles or textures, ask for "seamless tileable texture, top-down,
even lighting, no shadows from a single direction", then verify tiling by
offsetting the image by half its size.

## Editing instructions (Gemini image models)

```text
Keep everything identical except: replace the background with a plain <#hex> backdrop.
Keep the character, pose and lighting; change the outfit color to <#hex>.
Remove the object on the left table; fill with matching wall texture.
Extend the canvas to 16:9 by continuing the scenery on both sides.
Apply the style of the reference image to this photo; preserve the composition.
```

One change per instruction. If several changes are needed, chain them as
separate turns and keep the best intermediate.

## Iteration log template

```markdown
| # | Model | Prompt ID | Change from previous | Seed | Kept? | Notes |
| 1 | <id> | hero-v1 | baseline | - | no | subject too small |
| 2 | <id> | hero-v2 | medium shot, subject right third | - | yes | |
```
