export const EXTENSION_KEY = 'sillybunny-characterlexicon';
export const EXTENSION_NAME = 'SillyBunny-CharacterLexicon';

// The host identifies installed extensions by their folder, which may differ from the repository name.
const folder = new URL('../', import.meta.url).pathname.split('/').at(-2);
export const EXTENSION_ASSET_PATH = `third-party/${folder}`;
export const EXTENSION_ID = decodeURIComponent(EXTENSION_ASSET_PATH);
