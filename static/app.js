(function () {
  const MIN_JD = 120;
  const SUPPORTED = /\.(pdf|docx|txt|md)$/i;

  const jdEl = document.getElementById("jd-text");
  const jdStatusEl = document.getElementById("jd-status");
  const refUrlEl = document.getElementById("ref-url");
  const fetchUrlBtn = document.getElementById("fetch-url");
  const folderEl = document.getElementById("folder");
  const filesEl = document.getElementById("files");
  const fileSummaryEl = document.getElementById("file-summary");
  const analyzeBtn = document.getElementById("analyze");
  const resetBtn = document.getElementById("reset");
  const progressEl = document.getElementById("progress");
  const errorEl = document.getElementById("error");
  const resultsSection = document.getElementById("results");
  const resultsMetaEl = document.getElementById("results-meta");
  const resultListEl = document.getElementById("result-list");
  const apiStatusEl = document.getElementById("api-status");
  const resumeCardStatusEl = document.getElementById("resume-card-status");
  const RESUME_CARD_DEFAULT = "분석 워크스페이스로 이동";

  /** @type {File[]} */
  let selectedFiles = [];
  let apiReady = false;

  function updateResumeCardFoot() {
    if (!resumeCardStatusEl) return;
    if (!selectedFiles.length) {
      resumeCardStatusEl.textContent = RESUME_CARD_DEFAULT;
      return;
    }
    resumeCardStatusEl.textContent = `이력서 ${selectedFiles.length}건 선택됨 · 워크스페이스에서 실행`;
  }

  function apiBase() {
    return "";
  }

  async function apiGet(path) {
    const r = await fetch(apiBase() + path, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function apiPost(path, body) {
    const r = await fetch(apiBase() + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    if (!r.ok) {
      let msg = text;
      try {
        const j = JSON.parse(text);
        if (j.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
      } catch {
        /* ignore */
      }
      throw new Error(msg || `HTTP ${r.status}`);
    }
    return JSON.parse(text);
  }

  async function checkHealth() {
    apiStatusEl.classList.remove("api-status--bad");
    apiStatusEl.textContent = "API 연결 확인 중…";
    try {
      const h = await apiGet("/api/health");
      if (h.openai_configured) {
        apiReady = true;
        apiStatusEl.textContent = "백엔드 연결됨 · Anthropic Claude 키 설정됨.";
      } else {
        apiReady = false;
        apiStatusEl.textContent =
          "백엔드는 응답하지만 ANTHROPIC_API_KEY가 없습니다. .env 파일에 키를 입력한 뒤 서버를 재시작하세요.";
        apiStatusEl.classList.add("api-status--bad");
      }
    } catch {
      apiReady = false;
      apiStatusEl.textContent =
        "백엔드에 연결할 수 없습니다. 같은 주소에서 python server.py 로 서버를 띄웠는지 확인하세요.";
      apiStatusEl.classList.add("api-status--bad");
    }
    syncAnalyzeEnabled();
  }

  function updateJdStatus() {
    const n = jdEl.value.trim().length;
    if (n === 0) {
      jdStatusEl.textContent = `JD·공고 본문을 입력하거나 URL로 불러오세요. (최소 ${MIN_JD}자 권장)`;
      return;
    }
    if (n < MIN_JD) {
      jdStatusEl.textContent = `${n}자 · 최소 ${MIN_JD}자 이상으로 보강해 주세요.`;
      return;
    }
    jdStatusEl.textContent = `${n}자 · 레퍼런스 준비됨.`;
  }

  function setFilesFromInput(fileList) {
    const arr = Array.from(fileList || []).filter((f) => SUPPORTED.test(f.name));
    selectedFiles = arr;
    if (arr.length === 0) {
      fileSummaryEl.textContent = "선택된 이력서 파일이 없습니다.";
    } else {
      fileSummaryEl.textContent = `${arr.length}개 파일 선택됨`;
    }
    updateResumeCardFoot();
    syncAnalyzeEnabled();
  }

  function syncAnalyzeEnabled() {
    const jdOk = jdEl.value.trim().length >= MIN_JD;
    analyzeBtn.disabled = !apiReady || !jdOk || selectedFiles.length === 0;
  }

  function showError(msg) {
    if (!msg) {
      errorEl.hidden = true;
      errorEl.textContent = "";
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = msg;
  }

  async function readTextFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(r.error);
      r.readAsText(file, "UTF-8");
    });
  }

  async function readPdfText(file) {
    if (!window.pdfjsLib) throw new Error("PDF 라이브러리를 불러오지 못했습니다.");
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const parts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((it) => it.str).join(" "));
    }
    return parts.join("\n");
  }

  async function readDocxText(file) {
    if (!window.mammoth) throw new Error("DOCX 라이브러리를 불러오지 못했습니다.");
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return value || "";
  }

  async function extractPlainText(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".txt") || name.endsWith(".md")) {
      return readTextFile(file);
    }
    if (name.endsWith(".pdf")) {
      return readPdfText(file);
    }
    if (name.endsWith(".docx")) {
      return readDocxText(file);
    }
    return "";
  }

  function scoreClass(pct) {
    if (pct >= 60) return "score-pill";
    if (pct >= 35) return "score-pill score-pill--mid";
    return "score-pill score-pill--low";
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderResults(payload) {
    const meta = payload.meta || {};
    const rows = payload.results || [];
    resultListEl.innerHTML = "";

    for (const row of rows) {
      const li = document.createElement("li");
      li.className = "result-card";

      const title = el("h3", "result-card__name", row.display_name || row.filename);
      const sub = el("p", "result-card__file", row.filename);
      const pill = el("div", scoreClass(row.score), `LLM 점수 ${row.score}`);
      const verdict = el("p", "verdict", row.verdict || "");
      const summary = el("p", "summary", row.summary || "");

      const cols = el("div", "cols", null);
      const left = el("div", null, null);
      left.appendChild(el("p", "mini-title", "강점"));
      const ulS = el("ul", "list-tight", null);
      for (const s of row.strengths || []) {
        const liS = el("li", null, s);
        ulS.appendChild(liS);
      }
      if (!ulS.children.length) ulS.appendChild(el("li", null, "(없음)"));
      left.appendChild(ulS);

      const right = el("div", null, null);
      right.appendChild(el("p", "mini-title", "보완·리스크"));
      const ulG = el("ul", "list-tight", null);
      for (const g of row.gaps || []) {
        ulG.appendChild(el("li", null, g));
      }
      if (!ulG.children.length) ulG.appendChild(el("li", null, "(없음)"));
      right.appendChild(ulG);

      cols.appendChild(left);
      cols.appendChild(right);

      const pts = el("div", null, null);
      pts.appendChild(el("p", "mini-title", "레퍼런스와의 접점"));
      const ulP = el("ul", "list-tight", null);
      for (const p of row.matched_reference_points || []) {
        ulP.appendChild(el("li", null, p));
      }
      if (!ulP.children.length) ulP.appendChild(el("li", null, "(없음)"));
      pts.appendChild(ulP);

      const rag = document.createElement("details");
      rag.className = "rag";
      const sum = document.createElement("summary");
      sum.textContent = "RAG로 선택된 JD 발췌 (유사도)";
      rag.appendChild(sum);

      const chunks = (row.rag && row.rag.chunks) || [];
      if (!chunks.length) {
        rag.appendChild(el("p", "rag-chunk", "발췌 없음"));
      } else {
        for (const c of chunks) {
          const block = el("div", "rag-chunk", null);
          const m = el("span", "rag-meta", `#${c.index + 1} · cos 유사 ${c.similarity ?? ""}`);
          block.appendChild(m);
          block.appendChild(document.createTextNode(c.preview || ""));
          rag.appendChild(block);
        }
      }

      li.appendChild(title);
      li.appendChild(sub);
      li.appendChild(pill);
      li.appendChild(verdict);
      li.appendChild(summary);
      li.appendChild(cols);
      li.appendChild(pts);
      li.appendChild(rag);
      resultListEl.appendChild(li);
    }

    resultsMetaEl.textContent = `총 ${rows.length}명 · JD ${meta.jd_chars ?? "?"}자 · 청크 ${meta.chunk_count ?? "?"} · 임베딩 ${meta.embed_model ?? ""} · LLM ${meta.chat_model ?? ""}`;
    resultsSection.hidden = rows.length === 0;
  }

  async function runAnalysis() {
    showError("");
    const jd = jdEl.value.trim();
    if (jd.length < MIN_JD) {
      showError(`JD·레퍼런스 본문이 너무 짧습니다. (${MIN_JD}자 이상)`);
      return;
    }
    if (!apiReady) {
      showError("백엔드 또는 OpenAI 설정을 확인하세요.");
      return;
    }
    if (selectedFiles.length === 0) {
      showError("이력서 파일을 먼저 선택하세요.");
      return;
    }

    analyzeBtn.disabled = true;
    resultsSection.hidden = true;
    progressEl.textContent = "이력서 텍스트 추출 중…";

    const resumes = [];
    const total = selectedFiles.length;
    for (let i = 0; i < total; i++) {
      const file = selectedFiles[i];
      progressEl.textContent = `텍스트 추출 ${i + 1} / ${total} — ${file.name}`;
      let text = "";
      try {
        text = await extractPlainText(file);
      } catch (e) {
        console.warn(e);
        text = "";
      }
      resumes.push({ filename: file.name, text });
    }

    progressEl.textContent = "RAG + LLM 스코어링 요청 중… (지원자 수에 따라 수 분 걸릴 수 있습니다)";
    try {
      const payload = await apiPost("/api/score-resumes", {
        jd_text: jd,
        resumes,
        top_k: 5,
      });
      renderResults(payload);
      progressEl.textContent = "완료.";
    } catch (e) {
      console.error(e);
      showError(e.message || "분석 요청 실패");
      progressEl.textContent = "";
    }

    analyzeBtn.disabled = false;
    syncAnalyzeEnabled();
  }

  fetchUrlBtn.addEventListener("click", async () => {
    const url = refUrlEl.value.trim();
    if (!url) {
      showError("URL을 입력하세요.");
      return;
    }
    showError("");
    fetchUrlBtn.disabled = true;
    progressEl.textContent = "URL에서 본문을 가져오는 중…";
    try {
      const data = await apiPost("/api/fetch-reference", { url });
      const block = data.text.trim();
      const header = data.title ? `【${data.title}】\n\n` : "";
      const merged = (jdEl.value.trim() ? jdEl.value.trim() + "\n\n---\n\n" : "") + header + block;
      jdEl.value = merged.trim();
      updateJdStatus();
      syncAnalyzeEnabled();
      progressEl.textContent = "URL 본문을 JD 칸에 반영했습니다.";
    } catch (e) {
      showError(e.message || "URL 불러오기 실패");
      progressEl.textContent = "";
    }
    fetchUrlBtn.disabled = false;
  });

  jdEl.addEventListener("input", () => {
    updateJdStatus();
    syncAnalyzeEnabled();
  });

  folderEl.addEventListener("change", (e) => {
    filesEl.value = "";
    setFilesFromInput(e.target.files);
  });

  filesEl.addEventListener("change", (e) => {
    folderEl.value = "";
    setFilesFromInput(e.target.files);
  });

  analyzeBtn.addEventListener("click", () => {
    runAnalysis().catch((err) => {
      console.error(err);
      showError(err.message || "분석 중 오류가 발생했습니다.");
      analyzeBtn.disabled = false;
      syncAnalyzeEnabled();
      progressEl.textContent = "";
    });
  });

  resetBtn.addEventListener("click", () => {
    jdEl.value = "";
    refUrlEl.value = "";
    folderEl.value = "";
    filesEl.value = "";
    selectedFiles = [];
    fileSummaryEl.textContent = "";
    updateJdStatus();
    syncAnalyzeEnabled();
    progressEl.textContent = "";
    showError("");
    resultsSection.hidden = true;
    resultListEl.innerHTML = "";
    updateResumeCardFoot();
  });

  updateJdStatus();
  updateResumeCardFoot();
  checkHealth();
})();
