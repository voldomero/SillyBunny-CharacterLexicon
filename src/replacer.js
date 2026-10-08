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
 * Builds a lowercase word -> macro-token map for a container, honoring precedence.
 * @param {import('./pronouns.js').PronounContainer} container
 * @param {{ useShorthands?: boolean, entity?: 'persona'|'character' }} [options]
 * @returns {Map<string, string>}
 */
function buildWordMacroMap(container, { useShorthands = false, entity = 'persona' } = {}) {
    /** @type {Map<string, string>} */
    const map = new Map();
    for (const key of PRECEDENCE) {
        for (const set of container?.sets ?? []) {
            const value = String(set[key] ?? '').trim();
            if (!value) continue;
            const lower = value.toLowerCase();
            if (map.has(lower)) continue; // first (highest-precedence) wins

            let macroName = getPrimaryMacroName(key, entity);
            if (useShorthands && entity === 'persona') {
                const alias = pickShorthandAlias(key, value);
                if (alias) macroName = alias;
            }
            map.set(lower, `{{${macroName}}}`);
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
    return text.replace(re, (m) => wordMacro.get(m.toLowerCase()) || m);
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
            .map(([word, macro]) => `<tr><td>${escapeHtml(word)}</td><td>→</td><td>${escapeHtml(macro)}</td></tr>`)
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
