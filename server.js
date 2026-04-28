const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const { spawn } = require("child_process");

const PORT = process.env.PORT || 3100;
const ROOT = __dirname;
const STATIC_DIR = path.join(ROOT, "static");
const BASELINE_PATH = path.join(ROOT, "config", "baseline.json");
const PYTHON_BIN =
  process.env.CODEX_PYTHON ||
  "C:\\Users\\Jay\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
const DOC_TOOL = path.join(ROOT, "scripts", "doc_tools.py");

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text, type = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, { "Content-Type": type });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 30 * 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function runPython(args, stdinPayload) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [DOC_TOOL, ...args], {
      cwd: ROOT,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `Python exited with ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
    if (stdinPayload) {
      child.stdin.write(stdinPayload);
    }
    child.stdin.end();
  });
}

function base64ToTempFile(fileName, base64Data) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const target = path.join(os.tmpdir(), `${Date.now()}-${safeName}`);
  fs.writeFileSync(target, Buffer.from(base64Data, "base64"));
  return target;
}

function extractTextFromUpload(fileName, base64Data) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".docx") {
    const tempPath = base64ToTempFile(fileName, base64Data);
    return runPython(["extract", tempPath]).then((raw) => {
      try {
        return JSON.parse(raw).text || "";
      } finally {
        fs.rmSync(tempPath, { force: true });
      }
    });
  }
  return Promise.resolve(Buffer.from(base64Data, "base64").toString("utf-8"));
}

function loadBaseline() {
  const parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  const refs = parsed.referenceDocuments.map((name) => {
    const full = path.join(ROOT, name);
    return { name, exists: fs.existsSync(full) };
  });
  return { ...parsed, referencesStatus: refs };
}

function buildFallbackAnalysis(input) {
  const sections = input.baseline.playbook.map((item) => {
    const required = item.requiredClauses.map((clause) => `- ${clause.en}`).join("\n");
    const avoid = item.avoidClauses.map((clause) => `- ${clause.en}`).join("\n");
    return `## ${item.category}\nRisk: Review needed\nOur position: ${item.preferredPosition.en}\nRequired additions:\n${required}\nClauses to push back on:\n${avoid}`;
  });

  const ko = [
    "# 계약 비교 결과",
    "Claude API 키가 없거나 분석 호출이 실패하여 기본 비교 가이드를 표시합니다.",
    "당사 기준에 따라 아래 항목을 우선 검토하세요.",
    ...input.baseline.playbook.map(
      (item) =>
        `- ${item.category}: ${item.preferredPosition.ko} / 추가 필요 ${item.requiredClauses.length}개 / 삭제·축소 검토 ${item.avoidClauses.length}개`
    )
  ].join("\n");

  const en = [
    "# Contract Review Output",
    "Claude API was not available, so this is a standards-based fallback review.",
    ...sections
  ].join("\n\n");

  return {
    mode: "fallback",
    score: {
      favorableToUs: 54,
      vendorLeaning: 46
    },
    summaryKo: ko,
    summaryEn: en,
    editableDraft: `${ko}\n\n---\n\n${en}`
  };
}

function callClaude({ apiKey, vendorText, baseline, preferredLanguage }) {
  const system = [
    "You are a contracts analyst for a Korean company negotiating with overseas vendors.",
    "Compare the vendor contract against the internal baseline and produce JSON only.",
    "Assess what benefits or harms the company, what should be added, removed, narrowed, or revised.",
    "Return bilingual outputs in Korean and English.",
    "Be specific and practical for legal-business review, but do not claim to be a lawyer."
  ].join(" ");

  const prompt = {
    baseline,
    vendorContractText: vendorText.slice(0, 120000),
    outputFormat: {
      score: {
        favorableToUs: "0-100 integer",
        vendorLeaning: "0-100 integer"
      },
      keyFindings: [
        {
          category: "string",
          riskLevel: "high|medium|low",
          findingKo: "string",
          findingEn: "string",
          recommendationKo: "string",
          recommendationEn: "string"
        }
      ],
      summaryKo: "markdown string",
      summaryEn: "markdown string",
      editableDraft: "markdown string containing a proposed consolidated company-friendly contract language in bilingual form"
    },
    preferredLanguage
  };

  const body = JSON.stringify({
    model: "claude-3-7-sonnet-20250219",
    max_tokens: 4000,
    system,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: JSON.stringify(prompt) }]
      }
    ]
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-length": Buffer.byteLength(body)
        }
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk.toString()));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Claude API ${res.statusCode}: ${raw}`));
            return;
          }
          try {
            const parsed = JSON.parse(raw);
            const text = parsed.content?.map((item) => item.text || "").join("\n") || "{}";
            resolve(JSON.parse(text));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function handleAnalyze(req, res) {
  const payload = JSON.parse(await readBody(req));
  const baseline = payload.baseline || loadBaseline();
  const vendorText = await extractTextFromUpload(payload.fileName, payload.fileBase64);
  const input = {
    baseline,
    vendorText,
    preferredLanguage: payload.preferredLanguage || "ko,en"
  };

  try {
    if (!payload.apiKey) {
      return sendJson(res, 200, buildFallbackAnalysis(input));
    }
    const analysis = await callClaude({
      apiKey: payload.apiKey,
      vendorText,
      baseline,
      preferredLanguage: input.preferredLanguage
    });
    return sendJson(res, 200, { mode: "claude", ...analysis });
  } catch (error) {
    return sendJson(res, 200, {
      ...buildFallbackAnalysis(input),
      mode: "fallback",
      error: error.message
    });
  }
}

async function handleExport(req, res, kind) {
  const payload = JSON.parse(await readBody(req));
  const ext = kind === "docx" ? "docx" : "pdf";
  const outputPath = path.join(os.tmpdir(), `contract-output-${Date.now()}.${ext}`);
  await runPython([kind === "docx" ? "export-docx" : "export-pdf"], JSON.stringify({
    title: payload.title || "Contract Output",
    body: payload.body || "",
    outputPath
  }));
  const file = fs.readFileSync(outputPath);
  fs.rmSync(outputPath, { force: true });
  res.writeHead(200, {
    "Content-Type":
      kind === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf",
    "Content-Disposition": `attachment; filename="contract-output.${ext}"`
  });
  res.end(file);
}

function serveStatic(req, res) {
  const requested = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(STATIC_DIR, requested);
  if (!filePath.startsWith(STATIC_DIR) || !fs.existsSync(filePath)) {
    sendText(res, 404, "Not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  };
  sendText(res, 200, fs.readFileSync(filePath), types[ext] || "application/octet-stream");
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/baseline") {
      return sendJson(res, 200, loadBaseline());
    }
    if (req.method === "POST" && req.url === "/api/analyze") {
      return await handleAnalyze(req, res);
    }
    if (req.method === "POST" && req.url === "/api/export/docx") {
      return await handleExport(req, res, "docx");
    }
    if (req.method === "POST" && req.url === "/api/export/pdf") {
      return await handleExport(req, res, "pdf");
    }
    return serveStatic(req, res);
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Contract review studio running at http://localhost:${PORT}`);
});
