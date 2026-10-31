import { STORAGE_KEYS } from '../config.js';
import { byId } from './dom.js';

/** Settings checkbox switching the sound cues. On unless the user turned them off. */
export class SoundToggle {
    constructor({ storage, sound }) {
        this.toggle = byId('soundToggle');
        sound.enabled = storage.get(STORAGE_KEYS.sounds) !== 'off';
        this.toggle.checked = sound.enabled;
        this.toggle.addEventListener('change', () => {
            sound.enabled = this.toggle.checked;
            storage.set(STORAGE_KEYS.sounds, sound.enabled ? 'on' : 'off');
            // a sample of what was just switched on (a player that is off ignores it)
            sound.play('on');
        });
    }
}
