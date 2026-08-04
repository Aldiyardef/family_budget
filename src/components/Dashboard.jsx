import { useEffect, useMemo, useState } from 'react';

const today = new Date();
const currentMonth = today.toISOString().slice(0, 7);

function getMonthName(month) {
  return new Date(`${month}-01`).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
}

// Строим список месяцев для выпадающего выбора:
// текущий месяц, ±12 месяцев вокруг него и все месяцы, в которых есть операции.
// Гарантируем, что текущий выбранный месяц всегда присутствует в списке.
function buildMonthOptions(operations, selectedMonth) {
  const monthsSet = new Set();
  monthsSet.add(currentMonth);
  if (selectedMonth) monthsSet.add(selectedMonth);

  for (let i = -12; i <= 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    monthsSet.add(d.toISOString().slice(0, 7));
  }

  operations.forEach((op) => {
    if (op && op.date) monthsSet.add(op.date.slice(0, 7));
  });

  return Array.from(monthsSet).sort((a, b) => (a < b ? 1 : -1));
}

export default function Dashboard({ session }) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [operations, setOperations] = useState(() => {
    return JSON.parse(localStorage.getItem('familyBudgetOperations')) || [];
  });

  const [type, setType] = useState('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const monthOptions = useMemo(
    () => buildMonthOptions(operations, selectedMonth),
    [operations, selectedMonth]
  );

  useEffect(() => {
    localStorage.setItem(
      'familyBudgetOperations',
      JSON.stringify(operations)
    );
  }, [operations]);

  const monthOperations = useMemo(() => {
    return operations.filter((operation) =>
      operation.date.startsWith(selectedMonth)
    );
  }, [operations, selectedMonth]);

  const income = monthOperations
    .filter((operation) => operation.type === 'income')
    .reduce((sum, operation) => sum + operation.amount, 0);

  const expenses = monthOperations
    .filter((operation) => operation.type === 'expense')
    .reduce((sum, operation) => sum + operation.amount, 0);

  const previousBalance = operations
    .filter((operation) => operation.date < `${selectedMonth}-01`)
    .reduce(
      (balance, operation) =>
        operation.type === 'income'
          ? balance + operation.amount
          : balance - operation.amount,
      0
    );

  const balance = previousBalance + income - expenses;

  function addOperation(event) {
    event.preventDefault();

    if (!amount || Number(amount) <= 0 || !category) {
      alert('Заполните сумму и категорию');
      return;
    }

    const operation = {
      id: Date.now(),
      type,
      amount: Number(amount),
      category,
      description,
      date: `${selectedMonth}-${String(today.getDate()).padStart(2, '0')}`,
    };

    setOperations([operation, ...operations]);
    setAmount('');
    setCategory('');
    setDescription('');
  }

  function deleteOperation(id) {
    setOperations(
      operations.filter((operation) => operation.id !== id)
    );
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="topbar-title">
          <h1>Семейный бюджет</h1>
          <p className="user-email">{session.user.email}</p>
        </div>

        <button
          className="ghost-button"
          onClick={() => window.location.reload()}
        >
          Обновить
        </button>
      </header>

      <section className="month-panel">
        <label htmlFor="month-select">Месяц:</label>
        <select
          id="month-select"
          className="month-select"
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
        >
          {monthOptions.map((month) => (
            <option key={month} value={month}>
              {getMonthName(month)}
            </option>
          ))}
        </select>
      </section>

      <section className="summary">
        <div className="card balance-card">
          <span className="card-label">Баланс</span>
          <strong className="card-value">
            {balance.toLocaleString('ru-RU')} ₸
          </strong>
        </div>

        <div className="card income-card">
          <span className="card-label">Доходы</span>
          <strong className="card-value">
            +{income.toLocaleString('ru-RU')} ₸
          </strong>
        </div>

        <div className="card expense-card">
          <span className="card-label">Расходы</span>
          <strong className="card-value">
            -{expenses.toLocaleString('ru-RU')} ₸
          </strong>
        </div>
      </section>

      <section className="operation-form card">
        <h2>Добавить операцию</h2>

        <form onSubmit={addOperation}>
          <select
            className="input"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="income">Доход</option>
            <option value="expense">Расход</option>
          </select>

          <input
            className="input"
            type="number"
            placeholder="Сумма в тенге"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />

          <input
            className="input"
            type="text"
            placeholder="Категория"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />

          <input
            className="input"
            type="text"
            placeholder="Описание"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />

          <button className="primary-button" type="submit">
            Добавить
          </button>
        </form>
      </section>

      <section className="operations card">
        <div className="section-header">
          <h2>Операции</h2>
          <span className="badge">{monthOperations.length} операций</span>
        </div>

        {monthOperations.length === 0 ? (
          <p className="empty-state">
            Операций за этот месяц пока нет.
          </p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Категория</th>
                  <th>Описание</th>
                  <th>Тип</th>
                  <th>Сумма</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {monthOperations.map((operation) => (
                  <tr key={operation.id}>
                    <td>{operation.date}</td>

                    <td>
                      <strong>{operation.category}</strong>
                    </td>

                    <td>
                      {operation.description || 'Без описания'}
                    </td>

                    <td>
                      <span
                        className={
                          operation.type === 'income'
                            ? 'pill pill-income'
                            : 'pill pill-expense'
                        }
                      >
                        {operation.type === 'income'
                          ? 'Доход'
                          : 'Расход'}
                      </span>
                    </td>

                    <td
                      className={
                        operation.type === 'income'
                          ? 'amount-income'
                          : 'amount-expense'
                      }
                    >
                      {operation.type === 'income' ? '+' : '-'}
                      {operation.amount.toLocaleString('ru-RU')} ₸
                    </td>

                    <td>
                      <button
                        className="delete-button"
                        onClick={() => deleteOperation(operation.id)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
