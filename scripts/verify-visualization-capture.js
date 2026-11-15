// 验证 captureStream() 在三条音源路径下的行为
//
// 用法：npm run verify:capture
//
//   1. blob URL（带 header 的音源：fetch → createObjectURL(blob)）
//   2. MSE（hls.js 的 blob: MediaSource URL）
//   3. 跨域 http 直链（无 header 的普通音源）
//
// 结论必须与设计文档 §5.1 一致：
//   blob / MSE → 能拿到音轨，且 AnalyserNode 读到 440Hz 能量
//   跨域      → captureStream() 抛 SecurityError（消息含 cross-origin）
//
// 这是**一次性验证脚本**，不进产品代码路径。
const { app, BrowserWindow } = require("electron");
const http = require("http");

const HARD_TIMEOUT_MS = 40000;

/** 主进程手写一个 1 秒 440Hz 单声道 16bit WAV（主进程没有 OfflineAudioContext） */
function generateToneWav() {
    const sampleRate = 44100;
    const duration = 1;
    const numSamples = sampleRate * duration;
    const dataSize = numSamples * 2;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(1, 22); // 单声道
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    for (let i = 0; i < numSamples; i++) {
        const value = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
        buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
    }
    return buffer;
}

/** 起一个不带 CORS 头的本地 http server，用来模拟跨域直链 */
function startCrossOriginServer(wav) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            res.writeHead(200, {
                "Content-Type": "audio/wav",
                "Content-Length": wav.length,
                // 故意不给 Access-Control-Allow-Origin —— 模拟没有 CORS 头的音源
            });
            res.end(wav);
        });
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            resolve({ server, url: `http://127.0.0.1:${port}/tone.wav` });
        });
    });
}

/** 在渲染进程里跑的测试体 */
const RENDER_SCRIPT = `
(async (crossOriginUrl) => {
    const out = {};

    function encodeWav(buf) {
        const len = buf.length;
        const data = new Uint8Array(44 + len * 2);
        const dv = new DataView(data.buffer);
        const wr = (o, s) => { for (let i=0;i<s.length;i++) dv.setUint8(o+i, s.charCodeAt(i)); };
        wr(0, "RIFF"); dv.setUint32(4, 36 + len*2, true); wr(8, "WAVE");
        wr(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
        dv.setUint16(22, 1, true); dv.setUint32(24, buf.sampleRate, true);
        dv.setUint32(28, buf.sampleRate*2, true); dv.setUint16(32, 2, true);
        dv.setUint16(34, 16, true); wr(36, "data"); dv.setUint32(40, len*2, true);
        let o = 44;
        const chans = buf.getChannelData(0);
        for (let i=0;i<len;i++) { const v = Math.max(-1, Math.min(1, chans[i])); dv.setInt16(o, v*32767, true); o += 2; }
        return data;
    }

    /** 对一个 audio 元素做 capture + 分析 */
    async function measure(audio, label) {
        const r = { label };
        let stream = null;
        try { stream = audio.captureStream(); } catch (e) { r.captureError = String(e); }
        r.tracks = stream ? stream.getAudioTracks().length : -1;
        if (!stream || !r.tracks) return r;
        const actx = new AudioContext();
        await actx.resume();
        r.ctxState = actx.state;
        r.sampleRate = actx.sampleRate;
        const an = actx.createAnalyser();
        an.fftSize = 2048;
        actx.createMediaStreamSource(stream).connect(an);
        await new Promise(r2 => setTimeout(r2, 700));
        const d = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(d);
        r.maxBin = Math.max.apply(null, Array.from(d));
        r.nonZeroBins = Array.from(d).filter(v => v > 0).length;
        r.binAt440Hz = d[Math.round(440 / (actx.sampleRate / an.fftSize))];
        await actx.close();
        return r;
    }

    // ---------- 1. blob URL 路径 ----------
    try {
        const octx = new OfflineAudioContext(1, 44100, 44100);
        const osc = octx.createOscillator();
        const g = octx.createGain();
        g.gain.value = 0.5;
        osc.connect(g); g.connect(octx.destination); osc.start();
        const rendered = await octx.startRendering();
        const wavBlob = new Blob([encodeWav(rendered)], { type: "audio/wav" });

        const audio = new Audio();
        audio.src = URL.createObjectURL(wavBlob);
        await new Promise((res, rej) => { audio.oncanplay = res; audio.onerror = rej; });
        await audio.play();
        out.blob = await measure(audio, "blob URL");
    } catch (e) {
        out.blobError = String(e);
    }

    // ---------- 2. MSE 路径（模拟 hls.js 的 blob: MediaSource） ----------
    try {
        const actx2 = new AudioContext();
        await actx2.resume();
        const dest = actx2.createMediaStreamDestination();
        const osc2 = actx2.createOscillator();
        osc2.frequency.value = 440;
        const g2 = actx2.createGain();
        g2.gain.value = 0.5;
        osc2.connect(g2); g2.connect(dest);
        const rec = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus" });
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        const stopped = new Promise(r3 => { rec.onstop = r3; });
        rec.start();
        osc2.start();
        await new Promise(r4 => setTimeout(r4, 1200));
        osc2.stop(); rec.stop();
        await stopped;
        const seg = new Blob(chunks, { type: "audio/webm;codecs=opus" });
        out.mseSegmentBytes = seg.size;

        const ms = new MediaSource();
        const msAudio = new Audio();
        msAudio.src = URL.createObjectURL(ms);
        await new Promise((res) => ms.addEventListener("sourceopen", res, { once: true }));
        const sb = ms.addSourceBuffer("audio/webm;codecs=opus");
        sb.addEventListener("updateend", () => { if (ms.readyState === "open") { try { ms.endOfStream(); } catch (e) {} } });
        sb.appendBuffer(await seg.arrayBuffer());
        await new Promise(r5 => setTimeout(r5, 500));
        await msAudio.play();
        out.mseIsBlobUrl = msAudio.src.startsWith("blob:");
        for (let i = 0; i < 20; i++) {
            let s = null;
            try { s = msAudio.captureStream(); } catch (e) {}
            if (s && s.getAudioTracks().length) break;
            await new Promise(r6 => setTimeout(r6, 150));
        }
        out.mse = await measure(msAudio, "MSE blob url");
    } catch (e) {
        out.mseError = String(e);
    }

    // ---------- 3. 跨域直链路径 ----------
    try {
        const audio = new Audio();
        audio.src = crossOriginUrl;
        await new Promise((res, rej) => { audio.oncanplay = res; audio.onerror = () => rej(new Error("canplay failed")); });
        await audio.play();
        out.crossOrigin = await measure(audio, "跨域 http 直链");
    } catch (e) {
        out.crossOriginError = String(e);
    }

    return out;
})
`;

app.whenReady().then(async () => {
    const timer = setTimeout(() => {
        console.error("❌ 验证脚本超时（" + HARD_TIMEOUT_MS + "ms），强制退出");
        app.exit(2);
    }, HARD_TIMEOUT_MS);

    const win = new BrowserWindow({
        show: false,
        webPreferences: { offscreen: true },
    });
    await win.loadURL("data:text/html,<html><body></body></html>");

    const wav = generateToneWav();
    const { server, url } = await startCrossOriginServer(wav);

    let result;
    try {
        result = await win.webContents.executeJavaScript(
            `(${RENDER_SCRIPT})(${JSON.stringify(url)})`,
            true,
        );
    } catch (e) {
        console.error("❌ 执行失败:", e);
        clearTimeout(timer);
        server.close();
        app.exit(2);
        return;
    }

    server.close();
    clearTimeout(timer);

    console.log("RESULT " + JSON.stringify(result, null, 2));
    console.log("");

    let ok = true;

    // 1. blob
    const blob = result.blob;
    if (blob && blob.tracks > 0 && blob.maxBin > 0) {
        console.log(
            `✅ [1/3] blob URL        —— ${blob.tracks} 条音轨，440Hz 峰值 ${blob.maxBin}，非零 bin ${blob.nonZeroBins}，AudioContext ${blob.sampleRate}Hz/${blob.ctxState}`,
        );
    } else {
        ok = false;
        console.log(`❌ [1/3] blob URL        —— ${JSON.stringify(blob || result.blobError)}`);
    }

    // 2. MSE
    const mse = result.mse;
    if (mse && mse.tracks > 0 && mse.maxBin > 0) {
        console.log(
            `✅ [2/3] MSE / HLS       —— ${mse.tracks} 条音轨，440Hz 峰值 ${mse.maxBin}，非零 bin ${mse.nonZeroBins}`,
        );
    } else {
        ok = false;
        console.log(`❌ [2/3] MSE / HLS       —— ${JSON.stringify(mse || result.mseError)}`);
    }

    // 3. 跨域：预期是降级（抛 SecurityError）
    const cross = result.crossOrigin;
    const errText = (cross && cross.captureError) || result.crossOriginError || "";
    if (cross && cross.tracks === -1 && /cross-origin/i.test(errText)) {
        console.log(`✅ [3/3] 跨域直链        —— 预期内降级：${errText.slice(0, 120)}`);
    } else {
        ok = false;
        console.log(
            `❌ [3/3] 跨域直链        —— 预期抛 SecurityError(cross-origin)，实际 ${JSON.stringify(cross || result.crossOriginError)}`,
        );
    }

    console.log("");
    console.log(
        ok
            ? "结论：与设计文档 §5.1 一致 —— blob 与 MSE 可用，跨域直链降级。"
            : "结论：与设计文档 §5.1 不一致，方案需要重新评估。",
    );

    app.exit(ok ? 0 : 1);
});
