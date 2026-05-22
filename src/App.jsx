import React, { useEffect, useMemo, useState } from 'react';

const defaultCategories = [
  'Alimentación',
  'Formación',
  'Impuestos',
  'Entretenimiento',
  'Salud'
];

const initialData = {
  'Mayo 2026': {
    ingresos: [
      {
        id: 1,
        name: 'Cliente ejemplo · Pack mensual',
        amount: 350000,
        status: 'cobrado'
      },
      {
        id: 2,
        name: 'Diseño branding',
        amount: 220000,
        status: 'pendiente'
      }
    ],
    gastos: [
      {
        id: 1,
        name: 'Internet',
        amount: 35000,
        category: 'Impuestos',
        status: 'pagado'
      },
      {
        id: 2,
        name: 'Curso marketing',
        amount: 42000,
        category: 'Formación',
        status: 'pendiente'
      }
    ],
    ahorro: 120000
  }
};

export default function App() {
  const [monthsData, setMonthsData] = useState(() => {
    const saved = localStorage.getItem('finance-app-lil');
    return saved ? JSON.parse(saved) : initialData;
  });

  const [selectedMonth, setSelectedMonth] = useState('Mayo 2026');
  const [categories, setCategories] = useState(defaultCategories);

  const [incomeName, setIncomeName] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeStatus, setIncomeStatus] = useState('cobrado');

  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState(defaultCategories[0]);
  const [expenseStatus, setExpenseStatus] = useState('pagado');

  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    localStorage.setItem('finance-app-lil', JSON.stringify(monthsData));
  }, [monthsData]);

  const monthData = monthsData[selectedMonth] || {
    ingresos: [],
    gastos: [],
    ahorro: 0
  };

  const ingresosCobrados = useMemo(() => {
    return monthData.ingresos
      .filter((item) => item.status === 'cobrado')
      .reduce((acc, item) => acc + item.amount, 0);
  }, [monthData]);

  const ingresosPendientes = useMemo(() => {
    return monthData.ingresos
      .filter((item) => item.status === 'pendiente')
      .reduce((acc, item) => acc + item.amount, 0);
  }, [monthData]);

  const gastosPagados = useMemo(() => {
    return monthData.gastos
      .filter((item) => item.status === 'pagado')
      .reduce((acc, item) => acc + item.amount, 0);
  }, [monthData]);

  const gastosPendientes = useMemo(() => {
    return monthData.gastos
      .filter((item) => item.status === 'pendiente')
      .reduce((acc, item) => acc + item.amount, 0);
  }, [monthData]);

  const ingresoTotal = ingresosCobrados + ingresosPendientes;
  const gastosTotales = gastosPagados + gastosPendientes;
  const libre = ingresosCobrados - gastosPagados;

  const addIncome = () => {
    if (!incomeName || !incomeAmount) return;

    const newItem = {
      id: Date.now(),
      name: incomeName,
      amount: Number(incomeAmount),
      status: incomeStatus
    };

    setMonthsData({
      ...monthsData,
      [selectedMonth]: {
        ...monthData,
        ingresos: [...monthData.ingresos, newItem]
      }
    });

    setIncomeName('');
    setIncomeAmount('');
  };

  const addExpense = () => {
    if (!expenseName || !expenseAmount) return;

    const newItem = {
      id: Date.now(),
      name: expenseName,
      amount: Number(expenseAmount),
      category: expenseCategory,
      status: expenseStatus
    };

    setMonthsData({
      ...monthsData,
      [selectedMonth]: {
        ...monthData,
        gastos: [...monthData.gastos, newItem]
      }
    });

    setExpenseName('');
    setExpenseAmount('');
  };

  const removeIncome = (id) => {
    setMonthsData({
      ...monthsData,
      [selectedMonth]: {
        ...monthData,
        ingresos: monthData.ingresos.filter((item) => item.id !== id)
      }
    });
  };

  const removeExpense = (id) => {
    setMonthsData({
      ...monthsData,
      [selectedMonth]: {
        ...monthData,
        gastos: monthData.gastos.filter((item) => item.id !== id)
      }
    });
  };

  const addCategory = () => {
    if (!newCategory) return;

    setCategories([...categories, newCategory]);
    setNewCategory('');
  };

  const annualData = Object.keys(monthsData).map((month) => {
  const data = monthsData[month];

  const totalIngresos = data.ingresos.reduce((acc, item) => acc + item.amount, 0);

  const libreMes = data.ingresos
    .filter((item) => item.status === 'cobrado')
    .reduce((acc, item) => acc + item.amount, 0) - data.gastos
    .filter((item) => item.status === 'pagado')
    .reduce((acc, item) => acc + item.amount, 0);

  return {
    month,
    ingresos: totalIngresos,
    libre: libreMes
  };
});

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg,#5b004f 0%, #7b1b73 45%, #a05ca5 100%)',
        padding: 20,
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          background: 'rgba(255,255,255,0.96)',
          borderRadius: 28,
          padding: 24
        }}
      >
        <h1 style={{ marginTop: 0, color: '#4d0c4d' }}>
          Panel Financiero de Lil
        </h1>

        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={inputStyle}
        >
          {Object.keys(monthsData).map((month) => (
            <option key={month}>{month}</option>
          ))}
        </select>

        <DropdownCard title="💎 Ingreso total" value={ingresoTotal}>
          <div style={cardsGridStyle}>
            <SubCard title="Cobrados" value={ingresosCobrados} />
            <SubCard title="Por cobrar" value={ingresosPendientes} />
          </div>

          <div style={formBoxStyle}>
            <h4>Agregar ingreso</h4>

            <input
              placeholder="Cliente o proyecto"
              value={incomeName}
              onChange={(e) => setIncomeName(e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Monto"
              type="number"
              value={incomeAmount}
              onChange={(e) => setIncomeAmount(e.target.value)}
              style={inputStyle}
            />

            <select
              value={incomeStatus}
              onChange={(e) => setIncomeStatus(e.target.value)}
              style={inputStyle}
            >
              <option value="cobrado">Cobrado</option>
              <option value="pendiente">Por cobrar</option>
            </select>

            <button onClick={addIncome} style={buttonStyle}>
              Agregar ingreso
            </button>
          </div>

          {monthData.ingresos.map((item) => (
            <ItemCard
              key={item.id}
              title={item.name}
              subtitle={item.status}
              amount={item.amount}
              onDelete={() => removeIncome(item.id)}
            />
          ))}
        </DropdownCard>

        <DropdownCard title="🎯 Gastos totales" value={gastosTotales}>
          <div style={cardsGridStyle}>
            <SubCard title="Pagados" value={gastosPagados} />
            <SubCard title="Pendientes" value={gastosPendientes} />
          </div>

          <div style={formBoxStyle}>
            <h4>Agregar gasto</h4>

            <input
              placeholder="Nombre del gasto"
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Monto"
              type="number"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              style={inputStyle}
            />

            <select
              value={expenseCategory}
              onChange={(e) => setExpenseCategory(e.target.value)}
              style={inputStyle}
            >
              {categories.map((cat) => (
                <option key={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={expenseStatus}
              onChange={(e) => setExpenseStatus(e.target.value)}
              style={inputStyle}
            >
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
            </select>

            <button onClick={addExpense} style={buttonStyle}>
              Agregar gasto
            </button>
          </div>

          <div style={{ marginBottom: 18 }}>
            <h4>Categorías</h4>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {categories.map((category) => (
                <div key={category} style={tagStyle}>
                  {category}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                placeholder="Nueva categoría"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                style={{ ...inputStyle, marginBottom: 0 }}
              />

              <button onClick={addCategory} style={buttonStyle}>
                +
              </button>
            </div>
          </div>

          {monthData.gastos.map((item) => (
            <ItemCard
              key={item.id}
              title={item.name}
              subtitle={`${item.category} · ${item.status}`}
              amount={item.amount}
              onDelete={() => removeExpense(item.id)}
            />
          ))}
        </DropdownCard>

        <DropdownCard
          title="📈 Libre"
          value={libre}
          customBackground="linear-gradient(180deg,#0f5c7a 0%, #6ae2ff 100%)"
        >
          <div style={cardsGridStyle}>
            <div
              style={{
                ...subCardStyle,
                background: 'linear-gradient(180deg,#0f5c7a 0%, #6ae2ff 100%)'
              }}
            >
              <span style={{ opacity: 0.8 }}>Disponible</span>

              <strong style={{ fontSize: 20 }}>
                ${libre.toLocaleString('es-AR')}
              </strong>
            </div>

            <div
              style={{
                ...subCardStyle,
                background: 'linear-gradient(180deg,#0f5c7a 0%, #6ae2ff 100%)'
              }}
            >
              <span style={{ opacity: 0.8 }}>Ahorro</span>

              <strong style={{ fontSize: 20 }}>
                ${monthData.ahorro.toLocaleString('es-AR')}
              </strong>
            </div>
          </div>

          <div style={formBoxStyle}>
            <h4>Editar ahorro</h4>

            <input
              type="number"
              value={monthData.ahorro}
              onChange={(e) => {
                setMonthsData({
                  ...monthsData,
                  [selectedMonth]: {
                    ...monthData,
                    ahorro: Number(e.target.value)
                  }
                });
              }}
              style={inputStyle}
            />
          </div>
        </DropdownCard>

        <div style={sectionStyle}>
          <h2 style={sectionTitle}>📅 Calendario financiero anual</h2>

          <div style={chartWrapStyle}>
            {annualData.map((item, index) => {
              const ingresosHeight = Math.max(item.ingresos / 6000, 20);
              const libreHeight = Math.max(item.libre / 6000, 10);

              return (
                <div
                  key={index}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: 4,
                      height: 180,
                      width: '100%'
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: ingresosHeight,
                        borderRadius: 999,
                        background: 'linear-gradient(180deg,#5b004f 0%, #c17bc5 100%)'
                      }}
                    />

                    <div
                      style={{
                        flex: 1,
                        height: libreHeight,
                        borderRadius: 999,
                        background: 'linear-gradient(180deg,#0f5c7a 0%, #6ae2ff 100%)'
                      }}
                    />
                  </div>

                  <span style={{ fontSize: 11, marginTop: 8 }}>
                    {item.month.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DropdownCard({ title, value, children, customBackground }) {
  const [open, setOpen] = useState(true);

  return (
    <div
      style={{
        background:
          customBackground ||
          'linear-gradient(135deg,#5b004f 0%, #8b3f88 100%)',
        borderRadius: 22,
        marginBottom: 18,
        overflow: 'hidden'
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 22,
          color: '#fff',
          cursor: 'pointer'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <div>{title}</div>

            <strong style={{ fontSize: 30 }}>
              ${value.toLocaleString('es-AR')}
            </strong>
          </div>

          <div style={{ fontSize: 28 }}>
            {open ? '−' : '+'}
          </div>
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 22px 22px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function SubCard({ title, value }) {
  return (
    <div style={subCardStyle}>
      <span style={{ opacity: 0.8 }}>{title}</span>
      <strong style={{ fontSize: 20 }}>
        ${value.toLocaleString('es-AR')}
      </strong>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={miniStatStyle}>
      <span>{label}</span>
      <strong>${value.toLocaleString('es-AR')}</strong>
    </div>
  );
}

function ItemCard({ title, subtitle, amount, onDelete }) {
  return (
    <div style={itemCardStyle}>
      <div>
        <strong>{title}</strong>
        <div style={{ opacity: 0.7, fontSize: 13 }}>
          {subtitle}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 'bold' }}>
          ${amount.toLocaleString('es-AR')}
        </div>

        <button onClick={onDelete} style={deleteButtonStyle}>
          Eliminar
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: 12,
  borderRadius: 12,
  border: 'none',
  marginBottom: 10
};

const buttonStyle = {
  border: 'none',
  borderRadius: 12,
  padding: '12px 16px',
  background: '#ffffff',
  fontWeight: 'bold',
  cursor: 'pointer'
};

const cardsGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  marginBottom: 18
};

const subCardStyle = {
  background: 'rgba(255,255,255,0.12)',
  backdropFilter: 'blur(12px)',
  borderRadius: 18,
  padding: 16,
  color: '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  boxShadow: '0 10px 30px rgba(0,0,0,0.12)'
};

const miniStatStyle = {
  background: 'rgba(255,255,255,0.12)',
  borderRadius: 14,
  padding: 14,
  color: '#fff',
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 10
};

const itemCardStyle = {
  background: 'rgba(255,255,255,0.12)',
  borderRadius: 14,
  padding: 14,
  color: '#fff',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10
};

const deleteButtonStyle = {
  marginTop: 8,
  border: 'none',
  background: '#fff',
  color: '#5b004f',
  borderRadius: 8,
  padding: '6px 10px',
  cursor: 'pointer'
};

const formBoxStyle = {
  background: 'rgba(255,255,255,0.12)',
  borderRadius: 16,
  padding: 16,
  marginBottom: 18,
  color: '#fff'
};

const tagStyle = {
  background: 'rgba(255,255,255,0.12)',
  color: '#fff',
  padding: '8px 12px',
  borderRadius: 999
};

const sectionStyle = {
  background: '#fff',
  borderRadius: 22,
  padding: 20,
  marginTop: 20
};

const sectionTitle = {
  color: '#4d0c4d',
  marginTop: 0
};

const chartWrapStyle = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 8,
  height: 180
};
