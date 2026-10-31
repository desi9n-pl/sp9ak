import { MIN_AUTOSAVE_LENGTH } from './core/sessions.js';
import { AiAssistant } from './services/ai-assistant.js';
import { LoudnessTracker } from './core/loudness.js';
import { LoudToggle } from './ui/loud-toggle.js';
import { Dictation } from './services/dictation.js';
import { ExternalAi } from './services/external-ai.js';
import { GeminiNano } from './services/gemini-nano.js';
import { HotkeyPoller } from './services/hotkey-poller.js';
import { Logger } from './services/logger.js';
import { SessionHistory } from './services/session-history.js';
import { SoundPlayer } from './services/sound.js';
import { Storage } from './services/storage.js';
import { AiStatusView } from './ui/ai-status-view.js';
import { CopyButton } from './ui/copy-button.js';
import { CorrectedPane } from './ui/corrected-pane.js';
import { watchConnectivity } from './ui/connectivity.js';
import { DictationButton } from './ui/dictation-button.js';
import { byId } from './ui/dom.js';
import { Editor } from './ui/editor.js';
import { EmptyState } from './ui/empty-state.js';
import { ExternalAiForm } from './ui/external-ai-form.js';
import { HistoryView } from './ui/history-view.js';
import { InstallModal } from './ui/install-modal.js';
import { LanguageToggle } from './ui/language-toggle.js';
import { LogsView } from './ui/logs-view.js';
import { PanelManager } from './ui/panels.js';
import { PinButton } from './ui/pin-button.js';
import { installPointerFocus } from './ui/pointer-focus.js';
import { PunctuationToggle } from './ui/punctuation-toggle.js';
import { SemanticView } from './ui/semantic-view.js';
import { SoundToggle } from './ui/sound-toggle.js';
import { installShortcuts } from './ui/shortcuts.js';
import { StatusBar } from './ui/status-bar.js';
import { ThemePicker } from './ui/theme-picker.js';
import { ThickCaret } from './ui/thick-caret.js';
import { Toast } from './ui/toast.js';
import { Waveform } from './ui/waveform.js';

/** Level above which the microphone hears speech even though no text has arrived yet. */
const SPEECH_LEVEL = 22;

const storage = new Storage();
const sound = new SoundPlayer();
new SoundToggle({ storage, sound });
const log = new Logger();
const toast = new Toast();
const status = new StatusBar();
const editor = new Editor();
new ThickCaret(editor.el, { log });
installPointerFocus({ editor });
const corrected = new CorrectedPane({ toast });
const history = new SessionHistory({ storage });

const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
const loudness = new LoudnessTracker({ speechLevel: SPEECH_LEVEL });
const loudToggle = new LoudToggle({ storage, sound });
const dictation = new Dictation({
    editor,
    loudness: { tracker: loudness, enabled: () => loudToggle.enabled },
    createRecognition: () => (SpeechRecognition ? new SpeechRecognition() : null),
});

const ai = new AiAssistant({
    nano: new GeminiNano({ log }),
    external: new ExternalAi({ storage, log }),
    log,
});

const panels = new PanelManager({
    settings: { panel: byId('themesPanel'), button: byId('settingsBtn') },
    history: { panel: byId('historyPanel'), button: byId('historyBtn') },
    logs: { panel: byId('logsPanel'), button: byId('logsBtn') },
    semantic: { panel: byId('semanticPanel'), button: byId('semanticBtn'), pinned: true, manual: true },
});
panels.on('open', () => sound.play('open'));
panels.on('close', () => sound.play('close'));
const installModal = new InstallModal({ sound });

new ThemePicker({ storage, sound });
new LogsView({ log, panels, storage, sound });
new AiStatusView({ ai });
new ExternalAiForm({ ai, sound });
new LanguageToggle({ dictation, sound });
new DictationButton({ dictation, status });
const punctuation = new PunctuationToggle({ storage, ai, sound });
const emptyState = new EmptyState({ editor, dictation });
const copyButton = new CopyButton({ editor, corrected, sound });
new PinButton({ toast, sound }).load();

new HistoryView({
    history,
    sound,
    onSelect(text) {
        // Saved sessions are trimmed; dictated text ends with a space, so the next phrase must not stick to the last word.
        const loaded = `${text} `;
        editor.setText(loaded);
        editor.setCaret(loaded.length);
        dictation.moveTo(loaded.length);
        panels.close('history');
        sound.play('select');
        editor.focus();
    },
});

new SemanticView({
    ai, editor, panels, status, toast, log, sound,
    isDictating: () => dictation.listening,
    onApply(text) {
        editor.setText(text);
        dictation.moveTo(editor.caret);
        panels.close('semantic');
        sound.play('success');
        editor.focus();
    },
});

const dots = byId('dots');
const waveform = new Waveform({
    onFrame(level) {
        if (dictation.listening) loudness.record(level);
        dots.classList.toggle('show', level > SPEECH_LEVEL && !dictation.hasInterim && dictation.listening);
    },
});

dictation.on('status', ({ text, active }) => status.set(text, active));
dictation.on('toast', ({ text, ms }) => toast.show(text, ms));
dictation.on('started', () => waveform.start());
dictation.on('began', () => sound.play('start'));
dictation.on('ended', ({ failed }) => sound.play(failed ? 'error' : 'stop'));
dictation.on('stopped', () => {
    loudness.discardSegment();
    waveform.stop();
    dots.classList.remove('show');
});
dictation.on('finished', ({ text }) => {
    if (text.trim()) corrected.append(`${punctuation.apply(text, dictation.language).trimEnd()} `);
    corrected.show();
    const full = corrected.value.trim() || editor.value.trim();
    if (full.length > MIN_AUTOSAVE_LENGTH) history.add(full);
});
corrected.followEditor(editor, text => punctuation.apply(text, dictation.language));

function startNewNote() {
    panels.close('semantic');
    const text = corrected.value.trim() || editor.value.trim();
    if (text) history.add(text);
    editor.setText('');
    corrected.clear();
    dictation.moveTo(0);
    emptyState.reset();
    sound.play('create');
    editor.focus();
}
byId('newNoteBtn').addEventListener('click', startNewNote);

installShortcuts({
    copyAll: () => copyButton.copy(),
    newNote: startNewNote,
    toggleDictation: () => dictation.toggle(),
    dismiss() {
        dictation.stop();
        panels.closeAll();
        installModal.close();
    },
});

watchConnectivity({ toast, ai, sound });

new HotkeyPoller({
    onSignal: action => (action === 'stop' ? dictation.stop() : dictation.start()),
}).start();

ai.init();
history.load();
editor.focus();
