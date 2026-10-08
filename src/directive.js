/**
 * Pronoun directive injection.
 *
 * This is the piece that makes the *model's own writing* use multiple pronouns.
 * Macros only change text we substitute; they can't make an NPC vary how it refers
 * to someone. So when an entity has two or more pronoun sets, we inject a short
 * system instruction (via setExtensionPrompt) telling the model which set to use.
 *
 * Macros and directives share a selection derived from visible reply history.
 * Generation attempts do not consume turns; swipes and continuations reuse the
 * target reply's position. The host owns chat history and persistence.
 *
 * Pronoun slots cover the active persona and character. Separate language slots
 * cover the persona and the relevant character profiles, including group members.
 */

import { setExtensionPrompt, extension_prompt_types } from '../../../../../script.js';
import { getRotationTurns, selectReplyRotation } from './rotation.js';
import { getLanguageDirectives } from './language.js';
import { EXTENSION_KEY, EXTENSION_NAME } from './identity.js';
import {
    getPersonaContainer,
    getCharacterContainer,
    formatSetsList,
    formatSet,
    pickActiveSet,
    pronounsSettings,
    DIRECTIVE_OVERRIDE,
} from './pronouns.js';

const KEY_PERSONA = `${EXTENSION_KEY}_pronouns_persona`;
const KEY_CHARACTER = `${EXTENSION_KEY}_pronouns_character`;
const KEY_LANGUAGE_PERSONA = `${EXTENSION_KEY}_language_persona`;
const KEY_LANGUAGE_CHARACTERS = `${EXTENSION_KEY}_language_characters`;

const LOG_PREFIX = `[${EXTENSION_NAME}]`;

/**
 * Builds the directive text for a container, or '' if it has fewer than two sets.
 * `%LIST%` -> all sets; `%ACTIVE%` -> the set featured this turn.
 * `{{user}}`/`{{char}}` are left intact for the core macro engine to resolve.
 * @param {string} template
 * @param {import('./pronouns.js').PronounContainer} container
 * @param {number} turn
 * @returns {string}
 */
export function buildDirectiveText(template, container, turn = 0) {
    if (!container || (container.sets?.length ?? 0) < 2) return '';
    const list = formatSetsList(container);
    if (!list) return '';
    const active = formatSet(pickActiveSet(container, turn)) || list;
    return String(template ?? '')
        .replace(/%LIST%/g, list)
        .replace(/%ACTIVE%/g, active);
}

/**
 * Decides whether a container's directive should be injected, honoring the
 * per-entity override on top of the global default.
 * @param {import('./pronouns.js').PronounContainer} container
 * @returns {boolean}
 */
function shouldInject(container) {
    switch (container?.directive) {
        case DIRECTIVE_OVERRIDE.ON: return true;
        case DIRECTIVE_OVERRIDE.OFF: return false;
        default: return pronounsSettings.directiveEnabled;
    }
}

/**
 * Recomputes and (re)injects all instruction slots. Setting an empty value clears
 * a slot, so this both adds and removes directives as state changes.
 */
export function refreshDirectives() {
    const turns = getRotationTurns();
    const depth = pronounsSettings.directiveDepth;
    const role = pronounsSettings.directiveRole;

    const persona = getPersonaContainer();
    const personaText = shouldInject(persona)
        ? buildDirectiveText(pronounsSettings.directiveTemplatePersona, persona, turns.persona)
        : '';
    setExtensionPrompt(KEY_PERSONA, personaText, extension_prompt_types.IN_CHAT, depth, false, role);

    const character = getCharacterContainer();
    const characterText = shouldInject(character)
        ? buildDirectiveText(pronounsSettings.directiveTemplateCharacter, character, turns.character)
        : '';
    setExtensionPrompt(KEY_CHARACTER, characterText, extension_prompt_types.IN_CHAT, depth, false, role);

    const language = getLanguageDirectives();
    setExtensionPrompt(KEY_LANGUAGE_PERSONA, language.persona, extension_prompt_types.IN_CHAT, depth, false, role);
    setExtensionPrompt(KEY_LANGUAGE_CHARACTERS, language.characters, extension_prompt_types.IN_CHAT, depth, false, role);

    if (pronounsSettings.debugLogging) {
        console.info(`${LOG_PREFIX} directive refresh (reply ${turns.replyIndex}, depth ${depth}, role ${role})`, {
            turns,
            language,
            persona: { sets: persona.sets.length, directive: persona.directive, injected: personaText || '(none)' },
            character: { sets: character.sets.length, directive: character.directive, injected: characterText || '(none)' },
        });
    }
}

/**
 * Event handler for GENERATION_AFTER_COMMANDS — refreshes directives just before
 * the prompt is built. Background calls cannot change an in-flight selection.
 * @param {string} type
 * @param {object} [args]
 * @param {boolean} [dryRun]
 */
export function onGenerationDirective(type, args, dryRun) {
    if (selectReplyRotation(type, args, dryRun)) refreshDirectives();
}

/**
 * Returns a diagnostic snapshot of current directive state (for /lexicon-debug).
 * @returns {object}
 */
export function getDirectiveDebugInfo() {
    const turns = getRotationTurns();
    const persona = getPersonaContainer();
    const character = getCharacterContainer();
    return {
        turn: turns.persona,
        replyIndex: turns.replyIndex,
        language: getLanguageDirectives(),
        globalDirectiveEnabled: pronounsSettings.directiveEnabled,
        depth: pronounsSettings.directiveDepth,
        role: pronounsSettings.directiveRole,
        persona: {
            turn: turns.persona,
            sets: persona.sets,
            mode: persona.mode,
            directiveOverride: persona.directive,
            willInject: shouldInject(persona) && Boolean(buildDirectiveText(pronounsSettings.directiveTemplatePersona, persona, turns.persona)),
            text: shouldInject(persona) ? buildDirectiveText(pronounsSettings.directiveTemplatePersona, persona, turns.persona) : '(empty)',
        },
        character: {
            turn: turns.character,
            sets: character.sets,
            mode: character.mode,
            directiveOverride: character.directive,
            willInject: shouldInject(character) && Boolean(buildDirectiveText(pronounsSettings.directiveTemplateCharacter, character, turns.character)),
            text: shouldInject(character) ? buildDirectiveText(pronounsSettings.directiveTemplateCharacter, character, turns.character) : '(empty)',
        },
    };
}

/** Clears all instruction slots. Used on cleanup/uninstall. */
export function clearDirectives() {
    setExtensionPrompt(KEY_PERSONA, '', extension_prompt_types.IN_CHAT, 0, false, 0);
    setExtensionPrompt(KEY_CHARACTER, '', extension_prompt_types.IN_CHAT, 0, false, 0);
    setExtensionPrompt(KEY_LANGUAGE_PERSONA, '', extension_prompt_types.IN_CHAT, 0, false, 0);
    setExtensionPrompt(KEY_LANGUAGE_CHARACTERS, '', extension_prompt_types.IN_CHAT, 0, false, 0);
}
