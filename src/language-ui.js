import { t } from '../../../../../scripts/i18n.js';
import {
    LANGUAGE_FIELDS, getLanguageProfileKey, getLanguagePreferences, setLanguagePreferences,
} from './language.js';

function panelId(entity) {
    return `sbcl_language_${entity}`;
}

export function createLanguageEditor(entity, onChange) {
    const panel = document.createElement('details');
    panel.id = panelId(entity);
    panel.className = 'sbcl-language';
    const summary = document.createElement('summary');
    summary.textContent = t`Language preferences (optional)`;
    panel.appendChild(summary);

    const fields = document.createElement('fieldset');
    fields.className = 'sbcl-language-fields';
    fields.setAttribute('aria-label', t`Language preferences`);
    const explanation = document.createElement('p');
    explanation.textContent = t`Ways to refer to this person across chats. Enter one term per line. Leave unused fields blank.`;
    fields.appendChild(explanation);

    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'checkbox_label';
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.className = 'sbcl-language-enabled';
    enabledLabel.append(enabled, document.createTextNode(t`Use these preferences in prompts`));
    fields.appendChild(enabledLabel);

    const commit = () => {
        const profile = { enabled: enabled.checked };
        for (const { key } of LANGUAGE_FIELDS) {
            profile[key] = fields.querySelector(`[data-language-key="${key}"]`).value;
        }
        if (!setLanguagePreferences(entity, profile, panel.dataset.profileKey)) {
            refreshLanguageEditor(entity);
            return;
        }
        onChange();
    };
    enabled.addEventListener('change', commit);

    for (const { key, label, placeholder } of LANGUAGE_FIELDS) {
        const fieldLabel = document.createElement('label');
        fieldLabel.className = 'sbcl-language-field';
        const labelText = document.createElement('span');
        labelText.textContent = t`${label}`;
        const input = document.createElement('textarea');
        input.className = 'text_pole';
        input.rows = 2;
        input.dataset.languageKey = key;
        input.id = `${panel.id}_${key}`;
        input.placeholder = t`${placeholder}`;
        fieldLabel.htmlFor = input.id;
        input.addEventListener('input', commit);
        fieldLabel.append(labelText, input);
        fields.appendChild(fieldLabel);
    }

    const contextNote = document.createElement('small');
    contextNote.id = `${panel.id}_context`;
    contextNote.textContent = t`Affectionate and relationship terms are acceptable when the story supports them. They do not create a relationship. Terms to avoid apply to references to this person.`;
    fields.appendChild(contextNote);
    for (const key of ['affectionate', 'relationships', 'avoid']) {
        fields.querySelector(`[data-language-key="${key}"]`).setAttribute('aria-describedby', contextNote.id);
    }
    panel.appendChild(fields);
    return panel;
}

export function refreshLanguageEditor(entity) {
    const panel = document.getElementById(panelId(entity));
    if (!panel) return;
    const key = getLanguageProfileKey(entity);
    if (panel.dataset.profileKey !== key) panel.open = false;
    panel.dataset.profileKey = key;
    panel.querySelector('fieldset').disabled = !key;
    const profile = getLanguagePreferences(entity);
    panel.querySelector('.sbcl-language-enabled').checked = profile.enabled;
    for (const { key: field } of LANGUAGE_FIELDS) {
        const input = panel.querySelector(`[data-language-key="${field}"]`);
        if (input.value !== profile[field]) input.value = profile[field];
    }
}
