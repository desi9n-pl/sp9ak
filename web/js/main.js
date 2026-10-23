import { MIN_AUTOSAVE_LENGTH } from './core/sessions.js';
import { AiAssistant } from './services/ai-assistant.js';
import { Dictation } from './services/dictation.js';
import { ExternalAi } from './services/external-ai.js';
import { GeminiNano } from './services/gemini-nano.js';
import { HotkeyPoller } from './services/hotkey-poller.js';
import { Logger } from './services/logger.js';
import { SessionHistory } from './services/session-history.js';
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
import { PunctuationToggle } from './ui/punctuation-toggle.js';
import { SemanticView } from './ui/semantic-view.js';
import { installShortcuts } from './ui/shortcuts.js';
import { StatusBar } from './ui/status-bar.js';
import { ThemePicker } from './ui/theme-picker.js';
import { Toast } from './ui/toast.js';
import { Waveform } from './ui/waveform.js';

/** Level above which the microphone hears speech even though no text has arrived yet. */
const SPEECH_LEVEL = 22;

const storage = new Storage();
const log = new Logger();
const toast = new Toast();
const status = new StatusBar();
const editor = new Editor();
const corrected = new CorrectedPane({ toast });
const history = new SessionHistory({ storage });

const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
const dictation = new Dictation({
    editor,
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
const installModal = new InstallModal();

new ThemePicker({ storage });
new LogsView({ log, panels, storage });
new AiStatusView({ ai });
new ExternalAiForm({ ai });
new LanguageToggle({ dictation });
new DictationButton({ dictation, status });
const punctuation = new PunctuationToggle({ storage, ai });
const emptyState = new EmptyState({ editor, dictation });
const copyButton = new CopyButton({ editor, corrected });
new PinButton({ toast }).load();

new HistoryView({
    history,
    onSelect(text) {
        editor.setText(text);
        editor.setCaret(text.length);
        dictation.moveTo(text.length);
        panels.close('history');
        editor.focus();
    },
});

new SemanticView({
    ai, editor, panels, status, toast, log,
    isDictating: () => dictation.listening,
    onApply(text) {
        editor.setText(text);
        dictation.moveTo(editor.caret);
        panels.close('semantic');
        editor.focus();
    },
});

const dots = byId('dots');
const waveform = new Waveform({
    onFrame(level) {
        dots.classList.toggle('show', level > SPEECH_LEVEL && !dictation.hasInterim && dictation.listening);
    },
});

dictation.on('status', ({ text, active }) => status.set(text, active));
dictation.on('toast', ({ text, ms }) => toast.show(text, ms));
dictation.on('started', () => waveform.start());
dictation.on('stopped', () => {
    waveform.stop();
    dots.classList.remove('show');
});
dictation.on('finished', ({ text }) => {
    if (text.trim()) corrected.append(`${punctuation.apply(text).trimEnd()} `);
    corrected.show();
    const full = corrected.value.trim() || editor.value.trim();
    if (full.length > MIN_AUTOSAVE_LENGTH) history.add(full);
});
corrected.followEditor(editor, text => punctuation.apply(text));

function startNewNote() {
    panels.close('semantic');
    const text = corrected.value.trim() || editor.value.trim();
    if (text) history.add(text);
    editor.setText('');
    corrected.clear();
    dictation.moveTo(0);
    emptyState.reset();
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

watchConnectivity({ toast, ai });

new HotkeyPoller({
    onSignal: action => (action === 'stop' ? dictation.stop() : dictation.start()),
}).start();

ai.init();
history.load();
editor.focus();
