# SillyBunny Character Lexicon

Pronouns, names, and preferred terms for characters and personas.

**Pre-release: v0.1.0-pre.1**

Optional language preferences also guide the names, titles, descriptions, and other
terms used for each persona or character across chats.

LLMs tend to collapse "she/they" down to just "she" and refer to the persona only
one way. This extension fixes that two ways at once:

1. **An ordered list of pronoun sets** per persona/character (instead of a single set),
   with macros that use one complete set per reply and rotate between replies.
2. **An injected directive** — when an entity has two or more sets, a short system
   instruction is added telling the model to alternate between them. This is the part
   that makes the model itself use varied pronouns in its own writing.

Ported from and inspired by the [SillyTavern-Pronouns](https://github.com/SillyTavern/SillyTavern-Pronouns)
extension by [Wolfsblvt](https://github.com/Wolfsblvt) and [Ana](https://github.com/phampyk).

## Installation

Install using SillyBunny's extension installer from the URL:

```txt
https://github.com/voldomero/SillyBunny-CharacterLexicon
```

Or copy the release files into a folder in your SillyBunny third-party extensions
directory, for example:

```
<SillyBunny>/data/<your-user>/extensions/SillyBunny-CharacterLexicon/
```

Then enable **SillyBunny Character Lexicon** in the Extensions panel. Requires the macro
engine, which is enabled by default in SillyBunny.

The extension resolves its settings template and manifest from its installed folder;
the folder does not have to match the repository name.

### Upgrading from the pronouns extension

Disable the previous pronouns extension and reload before enabling Character Lexicon.
Keep only one enabled because both provide the same pronoun macros and commands.
Do not use the old extension's data-cleanup option when switching: persona pronouns
are shared profile data.

On first use, Character Lexicon copies the previous extension's saved settings if it
does not already have its own. This includes character pronouns, language preferences,
and custom directive templates. The original settings copy is preserved; subsequent
changes are saved separately. Existing Character Lexicon settings always take precedence.
The previous extension and its folder are not needed for this import or for fresh installs.

## How it works

### Multiple pronoun sets

Each persona and character holds a list of pronoun sets. Add one set for a single
pronoun, or several for multiple pronouns:

- `she/her`
- `she/her` + `they/them` → **she/they**
- `she/her` + `he/him` + `they/them` → **any/all**

Use the editor under the **persona description** (Persona Management) and under the
**character description** (character panel). Quick buttons append single presets
(She/Her, He/Him, …) or replace everything with a multi preset (She/They, He/They, Any/All).

### Resolution mode

When an entity has 2+ sets, the **When multiple** selector controls both macros and the
active set supplied to the model instruction:

| Mode | Behavior | Example output |
|---|---|---|
| **Rotate** (default) | One complete set per reply, cycling through the list | "She grabbed her bag." → "They grabbed their bag." |
| **Primary** | Always the first set | "She grabbed her bag." |

Older Join selections are treated as Rotate; every saved pronoun set is retained.

Rotation follows existing, non-empty character replies in the current chat, including
greetings and retained partial replies. Persona pronouns rotate across all such replies;
in groups, each character's own pronouns rotate across that character's replies, matched
by avatar identity. User messages, system messages, narrator messages, and empty
placeholders do not count. No rotation data is written into the transcript.

Repeated generation calls and failed attempts without a retained reply do not advance
rotation. Swipes, continuations, and replacement regenerations reuse the target reply's
position. Reloading derives the position from saved history; deleting replies changes
the subsequent position. Preview, background, and impersonation calls do not consume turns.

### The directive

This is the lever that makes NPCs actually refer to you with varied pronouns.
When an entity has 2+ sets, a system instruction is injected and **refreshed before
each visible reply**, selecting the same complete set as the macros:

> *[Pronoun instruction: {{user}} uses multiple pronoun sets — she/her and they/them.
> In your next reply, refer to {{user}} using **they/them** pronouns specifically.
> Use that set consistently throughout this reply, with matching verb agreement.
> Every listed set is equally correct and in-character.]*

The per-turn command (`%ACTIVE%`) is deliberately forceful: a soft "alternate naturally"
note gets ignored when the description and history are saturated with one pronoun, so
instead each reply is told exactly which set to use. Rotate cycles through the sets;
Primary keeps the first set. Model compliance still depends on the model and the rest
of the prompt.

Template placeholders: `%LIST%` = all sets ("she/her and they/them"); `%ACTIVE%` = this
turn's rotated set ("they/them"). It's toggleable globally (Extensions → SillyBunny
Character Lexicon settings), per-entity (the **Directive** selector: Default / Always on / Off),
and the wording, injection depth (default 2), and role are all configurable.
Custom templates are preserved; keep `%ACTIVE%` in them to communicate the selected set.
Only unchanged templates from the previous release are updated automatically.

### Language preferences

Open **Language preferences (optional)** beneath either pronoun editor. The section
starts closed and provides six optional fields, with one term per line:

- **Names and nicknames** — preferred names, aliases, and shortened forms.
- **Titles and honorifics** — accepted titles and forms of address.
- **Descriptive references** — ways to refer to the person in narration or dialogue.
- **Affectionate terms** — accepted pet names and affectionate wording.
- **Relationship terms** — accepted wording such as partner, girlfriend, or spouse.
- **Terms to avoid** — unwanted names, labels, descriptions, or gendered wording.

These preferences describe how to refer to the profile's owner. They apply across
chats using that persona or character. In a group, populated profiles for the current
members are included so other speakers can use their preferred terms too.

Titles and descriptions must fit the established setting and facts. Affectionate and
relationship terms apply only when the story already supports them; listing a term
does not create intimacy or a relationship. Specific relationship details belong in
character profiles or lorebooks.

Blank fields add no prompt text. Switch off **Use these preferences in prompts** to
stop using them while retaining the text. This switch is separate from the pronoun
directive, and language preferences also work with no pronoun sets configured.
Prompt depth and role are shared with the pronoun settings.

If the same term appears in both a preferred list and Terms to avoid, the avoid list
takes precedence, ignoring letter case. Entries are treated as literal terms, not
executable macros. These are model instructions, not an output filter; they do not
edit descriptions or existing chat messages.

### Troubleshooting

If the model still won't vary pronouns, run **`/lexicon-debug`** (or enable
*Log directive to console* in settings). It reports, per entity: how many sets are
stored, whether the pronoun directive will inject, the language instructions, and the
exact text being sent. If the pronoun information shows
`0 set(s)` or `inject=false`, the data/toggle didn't take; if it shows the text but the
model ignores it, lower the injection depth toward 0–1.

## Macros

Persona (the user) and character (the bot) each get their own family. All resolve
through the entity's mode (rotate/primary). All fields and verb agreement use the same
set for a reply, regardless of spacing or macro position. An unfilled field resolves to
an empty string rather than borrowing a word from a different set.

| Persona | Character | Pronoun type | Examples |
|---|---|---|---|
| `{{pronounSubjective}}` | `{{charPronounSubjective}}` | Subjective | she / he / they |
| `{{pronounObjective}}` | `{{charPronounObjective}}` | Objective | her / him / them |
| `{{pronounPosDet}}` | `{{charPronounPosDet}}` | Possessive determiner | her / his / their |
| `{{pronounPosPro}}` | `{{charPronounPosPro}}` | Possessive pronoun | hers / his / theirs |
| `{{pronounReflexive}}` | `{{charPronounReflexive}}` | Reflexive | herself / themselves |
| `{{pronounVerbBe}}` | `{{charPronounVerbBe}}` | Verb-be agreement | is / are |

**Compatibility (opt-in, persona-mapped):**

- WyvernChat dot-notation (`{{pronoun.subjective}}` …) is rewritten automatically.
- WyvernChat capitalized variants (`{{pronounSubjectiveCap}}` …) — toggle.
- JanitorAI (`{{sub}}`, `{{obj}}`, `{{poss}}`, `{{poss_p}}`, `{{ref}}`) — toggle.
- English shorthands (`{{she}}`, `{{him}}`, `{{their_}}` …) — toggle.

## Slash commands

| Command | Description |
|---|---|
| `/pronouns-set key=<key> [target=persona\|character] [index=N] <value>` | Set one field of set `N`. |
| `/pronouns-preset [target=…] <preset>` | Replace all sets with a preset (`she`/`he`/`they`/`it` or `sheThey`/`heThey`/`sheHe`/`any`). |
| `/pronouns-add [target=…] <preset>` | Append a single preset set. |
| `/pronouns-mode [target=…] <rotate\|primary>` | Set the resolution mode. |
| `/pronouns-clear [target=…]` | Remove all sets. |
| `/pronouns-replace [target=…] [shorthands=…] <text>` | Replace pronoun words in text with macros. |
| `/pronouns-open-replacer [target=…] [shorthands=…] [text]` | Open the replacer popup. |
| `/lexicon-debug` | Show current pronouns, language preferences, and injected instructions. `/pronouns-debug` remains an alias. |

Pronoun-editing commands and macros keep their established names so existing cards
and scripts continue to work.

## Data & storage

- **Persona** pronouns are stored on the persona descriptor (alongside the description),
  so they survive exports and backups. Old single-set data from the original extension
  is migrated in place.
- **Character** pronouns are stored in this extension's settings (keyed by the character's
  avatar), so chatting with a card never modifies the card file.
- **Persona language preferences** live alongside the persona description and are
  included in the host's persona backups. They are separate from pronouns, so changing
  or clearing pronoun sets does not remove them.
- **Character language preferences** live in the extension settings, keyed by the
  complete avatar reference. Existing pronoun record keys stay unchanged.
  These preferences do not modify or become part of the exported character card.

The data-cleanup hook removes Character Lexicon's pronouns and language preferences
and clears its prompt instructions. Any original settings backup is retained. If a
backup exists, an empty Character Lexicon settings record prevents reinstalling from
silently importing preferences that were cleared.


## License

AGPL-3.0 — see [LICENSE](LICENSE). Based on [SillyTavern-Pronouns](https://github.com/SillyTavern/SillyTavern-Pronouns).
