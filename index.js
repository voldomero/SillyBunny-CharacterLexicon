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
import { refreshDirectives, clearDirectives, onGenerationDirective } from './src/directive.js';
import { event_types, eventSource, saveSettingsDebounced } from '../../../../script.js';
import { EXTENSION_ID, EXTENSION_NAME } from './src/identity.js';

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

    ensureSettings(getOwnVersion());
    // Persist defaults on first run so settings (e.g. the directive toggle) survive a reload
    // even if the user never changes anything.
    saveSettingsDebounced();

    registerPreProcessors();
    applyMacroSettings();

    await injectUI();
    registerEventListeners();
    refreshEditors();

    registerSlashCommands();

    // A fresh chat load may reuse the same array and chat id; discard the old selection.
    eventSource.on(event_types.CHAT_CHANGED, resetReplyRotation);
    eventSource.on(event_types.GENERATION_AFTER_COMMANDS, onGenerationDirective);
    // Also inject once now and once the app is ready, so it's present for the first generation.
    eventSource.on(event_types.APP_INITIALIZED, () => refreshDirectives());
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
    await cleanAllPronounData();
    console.debug(`[${EXTENSION_NAME}] Clean complete.`);
}
