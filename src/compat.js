/**
 * Compatibility guards: the upstream extension and the host macro engine.
 */

import { power_user } from '../../../../../scripts/power-user.js';
import { t } from '../../../../../scripts/i18n.js';
import * as extensionsModule from '../../../../extensions.js';
import { PERSONA_HANDOFF } from './pronouns.js';

/**
 * The upstream extension registers the same macro names and writes the same persona field.
 * It resolves its templates against its own folder name, so an install is found by that name.
 */
export const LEGACY_EXTENSION_NAMES = Object.freeze(['SillyTavern-Pronouns']);

const PERSISTENT_TOAST = Object.freeze({ timeOut: 0, extendedTimeOut: 0, closeButton: true, preventDuplicates: true });

/**
 * @param {string} name
 * @returns {{ installed: boolean, enabled: boolean }}
 */
function getExtensionState(name) {
    if (typeof extensionsModule.findExtension === 'function') {
        const found = extensionsModule.findExtension(name);
        return { installed: Boolean(found), enabled: Boolean(found?.enabled) };
    }
    const context = globalThis.SillyTavern?.getContext?.();
    if (!context?.getExtensionManifest?.(name)) return { installed: false, enabled: false };
    const wanted = name.toLowerCase();
    const disabled = (context.extensionSettings?.disabledExtensions ?? [])
        .some(entry => String(entry).toLowerCase().replace(/^third-party\//, '') === wanted);
    return { installed: true, enabled: !disabled };
}

/** @returns {{ installed: string[], enabled: string[] }} Predecessor names by state. */
export function getLegacyExtensionState() {
    const installed = [];
    const enabled = [];
    for (const name of LEGACY_EXTENSION_NAMES) {
        const state = getExtensionState(name);
        if (state.installed) installed.push(name);
        if (state.enabled) enabled.push(name);
    }
    return { installed, enabled };
}

/**
 * @param {{ installed: string[] }} state From getLegacyExtensionState().
 * @returns {'flatten'|'delete'} What `clean` does with the persona `pronoun` field.
 */
export function personaPronounHandoff(state) {
    return state.installed.length ? PERSONA_HANDOFF.FLATTEN : PERSONA_HANDOFF.DELETE;
}

/** @param {string[]} names The enabled predecessors. */
export function warnLegacyExtensionEnabled(names) {
    const who = names.join(', ');
    toastr.warning(
        t`${who} is still enabled. Character Lexicon stays inactive until you disable ${who} and reload.`,
        'Character Lexicon',
        PERSISTENT_TOAST,
    );
}

/** The legacy substitution path never consults the macro registry or its pre-processors. */
export function isMacroEngineEnabled() {
    return Boolean(power_user?.experimental_macro_engine);
}

export function warnMacroEngineDisabled() {
    toastr.warning(
        t`The experimental macro engine is turned off, so pronoun macros reach the model unresolved. Enable "Experimental Macro Engine" in User Settings and reload.`,
        'Character Lexicon',
        PERSISTENT_TOAST,
    );
}
