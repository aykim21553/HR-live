(function () {
  const refreshBtn = document.getElementById("refresh-btn");
  const statusEl   = document.getElementById("status-text");
  const morningGrid   = document.getElementById("morning-grid");
  const educationList = document.getElementById("education-list");
  const confDomestic  = document.getElementById("conf-domestic");
  const confGlobal    = document.getElementById("conf-global");

  function esc(s) {
    return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  function fmtDate(v) {
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d)) return String(v).slice(0,10);
    return d.toLocaleDateString("ko-KR",{month:"2-digit",day:"2-digit"});
  }
  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
  function fmtKo(d) { return d.toLocaleDateString("ko-KR",{month:"long",day:"numeric"}); }

  // ── 날짜 범위 계산 및 UI 표시 ──
  const today    = new Date();
  const dateFrom = today;              // 오늘부터
  const dateTo   = addDays(today, 60); // 2개월 후
  const rangeStr = `${fmtKo(dateFrom)} ~ ${fmtKo(dateTo)}`;

  const dateRangeLabel = document.getElementById("date-range-label");
  if (dateRangeLabel) dateRangeLabel.textContent = rangeStr;

  const eduMeta = document.getElementById("edu-range-meta");
  if (eduMeta) eduMeta.textContent = `Agent Eddy 선별 · ${rangeStr} 일정 기준`;

  const confMeta = document.getElementById("conf-range-meta");
  if (confMeta) confMeta.textContent = `국내 4건 · 글로벌 4건 · ${rangeStr} 일정 기준`;

  /* ── 조간 브리핑 ── */
  function renderMorning(sections) {
    const cats = ["노무","채용","교육"];
    const catCls = {노무:"cat-노무", 채용:"cat-채용", 교육:"cat-교육"};
    const catIco = {노무:"⚖️", 채용:"🎯", 교육:"📚"};
    if (!sections || !Object.keys(sections).length) {
      morningGrid.innerHTML = `<div class="empty" style="grid-column:1/-1">수집된 뉴스가 없습니다.</div>`;
      return;
    }
    morningGrid.innerHTML = cats.map(cat => {
      const items = sections[cat] || [];
      const listHtml = items.length
        ? items.map(it => `
            <li class="brief-item">
              <a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a>
              ${it.summary ? `<div class="summary">${esc(it.summary)}</div>` : ""}
              <div class="brief-meta">
                ${esc(it.source||"")}${it.published_at ? " · "+fmtDate(it.published_at) : ""}
                ${it.relevance ? `<span class="relevance">관련도 ${it.relevance}/10</span>` : ""}
              </div>
            </li>`).join("")
        : `<li class="brief-item" style="color:#aaa;font-size:12px">수집된 기사 없음</li>`;
      return `
        <div class="brief-card">
          <div class="brief-cat ${catCls[cat]}">${catIco[cat]} ${cat}</div>
          <ol class="brief-list">${listHtml}</ol>
        </div>`;
    }).join("");
  }

  /* ── 교육 카드 ── */
  function renderEducation(items) {
    if (!items?.length) {
      educationList.innerHTML = `<div class="empty" style="grid-column:1/-1">교육 추천 데이터 없음</div>`;
      return;
    }
    educationList.innerHTML = items.slice(0,6).map(it => {
      const fmtCls = it.format === "온라인" ? "fp-online" : "fp-offline";
      return `
        <div class="edu-card">
          <div class="edu-card-head">
            <div class="edu-title">
              <a href="https://www.google.com/search?q=${encodeURIComponent(it.title+' '+it.organizer)}" target="_blank" rel="noopener">${esc(it.title)}</a>
            </div>
            <span class="edu-format-pill ${fmtCls}">${esc(it.format||"")}</span>
          </div>

          <div class="edu-info-grid">
            <div class="edu-info-item"><span class="edu-info-label">🏛️ 기관</span>${esc(it.organizer||"")}</div>
            <div class="edu-info-item"><span class="edu-info-label">💰 가격</span><span class="edu-price">${esc(it.price||"")}</span></div>
            <div class="edu-info-item"><span class="edu-info-label">📅 일정</span>${esc(it.schedule||"")}</div>
            <div class="edu-info-item"><span class="edu-info-label">⏱️ 시간</span>${esc(it.duration||"")}</div>
            ${it.location ? `<div class="edu-info-item" style="grid-column:1/-1"><span class="edu-info-label">📍 장소</span>${esc(it.location)}</div>` : ""}
          </div>

          <div style="display:flex;align-items:center;gap:6px">
            <span class="edu-info-label" style="font-size:10px">추천 대상</span>
            <span class="edu-for-pill">${esc(it.recommended_for||"")}</span>
          </div>

          ${it.reason ? `<div class="edu-reason"><span class="edu-reason-label">💡 추천 이유</span>${esc(it.reason)}</div>` : ""}
        </div>`;
    }).join("");
  }

  /* ── 컨퍼런스 카드 ── */
  const CATEGORY_STYLE = {
    "HR":       { bg:"rgba(98,91,113,0.09)",  color:"#625B71",  icon:"👥" },
    "디지털·AI": { bg:"rgba(13,107,71,0.09)",  color:"#0d6b47",  icon:"🤖" },
    "핀테크·금융":{ bg:"rgba(255,105,0,0.09)", color:"#FF6900",  icon:"💳" },
  };

  function renderConfCard(it) {
    const isGlobal = it.type === "글로벌";
    const cardCls  = isGlobal ? "conf-card global" : "conf-card domestic";
    const typeCls  = isGlobal ? "tp-global" : "tp-domestic";
    const topicsHtml = (it.topics||[]).map(t => `<span class="conf-topic-tag">${esc(t)}</span>`).join("");

    // 카테고리 배지
    const catKey = it.category || "HR";
    const catStyle = CATEGORY_STYLE[catKey] || CATEGORY_STYLE["HR"];
    const catBadge = `<span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:99px;background:${catStyle.bg};color:${catStyle.color};white-space:nowrap">${catStyle.icon} ${catKey}</span>`;

    return `
      <div class="${cardCls}">
        <div class="conf-card-head">
          <div class="conf-title">
            <a href="https://www.google.com/search?q=${encodeURIComponent(it.title+' '+it.organizer)}" target="_blank" rel="noopener">${esc(it.title)}</a>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
            <span class="conf-type-pill ${typeCls}">${isGlobal?"🌐 글로벌":"🇰🇷 국내"}</span>
            ${catBadge}
          </div>
        </div>

        <div class="conf-detail-row">
          <div class="conf-detail-item"><span class="conf-detail-icon">🏛️</span><span>${esc(it.organizer||"")}</span></div>
          <div class="conf-detail-item"><span class="conf-detail-icon">📅</span><span style="font-weight:600">${esc(it.date||"")}</span></div>
          <div class="conf-detail-item"><span class="conf-detail-icon">📍</span><span>${esc(it.venue||"")}</span></div>
          <div class="conf-detail-item"><span class="conf-detail-icon">💰</span><span class="conf-price">${esc(it.price||"")}</span></div>
          ${it.language ? `<div class="conf-detail-item"><span class="conf-detail-icon">🗣️</span><span>${esc(it.language)}</span></div>` : ""}
        </div>

        ${topicsHtml ? `<div class="conf-topics">${topicsHtml}</div>` : ""}
        ${it.description ? `<div style="font-size:12px;color:var(--mu);line-height:1.5">${esc(it.description)}</div>` : ""}
        ${it.recommend_reason ? `<div class="conf-reason"><span class="conf-reason-label">💡 참가 추천 이유</span>${esc(it.recommend_reason)}</div>` : ""}
      </div>`;
  }

  function renderConferences(data) {
    const domestic = (data.domestic || []).slice(0, 4);
    const global   = (data.global   || []).slice(0, 4);

    if (confDomestic) {
      confDomestic.innerHTML = domestic.length
        ? domestic.map(renderConfCard).join("")
        : `<div class="empty" style="grid-column:1/-1">국내 컨퍼런스 정보 없음</div>`;
    }
    if (confGlobal) {
      confGlobal.innerHTML = global.length
        ? global.map(renderConfCard).join("")
        : `<div class="empty" style="grid-column:1/-1">글로벌 컨퍼런스 정보 없음</div>`;
    }
  }

  /* ── 메인 로드 ── */
  async function loadDigest() {
    statusEl.textContent = `Agent Eddy 작업 중… (${rangeStr} 일정 기준, 30~60초 소요)`;
    statusEl.className = "status-text";
    refreshBtn.disabled = true;

    // 스켈레톤
    const sk = (h) => `<div class="brief-card"><div class="skeleton" style="height:${h}px"></div></div>`;
    morningGrid.innerHTML   = [1,2,3].map(()=>sk(200)).join("");
    educationList.innerHTML = [1,2].map(()=>sk(200)).join("");
    if(confDomestic) confDomestic.innerHTML = [1,2].map(()=>sk(200)).join("");
    if(confGlobal)   confGlobal.innerHTML   = [1,2].map(()=>sk(200)).join("");

    try {
      const res = await fetch(((location.hostname==="127.0.0.1"||location.hostname==="localhost")?"http://127.0.0.1:8765":"")+"/api/hr-newsroom/digest", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ morning_days:2, education_days:30, conference_days:21 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      renderMorning(data.morning_brief?.sections || {});
      renderEducation(data.education_recommendations?.items || []);
      renderConferences(data.conferences || {domestic:[], global:[]});

      const ts = data.generated_at
        ? new Date(data.generated_at).toLocaleString("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})
        : "";
      statusEl.textContent = `Agent Eddy 완료 · ${ts} · ${rangeStr} 기준`;

    } catch (e) {
      statusEl.textContent = "Agent Eddy 연결 실패 — python server.py 실행 여부를 확인하세요.";
      statusEl.className = "status-text error";
      morningGrid.innerHTML = `<div class="empty" style="grid-column:1/-1">서버에 연결할 수 없습니다.</div>`;
      educationList.innerHTML = "";
      console.error(e);
    } finally {
      refreshBtn.disabled = false;
    }
  }

  refreshBtn.addEventListener("click", loadDigest);
  loadDigest();
})();
