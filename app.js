const STORAGE_KEY = "empty-bowl-prayer-state";
const SHEET_API_URL =
  "https://script.google.com/macros/s/AKfycbyxW8hs4u4cBYFZ5YgaeOvHmGIkPFPODYKCHY24fgCKjaDr0pkCOP8L9eYHsHEJJaS4/exec";

const today = getLocalDate();

const defaultState = {
  activeIndex: 0,
  editingEntryId: null,
  editingTopicId: null,
  topics: [
    {
      id: createId(),
      title: "가족을 위한 기도",
      description: "사랑이 말과 행동에 머물고, 각자의 자리에서 평안을 누리도록",
      entries: [],
    },
    {
      id: createId(),
      title: "오늘 맡겨진 일",
      description: "성실함과 지혜로 감당하고, 결과보다 순종을 먼저 바라보도록",
      entries: [],
    },
    {
      id: createId(),
      title: "마음의 회복",
      description: "분주함을 내려놓고 하나님 앞에서 다시 정돈되는 하루가 되도록",
      entries: [],
    },
  ],
};

const state = loadState();

const elements = {
  addTopicButton: document.querySelector("#addTopicButton"),
  deleteEntryButton: document.querySelector("#deleteEntryButton"),
  deleteTopicButton: document.querySelector("#deleteTopicButton"),
  descriptionInput: document.querySelector("#descriptionInput"),
  dialogMode: document.querySelector("#dialogMode"),
  editTopicButton: document.querySelector("#editTopicButton"),
  entriesList: document.querySelector("#entriesList"),
  entryBody: document.querySelector("#entryBody"),
  entryDate: document.querySelector("#entryDate"),
  entryDialog: document.querySelector("#entryDialog"),
  entryDialogTitle: document.querySelector("#entryDialogTitle"),
  entryForm: document.querySelector("#entryForm"),
  journalPanel: document.querySelector("#journalPanel"),
  nextButton: document.querySelector("#nextButton"),
  prevButton: document.querySelector("#prevButton"),
  topicCard: document.querySelector("#topicCard"),
  topicCount: document.querySelector("#topicCount"),
  topicDescription: document.querySelector("#topicDescription"),
  topicDialog: document.querySelector("#topicDialog"),
  topicForm: document.querySelector("#topicForm"),
  topicInput: document.querySelector("#topicInput"),
  topicTitle: document.querySelector("#topicTitle"),
};

elements.entryDate.value = today;

elements.prevButton.addEventListener("click", () => moveTopic(-1));
elements.nextButton.addEventListener("click", () => moveTopic(1));
elements.topicCard.addEventListener("click", () => {
  if (wasSwiping) {
    wasSwiping = false;
    return;
  }
  openJournal();
});
elements.topicCard.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openJournal();
  }
});
elements.addTopicButton.addEventListener("click", () => openTopicDialog());
elements.editTopicButton.addEventListener("click", (event) => {
  event.stopPropagation();
  openTopicDialog(getActiveTopic());
});
elements.deleteTopicButton.addEventListener("click", deleteActiveTopic);
elements.deleteEntryButton.addEventListener("click", deleteEditingEntry);
elements.entryForm.addEventListener("submit", saveEntry);
elements.topicForm.addEventListener("submit", saveTopic);

let startX = null;
let wasSwiping = false;

elements.topicCard.addEventListener("touchstart", (event) => {
  startX = event.changedTouches[0].clientX;
});

elements.topicCard.addEventListener("touchend", (event) => {
  if (startX === null) return;
  const diff = event.changedTouches[0].clientX - startX;
  if (Math.abs(diff) > 45) {
    wasSwiping = true;
    moveTopic(diff > 0 ? -1 : 1);
  }
  startX = null;
});

document.addEventListener("keydown", (event) => {
  if (elements.topicDialog.open || elements.entryDialog.open) return;
  if (event.key === "ArrowLeft") moveTopic(-1);
  if (event.key === "ArrowRight") moveTopic(1);
});

render();
syncFromSheet();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);

  try {
    const parsed = JSON.parse(saved);
    return normalizeState(parsed);
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizeState(value) {
  if (!Array.isArray(value?.topics) || value.topics.length === 0) {
    return structuredClone(defaultState);
  }

  return {
    activeIndex: Number.isInteger(value.activeIndex) ? value.activeIndex : 0,
    editingEntryId: null,
    editingTopicId: null,
    topics: value.topics.map((topic) => ({
      id: topic.id || createId(),
      title: topic.title || "기도제목",
      description: topic.description || "",
      entries: Array.isArray(topic.entries)
        ? topic.entries.map((entry) => ({
            id: entry.id || createId(),
            date: entry.date || today,
            verse: entry.verse || "",
            body: entry.body || "",
            createdAt: entry.createdAt || new Date().toISOString(),
            updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString(),
          }))
        : [],
    })),
  };
}

function persist(options = {}) {
  const { cloud = true } = options;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      activeIndex: state.activeIndex,
      topics: state.topics,
    }),
  );

  if (cloud) {
    saveToSheet();
  }
}

async function syncFromSheet() {
  if (!isSheetSyncEnabled()) return;

  try {
    const response = await fetch(`${SHEET_API_URL}?action=load`, {
      method: "GET",
      cache: "no-store",
    });
    const data = await response.json();
    if (!data?.ok) throw new Error(data?.error || "시트 데이터를 불러오지 못했습니다.");

    if (Array.isArray(data.topics) && data.topics.length > 0) {
      const synced = normalizeState({ activeIndex: state.activeIndex, topics: data.topics });
      state.topics = synced.topics;
      state.activeIndex = Math.min(state.activeIndex, state.topics.length - 1);
      persist({ cloud: false });
      render();
    } else {
      saveToSheet();
    }
  } catch (error) {
    console.warn("Google Sheets sync skipped:", error);
  }
}

async function saveToSheet() {
  if (!isSheetSyncEnabled()) return;

  try {
    await fetch(SHEET_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        action: "saveState",
        topics: state.topics,
      }),
    });
  } catch (error) {
    console.warn("Google Sheets save skipped:", error);
  }
}

function isSheetSyncEnabled() {
  return SHEET_API_URL.startsWith("https://");
}

function getActiveTopic() {
  return state.topics[state.activeIndex];
}

function moveTopic(direction) {
  state.activeIndex = (state.activeIndex + direction + state.topics.length) % state.topics.length;
  persist({ cloud: false });
  render();
}

function openJournal() {
  const topic = getActiveTopic();
  state.editingEntryId = null;
  elements.entryDialogTitle.textContent = topic.title;
  elements.entryDate.value = today;
  elements.entryBody.value = "";
  elements.deleteEntryButton.hidden = true;
  elements.entryDialog.showModal();
  elements.entryBody.focus();
}

function openEntryEditor(entryId) {
  const topic = getActiveTopic();
  const entry = topic.entries.find((item) => item.id === entryId);
  if (!entry) return;

  state.editingEntryId = entry.id;
  elements.entryDialogTitle.textContent = "기록 수정";
  elements.entryDate.value = entry.date;
  elements.entryBody.value = [entry.verse, entry.body].filter(Boolean).join("\n\n");
  elements.deleteEntryButton.hidden = false;
  elements.entryDialog.showModal();
  elements.entryBody.focus();
}

function openTopicDialog(topic = null) {
  state.editingTopicId = topic?.id || null;
  elements.dialogMode.textContent = topic ? "Edit Topic" : "New Topic";
  elements.topicInput.value = topic?.title || "";
  elements.descriptionInput.value = topic?.description || "";
  elements.deleteTopicButton.hidden = !topic;
  elements.topicDialog.showModal();
  elements.topicInput.focus();
}

function saveTopic(event) {
  event.preventDefault();

  const submitter = event.submitter;
  if (submitter?.value === "cancel") {
    state.editingTopicId = null;
    elements.topicDialog.close();
    return;
  }

  const title = elements.topicInput.value.trim();
  const description = elements.descriptionInput.value.trim();
  if (!title) return;

  const topic = state.topics.find((item) => item.id === state.editingTopicId);
  if (topic) {
    topic.title = title;
    topic.description = description;
  } else {
    state.topics.push({
      id: createId(),
      title,
      description,
      entries: [],
    });
    state.activeIndex = state.topics.length - 1;
  }

  state.editingTopicId = null;
  elements.topicDialog.close();
  persist();
  render();
}

function deleteActiveTopic() {
  const topic = getActiveTopic();
  const confirmed = confirm(`"${topic.title}" 기도제목을 삭제할까요? 기록도 함께 삭제됩니다.`);
  if (!confirmed) return;

  state.topics.splice(state.activeIndex, 1);
  if (state.topics.length === 0) {
    state.topics.push({
      id: createId(),
      title: "새 기도제목",
      description: "기도하며 기록할 제목을 수정해보세요.",
      entries: [],
    });
  }
  state.activeIndex = Math.min(state.activeIndex, state.topics.length - 1);
  state.editingTopicId = null;
  persist();
  render();
  elements.topicDialog.close();
}

function saveEntry(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    state.editingEntryId = null;
    elements.entryDialog.close();
    return;
  }

  const topic = getActiveTopic();
  const date = elements.entryDate.value || today;
  const body = elements.entryBody.value.trim();

  if (!body) {
    elements.entryBody.focus();
    return;
  }

  const editingEntry = topic.entries.find((entry) => entry.id === state.editingEntryId);
  const existing = !editingEntry ? topic.entries.find((entry) => entry.date === date) : null;

  if (editingEntry) {
    editingEntry.date = date;
    editingEntry.verse = "";
    editingEntry.body = body;
    editingEntry.updatedAt = new Date().toISOString();
  } else if (existing) {
    existing.verse = "";
    existing.body = body;
    existing.updatedAt = new Date().toISOString();
  } else {
    topic.entries.push({
      id: createId(),
      date,
      verse: "",
      body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  topic.entries.sort((a, b) => b.date.localeCompare(a.date));
  elements.entryBody.value = "";
  state.editingEntryId = null;
  persist();
  render();
  elements.entryDialog.close();
}

function deleteEditingEntry() {
  if (!state.editingEntryId) return;
  const confirmed = confirm("이 기록을 삭제할까요?");
  if (!confirmed) return;

  deleteEntry(state.editingEntryId);
  state.editingEntryId = null;
  elements.entryDialog.close();
}

function deleteEntry(entryId) {
  const topic = getActiveTopic();
  topic.entries = topic.entries.filter((entry) => entry.id !== entryId);
  persist();
  render();
  renderEntries(topic);
}

function render() {
  const topic = getActiveTopic();

  elements.topicCount.textContent = `${state.activeIndex + 1} / ${state.topics.length}`;
  elements.topicTitle.textContent = topic.title;
  elements.topicDescription.textContent = topic.description || "기도하며 기록할 내용을 남겨보세요.";
  renderEntries(topic);
}

function renderEntries(topic) {
  elements.entriesList.innerHTML = "";

  if (topic.entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "이 기도제목에는 아직 기록이 없습니다.";
    elements.entriesList.append(empty);
    return;
  }

  topic.entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "entry-card";

    const content = [entry.verse, entry.body].filter(Boolean).join("\n\n");
    const text = document.createElement("p");
    text.className = "entry-text";

    const time = document.createElement("time");
    time.dateTime = entry.date;
    time.textContent = formatCompactDate(entry.date);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "entry-edit-button";
    editButton.setAttribute("aria-label", "기록 수정");
    editButton.title = "수정";
    editButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    `;
    editButton.addEventListener("click", () => openEntryEditor(entry.id));

    text.append(content, " - ", time);
    card.append(text, editButton);
    elements.entriesList.append(card);
  });
}

function formatCompactDate(value) {
  const date = new Date(`${value}T00:00:00`);
  const year = String(date.getFullYear()).slice(2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date);
  return `${year}.${month}.${day}.(${weekday})`;
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getLocalDate() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
