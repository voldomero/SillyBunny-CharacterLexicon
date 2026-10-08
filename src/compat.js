/**
 * Compatibility guards: the predecessor extension and the host macro engine.
 */

import { power_user } from '../../../../../scripts/power-user.js';
import { t } from '../../../../../scripts/i18n.js';
import * as extensionsModule from '../../../../extensions.js';

/** The predecessor resolves its templates against this folder name, so an install is found by it. */
export const LEGACY_EXTENSION_NAME = 'SillyBunny-Pronouns';

const PERSISTENT_TOAST = Object.freeze({ timeOut: 0, extendedTimeOut: 0, closeButton: true, preventDuplicates: true });

/** @returns {{ installed: boolean, enabled: boolean }} */
export function getLegacyExtensionState() {
    if (typeof extensionsModule.findExtension === 'function') {
        const found = extensionsModule.findExtension(LEGACY_EXTENSION_NAME);
        return { installed: Boolean(found), enabled: Boolean(found?.enabled) };
    }
    const context = globalThis.SillyTavern?.getContext?.();
    if (!context?.getExtensionManifest?.(LEGACY_EXTENSION_NAME)) return { installed: false, enabled: false };
    const wanted = LEGACY_EXTENSION_NAME.toLowerCase();
    const disabled = (context.extensionSettings?.disabledExtensions ?? [])
        .some(name => String(name).toLowerCase().replace(/^third-party\//, '') === wanted);
    return { installed: true, enabled: !disabled };
}

export function warnLegacyExtensionEnabled() {
    toastr.warning(
        t`SillyBunny-Pronouns is still enabled. Character Lexicon stays inactive until you disable SillyBunny-Pronouns and reload.`,
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
