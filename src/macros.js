/**
 * Macro registration for the SillyBunny Character Lexicon extension.
 *
 * Two parallel macro families:
 *  - Persona (the user):   {{pronounSubjective}}, {{pronounObjective}}, {{pronounPosDet}},
 *                          {{pronounPosPro}}, {{pronounReflexive}}, {{pronounVerbBe}}
 *  - Character (the bot):  {{charPronounSubjective}}, {{charPronounObjective}}, ...,
 *                          {{charPronounVerbBe}}
 *
 * Every macro resolves through its entity's container `mode`:
 *  - rotate (default): one complete set per reply, shared with the directive
 *  - primary:          always the first set
 *
 * Dot-notation aliases ({{pronoun.subjective}} etc.) are rewritten via a pre-processor.
 * Opt-in alias groups (shorthand / WyvernChat caps / JanitorAI) mirror the persona macros.
 */

import { macros } from '../../../../../scripts/macros/macro-system.js';
import { t } from '../../../../../scripts/i18n.js';
import { getRotationTurns } from './rotation.js';
import { EXTENSION_KEY } from './identity.js';
import {
    getPersonaContainer,
    getCharacterContainer,
    resolvePronoun,
    shorthandAliases,
    wyvernChatAliases,
    JanitorAIAliases,
    pronounsSettings,
} from './pronouns.js';

const ENTITY_PERSONA = 'persona';
const ENTITY_CHARACTER = 'character';

/**
 * Rewrites WyvernChat dot-notation pronoun placeholders to our camelCase macro names.
 * @param {string} text
 * @returns {string}
 */
function rewriteDotNotation(text) {
    return text
        .replace(/{{pronoun\.subjective}}/gi, '{{pronounSubjective}}')
        .replace(/{{pronoun\.objective}}/gi, '{{pronounObjective}}')
        .replace(/{{pronoun\.pos_det}}/gi, '{{pronounPosDet}}')
        .replace(/{{pronoun\.pos_pro}}/gi, '{{pronounPosPro}}')
        .replace(/{{pronoun\.reflexive}}/gi, '{{pronounReflexive}}');
}

/** Registers the dot-notation pre-processor. Called once during init. */
export function registerPreProcessors() {
    macros.engine.addPreProcessor(rewriteDotNotation, { priority: 45, source: `extension:${EXTENSION_KEY}` });
}

/**
 * @param {'persona'|'character'} entity
 * @returns {import('./pronouns.js').PronounContainer}
 */
function containerFor(entity) {
    return entity === ENTITY_CHARACTER ? getCharacterContainer() : getPersonaContainer();
}

/**
 * Builds a macro handler that resolves a pronoun field for an entity, using the
 * same reply position as the injected directive.
 * @param {'persona'|'character'} entity
 * @param {'subjective'|'objective'|'posDet'|'posPro'|'reflexive'} key
 * @returns {(ctx: any) => string}
 */
function makeValueHandler(entity, key) {
    return () => resolvePronoun(containerFor(entity), key, getRotationTurns()[entity]);
}

/**
 * Builds a verb-be ("is"/"are") handler agreeing with the resolved subjective pronoun.
 * @param {'persona'|'character'} entity
 * @returns {(ctx: any) => string}
 */
function makeVerbBeHandler(entity) {
    const areForms = new Set(['they', 'we', 'you']);
    return () => {
        const subjective = resolvePronoun(containerFor(entity), 'subjective', getRotationTurns()[entity]).toLowerCase().trim();
        if (!subjective) return '';
        return areForms.has(subjective) ? 'are' : 'is';
    };
}

/**
 * @typedef {Object} PronounMacroManager
 * @property {(entity: 'persona'|'character') => { subjective: string[]; objective: string[]; posDet: string[]; posPro: string[]; reflexive: string[]; verbBe: string[] }} getRegisteredByType
 * @property {{ set: (enabled: boolean) => void }} shorthands
 * @property {{ set: (enabled: boolean) => void }} wyvernCompat
 * @property {{ set: (enabled: boolean) => void }} janitorAliases
 */

/** @type {PronounMacroManager | null} */
let manager = null;

/** @returns {PronounMacroManager} */
export function getMacroManager() {
    if (!manager) manager = createPronounMacroManager();
    return manager;
}

/** @returns {PronounMacroManager} */
function createPronounMacroManager() {
    const descriptions = {
        subjective: t`Subjective pronoun (she/he/they)`,
        objective: t`Objective pronoun (her/him/them)`,
        posDet: t`Possessive determiner (her/his/their)`,
        posPro: t`Possessive pronoun (hers/his/theirs)`,
        reflexive: t`Reflexive pronoun (herself/himself/themselves)`,
        verbBe: t`Verb-be agreement ("is" for singular, "are" for they/plural)`,
    };

    /** type -> macro names, tracked per entity so tooltips can list them. */
    const byType = {
        [ENTITY_PERSONA]: newTypeMap(),
        [ENTITY_CHARACTER]: newTypeMap(),
    };

    /** @type {Set<string>} */ const shorthandRegistered = new Set();
    /** @type {Set<string>} */ const wyvernRegistered = new Set();
    /** @type {Set<string>} */ const janitorRegistered = new Set();

    function newTypeMap() {
        return new Map([
            ['subjective', new Set()],
            ['objective', new Set()],
            ['posDet', new Set()],
            ['posPro', new Set()],
            ['reflexive', new Set()],
            ['verbBe', new Set()],
        ]);
    }

    /**
     * @param {'persona'|'character'} entity
     * @param {string} name
     * @param {keyof typeof descriptions} pronounKey
     * @param {(ctx: any) => string} handler
     */
    function register(entity, name, pronounKey, handler) {
        if (macros.registry.hasMacro(name)) return;
        macros.registry.registerMacro(name, {
            category: 'pronouns',
            description: descriptions[pronounKey],
            handler,
        });
        byType[entity].get(pronounKey).add(name);
    }

    // --- Primary macros (always registered) for both entities ---
    /** @type {Array<{ name: string, key: keyof typeof descriptions }>} */
    const fields = [
        { name: 'Subjective', key: 'subjective' },
        { name: 'Objective', key: 'objective' },
        { name: 'PosDet', key: 'posDet' },
        { name: 'PosPro', key: 'posPro' },
        { name: 'Reflexive', key: 'reflexive' },
    ];

    for (const { name, key } of fields) {
        register(ENTITY_PERSONA, `pronoun${name}`, key, makeValueHandler(ENTITY_PERSONA, key));
        register(ENTITY_CHARACTER, `charPronoun${name}`, key, makeValueHandler(ENTITY_CHARACTER, key));
    }
    register(ENTITY_PERSONA, 'pronounVerbBe', 'verbBe', makeVerbBeHandler(ENTITY_PERSONA));
    register(ENTITY_CHARACTER, 'charPronounVerbBe', 'verbBe', makeVerbBeHandler(ENTITY_CHARACTER));

    // --- Opt-in alias groups (persona-mapped, matching the original extension) ---

    /**
     * @param {ReadonlyArray<import('./pronouns.js').PronounShorthandAlias>} aliasList
     * @param {Set<string>} registeredSet
     */
    function enableAliasGroup(aliasList, registeredSet) {
        for (const { names, pronounKey } of aliasList) {
            for (const name of names) {
                if (macros.registry.hasMacro(name)) continue;
                macros.registry.registerMacro(name, {
                    category: 'legacy',
                    description: descriptions[pronounKey],
                    handler: makeValueHandler(ENTITY_PERSONA, pronounKey),
                });
                byType[ENTITY_PERSONA].get(pronounKey).add(name);
                registeredSet.add(name);
            }
        }
    }

    /** @param {Set<string>} registeredSet */
    function enableWyvernGroup(registeredSet) {
        for (const { pronounKey, name } of wyvernChatAliases) {
            if (macros.registry.hasMacro(name)) continue;
            const inner = makeValueHandler(ENTITY_PERSONA, pronounKey);
            macros.registry.registerMacro(name, {
                category: 'legacy',
                description: descriptions[pronounKey],
                handler: (ctx) => {
                    const v = inner(ctx);
                    return v ? v.charAt(0).toUpperCase() + v.slice(1) : '';
                },
            });
            byType[ENTITY_PERSONA].get(pronounKey).add(name);
            registeredSet.add(name);
        }
    }

    /** @param {Set<string>} registeredSet */
    function disableGroup(registeredSet) {
        for (const name of registeredSet) {
            macros.registry.unregisterMacro(name);
            for (const typeSet of byType[ENTITY_PERSONA].values()) typeSet.delete(name);
        }
        registeredSet.clear();
    }

    return {
        shorthands: {
            set: (enabled) => enabled ? enableAliasGroup(shorthandAliases, shorthandRegistered) : disableGroup(shorthandRegistered),
        },
        wyvernCompat: {
            set: (enabled) => enabled ? enableWyvernGroup(wyvernRegistered) : disableGroup(wyvernRegistered),
        },
        janitorAliases: {
            set: (enabled) => enabled ? enableAliasGroup(JanitorAIAliases, janitorRegistered) : disableGroup(janitorRegistered),
        },
        getRegisteredByType: (entity) => {
            const map = byType[entity === ENTITY_CHARACTER ? ENTITY_CHARACTER : ENTITY_PERSONA];
            return {
                subjective: Array.from(map.get('subjective') ?? []),
                objective: Array.from(map.get('objective') ?? []),
                posDet: Array.from(map.get('posDet') ?? []),
                posPro: Array.from(map.get('posPro') ?? []),
                reflexive: Array.from(map.get('reflexive') ?? []),
                verbBe: Array.from(map.get('verbBe') ?? []),
            };
        },
    };
}

/** Applies current settings to the macro manager (call on init and on toggle change). */
export function applyMacroSettings() {
    const m = getMacroManager();
    m.shorthands.set(pronounsSettings.shorthands);
    m.wyvernCompat.set(pronounsSettings.wyvernCompat);
    m.janitorAliases.set(pronounsSettings.janitorCompat);
}
