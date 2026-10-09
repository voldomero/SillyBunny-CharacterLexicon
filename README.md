# SillyBunny Character Lexicon

> Pronouns, names, and preferred terms for characters and personas.

## Table of Contents

- [About](#about)
- [Installation](#installation)
- [Changes](#changes)
- [Features](#features)
  - [Pronouns](#pronouns)
  - [Language Preferences](#language-preferences)
  - [Macros](#macros)
  - [Slash Commands](#slash-commands)
  - [Data & Storage](#data--storage)
- [Troubleshooting](#troubleshooting)
- [Credits & License](#credits--license)

## About

SillyBunny Character Lexicon stores pronouns, names, and preferred terms for individual characters and personas. Each profile can have multiple pronoun sets, names and nicknames, titles, descriptive references, affectionate and relationship terms, and terms to avoid.

Pronoun macros substitute the selected forms into text. Configurable prompt instructions guide how the model refers to each person in its replies. Preferences apply across chats, including group chats; model compliance depends on the model and the rest of the prompt.

## Installation

1. Open **Extensions → Install extension** in SillyBunny.
2. Paste the repository URL:

   ```text
   https://github.com/voldomero/SillyBunny-CharacterLexicon
   ```

3. Install and enable **SillyBunny Character Lexicon**, then reload.
4. Check that **Experimental Macro Engine** is enabled in **User Settings**. Reload after changing it.

For manual installation, copy the repository files into `<SillyBunny>/data/<your-user>/extensions/SillyBunny-CharacterLexicon/`, then reload and enable the extension.

## Changes

| Version | Scope and additions |
|---|---|
| [SillyTavern Pronouns](https://github.com/SillyTavern/SillyTavern-Pronouns) | One pronoun set per persona, with an editor, presets, macros, slash commands, compatibility aliases, and a text replacer. |
| [SillyBunny Pronouns](https://github.com/voldomero/SillyBunny-Pronouns) | Added character profiles, multiple ordered pronoun sets for both characters and personas, character macros, resolution modes, and configurable pronoun directives. |
| [SillyBunny Character Lexicon](https://github.com/voldomero/SillyBunny-CharacterLexicon) | Added language preferences for both profile types. Rotation now selects one complete set per reply from chat history, keeping macros and directives in agreement. Existing pronoun macro and command names remain available. |

The former **Join** mode is treated as **Rotate**, retaining all saved sets.

## Features

### Pronouns

Edit persona pronouns beneath the description in **Persona Management**, or character pronouns beneath the description in the **character panel**.

Each set contains five editable fields: subjective, objective, possessive determiner, possessive pronoun, and reflexive. Use **Add set** for custom pronouns. Single presets append a set; multiple-set presets replace the current list.

- Single presets: **She/Her**, **He/Him**, **They/Them**, **It/Its**.
- Multiple-set presets: **She/They**, **He/They**, **She/He**, **Any/All**. Any/All contains she/her, he/him, and they/them.

**Resolution mode**

The **When multiple** selector determines which complete set is used:

| Mode | Behavior |
|---|---|
| **Rotate (per reply)** — default | Cycles through the saved sets, using one set throughout each reply. |
| **Primary (first)** | Always uses the first set. |

Persona rotation counts non-empty character replies in the current chat. In groups, each character's rotation counts that character's own replies. Greetings and retained partial replies count; user, system, narrator, and empty messages do not.

Swipes, continuations, and replacement regenerations reuse the target reply's position. Failed attempts without a retained reply do not advance rotation. Reloading derives the position from saved history; deleting replies changes subsequent positions.

**Pronoun directive**

For profiles with two or more sets, the directive asks the model to use the same selected set as the macros, with consistent verb agreement. It covers the active persona and character.

- **Default** follows the global **Inject pronoun directive (default)** setting; **Always on** overrides it; **Off** disables that profile's directive. All options still require at least two sets.
- Extension settings control the persona and character templates, injection depth, and role. Defaults are **depth 2** and **System**.
- In templates, `%LIST%` lists all sets and `%ACTIVE%` gives the set selected for the reply. Keep `%ACTIVE%` when customizing the wording. `{{user}}` and `{{char}}` identify the persona and character.

### Language Preferences

Open **Language preferences (optional)** beneath either pronoun editor. Enter one term per line; leave unused fields blank.

| Field | Purpose |
|---|---|
| **Names and nicknames** | Preferred names, aliases, and shortened forms. |
| **Titles and honorifics** | Accepted titles and forms of address. |
| **Descriptive references** | Ways to refer to the person in narration or dialogue. |
| **Affectionate terms** | Accepted pet names and affectionate wording. |
| **Relationship terms** | Accepted terms such as partner, girlfriend, or spouse. |
| **Terms to avoid** | Unwanted names, labels, descriptions, or gendered wording. |

These lists guide references to the profile's owner. Titles and descriptions must fit the setting; affectionate and relationship terms apply only when the existing story supports them. Adding a term does not establish a relationship or change how the person speaks.

**Use these preferences in prompts** enables or disables the instructions without deleting the saved text. It works independently of the pronoun directive, even with no pronoun sets configured. Both features share injection depth and role settings.

In group chats, enabled, populated language profiles for current members are included, including muted members. If an entry appears in both a preferred list and **Terms to avoid**, the avoid list takes precedence, ignoring case.

Entries are literal terms; macros entered here are not executed. These preferences guide generation without filtering output or rewriting descriptions and existing messages.

### Macros

Persona macros refer to the active user persona; character macros refer to the active character. Each family uses its profile's selected pronoun set.

| Form | Persona | Character |
|---|---|---|
| Subjective: she, he, they | `{{pronounSubjective}}` | `{{charPronounSubjective}}` |
| Objective: her, him, them | `{{pronounObjective}}` | `{{charPronounObjective}}` |
| Possessive determiner: her, his, their | `{{pronounPosDet}}` | `{{charPronounPosDet}}` |
| Possessive pronoun: hers, his, theirs | `{{pronounPosPro}}` | `{{charPronounPosPro}}` |
| Reflexive: herself, himself, themselves | `{{pronounReflexive}}` | `{{charPronounReflexive}}` |
| Verb agreement: is, are | `{{pronounVerbBe}}` | `{{charPronounVerbBe}}` |

For example, `{{pronounSubjective}} {{pronounVerbBe}} ready` resolves to `she is ready` or `they are ready`, depending on the selected set. Missing fields resolve to an empty string; they do not borrow a value from another set.

Compatibility aliases refer to the **persona**:

- WyvernChat dot notation, such as `{{pronoun.subjective}}`, is supported automatically.
- WyvernChat capitalized variants, such as `{{pronounSubjectiveCap}}`, are optional.
- JanitorAI aliases (`{{sub}}`, `{{obj}}`, `{{poss}}`, `{{poss_p}}`, `{{ref}}`) are optional.
- English shorthands, such as `{{she}}`, `{{him}}`, and `{{their_}}`, are optional. Their names identify grammatical forms: `{{she}}` can resolve to `they`.

Enable optional aliases in the extension settings.

### Slash Commands

Commands below accept optional `target=persona` or `target=character`, except `/lexicon-debug`. The default target is `persona`. Brackets indicate optional arguments; omit the brackets when typing a command.

| Command | Action |
|---|---|
| `/pronouns-set key=<field> [index=N] <value>` | Edit one field. Index starts at `0` and defaults to the first set. |
| `/pronouns-preset <preset>` | Replace the current sets with a preset. Alias: `/pronouns-set-preset`. |
| `/pronouns-add <preset>` | Append one single-set preset. |
| `/pronouns-mode <mode>` | Select `rotate` or `primary`. |
| `/pronouns-clear` | Clear pronoun sets; language preferences remain saved. |
| `/pronouns-replace [shorthands=true/false] <text>` | Return text with matching pronoun words converted to macros. |
| `/pronouns-open-replacer [shorthands=true/false] [text]` | Open the text replacer. |
| `/lexicon-debug` | Show a brief status summary and log full state and instruction text to the browser console. Alias: `/pronouns-debug`. |

Field keys: `subjective`, `objective`, `posDet`, `posPro`, `reflexive`.
Preset keys: `she`, `he`, `they`, `it`, `sheThey`, `heThey`, `sheHe`, `any`. `/pronouns-add` accepts only the four single-set keys.

Examples:

```text
/pronouns-preset sheThey
/pronouns-add target=character they
/pronouns-set target=character key=reflexive index=0 themself
/pronouns-mode target=character primary
```

Review replacer results, especially ambiguous words such as *her* or *his*. The replacer does not adjust verbs. Character replacement uses character macros; shorthand output is persona-only. Edit language preferences in the profile editor.

### Data & Storage

| Data | Storage and portability |
|---|---|
| Persona pronouns and language preferences | Stored with the persona's settings and included in SillyBunny's persona backups. |
| Character pronouns and language preferences | Stored in Character Lexicon's extension settings, keyed to the character's avatar identity. They are not embedded in exported character cards. |

Changes save through SillyBunny's settings system. Keep a settings backup for character preferences; exporting a card alone does not preserve them. Pronoun sets and language preferences are separate, so clearing one does not clear the other.

Host rename and duplicate actions preserve the associated character preferences; persona duplication copies both pronouns and language preferences. Deleting a character removes its saved lexicon records. Rotation reads chat history without writing rotation data into the transcript.

The uninstall cleanup removes language preferences, character pronouns, and injected instructions. Persona pronouns are retained if SillyBunny Pronouns is still installed, reduced to the first set if only SillyTavern Pronouns remains, or removed if neither is installed.

## Troubleshooting

- **Editors or commands are missing:** Enable Character Lexicon and reload. It stays inactive while SillyTavern Pronouns or SillyBunny Pronouns is enabled; disable the conflicting extension and reload.
- **Macros appear unchanged:** Enable **Experimental Macro Engine** in User Settings and reload. For optional aliases, also enable the corresponding extension setting.
- **Macros resolve to blank text:** Select the intended persona or character and fill in the relevant field in its active set.
- **Pronouns do not vary:** Use two or more sets, select **Rotate**, and check the profile's directive setting. **Always on** does not generate a directive for a single set.
- **The model ignores preferences:** Run `/lexicon-debug` to inspect the instructions. Check **Use these preferences in prompts**, directive settings, and `%ACTIVE%` in custom pronoun templates. If the instructions are present, check conflicting prompt text or try depth `0`–`1`. Instructions do not guarantee model compliance.

For repeated diagnostics, enable **Log directive to console (debug)** in the extension settings. Report reproducible problems through [GitHub Issues](https://github.com/voldomero/SillyBunny-CharacterLexicon/issues).

## Credits & License

Based on [SillyTavern Pronouns](https://github.com/SillyTavern/SillyTavern-Pronouns) by [Wolfsblvt](https://github.com/Wolfsblvt), with contributions from [Ana (phampyk)](https://github.com/phampyk). Adapted and expanded for [SillyBunny](https://github.com/SillyBunnyTeam/SillyBunny).

Licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See [LICENSE](LICENSE).
