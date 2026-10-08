/**
 * Compatibility guards: the host macro engine.
 */

import { power_user } from '../../../../../scripts/power-user.js';
import { t } from '../../../../../scripts/i18n.js';

const PERSISTENT_TOAST = Object.freeze({ timeOut: 0, extendedTimeOut: 0, closeButton: true, preventDuplicates: true });

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
