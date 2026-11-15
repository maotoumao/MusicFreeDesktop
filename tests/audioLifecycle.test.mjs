// Exercise the real TypeScript functions in memory, without Electron, network or audio.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playerDir = 'src/renderer/mainWindow/core/trackPlayer';
const a = { platform: 'test', id: 'a', title: 'A', artist: 'Artist' };
const b = { ...a, id: 'b', title: 'B' };
const source = { url: 'https://example.test/audio', quality: 'standard' };

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}

function harness() {
    const values = new Map();
    const atoms = Object.fromEntries(
        ['currentMusic', 'playerState', 'repeatMode', 'progress', 'quality'].map((key) => [
            `${key}Atom`,
            key,
        ]),
    );
    const store = { get: (key) => values.get(key), set: (key, value) => values.set(key, value) };
    const env = { requests: [], blobs: [], revoked: [], hls: [], session: {} };
    class AudioMock {
        src = '';
        paused = true;
        error = null;
        readyState = 0;
        currentTime = 0;
        duration = 120;
        plays = 0;
        loads = 0;
        constructor() {
            env.native = this;
        }
        pause() {
            this.paused = true;
        } // Deliberately no native pause event.
        play() {
            this.plays++;
            this.paused = false;
            return env.playPromise ?? Promise.resolve();
        }
        removeAttribute() {
            this.src = '';
        }
        load() {
            this.loads++;
            this.error = null;
            this.readyState = 0;
        }
    }
    class HlsMock {
        static Events = { ERROR: 'error' };
        config = {};
        constructor() {
            env.hls.push(this);
        }
        static isSupported() {
            return true;
        }
        attachMedia(audio) {
            this.audio = audio;
        }
        on(_event, callback) {
            this.onError = callback;
        }
        loadSource() {
            this.audio.src = 'blob:hls';
        }
        destroy() {
            this.destroyed = true;
        }
    }
    class URLMock extends URL {
        static createObjectURL(blob) {
            env.blobs.push(blob);
            return `blob:${env.blobs.length}`;
        }
        static revokeObjectURL(url) {
            env.revoked.push(url);
        }
    }
    const mocks = {
        eventemitter3: EventEmitter,
        'hls.js': HlsMock,
        '@infra/requestForwarder/renderer': { buildProxyUrl: (url) => url },
        './store': { store, ...atoms },
        './playQueue': class {},
        './lyricManager': class {},
        '@renderer/common/kvStore': { syncKV: { set() {}, remove() {} } },
        '@renderer/common/repeatModeMap': { REPEAT_MODE_MAP: {} },
        '@infra/musicSheet/renderer': { getRawMusicItem: async () => null },
        '@infra/pluginManager/renderer': { callPluginMethod: async () => null },
        '@infra/appConfig/renderer': { getConfigByKey: () => 'skip' },
        '@infra/downloadManager/renderer': {},
        '@infra/fsUtil/renderer': {},
        '@infra/appSync/renderer/main': {},
        '../recentlyPlayed': { addToRecentlyPlayed: async () => {} },
        '@common/delay': () => {
            env.delayStarted.resolve();
            return env.delayPromise;
        },
        '@common/throttle': (callback) => callback,
    };
    function load(relativePath) {
        const filename = path.resolve(root, relativePath);
        const { outputText, diagnostics } = ts.transpileModule(readFileSync(filename, 'utf8'), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2021,
                esModuleInterop: true,
            },
            reportDiagnostics: true,
        });
        assert.equal(diagnostics.length, 0, filename);
        const exports = {};
        vm.runInNewContext(
            outputText,
            {
                exports,
                require(name) {
                    if (Object.hasOwn(mocks, name)) return mocks[name];
                    if (name.startsWith('@common/')) return load(`src/common/${name.slice(8)}.ts`);
                    if (name.startsWith('.'))
                        return load(path.resolve(path.dirname(filename), `${name}.ts`));
                    throw new Error(`Unexpected dependency: ${name}`);
                },
                Audio: AudioMock,
                URL: URLMock,
                AbortController,
                HTMLMediaElement: { HAVE_METADATA: 1 },
                MediaMetadata: class {
                    constructor(data) {
                        Object.assign(this, data);
                    }
                },
                navigator: { mediaSession: env.session },
                location: { href: 'app://player' },
                fetch(url, options) {
                    const pending = deferred();
                    env.requests.push({ url, ...options, ...pending });
                    return pending.promise;
                },
            },
            { filename },
        );
        return exports;
    }
    env.constants = load('src/common/constant.ts');
    env.controller = load(`${playerDir}/audioController.ts`).createAudioController();
    mocks['./audioController'] = { createAudioController: () => env.controller };
    const player = load(`${playerDir}/index.ts`).default;
    let index = 0;
    player.playQueue = {
        queue: [a, b],
        isEmpty: false,
        getCurrentIndex: () => index,
        setCurrentIndex: (value) => (index = value),
        getCurrentMusic: () => player.playQueue.queue[index],
        getNextIndex: () => (index + 1) % 2,
    };
    player.audioController = env.controller;
    player.lyricManager = { async fetchLyric() {}, reset() {} };
    player.resolveSource = async () => source; // Keep the baseline URL/quality return contract.
    player.playRequested = true;
    player.bindAudioEvents();
    store.set(atoms.currentMusicAtom, a);
    store.set(atoms.qualityAtom, 'standard');
    store.set(atoms.progressAtom, { currentTime: 12, duration: 120 });
    return { ...env, env, player, store, atoms };
}

test('pause survives late initial/continuation/replacement sources; explicit resume still plays', async () => {
    for (const kind of ['initial', 'continuation', 'replacement']) {
        const { player, controller, native, store, atoms, constants } = harness();
        if (kind === 'replacement') controller.setTrackSource(source, a);
        const started = deferred(),
            pending = deferred();
        player.resolveSource = () => {
            started.resolve();
            return pending.promise;
        };
        const loading =
            kind === 'initial'
                ? player.playIndex(0)
                : kind === 'continuation'
                  ? player.resumeFromTruncation(23)
                  : player.setQuality('lossless');
        await started.promise;
        assert.equal(store.get(atoms.playerStateAtom), constants.PlayerState.Buffering);
        player.pause();
        assert.equal(store.get(atoms.playerStateAtom), constants.PlayerState.Paused);
        pending.resolve(source);
        await loading;
        assert.equal(controller.hasSource, true);
        native.oncanplay();
        assert.equal(native.plays, 0);
        assert.equal(store.get(atoms.playerStateAtom), constants.PlayerState.Paused);
        if (kind !== 'initial') {
            native.readyState = 1;
            native.onloadedmetadata();
            assert.equal(native.currentTime, kind === 'continuation' ? 23 : 12);
        }
        await player.advanceAfterCompletion();
        assert.equal(player.playQueue.getCurrentMusic().id, 'a');
        player.resume();
        assert.equal(native.plays, 1);
    }
});

test('pause cancels delayed error skip; a new explicit next still plays', async () => {
    const { env, player, native, store, atoms, constants } = harness();
    env.delayStarted = deferred();
    const delay = deferred();
    env.delayPromise = delay.promise;
    const handling = player.handlePlayError(a);
    await env.delayStarted.promise;
    player.pause();
    delay.resolve();
    await handling;
    assert.equal(player.playQueue.getCurrentMusic().id, 'a');
    assert.equal(native.plays, 0);
    assert.equal(store.get(atoms.playerStateAtom), constants.PlayerState.Paused);
    await player.skipToNext();
    assert.equal(player.playQueue.getCurrentMusic().id, 'b');
    assert.equal(native.plays, 1);
    assert.equal(store.get(atoms.playerStateAtom), constants.PlayerState.Buffering);
    native.onplaying();
    assert.equal(store.get(atoms.playerStateAtom), constants.PlayerState.Playing);
});

test('older same-track requests cannot attach or reset a newer source', async () => {
    for (const fail of [false, true]) {
        const { player, native } = harness();
        const started = deferred(),
            pending = deferred();
        player.resolveSource = () => {
            started.resolve();
            return pending.promise;
        };
        const older = player.playIndex(0);
        await started.promise;
        player.resolveSource = async () => ({ ...source, url: 'https://example.test/new' });
        await player.playIndex(0);
        if (fail) pending.reject(new Error('Old request failed'));
        else pending.resolve(source);
        await older;
        assert.equal(native.src, 'https://example.test/new');
        assert.equal(native.plays, 1);
    }
});

test('prepare/reset/destroy invalidate fetches and release HLS and Blob resources', async () => {
    const { env, controller, native, session } = harness();
    const errors = [];
    controller.on('error', (...args) => errors.push(args));
    const headers = { 'X-Test': 'mock' };
    controller.setTrackSource({ ...source, headers }, a);
    const old = env.requests[0];
    const blob = deferred();
    const reading = deferred();
    old.resolve({
        ok: true,
        blob: () => {
            reading.resolve();
            return blob.promise;
        },
    });
    await reading.promise;
    controller.prepareTrack(b);
    assert.equal(old.signal.aborted, true);
    assert.equal(session.metadata.title, b.title);
    blob.resolve({});
    await new Promise(setImmediate);
    assert.equal(native.src, '');
    assert.equal(env.blobs.length, 0);
    controller.setTrackSource({ ...source, headers }, b);
    env.requests[1].resolve({ ok: true, blob: async () => ({}) });
    await new Promise(setImmediate);
    assert.equal(native.src, 'blob:1');
    controller.setTrackSource({ url: 'https://example.test/audio.m3u8' }, b);
    assert.deepEqual(env.revoked, ['blob:1']);
    const hls = env.hls[0];
    controller.reset();
    assert.equal(hls.destroyed, true);
    hls.onError('error', { fatal: true });
    assert.equal(errors.length, 0);
    assert.equal(session.metadata, null);
    controller.setTrackSource({ ...source, headers }, a);
    controller.destroy();
    assert.equal(env.requests[2].signal.aborted, true);
    env.requests[2].reject(new Error('Canceled request'));
    await new Promise(setImmediate);
    assert.equal(native.src, '');
    assert.equal(native.loads, 7);
});

test('source-less pause notifies immediately; native errors force resume to resolve again', async () => {
    const { env, player, controller, native, constants, session } = harness();
    const states = [],
        errors = [];
    controller.removeAllListeners();
    controller.on('stateChange', (state) => states.push(state));
    controller.on('error', (...args) => errors.push(args));
    controller.prepareTrack(a);
    controller.setTrackSource({ ...source, headers: { 'X-Test': 'mock' } }, a);
    controller.play();
    controller.pause();
    controller.pause();
    assert.deepEqual(states, [constants.PlayerState.Paused, constants.PlayerState.Paused]);
    assert.equal(session.playbackState, 'paused');
    env.requests[0].resolve({ ok: true, blob: async () => ({}) });
    await new Promise(setImmediate);
    native.oncanplay();
    assert.equal(native.plays, 0);
    native.error = { code: 3 };
    native.onerror({ type: 'error' });
    assert.equal(errors.length, 1);
    assert.equal(controller.hasSource, false);
    controller.play();
    assert.equal(native.plays, 0);
    const resolved = deferred();
    player.resolveSource = async () => {
        resolved.resolve();
        return source;
    };
    player.resume();
    await resolved.promise;
    await new Promise(setImmediate);
    assert.equal(native.src, source.url);
    assert.equal(native.plays, 1);
    assert.equal(session.metadata.title, a.title);
});
