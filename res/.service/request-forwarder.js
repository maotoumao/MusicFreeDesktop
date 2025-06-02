const http = require("http");
const https = require("https");


const defaultPort = 52735;
const maxRetries = 20;

let retryCount = 0;

function forwardRequest(clientRes, url, method, headers) {

    // 确保 host 正确
    let host = headers?.host;

    if (!host || host.includes("localhost") || host.includes("127.0.0.1")) {
        // 如果没有提供 host，且是本地请求，则使用目标 URL 的主机名
        host = new URL(url).host;
    }

    const options = {
        method: method,
        headers: {
            ...(headers || {}),
            host, // 确保目标主机名正确
        },
    };

    const protocol = url.startsWith("https") ? https : http;

    const req = protocol.request(url, options, (targetRes) => {
        // 将目标响应的状态码和头部转发到客户端
        clientRes.writeHead(targetRes.statusCode, targetRes.headers);

        // 将目标响应的数据流转发到客户端
        targetRes.pipe(clientRes, {
            end: true,
        });
    });

    req.on("error", (error) => {
        console.error("Error forwarding request:", error);
        clientRes.writeHead(500, { "Content-Type": "text/plain" });
        clientRes.end("Internal Server Error");
    });

    // 结束目标请求
    req.end();
}


function safeParse(data) {
    try {
        return JSON.parse(data) || {};
    } catch (e) {
        return {};
    }
}


function startServer(port) {

    // 创建一个 HTTP 服务器
    const server = http.createServer((req, res) => {
        if (req.method !== "GET") {
            res.writeHead(405, { "Content-Type": "text/plain" });
            return res.end("Only GET requests are allowed");
        }

        if (req.url === "/heartbeat") {
            res.writeHead(200, { "Content-Type": "text/plain" });
            return res.end("OK");
        }

        const query = new URLSearchParams(req.url.slice(1));


        const url = query.get("url");
        const method = query.get("method") || "GET"; // 默认使用 GET 方法
        const headers = safeParse(query.get("headers"));

        res.setHeader("Access-Control-Allow-Origin", "*"); // 允许所有源
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); // 允许的方法

        if (!url) {
            res.writeHead(400, { "Content-Type": "text/plain" });
            return res.end("Bad Request: Missing URL");
        }

        forwardRequest(res, url, method, {
            ...(req.headers || {}),
            ...(headers || {})
        });
    });

    server.listen(port, () => {
        process.send?.({
            type: "port",
            port
        });
        console.log(`Proxy server is running on http://localhost:${port}`);
    });

    server.on("error", (err) => {
        console.error("Server error:", err);
        if (retryCount < maxRetries) {
            retryCount++;
            const newPort = port + 1; // 尝试下一个端口
            console.log(`Retrying on port: ${newPort} (attempt ${retryCount})`);
            startServer(newPort);
        } else {
            process.send?.({ type: "error", error: "Max retries reached" });
        }
    })
}


startServer(defaultPort);
