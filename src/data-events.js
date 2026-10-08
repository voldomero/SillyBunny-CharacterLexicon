/**
 * Keeps stored lexicon data attached to the entity it describes when the host
 * renames, deletes, or duplicates that entity. Both character stores are keyed by
 * avatar filename; persona data rides on host-owned descriptors.
 */

import { eventSource, event_types, saveSettingsDebounced } from '../../../../../script.js';
import { power_user } from '../../../../../scripts/power-user.js';
import { getCharaFilename } from '../../../../utils.js';
import { ensureSettings, settingKeys } from './pronouns.js';
import { PERSONA_LANGUAGE_KEY } from './language.js';

const PERSONA_FIELDS = ['pronoun', PERSONA_LANGUAGE_KEY];
/** Bracket assignment with these would alter the store object itself rather than add a record. */
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** @param {string} avatar @returns {string} The avatar filename without its extension. */
function stem(avatar) {
    return getCharaFilename(null, { manualAvatarKey: avatar }) || '';
}

/**
 * Moves a record between keys of a store; the live character's data wins over a stale record.
 * @param {Record<string, any>} store
 * @param {string} from
 * @param {string} to
 * @returns {boolean} Whether anything changed.
 */
function moveRecord(store, from, to) {
    if (!store || typeof store !== 'object' || !from || !to || from === to || RESERVED_KEYS.has(to) || !Object.hasOwn(store, from)) return false;
    store[to] = store[from];
    delete store[from];
    return true;
}

/**
 * @param {Record<string, any>} store
 * @param {string} key
 * @returns {boolean} Whether anything changed.
 */
function dropRecord(store, key) {
    if (!store || typeof store !== 'object' || !key || !Object.hasOwn(store, key)) return false;
    delete store[key];
    return true;
}

/**
 * CHARACTER_RENAMED fires with both avatar filenames while the host still points at the old entry,
 * so the new key must come from the event, not from the current character.
 * @param {string} oldAvatar
 * @param {string} newAvatar
 */
function onCharacterRenamed(oldAvatar, newAvatar) {
    if (typeof oldAvatar !== 'string' || typeof newAvatar !== 'string' || !oldAvatar || !newAvatar || oldAvatar === newAvatar) return;
    const settings = ensureSettings();
    const movedPronouns = moveRecord(settings[settingKeys.CHARACTERS], stem(oldAvatar), stem(newAvatar));
    const movedLanguage = moveRecord(settings[settingKeys.LANGUAGE_CHARACTERS], oldAvatar, newAvatar);
    if (movedPronouns || movedLanguage) saveSettingsDebounced();
}

/** @param {{ id?: number, character?: { avatar?: string } }} data */
function onCharacterDeleted(data) {
    const avatar = data?.character?.avatar;
    if (typeof avatar !== 'string' || !avatar) return;
    const settings = ensureSettings();
    const droppedPronouns = dropRecord(settings[settingKeys.CHARACTERS], stem(avatar));
    const droppedLanguage = dropRecord(settings[settingKeys.LANGUAGE_CHARACTERS], avatar);
    if (droppedPronouns || droppedLanguage) saveSettingsDebounced();
}

/**
 * The host builds a duplicated persona's descriptor from a fixed list of its own fields, so the
 * lexicon fields have to be copied from the source. Overwrite paths carry no source and keep nothing.
 * @param {{ avatarId?: string, duplicatedFromAvatarId?: string }} data
 */
function onPersonaCreated(data) {
    const source = data?.duplicatedFromAvatarId;
    const target = data?.avatarId;
    if (typeof source !== 'string' || typeof target !== 'string' || !source || !target || source === target) return;
    const from = power_user.persona_descriptions?.[source];
    if (!from || typeof from !== 'object') return;
    const to = power_user.persona_descriptions[target] ||= {};
    let changed = false;
    for (const field of PERSONA_FIELDS) {
        if (from[field] === undefined || to[field] !== undefined) continue;
        // A shallow copy would share the sets array between both personas.
        to[field] = structuredClone(from[field]);
        changed = true;
    }
    if (changed) saveSettingsDebounced();
}

/** Registers the host data event listeners. Called once during init. */
export function registerDataEventListeners() {
    eventSource.on(event_types.PERSONA_CREATED, onPersonaCreated);
    eventSource.on(event_types.CHARACTER_RENAMED, onCharacterRenamed);
    eventSource.on(event_types.CHARACTER_DELETED, onCharacterDeleted);
}
