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
    selection = { context, turns: countReplies(context, replyIndex) };
    return true;
}

/** Hold the selected position while the host appends or streams the response. */
export function getRotationTurns() {
    const context = currentContext();
    if (selection && Object.keys(context).every(key => context[key] === selection.context[key])) {
        return selection.turns;
    }
    return countReplies(context);
}

export function resetReplyRotation() {
    selection = null;
}
