export const scopeFields = ["name", "version", "environment"];
const confirmations = new WeakMap();

// Setters revoke confirmation at the moment of editing, including edit-and-revert.
function trackedFields(initial, onChange) {
  const record = {};
  for (const [key, initialValue] of Object.entries(initial)) {
    let value = initialValue;
    Object.defineProperty(record, key, {
      enumerable: true,
      get: () => value,
      set(next) {
        if (typeof next !== "string") throw new TypeError(key + " must be a string");
        if (next === value) return;
        value = next;
        onChange();
      },
    });
  }
  return record;
}

export function createCase(initial = { name: "", version: "", environment: "" }) {
  const record = { checks: [], nextNumber: 1 };
  const scope = trackedFields(
    Object.fromEntries(scopeFields.map(key => [key, initial[key] ?? ""])),
    () => record.checks.forEach(check => confirmations.delete(check)),
  );
  Object.defineProperty(record, "scope", { enumerable: true, value: scope });
  return record;
}

export function addCheck(record, condition = "") {
  const check = trackedFields(
    { condition, result: "pending", observation: "", source: "", limitations: "" },
    () => confirmations.delete(check),
  );
  check.number = record.nextNumber++;
  check.expanded = true;
  record.checks.push(check);
  return check;
}

export function recordResult(scope, check, result) {
  check.result = result;
}

export function isConfirmed(scope, check) {
  return confirmations.get(check) === scope;
}

export function confirmationProblem(scope, check) {
  if (scopeFields.some(key => !scope[key].trim())) return "scope";
  if (!check.condition.trim()) return "condition";
  if (!["pass", "fail", "unknown"].includes(check.result)) return "pending";
  if (!check.observation.trim() || !check.source.trim()) return "evidence";
  return null;
}

export function confirmCheck(scope, check) {
  confirmations.delete(check);
  const reason = confirmationProblem(scope, check);
  if (reason) return { ok: false, reason };
  confirmations.set(check, scope);
  return { ok: true };
}

export function assessCheck(scope, check) {
  const problem = confirmationProblem(scope, check);
  if (problem) return { state: "unknown", reason: problem };
  if (!isConfirmed(scope, check)) return { state: "unknown", reason: "unconfirmed" };
  if (check.result === "unknown") return { state: "unknown", reason: "inconclusive" };
  return { state: check.result, reason: null };
}

export function evaluate(record) {
  const { scope, checks } = record;
  const rows = checks.map(check => ({ check, ...assessCheck(scope, check) }));
  const counts = { pass: 0, fail: 0, unknown: 0 };
  for (const row of rows) counts[row.state]++;
  const base = { rows, counts, focus: null };
  const missingScope = scopeFields.find(key => !scope[key].trim());
  if (missingScope) return { ...base, outcome: "unknown", reason: "scope", missingScope };
  if (!checks.length) return { ...base, outcome: "unknown", reason: "no-checks" };
  const failure = rows.find(row => row.state === "fail");
  if (failure) return { ...base, outcome: "fail", reason: "failure", focus: failure };
  const unresolved = rows.find(row => row.state === "unknown");
  if (unresolved) return { ...base, outcome: "unknown", reason: "unresolved", focus: unresolved };
  return { ...base, outcome: "pass", reason: "complete" };
}

const versions = { fail: "build-demo.014", pass: "build-demo.015", unknown: "build-demo.016" };
const demoText = {
  ru: {
    name: "Выгрузка заказов в CSV",
    environment: "Тестовая, учебные данные",
    conditions: ["CSV содержит три строки данных", "Имена клиентов сохраняются без изменений", "Суммы сохраняются с точностью до тиына"],
    observations: [
      "Во входном наборе три заказа с ID 101, 102 и 103. В CSV найдены три строки данных с теми же ID. Заголовок не учитывался.",
      "После чтения CSV в UTF-8 в заказах № 101, 102 и 103 получены исходные имена «Иван», «Әлия» и «Мәди».",
      "Для заказов № 101, 102 и 103 исходные суммы 1200.00, 1850.75 и 73.01 совпали со значениями поля amount в CSV.",
    ],
    sources: [
      "Учебная запись CSV-01. Выгрузить три заказа, открыть CSV и сравнить ID заказов и число строк с входным набором.",
      "Учебная запись CSV-02. Прочитать экспорт как UTF-8 и сравнить customer_name для каждого ID с входным набором.",
      "Учебная запись CSV-03. Сравнить суммы до и после выгрузки по ID заказа в десятичном представлении.",
    ],
    failure: "В заказе № 102 имя «Әлия». При чтении CSV в UTF-8 в том же поле записано «?лия».",
    inconclusive: "Попытка сравнить суммы выполнена. Исходные суммы недоступны, поэтому соответствие установить не удалось.",
    inconclusiveSource: "Учебная запись CSV-03. Экспорт содержит суммы, но входной набор для сравнения недоступен. Для повтора нужен этот набор.",
    limitation: "Только три учебных заказа, указанная версия и среда. Все записи вымышлены.",
    inconclusiveLimit: "Исходные суммы отсутствуют. Требуется повторное сравнение после получения входного набора.",
  },
  en: {
    name: "Order export to CSV",
    environment: "Test environment, fictional data",
    conditions: ["CSV contains three data rows", "Customer names remain unchanged", "Amounts are preserved to the nearest tiyn"],
    observations: [
      "The input contained three orders with IDs 101, 102 and 103. The CSV contained three data rows with the same IDs. The header was excluded.",
      "Reading the CSV as UTF-8 returned the original names «Иван», «Әлия» and «Мәди» for orders 101, 102 and 103.",
      "The input amounts 1200.00, 1850.75 and 73.01 for orders 101, 102 and 103 matched the CSV amount values.",
    ],
    sources: [
      "Fictional record CSV-01. Export three orders, open the CSV and compare the order IDs and row count with the input.",
      "Fictional record CSV-02. Read the export as UTF-8 and compare customer_name for each ID with the input.",
      "Fictional record CSV-03. Match orders by ID and compare their amounts before and after export using decimal values.",
    ],
    failure: "Order 102 had the name «Әлия». Reading the CSV as UTF-8 returned «?лия» in the same field.",
    inconclusive: "An amount comparison was attempted. The original amounts were unavailable, so agreement could not be established.",
    inconclusiveSource: "Fictional record CSV-03. The export contains amounts, but the comparison input is unavailable. That input is needed to repeat the check.",
    limitation: "Only three fictional orders in the specified version and environment. All records are illustrative.",
    inconclusiveLimit: "Original amounts are missing. Repeat the comparison once the input is available.",
  },
};

export function createDemo(scenario, language = "ru") {
  const text = demoText[language] ?? demoText.ru;
  const record = createCase({ name: text.name, version: versions[scenario], environment: text.environment });
  for (let index = 0; index < text.conditions.length; index++) {
    const check = addCheck(record, text.conditions[index]);
    check.result = "pass";
    check.observation = text.observations[index];
    check.source = text.sources[index];
    check.limitations = text.limitation;
    if (index === 1 && scenario === "fail") {
      check.result = "fail";
      check.observation = text.failure;
    }
    if (index === 2 && scenario === "unknown") {
      check.result = "unknown";
      check.observation = text.inconclusive;
      check.source = text.inconclusiveSource;
      check.limitations = text.inconclusiveLimit;
    }
    confirmCheck(record.scope, check);
  }
  return record;
}
