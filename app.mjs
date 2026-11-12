import { addCheck, confirmationProblem, confirmCheck, createCase, createDemo, evaluate, isConfirmed, recordResult } from "./model.mjs";

const element = id => document.getElementById(id);
const language = document.documentElement.lang === "en" ? "en" : "ru";
const translations = {
  ru: {
    code: "У",
    labels: {
      pass: { verdict: "Принимать", row: "Выполнено", icon: "✓" },
      fail: { verdict: "Не принимать", row: "Нарушено", icon: "×" },
      unknown: { verdict: "Недостаточно данных", row: "Не установлено", icon: "?" },
    },
    expected: "Ожидаемый результат", result: "Исход проверки", evidence: "Доказательство",
    observation: "Что наблюдали", source: "Источник или способ повторения", limitations: "Ограничения",
    remove: "Удалить условие", confirm: "Подтвердить запись", confirmed: "Запись подтверждена",
    draft: "Черновик", confirmedNote: "Подтверждение записи относится к её текущему содержимому.",
    notes: {
      scope: "Заполните объект, версию и среду.",
      condition: "Запишите ожидаемый результат.",
      pending: "Отметьте исход проведённой проверки.",
      evidence: "Укажите наблюдение и его источник или способ повторения.",
      unconfirmed: "Подтвердите текущую запись после проверки её содержания.",
      inconclusive: "Попытка проверки зафиксирована. Условие осталось неустановленным.",
    },
    modes: {
      demo: "Измените наблюдения и подтвердите записи, чтобы увидеть, как меняется вывод. Все данные примера вымышлены.",
      custom: "Задайте свой пример. Записи и исходы вы оцениваете самостоятельно.",
    },
    editedDemo: "Учебные записи изменены вами. Для расчёта подтвердите их текущее содержание.",
    titles: { demo: "Учебный вывод", custom: "Расчёт по вашим записям" },
    context: {
      demo: "Учебный результат. Все наблюдения вымышлены.",
      custom: "По вашим записям. METHOD проверку не проводил.",
    },
    ruleTitles: { demo: "Правило задано для этого примера", custom: "Для вашего примера используется это правило" },
    scopeHints: {
      name: "Укажите, какой результат проверяется.",
      version: "Укажите неизменяемую версию, например SHA коммита или ID сборки.",
      environment: "Укажите среду, в которой проводилась проверка.",
    },
    noChecks: "Добавьте хотя бы одно условие приёмки.",
    failure: code => "Подтверждена запись о нарушении " + code + ". По правилу примера этого достаточно для отказа в приёмке.",
    unresolved: code => "Для " + code + " результат не установлен. Проверьте запись, её исход и подтверждение.",
    complete: "Все заданные условия отмечены как выполненные в подтверждённых записях для этой версии и среды.",
    evidenceLink: "К доказательству ", conditionLink: "К условию ",
  },
  en: {
    code: "C",
    labels: {
      pass: { verdict: "Accept", row: "Met", icon: "✓" },
      fail: { verdict: "Do not accept", row: "Violated", icon: "×" },
      unknown: { verdict: "Insufficient evidence", row: "Not established", icon: "?" },
    },
    expected: "Expected result", result: "Check outcome", evidence: "Evidence",
    observation: "Observed result", source: "Source or reproduction steps", limitations: "Limitations",
    remove: "Remove condition", confirm: "Confirm record", confirmed: "Record confirmed",
    draft: "Draft", confirmedNote: "Confirmation applies to the current contents of this record.",
    notes: {
      scope: "Enter the object, version and environment.",
      condition: "Enter the expected result.",
      pending: "Select the outcome of the check.",
      evidence: "Enter the observation and its source or reproduction steps.",
      unconfirmed: "Review the current record and confirm its contents.",
      inconclusive: "The attempt is recorded. The condition remains unestablished.",
    },
    modes: {
      demo: "Edit observations and confirm records to see how the conclusion changes. All example data is fictional.",
      custom: "Set up your own example. You assess the records and their outcomes.",
    },
    editedDemo: "You have edited the fictional records. Confirm their current contents to use them in the calculation.",
    titles: { demo: "Illustrative conclusion", custom: "Based on your records" },
    context: {
      demo: "Illustrative result. All observations are fictional.",
      custom: "Based on your records. METHOD has not performed this review.",
    },
    ruleTitles: { demo: "Rule set for this example", custom: "This rule applies to your example" },
    scopeHints: {
      name: "Specify the deliverable under review.",
      version: "Enter a fixed version, such as a commit SHA or build ID.",
      environment: "Specify the environment in which the checks were performed.",
    },
    noChecks: "Add at least one acceptance condition.",
    failure: code => "A record of a violation of " + code + " has been confirmed. This is sufficient for rejection under the example rule.",
    unresolved: code => "The result for " + code + " is not established. Review the record, outcome and confirmation.",
    complete: "All specified conditions are marked as met in confirmed records for this version and environment.",
    evidenceLink: "View evidence for ", conditionLink: "View condition ",
  },
};
const text = translations[language];
const objectFields = { name: element("object-name"), version: element("object-version"), environment: element("object-environment") };
const checksList = element("checks-list");
const addButton = element("add-check");
const verdictEvidence = element("verdict-evidence");
const modeButtons = document.querySelectorAll("[data-mode]");
const scenarioButtons = document.querySelectorAll("[data-scenario]");
const checkViews = new Map();
const cases = { demo: createDemo("fail", language), custom: createCase() };
addCheck(cases.custom);
let mode = "demo";
let scenario = "fail";

const current = () => cases[mode];
const checkCode = check => text.code + String(check.number).padStart(2, "0");

function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

function fitTextarea(input) {
  if (!input.isConnected || !input.getClientRects().length) return;
  input.style.height = "auto";
  const style = getComputedStyle(input);
  input.style.height = Math.ceil(input.scrollHeight + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)) + "px";
}

function fitFields(node = checksList) {
  node.querySelectorAll("textarea").forEach(fitTextarea);
}
window.addEventListener("resize", () => fitFields());
document.fonts.ready.then(() => fitFields());

function markEdited() {
  if (mode !== "demo") return;
  scenario = null;
  for (const button of scenarioButtons) button.setAttribute("aria-pressed", "false");
  setText(element("mode-description"), text.editedDemo);
}

function setEvidenceOpen(check, view, open) {
  check.expanded = open;
  view.details.hidden = !open;
  view.toggle.setAttribute("aria-expanded", String(open));
  if (open) fitFields(view.node);
}

function createCheckView(check) {
  const node = element("check-template").content.firstElementChild.cloneNode(true);
  const view = {
    node,
    state: node.querySelector(".check-state"),
    note: node.querySelector(".check-note"),
    condition: node.querySelector(".condition"),
    result: node.querySelector(".result"),
    toggle: node.querySelector(".evidence-toggle"),
    details: node.querySelector(".check-details"),
    observation: node.querySelector(".observation"),
    source: node.querySelector(".source"),
    limitations: node.querySelector(".limitations"),
    confirm: node.querySelector(".confirm-check"),
    confirmationStatus: node.querySelector(".confirmation-status"),
  };
  const { condition, result, toggle, details, observation, source, limitations, confirm } = view;
  const code = checkCode(check);
  node.querySelector(".check-number").textContent = code;
  details.id = "evidence-" + check.number;
  condition.setAttribute("aria-label", code + " " + text.expected);
  result.setAttribute("aria-label", code + " " + text.result);
  toggle.setAttribute("aria-label", text.evidence + " " + code);
  toggle.setAttribute("aria-controls", details.id);
  confirm.setAttribute("aria-label", text.confirm + " " + code);
  view.note.id = "note-" + check.number;
  result.setAttribute("aria-describedby", view.note.id);
  confirm.setAttribute("aria-describedby", view.note.id);
  for (const [key, input] of Object.entries({ condition, observation, source, limitations })) {
    input.value = check[key];
    if (key !== "condition") input.setAttribute("aria-label", code + " " + text[key]);
    input.addEventListener("input", () => {
      check[key] = input.value;
      fitTextarea(input);
      markEdited();
      updateVerdict();
    });
  }
  setEvidenceOpen(check, view, check.expanded);
  result.addEventListener("change", () => {
    recordResult(current().scope, check, result.value);
    markEdited();
    setEvidenceOpen(check, view, true);
    updateVerdict();
  });
  confirm.addEventListener("click", () => {
    confirmCheck(current().scope, check);
    updateVerdict();
  });
  toggle.addEventListener("click", () => setEvidenceOpen(check, view, !check.expanded));
  const remove = node.querySelector(".remove-check");
  remove.setAttribute("aria-label", text.remove + " " + code);
  remove.addEventListener("click", () => {
    const checks = current().checks;
    const index = checks.indexOf(check);
    checks.splice(index, 1);
    checkViews.delete(check);
    node.remove();
    markEdited();
    updateVerdict();
    const nextView = checkViews.get(checks[index] ?? checks[index - 1]);
    (nextView?.condition ?? addButton).focus();
  });
  checkViews.set(check, view);
  checksList.append(node);
  fitFields(node);
  return view;
}

function showCase() {
  for (const [key, input] of Object.entries(objectFields)) input.value = current().scope[key];
  checksList.replaceChildren();
  checkViews.clear();
  for (const check of current().checks) createCheckView(check);
  for (const button of modeButtons) button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  for (const button of scenarioButtons) button.setAttribute("aria-pressed", String(button.dataset.scenario === scenario));
  element("scenario-panel").hidden = mode !== "demo";
  setText(element("mode-description"), mode === "demo" && scenario === null ? text.editedDemo : text.modes[mode]);
  setText(element("verdict-title"), text.titles[mode]);
  setText(element("verdict-context"), text.context[mode]);
  setText(element("rule-title"), text.ruleTitles[mode]);
  updateVerdict();
}

function explain(result) {
  switch (result.reason) {
    case "scope": return text.scopeHints[result.missingScope];
    case "no-checks": return text.noChecks;
    case "failure": return text.failure(checkCode(result.focus.check));
    case "unresolved": return text.unresolved(checkCode(result.focus.check));
    case "complete": return text.complete;
  }
}

function updateVerdict() {
  const result = evaluate(current());
  for (const { check, state, reason } of result.rows) {
    const view = checkViews.get(check);
    const confirmed = isConfirmed(current().scope, check);
    view.state.dataset.state = state;
    setText(view.state, text.labels[state].row);
    view.result.value = check.result;
    view.note.hidden = false;
    setText(view.note, text.notes[reason] ?? text.confirmedNote);
    view.confirm.disabled = confirmed || confirmationProblem(current().scope, check) !== null;
    setText(view.confirm, confirmed ? text.confirmed : text.confirm);
    setText(view.confirmationStatus, confirmed ? "" : text.draft);
  }
  element("verdict-display").dataset.outcome = result.outcome;
  element("mobile-verdict").dataset.outcome = result.outcome;
  setText(element("mobile-verdict-label"), text.labels[result.outcome].verdict);
  setText(element("mobile-verdict-context"), text.context[mode]);
  setText(element("verdict-label"), text.labels[result.outcome].verdict);
  setText(element("verdict-icon"), text.labels[result.outcome].icon);
  setText(element("verdict-reason"), explain(result));
  verdictEvidence.hidden = result.focus === null;
  if (result.focus) {
    const prefix = result.outcome === "fail" ? text.evidenceLink : text.conditionLink;
    setText(verdictEvidence, prefix + checkCode(result.focus.check));
  }
  for (const [key, count] of Object.entries(result.counts)) {
    setText(element("count-" + key), String(count));
    const segment = element("progress-" + key);
    segment.hidden = count === 0;
    segment.style.setProperty("--share", String(count));
  }
}

for (const [key, input] of Object.entries(objectFields)) {
  input.addEventListener("input", () => {
    current().scope[key] = input.value;
    markEdited();
    updateVerdict();
  });
}
for (const button of modeButtons) {
  button.addEventListener("click", () => {
    if (mode === button.dataset.mode) return;
    mode = button.dataset.mode;
    showCase();
  });
}
for (const button of scenarioButtons) {
  button.addEventListener("click", () => {
    scenario = button.dataset.scenario;
    cases.demo = createDemo(scenario, language);
    showCase();
  });
}
addButton.addEventListener("click", () => {
  const view = createCheckView(addCheck(current()));
  markEdited();
  updateVerdict();
  view.condition.focus();
});
verdictEvidence.addEventListener("click", () => {
  const { focus } = evaluate(current());
  if (!focus) return;
  const view = checkViews.get(focus.check);
  setEvidenceOpen(focus.check, view, true);
  if (focus.reason === "condition") {
    view.condition.focus();
    return;
  }
  if (focus.reason === "pending") {
    view.result.focus();
    return;
  }
  if (focus.reason === "unconfirmed") {
    view.confirm.focus();
    return;
  }
  view.observation.focus();
});

showCase();
