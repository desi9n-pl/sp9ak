import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dictation } from '../../../web/js/services/dictation.js';
import { Emitter } from '../../../web/js/core/emitter.js';

/** Text field stand-in: a string with a caret. */
class FakeEditor extends Emitter {
    value = '';
    caret = 0;
    focus = vi.fn();
    setText(text) { this.value = text; this.emit('change'); }
    setCaret(position) { this.caret = position; }
    /** What the user does: types text, which moves the caret. */
    type(text, at = this.caret) {
        this.value = this.value.slice(0, at) + text + this.value.slice(at);
        this.caret = at + text.length;
        this.emit('input');
    }
}

/** Recognizer stand-in. Like the real one, start() throws while a session is still running. */
class FakeRecognition {
    running = false;
    starts = 0;
    start() {
        if (this.running) throw new DOMException('already started', 'InvalidStateError');
        this.running = true;
        this.starts++;
        this.onstart?.();
    }
    stop() { this.pendingStop = true; }
    /** The engine acknowledges stop() (or ends on its own). */
    end() { this.running = false; this.pendingStop = false; this.onend?.(); }
    say(transcript, isFinal = true) {
        const result = Object.assign([{ transcript }], { isFinal });
        this.onresult({ resultIndex: 0, results: [result] });
    }
    results(...parts) {
        const results = parts.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal }));
        this.onresult({ resultIndex: 0, results });
    }
    fail(error) { this.onerror({ error }); }
}

let editor;
let recognition;
let dictation;
let events;

function record(name) {
    events[name] = [];
    dictation.on(name, payload => events[name].push(payload));
}

beforeEach(() => {
    vi.useFakeTimers();
    editor = new FakeEditor();
    recognition = new FakeRecognition();
    dictation = new Dictation({ editor, createRecognition: () => recognition });
    events = {};
    ['status', 'started', 'stopped', 'toast', 'finished'].forEach(record);
});
afterEach(() => vi.useRealTimers());

const lastStatus = () => events.status.at(-1);

describe('support', () => {
    it('reports missing browser support and ignores commands', () => {
        const unsupported = new Dictation({ editor, createRecognition: () => null });
        expect(unsupported.supported).toBe(false);
        unsupported.start();
        unsupported.toggle();
        unsupported.setLanguage('en-US');
        expect(unsupported.listening).toBe(false);
    });

    it('configures a continuous recognizer with interim results', () => {
        expect(recognition).toMatchObject({ continuous: true, interimResults: true, lang: 'pl-PL' });
    });

    it('passes the language on', () => {
        dictation.setLanguage('en-US');
        dictation.start();
        expect(recognition.lang).toBe('en-US');
    });
});

describe('writing speech into the field', () => {
    it('shows interim words and replaces them with the final result', () => {
        dictation.start();
        recognition.say('rob', false);
        expect(editor.value).toBe('rob');
        recognition.say('robię', true);
        expect(editor.value).toBe('robię ');
        expect(editor.caret).toBe(6);
    });

    it('keeps earlier final results when later ones arrive', () => {
        dictation.start();
        recognition.say('pierwsze');
        recognition.say('drugie');
        expect(editor.value).toBe('pierwsze drugie ');
    });

    it('handles final and interim parts in one event', () => {
        dictation.start();
        recognition.results(['gotowe', true], ['w toku', false]);
        expect(editor.value).toBe('gotowe w toku');
        expect(dictation.hasInterim).toBe(true);
    });

    it('starts at the caret and leaves the surrounding text alone', () => {
        editor.value = 'początek koniec';
        editor.caret = 9;
        dictation.start();
        recognition.say('środek');
        expect(editor.value).toBe('początek środek koniec');
    });

    it('starts at the remembered caret when the live one is unavailable', () => {
        editor.value = 'abc';
        editor.caret = 1;
        dictation.rememberCaret();
        editor.caret = null;
        dictation.start();
        recognition.say('x');
        expect(editor.value).toBe('ax bc');
    });

    it('continues from the caret after the user types while dictating', () => {
        dictation.start();
        recognition.say('raz');
        editor.type('ręcznie ');
        recognition.say('dwa');
        expect(editor.value).toBe('raz ręcznie dwa ');
    });

    it('drops the unfinished phrase when the user presses Enter, so it is not written twice', () => {
        dictation.start();
        recognition.say('raz');
        recognition.say('dwa', false);
        editor.type('\n');
        recognition.say('dwa');
        expect(editor.value).toBe('raz \ndwa ');
    });

    it('does not follow typing when not dictating', () => {
        editor.type('tekst');
        dictation.start();
        recognition.say('x');
        expect(editor.value).toBe('tekstx ');
    });

    it('notifies listeners of the text change', () => {
        const onChange = vi.fn();
        editor.on('change', onChange);
        dictation.start();
        recognition.say('a');
        expect(onChange).toHaveBeenCalled();
    });
});

describe('caret memory', () => {
    it('remembers the caret while idle', () => {
        editor.value = 'abcdef';
        editor.caret = 3;
        dictation.rememberCaret();
        editor.caret = null;
        dictation.start();
        expect(dictation.span.start).toBe(3);
    });

    it('ignores caret movements while dictating', () => {
        editor.value = 'abcdef';
        editor.caret = 2;
        dictation.start();
        editor.caret = 5;
        dictation.rememberCaret();
        recognition.say('x');
        expect(dictation.span.start).toBe(2);
    });

    it('moveTo points the next dictation at a position', () => {
        editor.value = 'abcdef';
        editor.caret = null;
        dictation.moveTo(2);
        dictation.start();
        expect(dictation.span.start).toBe(2);
    });

    it('remembers where the previous dictation ended', () => {
        dictation.start();
        recognition.say('raz');
        dictation.stop();
        recognition.end();
        editor.caret = null;
        dictation.start();
        recognition.say('dwa');
        expect(editor.value).toBe('raz dwa ');
    });
});

describe('lifecycle', () => {
    it('announces start and the status line', () => {
        dictation.start();
        expect(events.started).toHaveLength(1);
        expect(lastStatus()).toEqual({ text: 'Słucham…', active: true });
        expect(dictation.listening).toBe(true);
    });

    it('toggles', () => {
        dictation.toggle();
        expect(dictation.listening).toBe(true);
        dictation.toggle();
        expect(dictation.listening).toBe(false);
    });

    it('ignores start while listening and stop while idle', () => {
        dictation.stop();
        dictation.start();
        dictation.start();
        expect(recognition.starts).toBe(1);
    });

    it('reports a recognizer that refuses to start', () => {
        recognition.start = () => { throw new DOMException('busy', 'InvalidStateError'); };
        dictation.start();
        expect(dictation.listening).toBe(false);
        expect(lastStatus().text).toBe('Błąd uruchamiania mikrofonu');
    });

    it('finishes after the engine acknowledges stop', () => {
        dictation.start();
        recognition.say('koniec dyktowania');
        dictation.stop();
        expect(events.finished).toEqual([]);
        recognition.end();
        expect(events.finished).toEqual([{ text: 'koniec dyktowania ' }]);
        expect(events.stopped).toHaveLength(1);
        expect(lastStatus()).toEqual({ text: 'Gotowy', active: false });
        expect(editor.focus).toHaveBeenCalled();
    });

    it('adds no space when stopped without anything dictated', () => {
        editor.value = 'tekst';
        editor.caret = 5;
        for (let i = 0; i < 3; i++) {
            dictation.start();
            dictation.stop();
            recognition.end();
        }
        expect(editor.value).toBe('tekst');
    });

    it('keeps interim text that never became final', () => {
        dictation.start();
        recognition.say('urwane', false);
        dictation.stop();
        recognition.end();
        expect(editor.value).toBe('urwane ');
        expect(events.finished[0].text).toBe('urwane ');
    });

    it('puts the caret after the dictated text', () => {
        editor.value = 'przed ';
        editor.caret = 6;
        dictation.start();
        recognition.say('tekst');
        dictation.stop();
        recognition.end();
        expect(editor.caret).toBe('przed tekst '.length);
    });
});

describe('the engine ending by itself', () => {
    it('restarts and keeps what was heard', () => {
        dictation.start();
        recognition.say('przed przerwą', false);
        recognition.end();
        expect(recognition.starts).toBe(2);
        recognition.say('po przerwie');
        expect(editor.value).toBe('przed przerwą po przerwie ');
    });

    it('survives a restart that throws because the engine is already running', () => {
        dictation.start();
        recognition.running = false;
        const start = recognition.start.bind(recognition);
        recognition.start = () => { recognition.start = start; throw new DOMException('x', 'InvalidStateError'); };
        expect(() => recognition.end()).not.toThrow();
        expect(dictation.listening).toBe(true);
    });
});

describe('stopping and starting again quickly', () => {
    it('waits for the engine to finish, then starts', () => {
        dictation.start();
        recognition.say('pierwsze');
        dictation.stop();
        dictation.start();               // the engine is still shutting down
        expect(dictation.listening).toBe(false);
        recognition.end();
        expect(dictation.listening).toBe(true);
        expect(recognition.starts).toBe(2);
        recognition.say('drugie');
        expect(editor.value).toBe('pierwsze drugie ');
    });

    it('forgets the pending start when stop is requested again', () => {
        dictation.start();
        dictation.stop();
        dictation.start();
        dictation.stop();
        recognition.end();
        expect(dictation.listening).toBe(false);
        expect(recognition.starts).toBe(1);
    });
});

describe('errors', () => {
    it('ignores "no-speech"', () => {
        dictation.start();
        const before = events.status.length;
        recognition.fail('no-speech');
        expect(events.status).toHaveLength(before);
    });

    it.each([
        ['not-allowed', 'Brak dostępu do mikrofonu'],
        ['audio-capture', 'Nie znaleziono mikrofonu'],
    ])('%s ends dictation and the message survives the following end event', (error, message) => {
        dictation.start();
        recognition.fail(error);
        expect(dictation.listening).toBe(false);
        expect(events.stopped).toHaveLength(1);
        recognition.end();
        expect(lastStatus().text).toBe(message);
        // and the next dictation reports "ready" again
        dictation.start();
        dictation.stop();
        recognition.end();
        expect(lastStatus().text).toBe('Gotowy');
    });

    it('shows unknown errors by name', () => {
        dictation.start();
        recognition.fail('weird');
        expect(lastStatus().text).toBe('Błąd: weird');
        expect(dictation.listening).toBe(true);
    });
});

describe('network trouble', () => {
    function failNetwork() {
        recognition.fail('network');
        recognition.end();
    }

    it('retries after a growing delay and tells the user', () => {
        dictation.start();
        failNetwork();
        expect(events.toast[0].text).toContain('internetu');
        expect(lastStatus()).toEqual({ text: 'Brak połączenia – ponawiam…', active: true });
        expect(recognition.starts).toBe(1);
        vi.advanceTimersByTime(1000);
        expect(recognition.starts).toBe(2);
        failNetwork();
        vi.advanceTimersByTime(1999);
        expect(recognition.starts).toBe(2);
        vi.advanceTimersByTime(1);
        expect(recognition.starts).toBe(3);
    });

    it('gives up after repeated failures and keeps the text', () => {
        dictation.start();
        recognition.say('zachowane');
        for (let i = 0; i < 5; i++) {
            failNetwork();
            vi.advanceTimersByTime(10_000);
        }
        expect(dictation.listening).toBe(false);
        expect(events.finished).toHaveLength(1);
        expect(editor.value).toBe('zachowane ');
        expect(events.toast.at(-1).text).toContain('przerwane');
    });

    it('starts counting again after a successful result', () => {
        dictation.start();
        for (let i = 0; i < 3; i++) {
            failNetwork();
            vi.advanceTimersByTime(10_000);
        }
        recognition.say('znowu działa');
        failNetwork();
        vi.advanceTimersByTime(1000);
        expect(dictation.listening).toBe(true);
        expect(recognition.starts).toBe(5);
    });

    it('does not restart if the user stopped while waiting to retry', () => {
        dictation.start();
        failNetwork();
        dictation.stop();
        vi.advanceTimersByTime(10_000);
        expect(recognition.starts).toBe(1);
    });
});

describe('loudness capitals', () => {
    const setup = (loud, enabled = true) => {
        const editor = new FakeEditor();
        const recognition = new FakeRecognition();
        const tracker = { takeSegment: vi.fn(() => loud) };
        const dictation = new Dictation({
            editor,
            createRecognition: () => recognition,
            loudness: { tracker, enabled: () => enabled },
        });
        dictation.start();
        return { editor, recognition, tracker };
    };

    it('writes a loud final phrase in capitals', () => {
        const { editor, recognition } = setup(true);
        recognition.say('to jest głośno');
        expect(editor.value).toBe('TO JEST GŁOŚNO ');
    });

    it('leaves a normal phrase alone', () => {
        const { editor, recognition } = setup(false);
        recognition.say('to jest cicho');
        expect(editor.value).toBe('to jest cicho ');
    });

    it('keeps learning but writes no capitals when the option is off', () => {
        const { editor, recognition, tracker } = setup(true, false);
        recognition.say('głośno');
        expect(tracker.takeSegment).toHaveBeenCalled();
        expect(editor.value).toBe('głośno ');
    });
});
