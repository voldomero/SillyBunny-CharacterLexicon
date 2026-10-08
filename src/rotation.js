import { chat, characters, this_chid, user_avatar, getCurrentChatId } from '../../../../../script.js';
import { selected_group, is_group_generating } from '../../../../../scripts/group-chats.js';

let selection = null;

function currentContext() {
    return {
        history: chat,
        chatId: getCurrentChatId(),
        groupId: selected_group,
        personaId: user_avatar,
        characterAvatar: characters[this_chid]?.avatar || '',
    };
}

function isVisibleReply(message) {
    return message && !message.is_user && !message.is_system
        && message.extra?.type !== 'narrator'
        && typeof message.mes === 'string' && Boolean(message.mes.trim());
}

function countReplies(context, replyIndex = context.history.length) {
    let persona = 0;
    let character = 0;
    for (let i = 0; i < replyIndex; i++) {
        const message = context.history[i];
        if (!isVisibleReply(message)) continue;
        persona++;
        // Group history can contain names shared by several cards. Never infer identity from names.
        if (!context.groupId || (context.characterAvatar && message.original_avatar === context.characterAvatar)) {
            character++;
        }
    }
    return { persona, character, replyIndex };
}

/** Select once before prompt assembly; duplicate events derive the same reply position. */
export function selectReplyRotation(type, args = {}, dryRun = false) {
    if (dryRun || args?.isAuxiliaryGeneration || type === 'quiet' || type === 'impersonate') return false;
    if (selected_group && !is_group_generating) return false;

    const context = currentContext();
    // The host only sets preserveLastMessage for replacement regenerations, and the group wrapper
    // forwards it while remapping the per-member type to 'normal'.
    const replacesReply = type === 'swipe' || type === 'continue' || Boolean(args?.preserveLastMessage);
    const last = context.history.at(-1);
    const replyIndex = replacesReply && last && !last.is_user && !last.is_system
        ? context.history.length - 1 : context.history.length;
    selection = { context, turns: countReplies(context, replyIndex), historyLength: context.history.length };
    return true;
}

/**
 * A selection describes one reply. It ends when that reply lands (GENERATION_ENDED resets it) or,
 * failing that, once the history has grown past the length it was made for.
 * @param {ReturnType<typeof currentContext>} context
 */
function selectionIsCurrent(context) {
    return Boolean(selection)
        && context.history.length <= selection.historyLength
        && Object.keys(context).every(key => context[key] === selection.context[key]);
}

/**
 * Hold the selected position while the host builds the prompt or streams the response.
 * @param {{ env?: { content?: string } }} [macroContext] The macro execution context, when called from a macro.
 */
export function getRotationTurns(macroContext = null) {
    const context = currentContext();
    if (isRenderingFirstReply(context, macroContext)) return countReplies(context, 0);
    if (selectionIsCurrent(context)) return selection.turns;
    return countReplies(context);
}

/**
 * The host substitutes message 0 in place while rendering it, before any chat event fires, so the
 * only way to tell is that the text being evaluated is that message. Its position is 0, not 1.
 * @param {ReturnType<typeof currentContext>} context
 * @param {{ env?: { content?: string } }|null} macroContext
 */
function isRenderingFirstReply(context, macroContext) {
    const content = macroContext?.env?.content;
    const first = context.history[0];
    return typeof content === 'string' && isVisibleReply(first) && content === first.mes;
}

export function resetReplyRotation() {
    selection = null;
}
