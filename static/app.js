const experts = [
  {
    id: "law",
    name: "노무법률",
    role: "판례/절차 리스크",
    avatar: "법",
    tone: "절차와 입증자료를 먼저 봅니다."
  },
  {
    id: "er",
    name: "ER",
    role: "노사관계/커뮤니케이션",
    avatar: "관",
    tone: "관계 훼손과 메시지 관리를 점검합니다."
  },
  {
    id: "people",
    name: "People Ops",
    role: "제도/운영 설계",
    avatar: "운",
    tone: "실행 가능한 프로세스로 바꿉니다."
  },
  {
    id: "pay",
    name: "보상/근태",
    role: "임금/시간/기록",
    avatar: "임",
    tone: "수당, 근태, 기록 누락을 확인합니다."
  }
];

const playbook = [
  {
    title: "PIP 운영",
    risk: "high",
    summary: "성과 기준, 피드백 이력, 개선 기간, 지원 조치를 문서화한 뒤 후속 인사조치를 검토합니다."
  },
  {
    title: "전환배치",
    risk: "medium",
    summary: "업무상 필요성, 생활상 불이익, 협의 절차, 직무 적합성을 함께 검토해야 합니다."
  },
  {
    title: "징계",
    risk: "high",
    summary: "취업규칙 근거, 징계양정, 소명 기회, 징계위원회 절차가 핵심입니다."
  },
  {
    title: "근로시간",
    risk: "medium",
    summary: "실근로 기록, 승인 체계, 포괄임금 적용 가능성, 휴게시간 운영을 대조합니다."
  },
  {
    title: "직장 내 괴롭힘",
    risk: "high",
    summary: "인지 즉시 분리, 조사 독립성, 피해자 보호, 2차 피해 방지를 우선합니다."
  },
  {
    title: "계약직/파견",
    risk: "medium",
    summary: "사용사업주 지휘명령, 갱신기대권, 기간제 예외 사유를 사전에 점검합니다."
  }
];

const state = {
  messages: [],
  issues: [
    {
      title: "성과부진 PIP 운영",
      risk: "high",
      owner: "People Ops",
      summary: "평가 근거와 개선기회 부여 여부가 핵심 쟁점입니다."
    },
    {
      title: "선택근로제 근태 기록",
      risk: "medium",
      owner: "보상/근태",
      summary: "정산기간과 실근로 기록 보존 체계를 재점검해야 합니다."
    },
    {
      title: "부서 이동 거부",
      risk: "medium",
      owner: "ER",
      summary: "업무상 필요성과 생활상 불이익 비교가 필요합니다."
    },
    {
      title: "퇴직 합의서 문구",
      risk: "low",
      owner: "노무법률",
      summary: "합의 의사와 정산 범위를 명확히 남기는 것이 좋습니다."
    }
  ]
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function renderExperts() {
  $("#expertStack").innerHTML = experts
    .map(
      (expert) => `
        <div class="expert-card">
          <div class="avatar">${expert.avatar}</div>
          <div>
            <strong>${expert.name}</strong>
            <span>${expert.role}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function selectedTags() {
  return $$(".tag.active").map((tag) => tag.dataset.tag);
}

function caseData() {
  return {
    title: $("#caseTitle").value.trim(),
    org: $("#orgName").value.trim(),
    urgency: $("#urgency").value,
    summary: $("#caseSummary").value.trim(),
    tags: selectedTags()
  };
}

function riskFromCase(data) {
  const text = `${data.title} ${data.summary} ${data.tags.join(" ")}`;
  let score = data.urgency === "high" ? 72 : data.urgency === "medium" ? 55 : 38;
  if (/해고|징계|괴롭힘|산재|임금|해고위험/.test(text)) score += 16;
  if (/PIP|성과|평가|전환배치/.test(text)) score += 10;
  if (/서면|기록|피드백|협의/.test(text)) score -= 8;
  score = Math.max(20, Math.min(95, score));
  return {
    level: score >= 75 ? "high" : score >= 50 ? "medium" : "low",
    legal: score,
    relation: Math.max(30, Math.min(92, score - 12 + data.tags.length * 4)),
    readiness: Math.max(18, Math.min(90, 100 - score + (text.includes("기록") ? 12 : 0)))
  };
}

function buildExpertMessages(data, risk) {
  const tagText = data.tags.length ? data.tags.join(", ") : "태그 없음";
  return [
    {
      expert: experts[0],
      text: `현재 쟁점은 ${tagText}입니다. ${data.title} 사안은 결론보다 절차가 먼저입니다. 평가 기준, 피드백 이력, 개선 기회가 문서로 남아 있지 않으면 후속 조치의 방어력이 약해집니다.`
    },
    {
      expert: experts[1],
      text: `팀장이 원하는 속도와 당사자의 수용 가능성 사이에 간극이 큽니다. 면담 메시지는 “퇴출”이 아니라 “개선 지원과 역할 적합성 검토”로 정리하는 편이 안전합니다.`
    },
    {
      expert: experts[2],
      text: `실행안은 1차 면담, 목표 합의, 6~8주 개선기간, 주간 피드백, 중간 리뷰, 최종 리뷰 순서가 좋습니다. 각 단계마다 참석자, 일시, 합의 내용을 남겨야 합니다.`
    },
    {
      expert: experts[3],
      text: `전환배치나 PIP 중 근로조건이 바뀌면 임금, 근로시간, 직책수당 변동 여부를 별도로 확인해야 합니다. 불이익 변경처럼 보이지 않게 기준을 분리해 두세요.`
    },
    {
      expert: { name: "클럽 결론", role: "Action", avatar: "결" },
      text: `리스크 등급은 ${risk.level.toUpperCase()}입니다. 즉시 불이익 조치보다 자료 정비와 개선 프로세스를 먼저 운영한 뒤, 결과에 따라 전환배치 또는 별도 인사조치를 검토하는 방향을 권고합니다.`
    }
  ];
}

function addMessage(message) {
  state.messages.push({ ...message, time: new Date() });
  renderMessages();
}

function renderMessages() {
  const feed = $("#chatFeed");
  feed.innerHTML = state.messages
    .map(
      (message) => `
        <div class="message">
          <div class="avatar">${message.expert.avatar}</div>
          <div class="message-body">
            <header>
              <strong>${message.expert.name}</strong>
              <small>${message.expert.role}</small>
            </header>
            <p>${message.text}</p>
          </div>
        </div>
      `
    )
    .join("");
  feed.scrollTop = feed.scrollHeight;
}

function renderDecision(data, risk) {
  $("#legalScore").textContent = risk.legal;
  $("#relationScore").textContent = risk.relation;
  $("#readinessScore").textContent = risk.readiness;
  $("#riskBadge").textContent = risk.level.toUpperCase();
  $("#riskBadge").className = `risk-badge ${risk.level}`;
  $("#caseStatus").textContent = risk.level === "high" ? "검토필요" : "토론완료";

  const recommendation =
    risk.level === "high"
      ? "즉시 불이익 조치보다 평가 근거 정비, 서면 피드백, 개선목표 합의, 6~8주 PIP 운영 후 후속 조치를 검토하는 흐름이 안정적입니다."
      : risk.level === "medium"
        ? "업무상 필요성과 당사자 커뮤니케이션을 정리한 뒤 제한적 조치를 진행할 수 있습니다."
        : "기록을 보완하면서 통상적인 운영 절차로 처리 가능합니다.";
  $("#recommendation").textContent = recommendation;

  const checklist = [
    `${data.org || "해당 조직"}의 평가 기준과 직무 기대수준을 서면으로 정리`,
    "최근 피드백, 면담, 성과자료, 업무지시 이력을 날짜별로 확보",
    "개선 목표와 지원 조치를 당사자에게 설명하고 확인 기록 작성",
    "전환배치 검토 시 업무상 필요성과 생활상 불이익 비교표 작성",
    "최종 조치 전 노무법률 리뷰와 ER 커뮤니케이션 문안 점검"
  ];
  $("#checklist").innerHTML = checklist.map((item) => `<li>${item}</li>`).join("");
}

function runClubDiscussion() {
  const data = caseData();
  if (!data.title || !data.summary) {
    alert("사안 제목과 상황 요약을 입력해주세요.");
    return;
  }
  const risk = riskFromCase(data);
  state.messages = buildExpertMessages(data, risk).map((message) => ({ ...message, time: new Date() }));
  renderMessages();
  renderDecision(data, risk);
}

function askFollowup() {
  const input = $("#followupInput");
  const question = input.value.trim();
  if (!question) return;
  const data = caseData();
  const risk = riskFromCase(data);
  addMessage({
    expert: { name: "질문", role: "사용자", avatar: "문" },
    text: question
  });
  addMessage({
    expert: experts[question.includes("임금") || question.includes("수당") ? 3 : question.includes("관계") ? 1 : 0],
    text: followupAnswer(question, data, risk)
  });
  input.value = "";
}

function followupAnswer(question, data, risk) {
  if (/기간|얼마|며칠|몇 주/.test(question)) {
    return "PIP는 사안 난이도와 직무 특성에 따라 달라지지만, 실무상 6~8주 이상을 두고 중간 피드백을 남기는 편이 방어력이 좋습니다. 단순 반복업무라면 더 짧게 설계할 수 있습니다.";
  }
  if (/해고|퇴직|권고사직/.test(question)) {
    return "해고나 퇴직 유도성 메시지는 매우 조심해야 합니다. 개선 기회와 객관 자료가 먼저이고, 권고사직은 자발성, 숙려기간, 정산 조건, 압박 정황 부재를 관리해야 합니다.";
  }
  if (/전환|배치/.test(question)) {
    return "전환배치는 업무상 필요성, 대상자 선정 기준, 직무 적합성, 출퇴근/임금/직책상 불이익을 비교해 판단합니다. 당사자 협의 기록을 남기면 리스크를 낮출 수 있습니다.";
  }
  return `현재 ${data.title} 사안은 ${risk.level.toUpperCase()} 리스크로 보입니다. 결론을 서두르기보다 사실관계표, 증빙목록, 커뮤니케이션 문안을 먼저 고정한 뒤 실행 여부를 판단하세요.`;
}

function renderIssues() {
  $("#caseCount").textContent = state.issues.length;
  $("#riskCount").textContent = state.issues.filter((issue) => issue.risk === "high").length;
  $("#issueGrid").innerHTML = state.issues
    .map(
      (issue) => `
        <article class="issue-card">
          <span class="case-chip ${issue.risk}">${issue.risk.toUpperCase()}</span>
          <h4>${issue.title}</h4>
          <p>${issue.summary}</p>
          <p><strong>Owner:</strong> ${issue.owner}</p>
        </article>
      `
    )
    .join("");
}

function renderPlaybook() {
  $("#playbookGrid").innerHTML = playbook
    .map(
      (item) => `
        <article class="playbook-card">
          <span class="case-chip ${item.risk}">${item.risk.toUpperCase()}</span>
          <h4>${item.title}</h4>
          <p>${item.summary}</p>
        </article>
      `
    )
    .join("");
}

function addCurrentIssue() {
  const data = caseData();
  const risk = riskFromCase(data);
  state.issues.unshift({
    title: data.title || "제목 없는 사안",
    risk: risk.level,
    owner: risk.level === "high" ? "노무법률" : "People Ops",
    summary: data.summary.slice(0, 86) + (data.summary.length > 86 ? "..." : "")
  });
  renderIssues();
  switchView("cases");
}

function exportBrief() {
  const data = caseData();
  const risk = riskFromCase(data);
  const checks = $$("#checklist li").map((li) => `- ${li.textContent}`).join("\n");
  const brief = [
    "[HR 노무전문가 토킹클럽 브리프]",
    "",
    `사안: ${data.title}`,
    `조직: ${data.org || "-"}`,
    `긴급도: ${data.urgency}`,
    `태그: ${data.tags.join(", ") || "-"}`,
    `리스크: ${risk.level.toUpperCase()} (법적 ${risk.legal} / 관계 ${risk.relation} / 준비도 ${risk.readiness})`,
    "",
    "[상황 요약]",
    data.summary,
    "",
    "[권고 방향]",
    $("#recommendation").textContent,
    "",
    "[체크리스트]",
    checks
  ].join("\n");

  navigator.clipboard
    .writeText(brief)
    .then(() => {
      $("#exportBriefButton").textContent = "복사 완료";
      setTimeout(() => {
        $("#exportBriefButton").textContent = "브리프 작성";
      }, 1400);
    })
    .catch(() => {
      alert(brief);
    });
}

function switchView(view) {
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  $$("[data-view-panel]").forEach((panel) => panel.classList.toggle("hidden", panel.dataset.viewPanel !== view));
}

function resetCase() {
  $("#caseTitle").value = "";
  $("#orgName").value = "";
  $("#urgency").value = "medium";
  $("#caseSummary").value = "";
  $$(".tag").forEach((tag) => tag.classList.remove("active"));
  state.messages = [];
  renderMessages();
  $("#caseStatus").textContent = "초안";
}

function bindEvents() {
  $$(".nav-item").forEach((item) => item.addEventListener("click", () => switchView(item.dataset.view)));
  $$(".tag").forEach((tag) => tag.addEventListener("click", () => tag.classList.toggle("active")));
  $("#runClubButton").addEventListener("click", runClubDiscussion);
  $("#askFollowupButton").addEventListener("click", askFollowup);
  $("#followupInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") askFollowup();
  });
  $("#clearChatButton").addEventListener("click", () => {
    state.messages = [];
    renderMessages();
  });
  $("#addIssueButton").addEventListener("click", addCurrentIssue);
  $("#newCaseButton").addEventListener("click", resetCase);
  $("#exportBriefButton").addEventListener("click", exportBrief);
}

function init() {
  renderExperts();
  renderIssues();
  renderPlaybook();
  bindEvents();
  runClubDiscussion();
}

init();
