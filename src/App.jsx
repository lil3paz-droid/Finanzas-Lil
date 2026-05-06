import React, { useMemo, useRef, useState } from "react";

const APP_VERSION = "1.0.6";
const STORAGE_KEY = "finanzas-lil-v4";
const COLORS = ["#9F649F", "#53A3A6", "#F3AA20", "#2A445E"];
const FIXED_EXPENSES = ["Luz", "Gas", "Internet", "Expensas", "Curso de inglés", "Tuenti", "Monotributo", "Sube", "Gym", "Supermercado", "Belleza", "Canva", "ChatGPT"];
const EXPENSE_CATEGORIES = ["Comida", "Transporte", "Disfrute", "Herramientas IA", "Entrenamiento", "Impuestos", "Formación", "Pagos dpto", "Ropa", "Otros"];
const INVESTMENT_TYPES = ["CEDEAR", "FCI", "Acción", "Dólar", "Otro"];
const TABS = ["Panel", "Ingresos", "Gastos", "Metas", "Inv.", "Ajustes"];

function todayISO() { return new Date().toISOString().slice(0, 10); }

function categoryForFixedExpense(name) {
  if (name === "Canva" || name === "ChatGPT") return "Herramientas IA";
  if (name === "Monotributo") return "Impuestos";
  if (name === "Gym") return "Entrenamiento";
  if (name === "Curso de inglés") return "Formación";
  if (name === "Expensas") return "Pagos dpto";
  if (name === "Supermercado") return "Comida";
  if (name === "Sube") return "Transporte";
  return "Otros";
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
  const number = parseAmount(value);
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(number);
  } catch {
    return `${currency} ${Math.round(number).toLocaleString("es-AR")}`;
  }
}

function convertToARS(item, usdRate) {
  const amount = parseAmount(item && item.amount);
  return item && item.currency === "USD" ? amount * Number(usdRate || 0) : amount;
}

function calculateTotals(data) {
  const safe = data || {};
  const usdRate = Number((safe.settings && safe.settings.usdRate) || 0);
  const incomes = Array.isArray(safe.incomes) ? safe.incomes : [];
  const expenses = Array.isArray(safe.expenses) ? safe.expenses : [];
  const investments = Array.isArray(safe.investments) ? safe.investments : [];

  const incomeCollected = incomes.filter((x) => x.status === "cobrado").reduce((s, x) => s + convertToARS(x, usdRate), 0);
  const incomePending = incomes.filter((x) => x.status === "pendiente").reduce((s, x) => s + convertToARS(x, usdRate), 0);
  const fixed = expenses.filter((x) => x.type === "fijo").reduce((s, x) => s + parseAmount(x.amount), 0);
  const variable = expenses.filter((x) => x.type === "variable").reduce((s, x) => s + parseAmount(x.amount), 0);
  const totalExpenses = fixed + variable;
  const available = incomeCollected - totalExpenses;
  const fixedCoverage = fixed ? Math.min(100, Math.round((incomeCollected / fixed) * 100)) : 0;
  const investmentTotal = investments.reduce((s, x) => s + convertToARS(x, usdRate), 0);
  return { incomeCollected, incomePending, fixed, variable, totalExpenses, available, fixedCoverage, investmentTotal };
}

function buildInitialState() {
  return {
    version: APP_VERSION,
    updatedAt: new Date().toISOString(),
    incomes: [{ id: 1, client: "Cliente ejemplo", project: "Pack mensual", amount: 450, currency: "USD", status: "pendiente", invoiced: false, date: todayISO() }],
    expenses: FIXED_EXPENSES.map((name, i) => ({ id: i + 1, name, category: categoryForFixedExpense(name), amount: 0, type: "fijo", paid: false, date: todayISO() })),
    goals: [
      { id: 1, name: "Fondo de emergencia", target: 0, current: 0 },
      { id: 2, name: "Casa", target: 0, current: 0 },
      { id: 3, name: "Independencia financiera", target: 0, current: 0 },
    ],
    investments: [
      { id: 1, asset: "CEDEAR", ticker: "AAPL / GOOGL / META / NVDA", amount: 0, currency: "ARS", note: "Cartera actual en IOL" },
      { id: 2, asset: "FCI", ticker: "IOL", amount: 0, currency: "ARS", note: "Fondos propios de IOL" },
      { id: 3, asset: "Acción", ticker: "YPF", amount: 0, currency: "ARS", note: "Acción local" },
    ],
    settings: { usdRate: 1000 },
  };
}

function getIncomeForm() { return { client: "", project: "", amount: "", currency: "ARS", status: "pendiente", invoiced: false, date: todayISO() }; }
function getExpenseForm() { return { name: "", category: "Comida", amount: "", type: "variable", paid: false, date: todayISO() }; }
function getGoalForm() { return { name: "", target: "", current: "" }; }
function getInvestmentForm() { return { asset: "CEDEAR", ticker: "", amount: "", currency: "ARS", note: "" }; }

function buildExpensesByCategory(expenses) {
  const map = {};
  (Array.isArray(expenses) ? expenses : []).forEach((expense) => {
    const key = expense.category || "Otros";
    map[key] = (map[key] || 0) + parseAmount(expense.amount);
  });
  return Object.entries(map).map(([name, value]) => ({ name, value })).filter((item) => item.value > 0);
}

function isStorageAvailable() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const key = "__finanzas_lil_storage_test__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function validateDataShape(value) {
  return Boolean(value && Array.isArray(value.incomes) && Array.isArray(value.expenses) && Array.isArray(value.goals) && Array.isArray(value.investments) && value.settings && typeof value.settings === "object");
}

function normalizeData(value) {
  const base = buildInitialState();
  if (!validateDataShape(value)) return base;
  return { ...base, ...value, version: APP_VERSION, updatedAt: value.updatedAt || new Date().toISOString(), settings: { ...base.settings, ...value.settings } };
}

function loadStoredData() {
  if (!isStorageAvailable()) return { data: buildInitialState(), storageEnabled: false, message: "Modo seguro: el navegador no permitió guardado local." };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: buildInitialState(), storageEnabled: true, message: "Guardado local activo." };
    return { data: normalizeData(JSON.parse(raw)), storageEnabled: true, message: "Datos recuperados del dispositivo." };
  } catch {
    return { data: buildInitialState(), storageEnabled: true, message: "No se pudo leer el guardado anterior. Se inició una copia limpia." };
  }
}

function persistData(nextData) {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    return true;
  } catch {
    return false;
  }
}

function clearStoredData() {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

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
  const testData = {
    incomes: [{ amount: 100, currency: "USD", status: "cobrado" }, { amount: 50000, currency: "ARS", status: "pendiente" }],
    expenses: [{ amount: 80000, type: "fijo", category: "Pagos dpto" }, { amount: 20000, type: "variable", category: "Comida" }],
    investments: [{ amount: 10, currency: "USD" }],
    settings: { usdRate: 1000 },
  };
  const result = calculateTotals(testData);
  assertTest(result.incomeCollected === 100000, "Test: USD cobrado convertido a ARS");
  assertTest(result.incomePending === 50000, "Test: ingreso pendiente en ARS");
  assertTest(result.totalExpenses === 100000, "Test: total de gastos");
  assertTest(result.available === 0, "Test: disponible final");
  assertTest(result.fixedCoverage === 100, "Test: cobertura de gastos fijos limitada a 100%");
  assertTest(result.investmentTotal === 10000, "Test: inversiones convertidas a ARS");
  assertTest(convertToARS({ amount: 25, currency: "ARS" }, 1200) === 25, "Test: ARS no se convierte");
  assertTest(parseAmount("12500") === 12500, "Test: parsea monto entero");
  assertTest(parseAmount("12,5") === 12.5, "Test: parsea decimal con coma");
  assertTest(parseAmount("12.500,50") === 12500.5, "Test: parsea miles con punto y decimal con coma");
  assertTest(buildExpensesByCategory(testData.expenses).length === 2, "Test: agrupa categorías con gasto mayor a cero");
  assertTest(categoryForFixedExpense("Canva") === "Herramientas IA", "Test: Canva clasifica como IA");
  assertTest(calculateTotals({ incomes: [], expenses: [], investments: [], settings: { usdRate: 1000 } }).available === 0, "Test: disponible sin registros debe ser 0");
  assertTest(formatMoney(1000, "ARS").length > 0, "Test: formatea dinero en ARS");
  assertTest(buildInitialState().expenses.length === FIXED_EXPENSES.length, "Test: crea gastos fijos iniciales");
  assertTest(validateDataShape(buildInitialState()) === true, "Test: estructura inicial válida");
  assertTest(validateDataShape({}) === false, "Test: rechaza backup inválido");
  assertTest(normalizeData({}).incomes.length === 1, "Test: normaliza datos inválidos a estado inicial");
  assertTest(buildExpensesByCategory(null).length === 0, "Test: tolera gastos nulos");
  assertTest(calculateTotals({ incomes: null, expenses: null, investments: null, settings: {} }).available === 0, "Test: tolera arrays nulos");
  assertTest(buildExpensesByCategory([{ category: "Ropa", amount: 3000 }])[0].name === "Ropa", "Test: permite agrupar gasto por categoría");
}
runSelfTests();

export default function App() {
  const initialLoad = useMemo(() => loadStoredData(), []);
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("Panel");
  const [data, setData] = useState(() => initialLoad.data);
  const [storageEnabled, setStorageEnabled] = useState(initialLoad.storageEnabled);
  const [systemMessage, setSystemMessage] = useState(initialLoad.message);
  const [incomeForm, setIncomeForm] = useState(getIncomeForm);
  const [expenseForm, setExpenseForm] = useState(getExpenseForm);
  const [goalForm, setGoalForm] = useState(getGoalForm);
  const [investmentForm, setInvestmentForm] = useState(getInvestmentForm);
  const totals = useMemo(() => calculateTotals(data), [data]);
  const expensesByCategory = useMemo(() => buildExpensesByCategory(data.expenses), [data.expenses]);

  function save(nextData, message = "Cambios guardados.") {
    const withMeta = { ...nextData, version: APP_VERSION, updatedAt: new Date().toISOString() };
    const didPersist = persistData(withMeta);
    setData(withMeta);
    setStorageEnabled(didPersist);
    setSystemMessage(didPersist ? message : "Cambios activos solo mientras la app esté abierta. Exportá un backup para no perderlos.");
  }

  function updateItem(key, id, changes) {
    const collection = Array.isArray(data[key]) ? data[key] : [];
    save({ ...data, [key]: collection.map((item) => (item.id === id ? { ...item, ...changes } : item)) });
  }

  function removeItem(key, id) {
    const confirmed = typeof window === "undefined" ? true : window.confirm("¿Querés eliminar este registro?");
    if (!confirmed) return;
    const collection = Array.isArray(data[key]) ? data[key] : [];
    save({ ...data, [key]: collection.filter((item) => item.id !== id) }, "Registro eliminado.");
  }

  function addIncome() {
    const amount = parseAmount(incomeForm.amount);
    if (!incomeForm.client.trim() || amount <= 0) {
      setSystemMessage("Para agregar un ingreso, cargá cliente y monto mayor a 0.");
      return;
    }
    save({ ...data, incomes: [{ ...incomeForm, id: Date.now(), amount }, ...data.incomes] }, "Ingreso agregado y guardado.");
    setIncomeForm(getIncomeForm());
  }

  function addExpense() {
    const amount = parseAmount(expenseForm.amount);
    if (amount <= 0) {
      setSystemMessage("Para agregar un gasto, cargá un monto mayor a 0. Podés usar coma o punto.");
      return;
    }
    const item = { ...expenseForm, id: Date.now(), name: expenseForm.name.trim() || expenseForm.category, amount };
    const currentExpenses = Array.isArray(data.expenses) ? data.expenses : [];
    save({ ...data, expenses: [item, ...currentExpenses] }, "Gasto agregado y guardado.");
    setExpenseForm(getExpenseForm());
  }

  function addGoal() {
    const target = parseAmount(goalForm.target);
    if (!goalForm.name.trim() || target <= 0) {
      setSystemMessage("Para agregar una meta, cargá nombre y objetivo mayor a 0.");
      return;
    }
    save({ ...data, goals: [{ ...goalForm, id: Date.now(), target, current: parseAmount(goalForm.current) }, ...data.goals] }, "Meta agregada y guardada.");
    setGoalForm(getGoalForm());
  }

  function addInvestment() {
    const amount = parseAmount(investmentForm.amount);
    if (!investmentForm.ticker.trim() || amount <= 0) {
      setSystemMessage("Para agregar una inversión, cargá ticker/fondo y monto mayor a 0.");
      return;
    }
    save({ ...data, investments: [{ ...investmentForm, id: Date.now(), amount }, ...data.investments] }, "Inversión agregada y guardada.");
    setInvestmentForm(getInvestmentForm());
  }

  function exportBackup() {
    const backup = { ...data, exportedAt: new Date().toISOString(), app: "Finanzas Lil", version: APP_VERSION };
    downloadTextFile(`finanzas-lil-backup-${todayISO()}.json`, JSON.stringify(backup, null, 2));
    setSystemMessage("Backup exportado. Guardalo en iCloud, Drive o tu compu.");
  }

  function importBackup(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!validateDataShape(parsed)) {
          setSystemMessage("El archivo no parece ser un backup válido de Finanzas Lil.");
          return;
        }
        save(normalizeData(parsed), "Backup importado y guardado.");
      } catch {
        setSystemMessage("No se pudo importar el archivo. Revisá que sea un JSON válido.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function resetAllData() {
    const confirmed = typeof window === "undefined" ? true : window.confirm("Esto va a borrar tus datos actuales y volver a los datos de ejemplo. ¿Continuar?");
    if (!confirmed) return;
    clearStoredData();
    save(buildInitialState(), "Datos reiniciados.");
  }

  const nextStep = totals.fixed > 0 && totals.fixedCoverage < 100
    ? "Prioridad: cubrir gastos fijos antes de separar dinero para inversión o disfrute."
    : totals.available > 0
      ? "Buen mes: separá primero una parte para fondo de emergencia y luego definí inversión/disfrute."
      : "Mes ajustado: revisá variables y pendientes de cobro antes de asumir nuevos gastos.";

  return (
    <div style={styles.app}>
      <div style={styles.shell}>
        <Header />
        <StatusBanner storageEnabled={storageEnabled} message={systemMessage} updatedAt={data.updatedAt} />
        <Metrics totals={totals} />
        <Card title="Lectura del mes" icon="✨">
          <p style={styles.muted}>{nextStep}</p>
          <ProgressBar value={totals.fixedCoverage} color="#9F649F" />
          <p style={styles.micro}>Cobertura de gastos fijos: {totals.fixedCoverage}%</p>
        </Card>
        <TabBar activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === "Panel" && <PanelTab totals={totals} expensesByCategory={expensesByCategory} />}
        {activeTab === "Ingresos" && <IngresosTab form={incomeForm} setForm={setIncomeForm} items={data.incomes} addIncome={addIncome} removeItem={removeItem} updateItem={updateItem} />}
        {activeTab === "Gastos" && <GastosTab form={expenseForm} setForm={setExpenseForm} items={data.expenses} addExpense={addExpense} removeItem={removeItem} updateItem={updateItem} />}
        {activeTab === "Metas" && <MetasTab form={goalForm} setForm={setGoalForm} items={data.goals} addGoal={addGoal} removeItem={removeItem} />}
        {activeTab === "Inv." && <InversionesTab form={investmentForm} setForm={setInvestmentForm} items={data.investments} addInvestment={addInvestment} removeItem={removeItem} />}
        {activeTab === "Ajustes" && <AjustesTab data={data} save={save} fileInputRef={fileInputRef} exportBackup={exportBackup} importBackup={importBackup} resetAllData={resetAllData} />}
      </div>
    </div>
  );
}

function Header() {
  return <header style={styles.header}><p style={styles.headerEyebrow}>Finanzas freelance</p><h1 style={styles.headerTitle}>Panel de Lil</h1><p style={styles.headerText}>Ingresos variables, gastos reales, metas e inversiones en un solo lugar.</p></header>;
}

function StatusBanner({ storageEnabled, message, updatedAt }) {
  return <div style={storageEnabled ? styles.statusOk : styles.statusWarning}><strong>{storageEnabled ? "Guardado activo" : "Modo seguro"}</strong><p style={styles.statusText}>{message}</p>{updatedAt ? <p style={styles.statusDate}>Última actualización: {new Date(updatedAt).toLocaleString("es-AR")}</p> : null}</div>;
}

function Metrics({ totals }) {
  return <section style={styles.metricsGrid}><Metric icon="💰" label="Cobrado" value={formatMoney(totals.incomeCollected)} /><Metric icon="⏳" label="Pendiente" value={formatMoney(totals.incomePending)} /><Metric icon="🎯" label="Gastos" value={formatMoney(totals.totalExpenses)} /><Metric icon="📈" label="Libre" value={formatMoney(totals.available)} danger={totals.available < 0} /></section>;
}

function TabBar({ activeTab, onChange }) {
  return <nav style={styles.tabs}>{TABS.map((tab) => <button key={tab} type="button" style={activeTab === tab ? styles.tabActive : styles.tab} onClick={() => onChange(tab)}>{tab}</button>)}</nav>;
}

function PanelTab({ totals, expensesByCategory }) {
  return <section style={styles.stack}><Card title="Flujo general"><SimpleBarChart data={[{ name: "Cobrado", value: totals.incomeCollected }, { name: "Pendiente", value: totals.incomePending }, { name: "Gastos", value: totals.totalExpenses }, { name: "Libre", value: Math.max(0, totals.available) }]} /></Card><Card title="Gastos por categoría">{expensesByCategory.length ? <CategoryList data={expensesByCategory} /> : <Empty text="Cargá montos en tus gastos para ver el detalle." />}</Card></section>;
}

function IngresosTab({ form, setForm, items, addIncome, removeItem, updateItem }) {
  return <section style={styles.stack}><Card title="Nuevo ingreso"><div style={styles.formGrid}><TextInput placeholder="Cliente" value={form.client} onChange={(value) => setForm({ ...form, client: value })} /><TextInput placeholder="Proyecto" value={form.project} onChange={(value) => setForm({ ...form, project: value })} /><TextInput inputMode="decimal" placeholder="Monto" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} /><NativeSelect value={form.currency} onChange={(value) => setForm({ ...form, currency: value })} options={["ARS", "USD"]} /><NativeSelect value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={["pendiente", "cobrado"]} /><TextInput type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} /><label style={styles.checkboxLabel}><input type="checkbox" checked={form.invoiced} onChange={(event) => setForm({ ...form, invoiced: event.target.checked })} />Factura realizada</label><button type="button" style={styles.primaryButtonWide} onClick={addIncome}>+ Agregar ingreso</button></div></Card><List items={items} render={(income) => <Row key={income.id} title={`${income.client} · ${income.project || "Sin proyecto"}`} meta={`${formatMoney(income.amount, income.currency)} · ${income.status} · ${income.invoiced ? "facturado" : "sin factura"}`} onDelete={() => removeItem("incomes", income.id)} action={<button type="button" style={styles.smallButton} onClick={() => updateItem("incomes", income.id, { status: income.status === "cobrado" ? "pendiente" : "cobrado" })}>{income.status === "cobrado" ? "Pendiente" : "Cobrado"}</button>} />} /></section>;
}

function GastosTab({ form, setForm, items, addExpense, removeItem, updateItem }) {
  return <section style={styles.stack}><Card title="Nuevo gasto"><div style={styles.formGrid}><TextInput placeholder="Nombre opcional" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><TextInput inputMode="decimal" placeholder="Monto ARS" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} /><NativeSelect value={form.category} onChange={(value) => setForm({ ...form, category: value })} options={EXPENSE_CATEGORIES} /><NativeSelect value={form.type} onChange={(value) => setForm({ ...form, type: value })} options={["fijo", "variable"]} /><TextInput type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} /><button type="button" style={styles.primaryButton} onClick={addExpense}>+ Agregar</button></div></Card><List items={items} render={(expense) => <EditableExpenseRow key={expense.id} expense={expense} updateItem={updateItem} removeItem={removeItem} />} /></section>;
}

function EditableExpenseRow({ expense, updateItem, removeItem }) {
  return <div style={styles.editableRow}><div style={styles.rowContent}><p style={styles.rowTitle}>{`${expense.name} · ${expense.type}`}</p><p style={styles.rowMeta}>{`${expense.category} · ${expense.paid ? "pagado" : "pendiente"}`}</p></div><div style={styles.expenseEditor}><input type="text" inputMode="decimal" value={expense.amount} aria-label={`Monto de ${expense.name}`} onChange={(event) => updateItem("expenses", expense.id, { amount: parseAmount(event.target.value) })} style={styles.amountInput} /><label style={styles.paidInlineLabel}><input type="checkbox" checked={expense.paid} onChange={(event) => updateItem("expenses", expense.id, { paid: event.target.checked })} />Pagado</label><button type="button" style={styles.linkButton} onClick={() => removeItem("expenses", expense.id)}>Eliminar</button></div></div>;
}

function MetasTab({ form, setForm, items, addGoal, removeItem }) {
  return <section style={styles.stack}><Card title="Nueva meta"><div style={styles.formGrid}><TextInput placeholder="Meta" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><TextInput inputMode="decimal" placeholder="Objetivo ARS" value={form.target} onChange={(value) => setForm({ ...form, target: value })} /><TextInput inputMode="decimal" placeholder="Actual ARS" value={form.current} onChange={(value) => setForm({ ...form, current: value })} /><button type="button" style={styles.primaryButton} onClick={addGoal}>+ Agregar</button></div></Card>{items.map((goal) => { const target = parseAmount(goal.target); const progress = target ? Math.min(100, Math.round((parseAmount(goal.current) / target) * 100)) : 0; return <Card key={goal.id} title={goal.name}><ProgressBar value={progress} color="#53A3A6" /><p style={styles.muted}>{formatMoney(goal.current)} de {formatMoney(goal.target)} · {progress}%</p><button type="button" style={styles.linkButton} onClick={() => removeItem("goals", goal.id)}>Eliminar</button></Card>; })}</section>;
}

function InversionesTab({ form, setForm, items, addInvestment, removeItem }) {
  return <section style={styles.stack}><Card title="Registro de inversiones"><div style={styles.formGrid}><NativeSelect value={form.asset} onChange={(value) => setForm({ ...form, asset: value })} options={INVESTMENT_TYPES} /><TextInput placeholder="Ticker / Fondo" value={form.ticker} onChange={(value) => setForm({ ...form, ticker: value })} /><TextInput inputMode="decimal" placeholder="Monto" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} /><NativeSelect value={form.currency} onChange={(value) => setForm({ ...form, currency: value })} options={["ARS", "USD"]} /><div style={styles.fullWidth}><TextInput placeholder="Nota" value={form.note} onChange={(value) => setForm({ ...form, note: value })} /></div><button type="button" style={styles.primaryButtonWide} onClick={addInvestment}>+ Agregar inversión</button></div></Card><Card title="Consejo orientativo"><p style={styles.muted}>Perfil moderado: antes de aumentar riesgo, priorizá fondo de emergencia líquido. Luego combiná FCI de liquidez/renta fija para corto plazo, CEDEARs diversificados para dolarización parcial y acciones locales solo como porción más volátil.</p><p style={styles.micro}>No es recomendación financiera personalizada. Revisar siempre costos, horizonte y riesgo antes de operar.</p></Card><List items={items} render={(investment) => <Row key={investment.id} title={`${investment.asset} · ${investment.ticker}`} meta={`${formatMoney(investment.amount, investment.currency)} · ${investment.note || "sin nota"}`} onDelete={() => removeItem("investments", investment.id)} />} /></section>;
}

function AjustesTab({ data, save, fileInputRef, exportBackup, importBackup, resetAllData }) {
  return <section style={styles.stack}><Card title="Configuración rápida"><label style={styles.label}>Dólar de referencia para convertir USD a ARS</label><TextInput inputMode="decimal" value={data.settings.usdRate} onChange={(value) => save({ ...data, settings: { ...data.settings, usdRate: parseAmount(value) } })} /></Card><Card title="Backup y seguridad"><p style={styles.muted}>Recomendación: exportá un backup cada semana o antes de hacer cambios grandes.</p><button type="button" style={styles.primaryButtonWide} onClick={exportBackup}>Descargar backup JSON</button><button type="button" style={styles.secondaryButton} onClick={() => fileInputRef.current && fileInputRef.current.click()}>Importar backup</button><input ref={fileInputRef} type="file" accept="application/json,.json" onChange={importBackup} style={{ display: "none" }} /><button type="button" style={styles.dangerButton} onClick={resetAllData}>Reiniciar datos</button></Card><Card title="Instalar en el celular como app"><ol style={styles.stepsList}><li>Subí el proyecto a Vercel o Netlify.</li><li>Abrí el link desde Safari en iPhone o Chrome en Android.</li><li>Elegí “Agregar a pantalla de inicio”.</li><li>Usala siempre desde ese ícono para mantener una experiencia estable.</li><li>Exportá backups periódicos desde esta sección.</li></ol><p style={styles.micro}>Para que sea PWA completa, agregá un manifest.json y un ícono en la carpeta public del proyecto.</p></Card></section>;
}

function TextInput({ value, onChange, placeholder = "", type = "text", inputMode }) {
  return <input type={type} inputMode={inputMode} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} style={styles.input} />;
}

function NativeSelect({ value, onChange, options }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} style={styles.input}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}

function Metric({ icon, label, value, danger = false }) {
  return <div style={styles.metricCard}><div style={styles.metricTop}><span>{icon}</span><span>{label}</span></div><strong style={danger ? styles.dangerValue : styles.metricValue}>{value}</strong></div>;
}

function Card({ title, icon, children }) {
  return <section style={styles.card}>{title ? <h2 style={styles.cardTitle}>{icon ? <span>{icon} </span> : null}{title}</h2> : null}{children}</section>;
}

function ProgressBar({ value, color }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${safeValue}%`, background: color }} /></div>;
}

function SimpleBarChart({ data }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return <div style={styles.chartWrap}>{data.map((item, index) => { const height = Math.max(8, Math.round((item.value / max) * 120)); return <div key={item.name} style={styles.barItem}><div style={styles.barColumn}><div title={formatMoney(item.value)} style={{ ...styles.bar, height, background: COLORS[index % COLORS.length] }} /></div><span style={styles.barLabel}>{item.name}</span></div>; })}</div>;
}

function CategoryList({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  return <div style={styles.stackSmall}>{data.map((item, index) => { const percentage = Math.round((item.value / total) * 100); return <div key={item.name}><div style={styles.categoryHeader}><span>{item.name}</span><strong>{formatMoney(item.value)}</strong></div><ProgressBar value={percentage} color={COLORS[index % COLORS.length]} /><p style={styles.micro}>{percentage}% del total cargado</p></div>; })}</div>;
}

function Empty({ text }) { return <div style={styles.empty}>{text}</div>; }
function List({ items, render }) { if (!items || !items.length) return <Empty text="Todavía no hay registros." />; return <div style={styles.stackSmall}>{items.map(render)}</div>; }

function Row({ title, meta, action, onDelete }) {
  return <div style={styles.row}><div style={styles.rowContent}><p style={styles.rowTitle}>{title}</p><p style={styles.rowMeta}>{meta}</p><button type="button" style={styles.linkButton} onClick={onDelete}>Eliminar</button></div>{action ? <div style={styles.rowAction}>{action}</div> : null}</div>;
}

const styles = {
  app: { minHeight: "100vh", background: "#FBF7FA", color: "#2A445E", padding: 16, fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  shell: { maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 48 },
  header: { borderRadius: 32, padding: 24, color: "white", background: "linear-gradient(135deg, #58094F, #9F649F)", boxShadow: "0 16px 32px rgba(88, 9, 79, 0.18)" },
  headerEyebrow: { margin: 0, fontSize: 13, opacity: 0.8 },
  headerTitle: { margin: "4px 0 0", fontSize: 32, lineHeight: 1.1 },
  headerText: { margin: "10px 0 0", fontSize: 14, opacity: 0.9 },
  statusOk: { background: "#EFFAF7", color: "#2A445E", border: "1px solid #B8E4DA", borderRadius: 22, padding: 14, fontSize: 13 },
  statusWarning: { background: "#FFF8E9", color: "#2A445E", border: "1px solid #F3D59A", borderRadius: 22, padding: 14, fontSize: 13 },
  statusText: { margin: "4px 0 0", color: "#627084", lineHeight: 1.35 },
  statusDate: { margin: "4px 0 0", color: "#8B96A6", fontSize: 11 },
  metricsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  metricCard: { background: "white", borderRadius: 24, padding: 16, boxShadow: "0 8px 24px rgba(42, 68, 94, 0.07)" },
  metricTop: { display: "flex", gap: 8, alignItems: "center", color: "#9F649F", fontSize: 12, fontWeight: 700 },
  metricValue: { display: "block", marginTop: 8, fontSize: 17, color: "#2A445E" },
  dangerValue: { display: "block", marginTop: 8, fontSize: 17, color: "#D33F49" },
  card: { background: "white", borderRadius: 28, padding: 20, boxShadow: "0 8px 24px rgba(42, 68, 94, 0.07)" },
  cardTitle: { margin: "0 0 14px", fontSize: 16, color: "#2A445E" },
  muted: { margin: "0 0 10px", color: "#627084", fontSize: 14, lineHeight: 1.5 },
  micro: { margin: "6px 0 0", color: "#8B96A6", fontSize: 11, lineHeight: 1.4 },
  tabs: { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, background: "white", padding: 4, borderRadius: 20, boxShadow: "0 8px 24px rgba(42, 68, 94, 0.07)" },
  tab: { border: 0, borderRadius: 16, padding: "10px 4px", background: "transparent", color: "#627084", fontWeight: 700, fontSize: 11, cursor: "pointer" },
  tabActive: { border: 0, borderRadius: 16, padding: "10px 4px", background: "#F1E6F1", color: "#58094F", fontWeight: 800, fontSize: 11, cursor: "pointer" },
  stack: { display: "flex", flexDirection: "column", gap: 16 },
  stackSmall: { display: "flex", flexDirection: "column", gap: 12 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  fullWidth: { gridColumn: "1 / -1" },
  input: { width: "100%", minWidth: 0, height: 42, border: "1px solid #E7DDE9", borderRadius: 14, padding: "0 12px", color: "#2A445E", background: "#fff", boxSizing: "border-box" },
  label: { display: "block", marginBottom: 8, fontSize: 13, color: "#627084" },
  checkboxLabel: { gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#627084" },
  primaryButton: { height: 42, border: 0, borderRadius: 16, background: "#58094F", color: "white", fontWeight: 800, cursor: "pointer" },
  primaryButtonWide: { gridColumn: "1 / -1", width: "100%", height: 42, border: 0, borderRadius: 16, background: "#58094F", color: "white", fontWeight: 800, cursor: "pointer", marginTop: 0 },
  secondaryButton: { width: "100%", height: 42, marginTop: 10, border: "1px solid #E7DDE9", borderRadius: 16, background: "white", color: "#58094F", fontWeight: 800, cursor: "pointer" },
  dangerButton: { width: "100%", height: 42, marginTop: 10, border: "1px solid #F1C5C5", borderRadius: 16, background: "#FFF4F4", color: "#B42318", fontWeight: 800, cursor: "pointer" },
  smallButton: { border: "1px solid #E7DDE9", borderRadius: 14, padding: "8px 10px", background: "white", color: "#58094F", fontWeight: 800, cursor: "pointer" },
  linkButton: { border: 0, background: "transparent", color: "#9F649F", padding: 0, fontSize: 12, cursor: "pointer" },
  progressTrack: { width: "100%", height: 10, borderRadius: 999, background: "#F1E6F1", overflow: "hidden", marginTop: 10 },
  progressFill: { height: "100%", borderRadius: 999 },
  chartWrap: { height: 170, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", alignItems: "end", gap: 12 },
  barItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "end" },
  barColumn: { height: 124, width: "100%", display: "flex", alignItems: "end", justifyContent: "center" },
  bar: { width: "68%", borderRadius: "12px 12px 0 0", minHeight: 8 },
  barLabel: { fontSize: 11, color: "#627084", textAlign: "center" },
  categoryHeader: { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, color: "#2A445E" },
  empty: { borderRadius: 18, background: "#FBF7FA", padding: 16, textAlign: "center", color: "#8B96A6", fontSize: 13 },
  row: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", background: "white", borderRadius: 22, padding: 16, boxShadow: "0 8px 24px rgba(42, 68, 94, 0.07)" },
  editableRow: { display: "flex", flexDirection: "column", gap: 12, background: "white", borderRadius: 22, padding: 16, boxShadow: "0 8px 24px rgba(42, 68, 94, 0.07)" },
  expenseEditor: { display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" },
  amountInput: { width: "100%", height: 40, border: "1px solid #E7DDE9", borderRadius: 14, padding: "0 12px", color: "#2A445E", background: "#fff", boxSizing: "border-box" },
  paidInlineLabel: { display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#627084" },
  rowContent: { minWidth: 0 },
  rowAction: { flexShrink: 0 },
  rowTitle: { margin: 0, color: "#2A445E", fontWeight: 800, fontSize: 14 },
  rowMeta: { margin: "4px 0", color: "#8B96A6", fontSize: 12 },
  stepsList: { margin: 0, paddingLeft: 18, color: "#627084", fontSize: 14, lineHeight: 1.6 },
};
