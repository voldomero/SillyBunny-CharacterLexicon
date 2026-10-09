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
    selection = {
        context,
        turns: countReplies(context, replyIndex),
        historyLength: context.history.length,
        // A new reply is appended (streaming pushes it before any text arrives); a replaced one is not.
        appendsReply: !(replacesReply && last && !last.is_user && !last.is_system),
    };
    return true;
}

/**
 * A selection describes one reply and lasts until that reply has landed (GENERATION_ENDED or
 * GENERATION_STOPPED resets it). As a fallback it also ends once the history has grown beyond
 * that reply: the appended reply itself still belongs to the selection while it is the last message.
 * @param {ReturnType<typeof currentContext>} context
 */
function selectionIsCurrent(context) {
    if (!selection || !Object.keys(context).every(key => context[key] === selection.context[key])) return false;
    const grown = context.history.length - selection.historyLength;
    if (grown <= 0) return true;
    const tail = context.history.at(-1);
    return grown === 1 && selection.appendsReply && Boolean(tail) && !tail.is_user;
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
