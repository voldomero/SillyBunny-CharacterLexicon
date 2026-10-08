/**
 * Pronoun replacer: converts direct pronoun words in text into macros, and the
 * replacer popup UI.
 *
 * With multiple sets, every word across every set maps to the same per-field macro
 * (e.g. both "she" and "they" -> {{pronounSubjective}}), so the rotating macro then
 * varies them naturally at render time.
 */

import { t } from '../../../../../scripts/i18n.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../../../scripts/popup.js';
import { escapeHtml } from '../../../../utils.js';
import {
    getContainer,
    pronounsSettings,
    shorthandAliases,
} from './pronouns.js';

/** Disambiguation precedence: a word that fits several fields maps to the earliest here. */
const PRECEDENCE = Object.freeze(['reflexive', 'posPro', 'objective', 'posDet', 'subjective']);

/**
 * Words that commonly follow an object pronoun ("told her that", "gave him a"); an ambiguous
 * her/his/its directly before one of these is not read as a determiner.
 */
const NOT_A_DETERMINER_BEFORE = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'so', 'yet', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with',
    'from', 'into', 'onto', 'about', 'over', 'under', 'after', 'before', 'until', 'since', 'while', 'when',
    'if', 'that', 'this', 'these', 'those', 'as', 'than', 'then', 'there', 'here', 'too', 'very', 'also',
    'again', 'away', 'back', 'down', 'up', 'out', 'off', 'not', 'no', 'what', 'who', 'whom', 'which', 'how',
    'why', 'where', 'because', 'though', 'although', 'whether', 'do', 'does', 'did', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should', 'may',
    'might', 'must', 'go', 'come', 'like', 'well', 'now', 'just', 'even', 'only', 'still', 'already', 'once',
    'all', 'both', 'each', 'every', 'some', 'any', 'more', 'most', 'much', 'many', 'something', 'anything',
    'nothing', 'everything', 'someone', 'anyone', 'everyone', 'he', 'she', 'it', 'they', 'we', 'you', 'i',
    'him', 'them', 'us', 'me', 'her', 'his', 'its', 'their', 'my', 'your', 'our',
]);

/** Clause openers after which a bare "it" is read as the subject rather than the object. */
const SUBJECT_AFTER = new Set([
    'and', 'but', 'or', 'nor', 'so', 'yet', 'that', 'when', 'if', 'because', 'while', 'as', 'then', 'until',
    'though', 'although', 'since', 'where', 'which', 'whether', 'unless', 'think', 'thought', 'know', 'knew',
    'said', 'say', 'says', 'hope', 'wish', 'believe', 'guess', 'sure', 'maybe', 'perhaps', 'now', 'there', 'here',
]);

const WORD = String.raw`[\p{L}\p{N}'\u2019-]+`;
const nextWordRe = new RegExp(String.raw`^\s+(${WORD})`, 'u');
const prevWordRe = new RegExp(String.raw`(${WORD})\s+$`, 'u');
const openerRe = /(?:^|[.!?;:()[\]"\u201c\u201d\u2014-])\s*$/u;

/** @param {string} text @param {number} end End offset of the matched word */
function readsAsDeterminer(text, end) {
    const next = nextWordRe.exec(text.slice(end));
    return Boolean(next) && !NOT_A_DETERMINER_BEFORE.has(next[1].toLowerCase());
}

/** @param {string} text @param {number} start Start offset of the matched word */
function readsAsSubject(text, start) {
    const before = text.slice(0, start);
    if (openerRe.test(before)) return true;
    const prev = prevWordRe.exec(before);
    return Boolean(prev) && SUBJECT_AFTER.has(prev[1].toLowerCase());
}

/**
 * Picks the field an ambiguous word stands for at this position: her/his/its before a noun is
 * a determiner, "it" opening a clause is the subject; otherwise the precedence order decides.
 * @param {Map<string, string>} byKey key -> macro token, in precedence order
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @returns {string}
 */
function pickField(byKey, text, start, end) {
    const first = byKey.keys().next().value;
    if (byKey.size < 2) return first;
    if (byKey.has('posDet') && readsAsDeterminer(text, end)) return 'posDet';
    if (byKey.has('subjective') && byKey.has('objective') && readsAsSubject(text, start)) return 'subjective';
    return first;
}

const PRIMARY_MACRO = Object.freeze({
    persona: {
        subjective: 'pronounSubjective',
        objective: 'pronounObjective',
        posDet: 'pronounPosDet',
        posPro: 'pronounPosPro',
        reflexive: 'pronounReflexive',
    },
    character: {
        subjective: 'charPronounSubjective',
        objective: 'charPronounObjective',
        posDet: 'charPronounPosDet',
        posPro: 'charPronounPosPro',
        reflexive: 'charPronounReflexive',
    },
});

/**
 * @param {string} str
 * @returns {string}
 */
function escapeForRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {'subjective'|'objective'|'posDet'|'posPro'|'reflexive'} key
 * @param {'persona'|'character'} entity
 * @returns {string}
 */
function getPrimaryMacroName(key, entity) {
    const map = PRIMARY_MACRO[entity] ?? PRIMARY_MACRO.persona;
    return map[key] ?? map.subjective;
}

/**
 * Selects the shorthand alias matching a value for a key (persona only), or null.
 * @param {'subjective'|'objective'|'posDet'|'posPro'|'reflexive'} pronounKey
 * @param {string} value
 * @returns {string|null}
 */
function pickShorthandAlias(pronounKey, value) {
    const group = shorthandAliases.find(a => a.pronounKey === pronounKey);
    if (!group) return null;
    const lower = String(value || '').toLowerCase();
    return group.names.find(name => name.replace(/_$/, '').toLowerCase() === lower) ?? null;
}

/**
 * Builds, for every distinct lowercase word across a container's sets, the fields it can stand
 * for (e.g. "her" -> objective and posDet) and the macro token for each, in precedence order.
 * @param {import('./pronouns.js').PronounContainer} container
 * @param {{ useShorthands?: boolean, entity?: 'persona'|'character' }} [options]
 * @returns {Map<string, Map<string, string>>} word -> (key -> macro token)
 */
function buildWordMacroMap(container, { useShorthands = false, entity = 'persona' } = {}) {
    /** @type {Map<string, Map<string, string>>} */
    const map = new Map();
    for (const key of PRECEDENCE) {
        for (const set of container?.sets ?? []) {
            const value = String(set[key] ?? '').trim();
            if (!value) continue;
            const lower = value.toLowerCase();
            const byKey = map.get(lower) ?? new Map();
            if (byKey.has(key)) continue;

            let macroName = getPrimaryMacroName(key, entity);
            if (useShorthands && entity === 'persona') {
                const alias = pickShorthandAlias(key, value);
                if (alias) macroName = alias;
            }
            byKey.set(key, `{{${macroName}}}`);
            map.set(lower, byKey);
        }
    }
    return map;
}

/**
 * Converts direct pronoun words in `text` into macros for an entity.
 * @param {string} text
 * @param {Object} [options]
 * @param {boolean} [options.useShorthands=false]
 * @param {'persona'|'character'} [options.entity='persona']
 * @param {import('./pronouns.js').PronounContainer} [options.container=null] - Override container.
 * @returns {string}
 */
export function replacePronounsWithMacros(text, { useShorthands = false, entity = 'persona', container = null } = {}) {
    if (!text) return '';

    const c = container ?? getContainer(entity);
    if (!c || (c.sets?.length ?? 0) === 0) {
        toastr.warning(container
            ? t`No pronoun values provided. Cannot replace.`
            : t`No pronouns are set for the active ${entity}. Set them first to enable replacement.`);
        return text;
    }

    const wordMacro = buildWordMacroMap(c, { useShorthands, entity });
    if (wordMacro.size === 0) return text;

    const alternation = Array.from(wordMacro.keys()).map(escapeForRegex).join('|');
    if (!alternation) return text;
    const re = new RegExp(`\\b(${alternation})\\b`, 'gi');
    return text.replace(re, (m, _word, offset) => {
        const byKey = wordMacro.get(m.toLowerCase());
        if (!byKey) return m;
        return byKey.get(pickField(byKey, text, offset, offset + m.length)) || m;
    });
}

// ---------------------------------------------------------------------------
// Replacer popup
// ---------------------------------------------------------------------------

/** @returns {Promise<string|null>} */
async function tryReadClipboardText() {
    try {
        if (navigator?.clipboard?.readText) {
            const txt = await navigator.clipboard.readText();
            return typeof txt === 'string' && txt.length > 0 ? txt : null;
        }
    } catch { /* ignore */ }
    return null;
}

/**
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text) {
    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch { /* ignore */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    } catch {
        return false;
    }
}

/**
 * Opens the pronoun replacer popup for an entity (defaults to the active persona).
 * @param {string|null} [initialText=null]
 * @param {Object} [options]
 * @param {boolean} [options.defaultUseShorthands=true]
 * @param {'persona'|'character'} [options.entity='persona']
 * @returns {Promise<string>}
 */
export async function openPronounReplacePopup(initialText = null, { defaultUseShorthands = true, entity = 'persona' } = {}) {
    const shorthandsGloballyEnabled = pronounsSettings.shorthands && entity === 'persona';

    const container = getContainer(entity);
    if (!container || (container.sets?.length ?? 0) === 0) {
        toastr.warning(t`No pronouns are set for the active ${entity}. Set them first to enable the replacer.`);
        return '';
    }

    /** @type {Popup|null} */
    let popup = null;

    /** @returns {HTMLInputElement|null} */
    function getShorthandsCheckbox() {
        const el = popup?.dlg?.querySelector('#pronouns_replace_use_shorthands');
        return el instanceof HTMLInputElement ? el : null;
    }

    /** @returns {string} */
    function buildTable() {
        const useShorthands = shorthandsGloballyEnabled && (getShorthandsCheckbox()?.checked ?? defaultUseShorthands);
        const wordMacro = buildWordMacroMap(container, { useShorthands, entity });
        if (wordMacro.size === 0) return '';
        return Array.from(wordMacro.entries())
            .map(([word, byKey]) => `<tr><td>${escapeHtml(word)}</td><td>→</td><td>${escapeHtml(Array.from(byKey.values()).join(' / '))}</td></tr>`)
            .join('');
    }

    const content = `
        <h3>${t`Pronoun Replacer`}</h3>
        <p>${t`Converts direct pronoun words into macros for the active ${entity}. All macros use the same pronoun set for each reply.`}</p>
        <table class="pronoun-replacer-table">
            <thead><tr><th>${t`Word`}</th><th></th><th>${t`Macro`}</th></tr></thead>
            <tbody>${buildTable()}</tbody>
        </table>
    `;

    popup = new Popup(content, POPUP_TYPE.INPUT, String(initialText ?? ''), {
        okButton: t`Convert & Copy`,
        cancelButton: t`Close`,
        rows: 8,
        customInputs: [{
            id: 'pronouns_replace_use_shorthands',
            label: t`Use shorthand macros (e.g. {{she}}, {{him}})`,
            tooltip: shorthandsGloballyEnabled
                ? t`Uses shorthand macro names where available.`
                : t`Shorthand macros apply to personas and must be enabled in settings.`,
            defaultState: shorthandsGloballyEnabled && Boolean(defaultUseShorthands),
            disabled: !shorthandsGloballyEnabled,
        }],
        customButtons: [
            {
                text: t`Paste`,
                classes: ['secondary'],
                action: async () => {
                    const pasted = await tryReadClipboardText();
                    if (pasted) popup.mainInput.value = pasted;
                },
            },
            {
                text: t`Convert`,
                classes: ['secondary'],
                action: async () => {
                    const checkbox = getShorthandsCheckbox();
                    const useSh = shorthandsGloballyEnabled && (checkbox ? checkbox.checked : false);
                    popup.mainInput.value = replacePronounsWithMacros(String(popup.mainInput.value ?? ''), { useShorthands: useSh, entity });
                    toastr.success(t`Converted`);
                },
            },
            {
                text: t`Copy`,
                classes: ['menu_button_primary'],
                action: async () => {
                    const ok = await copyToClipboard(popup.mainInput.value ?? '');
                    if (ok) toastr.success(t`Copied to clipboard`);
                },
            },
        ],
        onOpen: async (p) => {
            if (!p.mainInput.value) {
                const clip = await tryReadClipboardText();
                if (clip) p.mainInput.value = clip;
            }
        },
        onClosing: async (p) => {
            if (p.result >= POPUP_RESULT.AFFIRMATIVE) {
                const useSh = shorthandsGloballyEnabled && Boolean(p.inputResults?.get('pronouns_replace_use_shorthands') ?? false);
                const converted = replacePronounsWithMacros(String(p.value ?? ''), { useShorthands: useSh, entity });
                const ok = await copyToClipboard(converted);
                if (ok) toastr.success(t`Converted and copied`);
                p.value = converted;
            }
            return true;
        },
    });

    const checkbox = getShorthandsCheckbox();
    if (checkbox) {
        checkbox.addEventListener('change', () => {
            const tbody = popup.dlg.querySelector('.pronoun-replacer-table tbody');
            if (tbody) tbody.innerHTML = buildTable();
        });
    }

    const result = await popup.show();
    return typeof result === 'string' ? result : '';
}
