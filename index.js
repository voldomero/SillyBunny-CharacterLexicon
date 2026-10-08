/**
 * SillyBunny Character Lexicon — pronouns, names, and preferred terms for personas and characters.
 *
 * Ported from the SillyTavern-Pronouns extension by Wolfsblvt (AGPL-3.0) and
 * extended so a single persona or character can carry several pronoun sets
 * (she/they, he/they, any/all) that actually surface in chat — via rotating
 * macros and an injected directive that tells the model to alternate.
 */

import { injectUI, registerEventListeners, refreshEditors } from './src/ui.js';
import { ensureSettings, cleanAllPronounData } from './src/pronouns.js';
import { resetReplyRotation } from './src/rotation.js';
import { clearPersonaLanguagePreferences } from './src/language.js';
import { applyMacroSettings, registerPreProcessors } from './src/macros.js';
import { registerSlashCommands } from './src/slash-commands.js';
import { registerDataEventListeners } from './src/data-events.js';
import { refreshDirectives, clearDirectives, onGenerationDirective } from './src/directive.js';
import { event_types, eventSource, saveSettingsDebounced } from '../../../../script.js';
import { EXTENSION_ID, EXTENSION_NAME } from './src/identity.js';
import {
    getLegacyExtensionState,
    warnLegacyExtensionEnabled,
    isMacroEngineEnabled,
    warnMacroEngineDisabled,
} from './src/compat.js';

export { EXTENSION_KEY, EXTENSION_NAME } from './src/identity.js';

let initCalled = false;
export let initialized = false;

/**
 * Reads this extension's version from its manifest, if available.
 * @returns {string|null}
 */
function getOwnVersion() {
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        return ctx?.getExtensionManifest?.(EXTENSION_ID)?.version ?? null;
    } catch {
        return null;
    }
}

/** Extension initialization — called via the 'activate' lifecycle hook. */
export async function init() {
    if (initCalled) return;
    initCalled = true;

    console.debug(`[${EXTENSION_NAME}] Initializing...`);

    const legacy = getLegacyExtensionState();
    if (legacy.enabled.length) {
        // Two copies would fight over the macro names, the shared persona field and the prompt slots.
        console.warn(`[${EXTENSION_NAME}] ${legacy.enabled.join(', ')} is enabled; staying inactive until it is disabled.`);
        eventSource.on(event_types.APP_INITIALIZED, () => warnLegacyExtensionEnabled(legacy.enabled));
        return;
    }

    ensureSettings(getOwnVersion());
    // Persist defaults on first run so settings (e.g. the directive toggle) survive a reload
    // even if the user never changes anything.
    saveSettingsDebounced();

    registerPreProcessors();
    applyMacroSettings();

    await injectUI();
    registerEventListeners();
    registerDataEventListeners();
    refreshEditors();

    registerSlashCommands();

    // A fresh chat load may reuse the same array and chat id; discard the old selection.
    eventSource.on(event_types.CHAT_CHANGED, resetReplyRotation);
    // Once the reply has landed (or the generation was stopped), everything evaluated afterwards belongs to the next turn.
    eventSource.on(event_types.GENERATION_ENDED, resetReplyRotation);
    if (event_types.GENERATION_STOPPED) eventSource.on(event_types.GENERATION_STOPPED, resetReplyRotation);
    eventSource.on(event_types.GENERATION_AFTER_COMMANDS, onGenerationDirective);
    // Also inject once now and once the app is ready, so it's present for the first generation.
    eventSource.on(event_types.APP_INITIALIZED, () => {
        refreshDirectives();
        if (!isMacroEngineEnabled()) warnMacroEngineDisabled();
    });
    refreshDirectives();

    console.debug(`[${EXTENSION_NAME}] Activated`);
    initialized = true;
}

/** Extension clean hook — called when the extension is uninstalled. */
export async function clean() {
    console.debug(`[${EXTENSION_NAME}] Running clean hook...`);
    clearDirectives();
    resetReplyRotation();
    clearPersonaLanguagePreferences();
    // The persona `pronoun` field predates this extension; leave it to an installed predecessor.
    await cleanAllPronounData({ keepPersonaPronouns: getLegacyExtensionState().installed.length > 0 });
    console.debug(`[${EXTENSION_NAME}] Clean complete.`);
}
