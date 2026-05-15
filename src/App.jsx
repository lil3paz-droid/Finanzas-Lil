import React, { useMemo, useRef, useState } from "react";

const APP_VERSION = "1.4.0";
const STORAGE_KEY = "finanzas-lil-v16";
const TABS = ["Panel", "Ingresos", "Gastos", "Metas", "Inv.", "Ajustes"];
const EXPENSE_CATEGORIES = ["Comida", "Transporte", "Disfrute", "Herramientas IA", "Entrenamiento", "Impuestos", "Formación", "Pagos dpto", "Ropa", "Otros"];
const INVESTMENT_TYPES = ["CEDEAR", "FCI", "Acción", "Dólar", "Otro"];
const FIXED_EXPENSES = ["Luz", "Gas", "Internet", "Expensas", "Curso de inglés", "Tuenti", "Monotributo", "Sube", "Gym", "Supermercado", "Belleza", "Canva", "ChatGPT"];
const BAR_COLORS = ["#9F649F", "#53A3A6", "#F3AA20", "#2A445E"];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function currentMonthKey() { return todayISO().slice(0, 7); }
function monthStartDate(monthKey) { return `${monthKey}-01`; }
function getMonthKeyFromDate(date) { return String(date || todayISO()).slice(0, 7); }
function getPreviousMonthKey(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function getNextMonthKey(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function getMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}
function parseAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const compact = raw.replace(/\s/g, "");
  const hasComma = compact.includes(",");
  const hasDot = compact.includes(".");
  if (hasComma && hasDot) return Number(compact.replace(/\./g, "").replace(",", ".")) || 0;
  if (hasComma) return Number(compact.replace(",", ".")) || 0;
  return Number(compact) || 0;
}
function formatMoney(value, currency = "ARS") {
  const amount = parseAmount(value);
  try { return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount); }
  catch { return `${currency} ${Math.round(amount).toLocaleString("es-AR")}`; }
}
function defaultCategory(name) {
  if (["Canva", "ChatGPT"].includes(name)) return "Herramientas IA";
  if (name === "Monotributo") return "Impuestos";
  if (name === "Gym") return "Entrenamiento";
  if (name === "Curso de inglés") return "Formación";
  if (name === "Expensas") return "Pagos dpto";
  if (name === "Supermercado") return "Comida";
  if (name === "Sube") return "Transporte";
  return "Otros";
}
function convertToARS(item, usdRate) { return item?.currency === "USD" ? parseAmount(item?.amount) * parseAmount(usdRate) : parseAmount(item?.amount); }
function deleteById(collection, id) { return (Array.isArray(collection) ? collection : []).filter((item) => String(item.id) !== String(id)); }
function filterByMonth(collection, monthKey) { return (Array.isArray(collection) ? collection : []).filter((item) => getMonthKeyFromDate(item.date) === monthKey); }
function calculateTotals(data) {
  const usdRate = parseAmount(data?.settings?.usdRate);
  const incomes = Array.isArray(data?.incomes) ? data.incomes : [];
  const expenses = Array.isArray(data?.expenses) ? data.expenses : [];
  const investments = Array.isArray(data?.investments) ? data.investments : [];
  const incomeCollected = incomes.filter((i) => i.status === "cobrado").reduce((s, i) => s + convertToARS(i, usdRate), 0);
  const incomePending = incomes.filter((i) => i.status !== "cobrado").reduce((s, i) => s + convertToARS(i, usdRate), 0);
  const fixed = expenses.filter((e) => e.type === "fijo").reduce((s, e) => s + parseAmount(e.amount), 0);
  const variable = expenses.filter((e) => e.type === "variable").reduce((s, e) => s + parseAmount(e.amount), 0);
  const totalExpenses = fixed + variable;
  const paidExpenses = expenses.filter((e) => e.paid).reduce((s, e) => s + parseAmount(e.amount), 0);
  return {
    incomeCollected,
    incomePending,
    totalIncome: incomeCollected + incomePending,
    fixed,
    variable,
    totalExpenses,
    paidExpenses,
    pendingExpenses: Math.max(0, totalExpenses - paidExpenses),
    available: incomeCollected - paidExpenses,
    fixedCoverage: fixed ? Math.min(100, Math.round((incomeCollected / fixed) * 100)) : 0,
    investmentTotal: investments.reduce((s, i) => s + convertToARS(i, usdRate), 0),
  };
}
function buildFixedExpensesForMonth(monthKey) {
  return FIXED_EXPENSES.map((name, index) => ({ id: `${monthKey}-fixed-${index}`, name, category: defaultCategory(name), amount: 0, type: "fijo", paid: false, date: monthStartDate(monthKey) }));
}
function buildCarryoverIncome(monthKey, amount) {
  return { id: `${monthKey}-carryover`, client: "Saldo mes anterior", project: "Libre del mes anterior", amount: Math.max(0, Math.round(parseAmount(amount))), currency: "ARS", status: "cobrado", invoiced: false, isCarryover: true, date: monthStartDate(monthKey) };
}
function getMonthScopedData(data, monthKey) { return { ...data, incomes: filterByMonth(data?.incomes, monthKey), expenses: filterByMonth(data?.expenses, monthKey) }; }
function buildInitialState() {
  const monthKey = currentMonthKey();
  return {
    version: APP_VERSION,
    updatedAt: new Date().toISOString(),
    activeMonth: monthKey,
    settings: { usdRate: 1000 },
    incomes: [{ id: "demo-income", client: "Cliente ejemplo", project: "Pack mensual", amount: 450, currency: "USD", status: "pendiente", invoiced: false, date: monthStartDate(monthKey) }],
    expenses: buildFixedExpensesForMonth(monthKey),
    goals: [
      { id: "goal-1", name: "Fondo de emergencia", target: 0, current: 0 },
      { id: "goal-2", name: "Casa", target: 0, current: 0 },
      { id: "goal-3", name: "Independencia financiera", target: 0, current: 0 },
    ],
    investments: [
      { id: "inv-1", asset: "CEDEAR", ticker: "AAPL / GOOGL / META / NVDA", amount: 0, currency: "ARS", note: "Cartera actual en IOL" },
      { id: "inv-2", asset: "FCI", ticker: "IOL", amount: 0, currency: "ARS", note: "Fondos propios de IOL" },
      { id: "inv-3", asset: "Acción", ticker: "YPF", amount: 0, currency: "ARS", note: "Acción local" },
    ],
  };
}
function validateDataShape(value) { return Boolean(value && Array.isArray(value.incomes) && Array.isArray(value.expenses) && Array.isArray(value.goals) && Array.isArray(value.investments) && value.settings && typeof value.settings === "object"); }
function normalizeData(value) {
  const base = buildInitialState();
  if (!validateDataShape(value)) return base;
  const activeMonth = value.activeMonth || currentMonthKey();
  return { ...base, ...value, version: APP_VERSION, activeMonth, updatedAt: value.updatedAt || new Date().toISOString(), settings: { ...base.settings, ...value.settings }, incomes: value.incomes.map((item) => ({ ...item, date: item.date || monthStartDate(activeMonth) })), expenses: value.expenses.map((item) => ({ ...item, date: item.date || monthStartDate(activeMonth) })) };
}
function ensureMonthData(data, monthKey) {
  const safeData = normalizeData(data || buildInitialState());
  const hasIncomes = filterByMonth(safeData.incomes, monthKey).length > 0;
  const hasExpenses = filterByMonth(safeData.expenses, monthKey).length > 0;
  if (hasIncomes || hasExpenses) return safeData;
  const previousTotals = calculateTotals(getMonthScopedData(safeData, getPreviousMonthKey(monthKey)));
  const carryover = previousTotals.available > 0 ? [buildCarryoverIncome(monthKey, previousTotals.available)] : [];
  return { ...safeData, incomes: [...carryover, ...safeData.incomes], expenses: [...buildFixedExpensesForMonth(monthKey), ...safeData.expenses], updatedAt: new Date().toISOString() };
}
function getIncomeForm(monthKey) { return { client: "", project: "", amount: "", currency: "ARS", status: "pendiente", invoiced: false, date: monthStartDate(monthKey || currentMonthKey()) }; }
function getExpenseForm(monthKey) { return { name: "", category: "Comida", amount: "", type: "variable", paid: false, date: monthStartDate(monthKey || currentMonthKey()) }; }
function getGoalForm() { return { name: "", target: "", current: "" }; }
function getInvestmentForm() { return { asset: "CEDEAR", ticker: "", amount: "", currency: "ARS", note: "" }; }
function buildExpensesByCategory(expenses) {
  const map = {};
  (Array.isArray(expenses) ? expenses : []).forEach((expense) => { const key = expense.category || "Otros"; map[key] = (map[key] || 0) + parseAmount(expense.amount); });
  return Object.entries(map).map(([name, value]) => ({ name, value })).filter((item) => item.value > 0);
}
function isStorageAvailable() {
  try { if (typeof window === "undefined" || !window.localStorage) return false; const key = "__finanzas_lil_storage_test__"; window.localStorage.setItem(key, "1"); window.localStorage.removeItem(key); return true; }
  catch { return false; }
}
function loadStoredData() {
  if (!isStorageAvailable()) return { data: buildInitialState(), storageEnabled: false, message: "Modo seguro: el navegador no permitió guardado local." };
  try { const raw = window.localStorage.getItem(STORAGE_KEY); if (!raw) return { data: buildInitialState(), storageEnabled: true, message: "Guardado local activo." }; return { data: normalizeData(JSON.parse(raw)), storageEnabled: true, message: "Datos recuperados del dispositivo." }; }
  catch { return { data: buildInitialState(), storageEnabled: true, message: "No se pudo leer el guardado anterior. Se inició una copia limpia." }; }
}
function persistData(nextData) { try { if (!isStorageAvailable()) return false; window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData)); return true; } catch { return false; } }
function clearStoredData() { try { if (!isStorageAvailable()) return false; window.localStorage.removeItem(STORAGE_KEY); return true; } catch { return false; } }
function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
function assertTest(condition, message) { if (!condition) throw new Error(message); }
function runSelfTests() {
  const testData = { incomes: [{ amount: 100, currency: "USD", status: "cobrado", date: "2026-05-01" }, { amount: 50000, currency: "ARS", status: "pendiente", date: "2026-05-01" }], expenses: [{ amount: 80000, type: "fijo", category: "Pagos dpto", paid: true, date: "2026-05-01" }, { amount: 20000, type: "variable", category: "Comida", paid: false, date: "2026-05-01" }], investments: [{ amount: 10, currency: "USD" }], settings: { usdRate: 1000 } };
  const result = calculateTotals(testData);
  assertTest(result.incomeCollected === 100000, "Test: USD cobrado convertido a ARS");
  assertTest(result.incomePending === 50000, "Test: ingreso pendiente en ARS");
  assertTest(result.totalIncome === 150000, "Test: ingreso total suma cobrado y pendiente");
  assertTest(result.totalExpenses === 100000, "Test: total de gastos");
  assertTest(result.paidExpenses === 80000, "Test: gastos pagados separados");
  assertTest(result.pendingExpenses === 20000, "Test: gastos pendientes separados");
  assertTest(result.available === 20000, "Test: disponible resta solo gastos pagados");
  assertTest(result.investmentTotal === 10000, "Test: inversiones convertidas a ARS");
  assertTest(parseAmount("12500") === 12500, "Test: parsea monto entero");
  assertTest(parseAmount("12,5") === 12.5, "Test: parsea decimal con coma");
  assertTest(parseAmount("12.500,50") === 12500.5, "Test: parsea miles con punto y decimal con coma");
  assertTest(buildExpensesByCategory(testData.expenses).length === 2, "Test: agrupa categorías con gasto mayor a cero");
  assertTest(defaultCategory("Canva") === "Herramientas IA", "Test: Canva clasifica como IA");
  assertTest(calculateTotals({ incomes: [], expenses: [], investments: [], settings: { usdRate: 1000 } }).available === 0, "Test: disponible sin registros debe ser 0");
  assertTest(buildInitialState().expenses.length === FIXED_EXPENSES.length, "Test: crea gastos fijos iniciales");
  assertTest(validateDataShape(buildInitialState()) === true, "Test: estructura inicial válida");
  assertTest(validateDataShape({}) === false, "Test: rechaza backup inválido");
  assertTest(normalizeData({}).incomes.length === 1, "Test: normaliza datos inválidos a estado inicial");
  assertTest(buildExpensesByCategory(null).length === 0, "Test: tolera gastos nulos");
  assertTest(calculateTotals({ incomes: null, expenses: null, investments: null, settings: {} }).available === 0, "Test: tolera arrays nulos");
  assertTest(deleteById([{ id: 1 }, { id: 2 }], 1).length === 1, "Test: elimina registros por ID numérico");
  assertTest(getPreviousMonthKey("2026-01") === "2025-12", "Test: calcula mes anterior cruzando año");
  assertTest(getNextMonthKey("2026-12") === "2027-01", "Test: calcula mes siguiente cruzando año");
  assertTest(filterByMonth([{ date: "2026-05-01" }, { date: "2026-06-01" }], "2026-05").length === 1, "Test: filtra registros por mes");
  assertTest(buildCarryoverIncome("2026-06", 20000).amount === 20000, "Test: crea ingreso de arrastre positivo");
}
runSelfTests();

const css = `
*{box-sizing:border-box}body{margin:0;background:#FBF7FA}.fin-app{min-height:100vh;background:#FBF7FA;color:#2A445E;padding:16px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.fin-shell{width:100%;max-width:430px;margin:0 auto;display:flex;flex-direction:column;gap:16px;padding-bottom:48px}.fin-header{border-radius:32px;padding:24px;color:white;background:linear-gradient(135deg,#58094F,#9F649F);box-shadow:0 16px 32px rgba(88,9,79,.18)}.fin-header p{margin:0;font-size:14px;opacity:.9}.fin-header h1{margin:4px 0 10px;font-size:32px;line-height:1.1;letter-spacing:-.04em}.card{background:#fff;border-radius:28px;padding:20px;box-shadow:0 8px 24px rgba(42,68,94,.07)}.card h2{margin:0 0 14px;font-size:16px;color:#2A445E}.muted{color:#627084;font-size:14px;line-height:1.5;margin:0}.micro{color:#8B96A6;font-size:11px;line-height:1.4;margin:8px 0 0}.status{border-radius:22px;padding:14px;font-size:13px;border:1px solid #B8E4DA;background:#EFFAF7}.status.warning{border-color:#F3D59A;background:#FFF8E9}.metric-grid{display:flex;flex-direction:column;gap:12px}.metric-block{display:flex;flex-direction:column;gap:10px}.metric-toggle{border:0;background:transparent;padding:0;text-align:left;cursor:pointer}.metric-dropdown{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-left:8px}.metric-card{background:white;border-radius:24px;padding:16px;box-shadow:0 8px 24px rgba(42,68,94,.07)}.metric-top{display:flex;gap:8px;align-items:center;color:#9F649F;font-size:12px;font-weight:700}.metric-value{display:block;margin-top:8px;font-size:17px;color:#2A445E}.metric-value.danger{color:#D33F49}.month-switcher{display:grid;gap:10px}.input,.select{width:100%;min-width:0;height:42px;border:1px solid #E7DDE9;border-radius:14px;padding:0 12px;color:#2A445E;background:white;font:inherit}.btn{height:42px;border:0;border-radius:16px;background:#58094F;color:white;font-weight:800;cursor:pointer;padding:0 14px}.btn.secondary{border:1px solid #E7DDE9;background:white;color:#58094F}.btn.danger{border:1px solid #F1C5C5;background:#FFF4F4;color:#B42318;width:100%}.btn.full{width:100%}.tabs{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;background:white;padding:4px;border-radius:20px;box-shadow:0 8px 24px rgba(42,68,94,.07)}.tab{border:0;border-radius:16px;padding:10px 4px;background:transparent;color:#627084;font-weight:700;font-size:11px;cursor:pointer}.tab.active{background:#F1E6F1;color:#58094F;font-weight:800}.stack{display:flex;flex-direction:column;gap:16px}.stack-small{display:flex;flex-direction:column;gap:12px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.full-width{grid-column:1/-1}.check-row{grid-column:1/-1;display:flex;gap:8px;align-items:center;font-size:13px;color:#627084}.progress-track{width:100%;height:10px;border-radius:999px;background:#F1E6F1;overflow:hidden;margin-top:10px}.progress-fill{height:100%;border-radius:999px}.chart{height:170px;display:grid;grid-template-columns:repeat(4,1fr);align-items:end;gap:12px}.bar-item{display:flex;flex-direction:column;align-items:center;gap:8px;height:100%;justify-content:end}.bar-column{height:124px;width:100%;display:flex;align-items:end;justify-content:center}.bar{width:68%;border-radius:12px 12px 0 0;min-height:8px}.bar-label{font-size:11px;color:#627084;text-align:center}.category-header{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:#2A445E}.empty{border-radius:18px;background:#FBF7FA;padding:16px;text-align:center;color:#8B96A6;font-size:13px}.row{display:flex;justify-content:space-between;gap:12px;align-items:center;background:white;border-radius:22px;padding:16px;box-shadow:0 8px 24px rgba(42,68,94,.07)}.row-title{margin:0;color:#2A445E;font-weight:800;font-size:14px}.row-meta{margin:4px 0;color:#8B96A6;font-size:12px}.link{border:0;background:transparent;color:#9F649F;padding:0;font-size:12px;cursor:pointer}.editable-row{display:flex;flex-direction:column;gap:12px;background:white;border-radius:22px;padding:16px;box-shadow:0 8px 24px rgba(42,68,94,.07)}.expense-editor{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}.paid-label{display:flex;gap:6px;align-items:center;font-size:12px;color:#627084}.steps{margin:0;padding-left:18px;color:#627084;font-size:14px;line-height:1.6}
`;

export default function App() {
  const initialLoad = useMemo(() => loadStoredData(), []);
  const initialMonth = initialLoad.data.activeMonth || currentMonthKey();
  const initialData = useMemo(() => ensureMonthData(initialLoad.data, initialMonth), [initialLoad.data, initialMonth]);
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("Panel");
  const [activeMonth, setActiveMonth] = useState(initialMonth);
  const [data, setData] = useState(initialData);
  const [storageEnabled, setStorageEnabled] = useState(initialLoad.storageEnabled);
  const [systemMessage, setSystemMessage] = useState(initialLoad.message);
  const [incomeForm, setIncomeForm] = useState(() => getIncomeForm(initialMonth));
  const [expenseForm, setExpenseForm] = useState(() => getExpenseForm(initialMonth));
  const [goalForm, setGoalForm] = useState(getGoalForm);
  const [investmentForm, setInvestmentForm] = useState(getInvestmentForm);
  const monthData = useMemo(() => getMonthScopedData(data, activeMonth), [data, activeMonth]);
  const totals = useMemo(() => calculateTotals(monthData), [monthData]);
  const expensesByCategory = useMemo(() => buildExpensesByCategory(monthData.expenses), [monthData.expenses]);
  function save(nextData, message = "Cambios guardados.") { const withMeta = { ...nextData, version: APP_VERSION, activeMonth, updatedAt: new Date().toISOString() }; const didPersist = persistData(withMeta); setData(withMeta); setStorageEnabled(didPersist); setSystemMessage(didPersist ? message : "Cambios activos solo mientras la app esté abierta. Exportá un backup para no perderlos."); }
  function changeMonth(nextMonth) { const ensured = ensureMonthData({ ...data, activeMonth: nextMonth }, nextMonth); const withMeta = { ...ensured, activeMonth: nextMonth, version: APP_VERSION, updatedAt: new Date().toISOString() }; const didPersist = persistData(withMeta); setActiveMonth(nextMonth); setData(withMeta); setStorageEnabled(didPersist); setIncomeForm(getIncomeForm(nextMonth)); setExpenseForm(getExpenseForm(nextMonth)); setSystemMessage(`Mes activo: ${getMonthLabel(nextMonth)}.`); }
  function updateItem(key, id, changes) { const collection = Array.isArray(data[key]) ? data[key] : []; save({ ...data, [key]: collection.map((item) => (String(item.id) === String(id) ? { ...item, ...changes } : item)) }); }
  function removeItem(key, id) { save({ ...data, [key]: deleteById(data[key], id) }, "Registro eliminado."); }
  function addIncome() { const amount = parseAmount(incomeForm.amount); if (!incomeForm.client.trim() || amount <= 0) return setSystemMessage("Para agregar un ingreso, cargá cliente y monto mayor a 0."); save({ ...data, incomes: [{ ...incomeForm, id: Date.now(), amount, date: incomeForm.date || monthStartDate(activeMonth) }, ...data.incomes] }, "Ingreso agregado y guardado."); setIncomeForm(getIncomeForm(activeMonth)); }
  function addExpense() { const amount = parseAmount(expenseForm.amount); if (amount <= 0) return setSystemMessage("Para agregar un gasto, cargá un monto mayor a 0. Podés usar coma o punto."); const name = expenseForm.name.trim() || expenseForm.category; save({ ...data, expenses: [{ ...expenseForm, id: Date.now(), name, amount, date: expenseForm.date || monthStartDate(activeMonth) }, ...data.expenses] }, "Gasto agregado y guardado."); setExpenseForm(getExpenseForm(activeMonth)); }
  function addGoal() { const target = parseAmount(goalForm.target); if (!goalForm.name.trim() || target <= 0) return setSystemMessage("Para agregar una meta, cargá nombre y objetivo mayor a 0."); save({ ...data, goals: [{ ...goalForm, id: Date.now(), target, current: parseAmount(goalForm.current) }, ...data.goals] }, "Meta agregada y guardada."); setGoalForm(getGoalForm()); }
  function addInvestment() { const amount = parseAmount(investmentForm.amount); if (!investmentForm.ticker.trim() || amount <= 0) return setSystemMessage("Para agregar una inversión, cargá ticker/fondo y monto mayor a 0."); save({ ...data, investments: [{ ...investmentForm, id: Date.now(), amount }, ...data.investments] }, "Inversión agregada y guardada."); setInvestmentForm(getInvestmentForm()); }
  function exportBackup() { const backup = { ...data, activeMonth, exportedAt: new Date().toISOString(), app: "Finanzas Lil", version: APP_VERSION }; downloadTextFile(`finanzas-lil-backup-${todayISO()}.json`, JSON.stringify(backup, null, 2)); setSystemMessage("Backup exportado. Guardalo en iCloud, Drive o tu compu."); }
  function importBackup(event) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = normalizeData(JSON.parse(String(reader.result))); const nextMonth = parsed.activeMonth || currentMonthKey(); const ensured = ensureMonthData(parsed, nextMonth); setActiveMonth(nextMonth); setIncomeForm(getIncomeForm(nextMonth)); setExpenseForm(getExpenseForm(nextMonth)); save(ensured, "Backup importado y guardado."); } catch { setSystemMessage("No se pudo importar el archivo. Revisá que sea un JSON válido."); } finally { event.target.value = ""; } }; reader.readAsText(file); }
  function resetAllData() { const confirmed = typeof window === "undefined" ? true : window.confirm("Esto va a borrar tus datos actuales y volver a los datos de ejemplo. ¿Continuar?"); if (!confirmed) return; const fresh = buildInitialState(); clearStoredData(); setActiveMonth(fresh.activeMonth); setIncomeForm(getIncomeForm(fresh.activeMonth)); setExpenseForm(getExpenseForm(fresh.activeMonth)); save(fresh, "Datos reiniciados."); }
  const nextStep = totals.fixed > 0 && totals.fixedCoverage < 100 ? "Prioridad: cubrir gastos fijos antes de separar dinero para inversión o disfrute." : totals.available > 0 ? "Buen mes: separá primero una parte para fondo de emergencia y luego definí inversión/disfrute." : "Mes ajustado: revisá variables y pendientes de cobro antes de asumir nuevos gastos.";
  return <><style>{css}</style><main className="fin-app"><div className="fin-shell"><header className="fin-header"><p>Finanzas freelance</p><h1>Panel de Lil</h1><p>Ingresos variables, gastos reales, metas e inversiones en un solo lugar.</p></header><MonthSwitcher activeMonth={activeMonth} onChangeMonth={changeMonth} /><StatusBanner storageEnabled={storageEnabled} message={systemMessage} updatedAt={data.updatedAt} /><MetricsGrid totals={totals} /><CardBox title="Lectura del mes" icon="✨"><p className="muted">{nextStep}</p><ProgressBar value={totals.fixedCoverage} color="#9F649F" /><p className="micro">Cobertura de gastos fijos: {totals.fixedCoverage}%</p></CardBox><TabBar activeTab={activeTab} onChange={setActiveTab} />{activeTab === "Panel" && <PanelView totals={totals} expensesByCategory={expensesByCategory} activeMonth={activeMonth} />}{activeTab === "Ingresos" && <IncomeView form={incomeForm} setForm={setIncomeForm} items={monthData.incomes} addIncome={addIncome} removeItem={removeItem} updateItem={updateItem} activeMonth={activeMonth} />}{activeTab === "Gastos" && <ExpensesView form={expenseForm} setForm={setExpenseForm} items={monthData.expenses} addExpense={addExpense} removeItem={removeItem} updateItem={updateItem} activeMonth={activeMonth} />}{activeTab === "Metas" && <GoalsView form={goalForm} setForm={setGoalForm} items={data.goals} addGoal={addGoal} removeItem={removeItem} />}{activeTab === "Inv." && <InvestmentsView form={investmentForm} setForm={setInvestmentForm} items={data.investments} addInvestment={addInvestment} removeItem={removeItem} />}{activeTab === "Ajustes" && <SettingsView data={data} save={save} fileInputRef={fileInputRef} exportBackup={exportBackup} importBackup={importBackup} resetAllData={resetAllData} />}</div></main></>;
}
function MonthSwitcher({ activeMonth, onChangeMonth }) { return <CardBox title="Mes activo" icon="📅"><div className="month-switcher"><button type="button" className="btn secondary" onClick={() => onChangeMonth(getPreviousMonthKey(activeMonth))}>← Mes anterior</button><input className="input" type="month" value={activeMonth} onChange={(e) => onChangeMonth(e.target.value)} /><button type="button" className="btn secondary" onClick={() => onChangeMonth(getNextMonthKey(activeMonth))}>Mes siguiente →</button></div><p className="micro">Al abrir un mes nuevo, los gastos fijos se crean en 0 y se arrastra el dinero libre positivo del mes anterior.</p></CardBox>; }
function StatusBanner({ storageEnabled, message, updatedAt }) { return <div className={storageEnabled ? "status" : "status warning"}><strong>{storageEnabled ? "Guardado activo" : "Modo seguro"}</strong><p className="muted">{message}</p>{updatedAt ? <p className="micro">Última actualización: {new Date(updatedAt).toLocaleString("es-AR")}</p> : null}</div>; }
function MetricsGrid({ totals }) { const [showIncomeDetails, setShowIncomeDetails] = useState(false); const [showExpenseDetails, setShowExpenseDetails] = useState(false); return <section className="metric-grid"><div className="metric-block"><button type="button" className="metric-toggle" onClick={() => setShowIncomeDetails(!showIncomeDetails)}><MetricCard icon="💎" label="Ingreso total" value={formatMoney(totals.totalIncome)} /></button>{showIncomeDetails ? <div className="metric-dropdown"><MetricCard icon="💰" label="Cobrado" value={formatMoney(totals.incomeCollected)} /><MetricCard icon="⏳" label="Pendiente" value={formatMoney(totals.incomePending)} /></div> : null}</div><div className="metric-block"><button type="button" className="metric-toggle" onClick={() => setShowExpenseDetails(!showExpenseDetails)}><MetricCard icon="🎯" label="Gastos totales" value={formatMoney(totals.totalExpenses)} /></button>{showExpenseDetails ? <div className="metric-dropdown"><MetricCard icon="💸" label="Gastos pagos" value={formatMoney(totals.paidExpenses)} /><MetricCard icon="🧾" label="Pendientes" value={formatMoney(totals.pendingExpenses)} /></div> : null}</div><MetricCard icon="📈" label="Libre" value={formatMoney(totals.available)} danger={totals.available < 0} /></section>; }
function MetricCard({ icon, label, value, danger = false }) { return <div className="metric-card"><div className="metric-top"><span>{icon}</span><span>{label}</span></div><strong className={danger ? "metric-value danger" : "metric-value"}>{value}</strong></div>; }
function TabBar({ activeTab, onChange }) { return <nav className="tabs">{TABS.map((tab) => <button key={tab} type="button" className={activeTab === tab ? "tab active" : "tab"} onClick={() => onChange(tab)}>{tab}</button>)}</nav>; }
function CardBox({ title, icon, children }) { return <section className="card">{title ? <h2>{icon ? <span>{icon} </span> : null}{title}</h2> : null}{children}</section>; }
function TextInput({ value, onChange, placeholder = "", type = "text", inputMode }) { return <input className="input" type={type} inputMode={inputMode} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />; }
function NativeSelect({ value, onChange, options }) { return <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>; }
function ProgressBar({ value, color }) { const safeValue = Math.max(0, Math.min(100, Number(value || 0))); return <div className="progress-track"><div className="progress-fill" style={{ width: `${safeValue}%`, background: color }} /></div>; }
function SimpleBarChart({ data }) { const max = Math.max(...data.map((item) => item.value), 1); return <div className="chart">{data.map((item, index) => { const height = Math.max(8, Math.round((item.value / max) * 120)); return <div key={item.name} className="bar-item"><div className="bar-column"><div className="bar" title={formatMoney(item.value)} style={{ height, background: BAR_COLORS[index % BAR_COLORS.length] }} /></div><span className="bar-label">{item.name}</span></div>; })}</div>; }
function CategoryList({ data }) { const total = data.reduce((s, i) => s + i.value, 0) || 1; return <div className="stack-small">{data.map((item, index) => { const percentage = Math.round((item.value / total) * 100); return <div key={item.name}><div className="category-header"><span>{item.name}</span><strong>{formatMoney(item.value)}</strong></div><ProgressBar value={percentage} color={BAR_COLORS[index % BAR_COLORS.length]} /><p className="micro">{percentage}% del total cargado</p></div>; })}</div>; }
function EmptyState({ text }) { return <div className="empty">{text}</div>; }
function RecordList({ items, render }) { if (!items || !items.length) return <EmptyState text="Todavía no hay registros." />; return <div className="stack-small">{items.map(render)}</div>; }
function RecordRow({ title, meta, action, onDelete }) { return <div className="row"><div><p className="row-title">{title}</p><p className="row-meta">{meta}</p><button type="button" className="link" onClick={onDelete}>Eliminar</button></div>{action ? <div>{action}</div> : null}</div>; }
function PanelView({ totals, expensesByCategory, activeMonth }) { const chartData = [{ name: "Total", value: totals.totalIncome }, { name: "Cobrado", value: totals.incomeCollected }, { name: "Pendiente", value: totals.incomePending }, { name: "Libre", value: Math.max(0, totals.available) }]; return <section className="stack"><CardBox title={`Flujo general · ${getMonthLabel(activeMonth)}`}><SimpleBarChart data={chartData} /></CardBox><CardBox title="Gastos por categoría">{expensesByCategory.length ? <CategoryList data={expensesByCategory} /> : <EmptyState text="Cargá montos en tus gastos para ver el detalle." />}</CardBox></section>; }
function IncomeView({ form, setForm, items, addIncome, removeItem, updateItem, activeMonth }) { return <section className="stack"><CardBox title={`Nuevo ingreso · ${getMonthLabel(activeMonth)}`}><div className="form-grid"><TextInput placeholder="Cliente" value={form.client} onChange={(value) => setForm({ ...form, client: value })} /><TextInput placeholder="Proyecto" value={form.project} onChange={(value) => setForm({ ...form, project: value })} /><TextInput inputMode="decimal" placeholder="Monto" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} /><NativeSelect value={form.currency} onChange={(value) => setForm({ ...form, currency: value })} options={["ARS", "USD"]} /><NativeSelect value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={["pendiente", "cobrado"]} /><TextInput type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} /><label className="check-row"><input type="checkbox" checked={form.invoiced} onChange={(e) => setForm({ ...form, invoiced: e.target.checked })} />Factura realizada</label><button type="button" className="btn full full-width" onClick={addIncome}>+ Agregar ingreso</button></div></CardBox><RecordList items={items} render={(income) => <RecordRow key={income.id} title={`${income.client} · ${income.project || "Sin proyecto"}`} meta={`${formatMoney(income.amount, income.currency)} · ${income.status} · ${income.invoiced ? "facturado" : "sin factura"}`} onDelete={() => removeItem("incomes", income.id)} action={<button type="button" className="btn secondary" onClick={() => updateItem("incomes", income.id, { status: income.status === "cobrado" ? "pendiente" : "cobrado" })}>{income.status === "cobrado" ? "Pendiente" : "Cobrado"}</button>} />} /></section>; }
function ExpensesView({ form, setForm, items, addExpense, removeItem, updateItem, activeMonth }) { return <section className="stack"><CardBox title={`Nuevo gasto · ${getMonthLabel(activeMonth)}`}><div className="form-grid"><TextInput placeholder="Nombre opcional" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><TextInput inputMode="decimal" placeholder="Monto ARS" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} /><NativeSelect value={form.category} onChange={(value) => setForm({ ...form, category: value })} options={EXPENSE_CATEGORIES} /><NativeSelect value={form.type} onChange={(value) => setForm({ ...form, type: value })} options={["fijo", "variable"]} /><TextInput type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} /><button type="button" className="btn" onClick={addExpense}>+ Agregar</button></div></CardBox><RecordList items={items} render={(expense) => <ExpenseEditableRow key={expense.id} expense={expense} updateItem={updateItem} removeItem={removeItem} />} /></section>; }
function ExpenseEditableRow({ expense, updateItem, removeItem }) { return <div className="editable-row"><div><p className="row-title">{expense.name} · {expense.type}</p><p className="row-meta">{expense.category} · {expense.paid ? "pagado" : "pendiente"}</p></div><div className="expense-editor"><input className="input" type="text" inputMode="decimal" value={expense.amount} onChange={(e) => updateItem("expenses", expense.id, { amount: parseAmount(e.target.value) })} /><label className="paid-label"><input type="checkbox" checked={expense.paid} onChange={(e) => updateItem("expenses", expense.id, { paid: e.target.checked })} />Pagado</label><button type="button" className="link" onClick={() => removeItem("expenses", expense.id)}>Eliminar</button></div></div>; }
function GoalsView({ form, setForm, items, addGoal, removeItem }) { return <section className="stack"><CardBox title="Nueva meta"><div className="form-grid"><TextInput placeholder="Meta" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><TextInput inputMode="decimal" placeholder="Objetivo ARS" value={form.target} onChange={(value) => setForm({ ...form, target: value })} /><TextInput inputMode="decimal" placeholder="Actual ARS" value={form.current} onChange={(value) => setForm({ ...form, current: value })} /><button type="button" className="btn" onClick={addGoal}>+ Agregar</button></div></CardBox>{items.map((goal) => { const target = parseAmount(goal.target); const progress = target ? Math.min(100, Math.round((parseAmount(goal.current) / target) * 100)) : 0; return <CardBox key={goal.id} title={goal.name}><ProgressBar value={progress} color="#53A3A6" /><p className="muted">{formatMoney(goal.current)} de {formatMoney(goal.target)} · {progress}%</p><button type="button" className="link" onClick={() => removeItem("goals", goal.id)}>Eliminar</button></CardBox>; })}</section>; }
function InvestmentsView({ form, setForm, items, addInvestment, removeItem }) { return <section className="stack"><CardBox title="Registro de inversiones"><div className="form-grid"><NativeSelect value={form.asset} onChange={(value) => setForm({ ...form, asset: value })} options={INVESTMENT_TYPES} /><TextInput placeholder="Ticker / Fondo" value={form.ticker} onChange={(value) => setForm({ ...form, ticker: value })} /><TextInput inputMode="decimal" placeholder="Monto" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} /><NativeSelect value={form.currency} onChange={(value) => setForm({ ...form, currency: value })} options={["ARS", "USD"]} /><div className="full-width"><TextInput placeholder="Nota" value={form.note} onChange={(value) => setForm({ ...form, note: value })} /></div><button type="button" className="btn full full-width" onClick={addInvestment}>+ Agregar inversión</button></div></CardBox><CardBox title="Consejo orientativo"><p className="muted">Perfil moderado: antes de aumentar riesgo, priorizá fondo de emergencia líquido. Luego combiná FCI de liquidez/renta fija para corto plazo, CEDEARs diversificados para dolarización parcial y acciones locales solo como porción más volátil.</p><p className="micro">No es recomendación financiera personalizada. Revisar siempre costos, horizonte y riesgo antes de operar.</p></CardBox><RecordList items={items} render={(investment) => <RecordRow key={investment.id} title={`${investment.asset} · ${investment.ticker}`} meta={`${formatMoney(investment.amount, investment.currency)} · ${investment.note || "sin nota"}`} onDelete={() => removeItem("investments", investment.id)} />} /></section>; }
function SettingsView({ data, save, fileInputRef, exportBackup, importBackup, resetAllData }) { return <section className="stack"><CardBox title="Configuración rápida"><label className="muted">Dólar de referencia para convertir USD a ARS</label><TextInput inputMode="decimal" value={data.settings.usdRate} onChange={(value) => save({ ...data, settings: { ...data.settings, usdRate: parseAmount(value) } })} /></CardBox><CardBox title="Backup y seguridad"><p className="muted">Recomendación: exportá un backup cada semana o antes de hacer cambios grandes.</p><button type="button" className="btn full" onClick={exportBackup}>Descargar backup JSON</button><button type="button" className="btn secondary full" style={{ marginTop: 10 }} onClick={() => fileInputRef.current?.click()}>Importar backup</button><input ref={fileInputRef} type="file" accept="application/json,.json" onChange={importBackup} style={{ display: "none" }} /><button type="button" className="btn danger" style={{ marginTop: 10 }} onClick={resetAllData}>Reiniciar datos</button></CardBox><CardBox title="Instalar en el celular como app"><ol className="steps"><li>Subí el proyecto a Vercel o Netlify.</li><li>Abrí el link desde Safari en iPhone o Chrome en Android.</li><li>Elegí “Agregar a pantalla de inicio”.</li><li>Usala siempre desde ese ícono para mantener una experiencia estable.</li><li>Exportá backups periódicos desde esta sección.</li></ol></CardBox></section>; }
