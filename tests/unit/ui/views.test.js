// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Emitter } from '../../../web/js/core/emitter.js';
import { Logger } from '../../../web/js/services/logger.js';
import { PanelManager } from '../../../web/js/ui/panels.js';
import { LogsView } from '../../../web/js/ui/logs-view.js';
import { HistoryView } from '../../../web/js/ui/history-view.js';
import { CorrectedPane } from '../../../web/js/ui/corrected-pane.js';
import { CopyButton } from '../../../web/js/ui/copy-button.js';
import { Editor } from '../../../web/js/ui/editor.js';
import { $, click, key, mountPage } from './fixture.js';

const memoryStorage = (initial = {}) => {
    const data = { ...initial };
    return { data, get: (k, d = null) => data[k] ?? d, set: (k, v) => { data[k] = v; return true; } };
};

const realPanels = () => new PanelManager({
    settings: { panel: $('themesPanel'), button: $('settingsBtn') },
    history: { panel: $('historyPanel'), button: $('historyBtn') },
    logs: { panel: $('logsPanel'), button: $('logsBtn') },
    semantic: { panel: $('semanticPanel'), button: $('semanticBtn'), pinned: true, manual: true },
});

beforeEach(mountPage);

describe('LogsView', () => {
    let log;
    let panels;
    let storage;

    beforeEach(() => {
        log = new Logger();
        panels = realPanels();
        storage = memoryStorage();
    });

    it('is hidden unless switched on', () => {
        new LogsView({ log, panels, storage });
        expect($('logsBtn').hidden).toBe(true);
        expect($('logsToggle').checked).toBe(false);
    });

    it('shows the button when the setting was saved', () => {
        storage.data['sp9ak-logs'] = 'on';
        new LogsView({ log, panels, storage });
        expect($('logsBtn').hidden).toBe(false);
        expect($('logsToggle').checked).toBe(true);
    });

    it('remembers the switch and closes the panel when switched off', () => {
        new LogsView({ log, panels, storage });
        $('logsToggle').checked = true;
        $('logsToggle').dispatchEvent(new Event('change'));
        expect(storage.data['sp9ak-logs']).toBe('on');
        panels.open('logs');
        $('logsToggle').checked = false;
        $('logsToggle').dispatchEvent(new Event('change'));
        expect(storage.data['sp9ak-logs']).toBe('off');
        expect(panels.isOpen('logs')).toBe(false);
        expect($('logsBtn').hidden).toBe(true);
    });

    it('renders entries when the panel opens and as new ones arrive', () => {
        new LogsView({ log, panels, storage });
        log.ok('pierwszy');
        panels.open('logs');
        expect($('logsList').children).toHaveLength(1);
        log.err('drugi', 'szczegóły');
        expect($('logsList').children).toHaveLength(2);
        expect($('logsList').lastChild.className).toBe('log-entry log-err');
        expect($('logsList').lastChild.textContent).toContain('drugi\n  szczegóły');
    });

    it('shows a placeholder when empty and after clearing', () => {
        new LogsView({ log, panels, storage });
        log.ok('x');
        panels.open('logs');
        click($('clearLogsBtn'));
        expect($('logsList').firstChild).toBe($('logsEmpty'));
    });

    it('does not render while the panel is closed', () => {
        new LogsView({ log, panels, storage });
        log.ok('x');
        expect($('logsList').querySelectorAll('.log-entry')).toHaveLength(0);
    });

    describe('copying', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
        });
        afterEach(() => vi.useRealTimers());

        it('copies the log as text and confirms briefly', async () => {
            new LogsView({ log, panels, storage });
            log.ok('gotowe');
            click($('copyLogsBtn'));
            await vi.advanceTimersByTimeAsync(0);
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('[OK] gotowe'));
            expect($('copyLogsBtn').textContent).toBe('✓ Skopiowano');
            await vi.advanceTimersByTimeAsync(2000);
            expect($('copyLogsBtn').textContent).toBe('Kopiuj logi');
        });

        it('does nothing when there is no log', async () => {
            new LogsView({ log, panels, storage });
            click($('copyLogsBtn'));
            await vi.advanceTimersByTimeAsync(0);
            expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
        });

        it('copes with a blocked clipboard', async () => {
            navigator.clipboard.writeText.mockRejectedValue(new Error('denied'));
            new LogsView({ log, panels, storage });
            log.ok('x');
            click($('copyLogsBtn'));
            await vi.advanceTimersByTimeAsync(0);
            expect($('copyLogsBtn').textContent).toBe('✓ Skopiowano');
        });
    });
});

describe('HistoryView', () => {
    class FakeHistory extends Emitter {
        items = [];
        remove = vi.fn();
        clear = vi.fn();
    }

    it('lists sessions with a preview and shows the empty message otherwise', () => {
        const history = new FakeHistory();
        new HistoryView({ history, onSelect: vi.fn() }).render();
        expect($('historyEmpty').hidden).toBe(false);
        history.items = [{ id: '1', ts: '2026-03-01T10:30:00Z', text: 'x'.repeat(100) }];
        history.emit('change');
        expect($('historyEmpty').hidden).toBe(true);
        expect($('historyList').children).toHaveLength(1);
        expect($('historyList').querySelector('.sess-preview').textContent).toBe(`${'x'.repeat(80)}…`);
        expect($('historyList').querySelector('.sess-time').textContent).not.toBe('');
    });

    it('shows text literally instead of interpreting it as markup', () => {
        const history = new FakeHistory();
        history.items = [{ id: '1', ts: '2026-03-01T10:30:00Z', text: '<img src=x onerror=alert(1)>' }];
        new HistoryView({ history, onSelect: vi.fn() }).render();
        expect($('historyList').querySelector('img')).toBeNull();
        expect($('historyList').querySelector('.sess-preview').textContent).toBe('<img src=x onerror=alert(1)>');
    });

    it('selects a session on click, and deleting does not select it', () => {
        const history = new FakeHistory();
        history.items = [{ id: 'abc', ts: '2026-03-01T10:30:00Z', text: 'notatka' }];
        const onSelect = vi.fn();
        new HistoryView({ history, onSelect }).render();
        click($('historyList').querySelector('.sess-body'));
        expect(onSelect).toHaveBeenCalledWith('notatka');
        click($('historyList').querySelector('.sess-del'));
        expect(history.remove).toHaveBeenCalledWith('abc');
        expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('clears everything only after confirmation', () => {
        const history = new FakeHistory();
        new HistoryView({ history, onSelect: vi.fn() });
        window.confirm = vi.fn(() => false);
        click($('clearAllBtn'));
        expect(history.clear).not.toHaveBeenCalled();
        window.confirm = vi.fn(() => true);
        click($('clearAllBtn'));
        expect(history.clear).toHaveBeenCalledTimes(1);
    });
});

describe('CorrectedPane', () => {
    let toast;
    let pane;

    beforeEach(() => {
        toast = { show: vi.fn() };
        pane = new CorrectedPane({ toast });
    });

    it('starts hidden and empty', () => {
        expect(pane.visible).toBe(false);
        expect(pane.value).toBe('');
    });

    it('appends text, showing the pane', () => {
        pane.append('raz ');
        pane.append('dwa ');
        expect(pane.visible).toBe(true);
        expect(pane.value).toBe('raz dwa ');
    });

    it('clears and hides', () => {
        pane.append('tekst');
        pane.clear();
        expect(pane.value).toBe('');
        expect(pane.visible).toBe(false);
    });

    describe('read-only behaviour', () => {
        it('refuses typing and tells the user where to edit', () => {
            const event = key($('corrected'), { key: 'a' });
            expect(event.defaultPrevented).toBe(true);
            expect(toast.show).toHaveBeenCalledWith('Edytuj tekst w górnym okienku');
        });

        it('allows navigation and copy shortcuts', () => {
            expect(key($('corrected'), { key: 'ArrowLeft' }).defaultPrevented).toBe(false);
            expect(key($('corrected'), { key: 'c', ctrlKey: true }).defaultPrevented).toBe(false);
            expect(toast.show).not.toHaveBeenCalled();
        });

        it.each(['paste', 'cut', 'drop'])('refuses %s', type => {
            const event = new Event(type, { cancelable: true });
            $('corrected').dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
        });

        it('refuses input events except IME composition', () => {
            const refused = new InputEvent('beforeinput', { inputType: 'insertText', cancelable: true });
            const composed = new InputEvent('beforeinput', { inputType: 'insertCompositionText', cancelable: true });
            $('corrected').dispatchEvent(refused);
            $('corrected').dispatchEvent(composed);
            expect(refused.defaultPrevented).toBe(true);
            expect(composed.defaultPrevented).toBe(false);
        });
    });

    describe('following the editor', () => {
        let editor;
        beforeEach(() => {
            vi.useFakeTimers();
            editor = new Editor();
            pane.followEditor(editor, text => `[${text}]`);
        });
        afterEach(() => vi.useRealTimers());

        it('re-renders a few seconds after the text stops changing', () => {
            pane.show();
            editor.setText('pierwsza wersja');
            vi.advanceTimersByTime(2000);
            editor.setText('druga wersja');
            vi.advanceTimersByTime(2999);
            expect(pane.value).toBe('');
            vi.advanceTimersByTime(1);
            expect(pane.value).toBe('[druga wersja] ');
        });

        it('stays out of the way while hidden or when the text is blank', () => {
            editor.setText('coś');
            vi.advanceTimersByTime(3000);
            expect(pane.value).toBe('');
            pane.show();
            editor.setText('   ');
            vi.advanceTimersByTime(3000);
            expect(pane.value).toBe('');
        });

        it('does not re-render the same text twice', () => {
            pane.show();
            editor.setText('tekst');
            vi.advanceTimersByTime(3000);
            pane.field.value = 'ręcznie zmienione';
            editor.setText('tekst');
            vi.advanceTimersByTime(3000);
            expect(pane.value).toBe('ręcznie zmienione');
        });
    });
});

describe('CopyButton', () => {
    let editor;
    let pane;
    let copy;

    beforeEach(() => {
        vi.useFakeTimers();
        Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
        editor = new Editor();
        pane = new CorrectedPane({ toast: { show: vi.fn() } });
        copy = new CopyButton({ editor, corrected: pane });
    });
    afterEach(() => vi.useRealTimers());

    it('copies the corrected text when there is some', async () => {
        editor.setText('oryginał');
        pane.append('Poprawiony. ');
        await copy.copy();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Poprawiony. ');
    });

    it('copies the original otherwise', async () => {
        editor.setText('oryginał');
        await copy.copy();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('oryginał');
    });

    it('does nothing for an empty field', async () => {
        await copy.copy();
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
        expect($('copyLabel').textContent).toBe('Kopiuj');
    });

    it('confirms, then restores the label', async () => {
        editor.setText('tekst');
        click($('copyBtn'));
        await vi.advanceTimersByTimeAsync(0);
        expect($('copyLabel').textContent).toBe('✓ Skopiowano');
        expect($('copyBtn').classList.contains('ok')).toBe(true);
        await vi.advanceTimersByTimeAsync(2000);
        expect($('copyLabel').textContent).toBe('Kopiuj');
        expect($('copyBtn').classList.contains('ok')).toBe(false);
    });

    it('falls back to selecting and copying, keeping the user selection', async () => {
        navigator.clipboard.writeText.mockRejectedValue(new Error('denied'));
        document.execCommand = vi.fn(() => true);
        editor.setText('abcdef');
        $('output').setSelectionRange(2, 4);
        await copy.copy();
        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect([$('output').selectionStart, $('output').selectionEnd]).toEqual([2, 4]);
        expect($('copyLabel').textContent).toBe('✓ Skopiowano');
    });
});
