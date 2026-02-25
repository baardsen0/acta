const form = document.getElementById("entry-form");
const listEl = document.getElementById("list");
const messageEl = document.getElementById("form-message");
const refreshBtn = document.getElementById("refresh-btn");
const exportBtn = document.getElementById("export-btn");
const searchInput = document.getElementById("search-input");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const pageInfo = document.getElementById("page-info");
const nowBtn = document.getElementById("now-btn");
const exampleBtn = document.getElementById("example-btn");
const toastContainer = document.getElementById("toast-container");
const createdByInput = form.elements.created_by;
const whoFields = document.getElementById("who-fields");
const addWhoBtn = document.getElementById("add-who-btn");

const saveSettingsBtn = document.getElementById("save-settings-btn");
const settingsMessageEl = document.getElementById("settings-message");
const timeFormatSelect = document.getElementById("setting-time-format");
const exportFormatSelect = document.getElementById("setting-export-format");
const defaultUserInput = document.getElementById("setting-default-user");

const when24Wrap = document.getElementById("when-24-wrap");
const whenAmPmWrap = document.getElementById("when-ampm-wrap");
const whenHelper = document.getElementById("when-helper");
const whenDate24Input = document.getElementById("when_date_24");
const whenHour24Select = document.getElementById("when_hour_24");
const whenMinute24Select = document.getElementById("when_minute_24");
const whenDateInput = document.getElementById("when_date");
const whenTime12Input = document.getElementById("when_time_12");
const whenMeridiemSelect = document.getElementById("when_meridiem");

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanes = document.querySelectorAll(".tab-pane");
const guideToggles = document.querySelectorAll(".guide-toggle");

const SETTINGS_KEY = "acta_settings";
const PAGE_SIZE = 5;

const DEFAULT_SETTINGS = {
  timeFormat: "24h",
  exportFormat: "md",
  defaultUser: "",
};

let allEntries = [];
let currentPage = 1;

/**
 * Show a temporary toast notification.
 * @param {string} text
 * @param {"error"|"success"} kind
 */
function showToast(text, kind = "error") {
  const toast = document.createElement("div");
  toast.className = `toast ${kind}`;
  toast.textContent = text;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/**
 * Switch active top-level tab.
 * @param {string} tabName
 */
function switchTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  tabPanes.forEach((pane) => {
    pane.classList.toggle("active", pane.id === `tab-${tabName}`);
  });
}

/**
 * Pad number to 2 digits.
 * @param {number} value
 * @returns {string}
 */
function pad2(value) {
  return String(value).padStart(2, "0");
}

/**
 * Populate 24-hour select pickers.
 */
function init24HourPickerOptions() {
  if (whenHour24Select.options.length === 0) {
    for (let h = 0; h < 24; h += 1) {
      const option = document.createElement("option");
      option.value = pad2(h);
      option.textContent = pad2(h);
      whenHour24Select.appendChild(option);
    }
  }
  if (whenMinute24Select.options.length === 0) {
    for (let m = 0; m < 60; m += 1) {
      const option = document.createElement("option");
      option.value = pad2(m);
      option.textContent = pad2(m);
      whenMinute24Select.appendChild(option);
    }
  }
}

/**
 * Read settings from localStorage.
 * @returns {{timeFormat: string, exportFormat: string, defaultUser: string}}
 */
function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const stored = raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
    return {
      timeFormat: stored.timeFormat === "ampm" ? "ampm" : "24h",
      exportFormat: ["md", "pdf", "xls", "json"].includes(stored.exportFormat) ? stored.exportFormat : "md",
      defaultUser: String(stored.defaultUser || "").trim(),
    };
  } catch (_error) {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persist settings.
 * @param {{timeFormat: string, exportFormat: string, defaultUser: string}} settings
 */
function setSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Apply settings to controls and form presentation.
 */
function applySettingsToUi() {
  const settings = getSettings();

  timeFormatSelect.value = settings.timeFormat;
  exportFormatSelect.value = settings.exportFormat;
  defaultUserInput.value = settings.defaultUser;

  if (settings.timeFormat === "ampm") {
    when24Wrap.classList.add("hidden");
    whenAmPmWrap.classList.remove("hidden");
    whenDate24Input.required = false;
    whenHour24Select.required = false;
    whenMinute24Select.required = false;
    whenDateInput.required = true;
    whenTime12Input.required = true;
    whenMeridiemSelect.required = true;
    whenHelper.textContent = "Use date + time (hh:mm) and choose AM/PM.";
  } else {
    when24Wrap.classList.remove("hidden");
    whenAmPmWrap.classList.add("hidden");
    whenDate24Input.required = true;
    whenHour24Select.required = true;
    whenMinute24Select.required = true;
    whenDateInput.required = false;
    whenTime12Input.required = false;
    whenMeridiemSelect.required = false;
    whenHelper.textContent = "Use date + time in 24-hour format (HH:MM).";
  }

  if (settings.defaultUser) {
    createdByInput.value = settings.defaultUser;
  }
}

/**
 * Convert date + 24-hour selector values to SQL datetime.
 * @param {string} datePart
 * @param {string} hour24
 * @param {string} minute24
 * @returns {string|null}
 */
function toSqlDatetimeFrom24h(datePart, hour24, minute24) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const dateValue = String(datePart || "").trim();
  const hourValue = String(hour24 || "").trim();
  const minuteValue = String(minute24 || "").trim();

  if (!dateRegex.test(dateValue)) {
    return null;
  }
  if (!/^\d{2}$/.test(hourValue) || !/^\d{2}$/.test(minuteValue)) {
    return null;
  }

  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${dateValue} ${pad2(hour)}:${pad2(minute)}:00`;
}

/**
 * Convert AM/PM split fields to SQL datetime.
 * @param {string} datePart
 * @param {string} time12
 * @param {string} meridiem
 * @returns {string|null}
 */
function toSqlDatetimeFromAmPm(datePart, time12, meridiem) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const timeRegex = /^(\d{1,2}):(\d{2})$/;

  if (!dateRegex.test(String(datePart || ""))) {
    return null;
  }

  const match = String(time12 || "").trim().match(timeRegex);
  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return null;
  }

  const up = String(meridiem || "").toUpperCase();
  if (up !== "AM" && up !== "PM") {
    return null;
  }

  if (up === "AM") {
    hour = hour === 12 ? 0 : hour;
  } else {
    hour = hour === 12 ? 12 : hour + 12;
  }

  return `${datePart} ${pad2(hour)}:${pad2(minute)}:00`;
}

/**
 * Build SQL datetime based on current settings and form state.
 * @returns {string|null}
 */
function getSqlWhenFromForm() {
  const settings = getSettings();
  if (settings.timeFormat === "ampm") {
    return toSqlDatetimeFromAmPm(
      whenDateInput.value,
      whenTime12Input.value,
      whenMeridiemSelect.value,
    );
  }
  return toSqlDatetimeFrom24h(whenDate24Input.value, whenHour24Select.value, whenMinute24Select.value);
}

/**
 * Convert SQL datetime to Date.
 * @param {string} value
 * @returns {Date|null}
 */
function sqlToDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }
  const [, y, m, d, hh, mm, ss] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss || "0"));
}

/**
 * Format SQL datetime according to selected settings.
 * @param {string} value
 * @returns {string}
 */
function formatDisplayDate(value) {
  const date = sqlToDate(value);
  if (!date) {
    return value || "";
  }

  const settings = getSettings();
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const minutes = pad2(date.getMinutes());

  if (settings.timeFormat === "ampm") {
    const hours24 = date.getHours();
    const meridiem = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 || 12;
    return `${year}-${month}-${day} ${pad2(hours12)}:${minutes} ${meridiem}`;
  }

  return `${year}-${month}-${day} ${pad2(date.getHours())}:${minutes}`;
}

/**
 * Create a single person input row for Who.
 * @param {string} value
 */
function addWhoField(value = "") {
  const row = document.createElement("div");
  row.className = "who-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "who-input";
  input.placeholder = "Person name";
  input.title = "Person related to this entry.";
  input.value = value;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "secondary who-remove";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => {
    row.remove();
    if (!whoFields.querySelector(".who-row")) {
      addWhoField();
    }
  });

  row.appendChild(input);
  row.appendChild(removeBtn);
  whoFields.appendChild(row);
}

/**
 * Replace Who rows with provided names.
 * @param {string[]} names
 */
function setWhoFields(names) {
  whoFields.innerHTML = "";
  const list = names.map((name) => String(name).trim()).filter(Boolean);
  if (!list.length) {
    addWhoField();
    return;
  }
  list.forEach((name) => addWhoField(name));
}

/**
 * Read Who rows and convert to comma-separated string.
 * @returns {string}
 */
function getNormalizedWhoFromFields() {
  const values = Array.from(whoFields.querySelectorAll(".who-input"))
    .map((input) => input.value.trim())
    .filter(Boolean);
  return values.join(", ");
}

/**
 * Filter entries by search input.
 * @returns {Array<Record<string, string|number>>}
 */
function getFilteredEntries() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    return allEntries;
  }

  return allEntries.filter((item) => {
    return Object.values(item)
      .map((value) => String(value ?? "").toLowerCase())
      .some((value) => value.includes(query));
  });
}

/**
 * Render paginated entries into the page.
 */
function renderEntriesView() {
  const filtered = getFilteredEntries();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  if (!pageItems.length) {
    listEl.innerHTML = "<p>No entries found.</p>";
  } else {
    listEl.innerHTML = pageItems
      .map(
        (item) => `
        <article class="item">
          <strong>#${item.id} - ${item.what}</strong>
          <div class="meta">When: ${formatDisplayDate(item.when_at)}</div>
          <div class="meta">Where: ${item.where}</div>
          <div class="meta">Who: ${item.who}</div>
          <div class="meta">Created at: ${formatDisplayDate(item.created_at)}</div>
          <div class="meta">Created by: ${item.created_by}</div>
        </article>
      `
      )
      .join("");
  }

  pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
}

/**
 * Fetch and cache all entries from API.
 */
async function fetchEntries() {
  try {
    const res = await fetch("/api/incidents");
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Failed to load entries.", "error");
      return;
    }
    allEntries = data.items || [];
    renderEntriesView();
  } catch (error) {
    console.error("Failed to fetch entries", error);
    showToast("Network error while loading entries.", "error");
  }
}

/**
 * Fill form with sample values.
 */
function fillExampleValues() {
  const settings = getSettings();

  form.elements.what.value = "Routine check completed";
  form.elements.where.value = "Warehouse A - aisle 3";
  setWhoFields(["Ola N.", "Kari S."]);

  if (settings.timeFormat === "ampm") {
    const now = new Date();
    whenDateInput.value = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const hours24 = now.getHours();
    const meridiem = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 || 12;
    whenTime12Input.value = `${pad2(hours12)}:${pad2(now.getMinutes())}`;
    whenMeridiemSelect.value = meridiem;
  } else {
    const now = new Date();
    whenDate24Input.value = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    whenHour24Select.value = pad2(now.getHours());
    whenMinute24Select.value = pad2(now.getMinutes());
  }

  if (settings.defaultUser) {
    createdByInput.value = settings.defaultUser;
  } else if (!createdByInput.value.trim()) {
    createdByInput.value = "baardsen / u_17";
  }

  messageEl.textContent = "Example values filled. Edit as needed.";
}

/**
 * Trigger a browser file download.
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Extract filename from Content-Disposition header.
 * @param {string|null} disposition
 * @param {string} fallback
 * @returns {string}
 */
function extractFilename(disposition, fallback) {
  if (!disposition) {
    return fallback;
  }
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : fallback;
}

nowBtn.addEventListener("click", () => {
  const settings = getSettings();

  if (settings.timeFormat === "ampm") {
    const now = new Date();
    whenDateInput.value = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const meridiem = now.getHours() >= 12 ? "PM" : "AM";
    const hours12 = now.getHours() % 12 || 12;
    whenTime12Input.value = `${pad2(hours12)}:${pad2(now.getMinutes())}`;
    whenMeridiemSelect.value = meridiem;
  } else {
    const now = new Date();
    whenDate24Input.value = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    whenHour24Select.value = pad2(now.getHours());
    whenMinute24Select.value = pad2(now.getMinutes());
  }

  messageEl.textContent = "Time set to current local time.";
});

exampleBtn.addEventListener("click", fillExampleValues);

saveSettingsBtn.addEventListener("click", () => {
  const next = {
    timeFormat: timeFormatSelect.value === "ampm" ? "ampm" : "24h",
    exportFormat: ["md", "pdf", "xls", "json"].includes(exportFormatSelect.value) ? exportFormatSelect.value : "md",
    defaultUser: defaultUserInput.value.trim(),
  };

  setSettings(next);
  applySettingsToUi();
  settingsMessageEl.textContent = "Settings saved.";
  showToast("Settings saved.", "success");
  renderEntriesView();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  payload.when_at = getSqlWhenFromForm();
  if (!payload.when_at) {
    showToast("Please provide a valid date/time.", "error");
    return;
  }

  payload.who = getNormalizedWhoFromFields();
  if (!payload.who) {
    showToast("Please add at least one name in Who.", "error");
    return;
  }

  payload.what = String(payload.what || "").trim();
  payload.where = String(payload.where || "").trim();

  const settings = getSettings();
  payload.created_by = settings.defaultUser || String(payload.created_by || "").trim();
  if (settings.defaultUser) {
    createdByInput.value = settings.defaultUser;
  }

  if (!payload.what || !payload.where || !payload.created_by) {
    showToast("Please fill all required fields.", "error");
    return;
  }

  try {
    const res = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Failed to save entry.", "error");
      return;
    }

    form.reset();
    setWhoFields([]);
    if (settings.defaultUser) {
      createdByInput.value = settings.defaultUser;
    }

    messageEl.textContent = `Saved entry #${data.id}.`;
    showToast(`Saved entry #${data.id}.`, "success");
    currentPage = 1;
    await fetchEntries();
  } catch (error) {
    console.error("Failed to save entry", error);
    showToast("Network error while saving entry.", "error");
  }
});

refreshBtn.addEventListener("click", fetchEntries);
addWhoBtn.addEventListener("click", () => addWhoField());

searchInput.addEventListener("input", () => {
  currentPage = 1;
  renderEntriesView();
});

prevBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    renderEntriesView();
  }
});

nextBtn.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(getFilteredEntries().length / PAGE_SIZE));
  if (currentPage < totalPages) {
    currentPage += 1;
    renderEntriesView();
  }
});

exportBtn.addEventListener("click", async () => {
  const settings = getSettings();
  const format = settings.exportFormat || "md";

  try {
    const res = await fetch(`/api/export?format=${encodeURIComponent(format)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "Failed to export entries.", "error");
      return;
    }

    const blob = await res.blob();
    const fallbackName = `entries.${format}`;
    const filename = extractFilename(res.headers.get("Content-Disposition"), fallbackName);
    downloadBlob(blob, filename);
    showToast(`Exported ${filename}.`, "success");
  } catch (error) {
    console.error("Failed to export entries", error);
    showToast("Network error while exporting entries.", "error");
  }
});

for (const button of tabButtons) {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
}

for (const toggle of guideToggles) {
  toggle.addEventListener("click", () => {
    const body = toggle.nextElementSibling;
    if (!body) {
      return;
    }
    const isOpen = !body.classList.contains("hidden");
    body.classList.toggle("hidden", isOpen);
    toggle.setAttribute("aria-expanded", String(!isOpen));
  });
}

applySettingsToUi();
init24HourPickerOptions();
setWhoFields([]);
fetchEntries();
