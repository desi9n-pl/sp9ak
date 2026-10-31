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
    abort() { if (this.running) this.end(); }
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
    ['status', 'started', 'stopped', 'toast', 'finished', 'began', 'ended'].forEach(record);
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

    it('reports where the words still being recognized end, while the caret stays before them', () => {
        editor.value = 'Start  koniec';
        editor.caret = 6;
        dictation.start();
        expect(dictation.interimEnd).toBe(null);
        recognition.results(['gotowe', true], ['w toku', false]);
        expect(editor.value).toBe('Start gotowe w toku koniec');
        expect(editor.caret).toBe(13);
        expect(dictation.interimEnd).toBe(19);
        recognition.say('gotowe w toku');
        expect(dictation.interimEnd).toBe(null);
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

    it('keeps a phrase in one line when Enter comes before it is final, and breaks the line after it', () => {
        dictation.start();
        recognition.say('raz');
        recognition.say('dwa', false);
        editor.type('\n', 'raz '.length);
        expect(editor.value).toBe('raz dwa');
        recognition.say('dwa');
        expect(editor.value).toBe('raz dwa\n');
    });

    it('does not split "przygotować się porządnie na TC marketingowe" when Enter is pressed mid-phrase', () => {
        dictation.start();
        recognition.say('przygotować się porządnie na', false);
        editor.type('\n', 0);
        recognition.say('przygotować się porządnie na TC marketingowe');
        expect(editor.value).toBe('przygotować się porządnie na TC marketingowe\n');
        recognition.say('następna linia');
        expect(editor.value).toBe('przygotować się porządnie na TC marketingowe\nnastępna linia ');
    });

    it('applies the line break when dictation stops before the phrase became final', () => {
        dictation.start();
        recognition.say('raz');
        recognition.say('dwa', false);
        editor.type('\n', 'raz '.length);
        dictation.stop();
        recognition.end();
        expect(editor.value).toBe('raz dwa\n');
    });

    it('drops the unfinished phrase even when Chrome gave it a leading space', () => {
        dictation.start();
        recognition.say('na');
        recognition.say(' TC marketingowe', false);
        editor.type('\n', 'na '.length);
        recognition.say(' TC marketingowe');
        expect(editor.value.match(/TC marketingowe/g)).toHaveLength(1);
    });

    it('writes each dictated sentence once across several Enter presses', () => {
        dictation.start();
        recognition.say('pierwsze');
        recognition.say(' drugie zdanie', false);
        editor.type('\n', editor.value.length - ' drugie zdanie'.length);
        recognition.say(' drugie zdanie');
        recognition.say(' trzecie', false);
        editor.type('\n', editor.caret);
        recognition.say(' trzecie');
        expect(editor.value.match(/drugie zdanie/g)).toHaveLength(1);
        expect(editor.value.match(/trzecie/g)).toHaveLength(1);
        expect(editor.value.match(/pierwsze/g)).toHaveLength(1);
    });

    it('keeps the final text when Enter comes with no unfinished phrase', () => {
        dictation.start();
        recognition.say('raz');
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

describe('began and ended (one pair per dictation, for the sound cues)', () => {
    it('come once even when the engine restarts by itself', () => {
        dictation.start();
        recognition.end();
        recognition.end();
        expect(events.started).toHaveLength(3);
        expect(events.began).toHaveLength(1);
        dictation.stop();
        recognition.end();
        expect(events.ended).toEqual([{ failed: false }]);
    });

    it('come again for the next dictation', () => {
        for (let i = 0; i < 2; i++) {
            dictation.start();
            dictation.stop();
            recognition.end();
        }
        expect(events.began).toHaveLength(2);
        expect(events.ended).toHaveLength(2);
    });

    it('end once, as failed, after a fatal error', () => {
        dictation.start();
        recognition.fail('not-allowed');
        recognition.end();
        expect(events.ended).toEqual([{ failed: true }]);
        dictation.start();
        dictation.stop();
        recognition.end();
        expect(events.ended.at(-1)).toEqual({ failed: false });
    });

    it('end as failed when the network keeps failing', () => {
        dictation.start();
        for (let i = 0; i < 5; i++) {
            recognition.fail('network');
            recognition.end();
            vi.advanceTimersByTime(10_000);
        }
        expect(events.ended).toEqual([{ failed: true }]);
    });

    it('end as failed when the microphone cannot start', () => {
        recognition.start = () => { throw new Error('busy'); };
        dictation.start();
        expect(events.began).toHaveLength(0);
        expect(events.ended).toEqual([{ failed: true }]);
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

describe('stopping always completes', () => {
    function failNetwork() {
        recognition.fail('network');
        recognition.end();
    }

    it('finishes at once when stopped while waiting to retry after a network error', () => {
        dictation.start();
        recognition.say('zachowane');
        failNetwork();
        dictation.stop();
        // no engine is running, so nobody would ever acknowledge the stop
        expect(events.finished).toEqual([{ text: 'zachowane ' }]);
        expect(events.stopped).toHaveLength(1);
        expect(events.ended).toEqual([{ failed: false }]);
        expect(lastStatus()).toEqual({ text: 'Gotowy', active: false });
    });

    it('can start again after being stopped during a retry wait', () => {
        dictation.start();
        failNetwork();
        dictation.stop();
        dictation.start();
        expect(dictation.listening).toBe(true);
        expect(recognition.starts).toBe(2);
        vi.advanceTimersByTime(10_000);
        expect(recognition.starts).toBe(2); // the old retry timer is gone
    });

    it('tells the user that it is stopping', () => {
        dictation.start();
        dictation.stop();
        expect(lastStatus().text).toBe('Zatrzymuję…');
    });

    it('gives up waiting for an engine that never reports the end', () => {
        dictation.start();
        recognition.say('tekst');
        dictation.stop();
        vi.advanceTimersByTime(1999);
        expect(events.finished).toEqual([]);
        vi.advanceTimersByTime(1);
        expect(events.finished).toEqual([{ text: 'tekst ' }]);
        expect(events.stopped).toHaveLength(1);
        expect(lastStatus()).toEqual({ text: 'Gotowy', active: false });
    });

    it('asks a silent engine to abort', () => {
        recognition.abort = vi.fn();
        dictation.start();
        dictation.stop();
        vi.advanceTimersByTime(2000);
        expect(recognition.abort).toHaveBeenCalled();
    });

    it('ignores the late end of an engine it already gave up on', () => {
        dictation.start();
        dictation.stop();
        vi.advanceTimersByTime(2000);
        recognition.end();
        expect(events.finished).toHaveLength(1);
        expect(events.stopped).toHaveLength(1);
        expect(events.ended).toHaveLength(1);
    });

    it('cancels the wait when the engine does end', () => {
        dictation.start();
        dictation.stop();
        recognition.end();
        vi.advanceTimersByTime(5000);
        expect(events.finished).toHaveLength(1);
    });

    it('can dictate again after a forced finish', () => {
        dictation.start();
        dictation.stop();
        vi.advanceTimersByTime(2000);
        recognition.end();               // the abandoned session ends eventually
        dictation.start();
        expect(dictation.listening).toBe(true);
        expect(recognition.starts).toBe(2);
        recognition.say('nowe');
        expect(editor.value).toBe('nowe ');
    });

    it('finishes after a fatal error even when stop was pressed meanwhile', () => {
        dictation.start();
        recognition.fail('not-allowed');
        dictation.stop();
        recognition.end();
        expect(events.finished).toHaveLength(1);
        expect(events.ended).toEqual([{ failed: true }]);
    });
});

/** Random key presses and engine events: whatever happens, the last stop must really stop. */
describe('stopping survives random event orders', () => {
    function rng(seed) {
        let s = seed;
        return () => {
            s = (s * 1664525 + 1013904223) % 4294967296;
            return s / 4294967296;
        };
    }

    const STEPS = [
        () => dictation.toggle(),
        () => dictation.start(),
        () => dictation.stop(),
        () => recognition.running && recognition.say('słowo', Math.random() < 0.5),
        () => recognition.running && recognition.end(),
        () => recognition.running && (recognition.fail('network'), recognition.end()),
        () => recognition.running && recognition.fail('no-speech'),
        () => vi.advanceTimersByTime(400),
        () => vi.advanceTimersByTime(3000),
    ];

    it.each(Array.from({ length: 200 }, (_, i) => i + 1))('seed %i', seed => {
        const random = rng(seed);
        vi.spyOn(Math, 'random').mockImplementation(random);
        for (let i = 0; i < 60; i++) STEPS[Math.floor(random() * STEPS.length)]();

        dictation.stop();
        if (recognition.running && random() < 0.5) recognition.end();
        vi.advanceTimersByTime(60_000);

        expect(dictation.listening).toBe(false);
        // not stuck: a fresh start reaches the engine, or is already queued behind a finished stop
        dictation.start();
        expect(dictation.listening).toBe(true);
        dictation.stop();
        if (recognition.running) recognition.end();
        vi.advanceTimersByTime(60_000);
        expect(dictation.listening).toBe(false);
        // every dictation that began has ended exactly once
        expect(events.ended.length).toBe(events.began.length);
        expect(events.finished.length).toBe(events.began.length);
        vi.restoreAllMocks();
    });
});
