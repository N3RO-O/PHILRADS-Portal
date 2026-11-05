# PHILRADS Portal design rules

The portal is a work tool for relief and development staff, often on phones, outdoors and in a
hurry. It should feel calm, trustworthy and quick to read. Colour comes from the PHILRADS brand,
and emphasis is rationed so the things that matter stand out.

## Three colours

| Role | Colour | What it is for |
| --- | --- | --- |
| Neutral | Charcoal to Cloud (`page`, `surface`, `line`, `ink`) | Nearly everything: backgrounds, text, borders, icons. |
| Dominant | PHILRADS Burgundy (`burgundy`) | Who we are and where you are: the brand mark, the welcome band, the page you are on in the menu, the option you picked in a chip, tab or switch. |
| Accent | Uplifting Yellow (`uplift`) | What you can do: one filled primary button per view, links, the keyboard focus ring, and progress toward your own goals (level, task progress, today in a calendar). |

Nothing else gets the accent: not icons, headings, counts, badges or decorative tints. If an
element is not one of the things in the Accent row, it is neutral.

Burgundy is always a fill with Cloud text on it. It is never used as text on the dark background,
because it is too dark to read there.

## Status colours

Status colours describe state, nothing else, and always sit next to a word.

| Token | Colour | Means |
| --- | --- | --- |
| `status-in` | Green | Done, in stock, connected, live, approved, online |
| `status-low` | Amber | Needs attention soon: due soon, low stock, expiring, paused, away, offline |
| `status-out` | Red | Something is wrong or late: overdue, out of stock, expired, failed, high priority, busy |
| Neutral outline | `border-line text-ink-soft` | Waiting on someone else: pending, for review, scheduled, waiting to sync |

`rose`, `status-expiring` and `status-expired` are kept as names so older code still works, but
they resolve to the red and amber above.

Dots are only for a state that changes (presence, live location) and always come with a label.
Where nothing changes state, there is no dot.

Charts and the map may use the program colours to tell categories apart, always with a legend.

## Depth without effects

Dark mode gets its depth from three surface levels and from type, not from glows or blur.

1. `page`: the background.
2. `surface`: bounded objects you interact with (cards that open something, inputs, rows).
3. `surface-raised`: things that float over the page (menus, sheets, dialogs, toasts). These are
   the only things with a shadow, because the shadow tells you they sit on top.

No gradients, glass blur, glows, grain or ambient motion. Motion is allowed only when it answers
something the person did (opening a sheet, ticking a task, sliding the menu highlight) or shows a
live state (loading, sharing your location).

## Grouping

Content is grouped with whitespace, headings and a thin top rule (`.card`, which is now an
unboxed section). A box (`.panel`, `.tile`) is only for something you can press, drag or dismiss,
or something that floats.

## Icons

Lucide icons only, in the text colour around them.

| Where | Size |
| --- | --- |
| Badges and small meta lines | 14 px (`h-3.5 w-3.5`) |
| Next to body text, list rows | 16 px (`h-4 w-4`) |
| Buttons, menu items, icon buttons | 20 px (`h-5 w-5`) |
| Empty states and confirmations | 24 px (`h-6 w-6`) |

No emoji in the interface. They belong in what people write to each other (chat, notes), not in
labels, buttons or hints.

## Type

Montserrat for everything you read, Archivo Black for the few display numbers and page titles,
EB Garamond only for the verse of the day. Hierarchy comes from size and weight: section titles
are semibold Cloud, notes are muted, figures are large and tabular.

## Light and dark (2026-11-05)

- Colours are CSS variables (`src/index.css`, `:root` for dark, `:root[data-theme='light']` for light);
  `tailwind.config.js` reads them, so every `bg-surface`, `text-ink`, `border-line` follows the theme.
- People choose Dark, Light or Auto in Profile or the account menu (`src/lib/theme.ts`); `index.html`
  applies the choice before the page draws.
- Light is soft, not glaring: the page is a light grey, panels a step lighter, with a small shadow
  instead of a strong border. Text, accent text and status colours are deepened so each reads at
  4.5:1 or better on the page.
- A solid Uplift fill stays the bright brand orange with dark text (`text-onaccent`) in both themes.
- Overlays use `bg-ink/[…]` (light on dark, dark on light), never `bg-white/[…]`.
- SVG colours that follow the theme go in `style` (`style={{ stroke: 'rgb(var(--ink))' }}`), because
  CSS variables don't work in SVG attributes.

## Response to the user (gloss and sound)

- `.btn-primary` / `.premium`: a glossy Uplift gradient that lifts and shines on hover and sinks on
  press, with a ripple from the finger. Only for the main action of a view and floating buttons.
- `.gloss`: the same in burgundy, for the chosen item (nav pill, chosen chip, `ChoiceSwitch`).
- Choices that are on must be unmistakable: `ChoiceSwitch` fills the chosen option, with its icon and
  a bold label, and dims the rest.
- Sound: a soft "ti-ting" for new notifications and a low tone for errors, both synthesised (Web
  Audio) and both switchable in the account menu.
