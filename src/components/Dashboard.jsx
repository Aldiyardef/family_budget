import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

// --- Безопасные функции работы с датами (без UTC-сдвига) ---

function pad(num) {
  return String(num).padStart(2, '0');
}

function formatLocalMonth(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

const today = new Date();
const currentMonth = formatLocalMonth(today);

function getMonthName(month) {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, monthNum - 1, 1);

  return date.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
}

function buildMonthOptions(operations, selectedMonth) {
  const months = new Set();

  months.add(currentMonth);
  months.add(selectedMonth);

  for (let i = -12; i <= 12; i++) {
    const date = new Date(
      today.getFullYear(),
      today.getMonth() + i,
      1
    );

    months.add(formatLocalMonth(date));
  }

  operations.forEach((operation) => {
    if (operation.operation_date) {
      months.add(String(operation.operation_date).slice(0, 7));
    }
  });

  return Array.from(months).sort((a, b) => (a < b ? 1 : -1));
}

export default function Dashboard({ session }) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [operations, setOperations] = useState([]);

  const [type, setType] = useState('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  // --- Планируемые расходы ---
  const [plannedExpenses, setPlannedExpenses] = useState([]);
  const [planCategory, setPlanCategory] = useState('');
  const [planAmount, setPlanAmount] = useState('');
  const [planDescription, setPlanDescription] = useState('');

  // --- Редактирование по двойному клику ---
  const [editingId, setEditingId] = useState(null);
  const [editingType, setEditingType] = useState(null); // 'operation' или 'plan'
  const [editingField, setEditingField] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  const monthOptions = useMemo(
    () => buildMonthOptions(operations, selectedMonth),
    [operations, selectedMonth]
  );

  useEffect(() => {
    async function loadOperations() {
      const { data, error } = await supabase
        .from('operations')
        .select(
          'id, user_id, type, amount, category, description, operation_date, created_at'
        )
        .order('operation_date', { ascending: false });

      if (error) {
        console.error('Ошибка загрузки операций:', error);
        return;
      }

      setOperations(data || []);
    }

    loadOperations();
  }, []);

  useEffect(() => {
    async function loadPlannedExpenses() {
      const { data, error } = await supabase
        .from('planned_expenses')
        .select(
          'id, user_id, month, amount, category, description, is_done, created_at'
        )
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Ошибка загрузки планов:', error);
        return;
      }

      setPlannedExpenses(data || []);
    }

    loadPlannedExpenses();
  }, []);

  const monthOperations = useMemo(
    () =>
      operations.filter(
        (operation) =>
          String(operation.operation_date).slice(0, 7) ===
          selectedMonth
      ),
    [operations, selectedMonth]
  );

  const monthPlannedExpenses = useMemo(
    () =>
      plannedExpenses.filter((plan) => plan.month === selectedMonth),
    [plannedExpenses, selectedMonth]
  );

  const totals = useMemo(() => {
    const income = monthOperations
      .filter((o) => o.type === 'income')
      .reduce((sum, o) => sum + Number(o.amount), 0);

    const expense = monthOperations
      .filter((o) => o.type === 'expense')
      .reduce((sum, o) => sum + Number(o.amount), 0);

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [monthOperations]);

  const plannedTotals = useMemo(() => {
    const planned = monthPlannedExpenses.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    const remaining = planned - totals.expense;
    const balanceWithPlanned = totals.balance - planned;

    return { planned, remaining, balanceWithPlanned };
  }, [monthPlannedExpenses, totals.expense, totals.balance]);

  // --- Функции редактирования ---

  function startEditingOperation(operation, field) {
    setEditingId(operation.id);
    setEditingType('operation');
    setEditingField(field);
    setEditingValue(String(operation[field]));
  }

  function startEditingPlan(plan, field) {
    setEditingId(plan.id);
    setEditingType('plan');
    setEditingField(field);
    setEditingValue(String(plan[field]));
  }

  async function saveEdit() {
    if (!editingId || !editingType || !editingField) return;

    try {
      if (editingType === 'operation') {
        // Валидация в зависимости от поля
        let updateData = {};

        if (editingField === 'amount') {
          const num = Number(editingValue);
          if (isNaN(num) || num <= 0) {
            alert('Сумма должна быть положительным числом');
            return;
          }
          updateData.amount = num;
        } else if (editingField === 'operation_date') {
          // Проверка формата даты (YYYY-MM-DD)
          if (!/^\d{4}-\d{2}-\d{2}$/.test(editingValue)) {
            alert('Дата должна быть в формате YYYY-MM-DD');
            return;
          }
          updateData.operation_date = editingValue;
        } else {
          updateData[editingField] = editingValue;
        }

        const { data, error } = await supabase
          .from('operations')
          .update(updateData)
          .eq('id', editingId)
          .select()
          .single();

        if (error) throw error;

        setOperations((prev) =>
          prev.map((o) => (o.id === editingId ? data : o))
        );
      } else if (editingType === 'plan') {
        let updateData = {};

        if (editingField === 'amount') {
          const num = Number(editingValue);
          if (isNaN(num) || num <= 0) {
            alert('Сумма должна быть положительным числом');
            return;
          }
          updateData.amount = num;
        } else if (editingField === 'month') {
          // Проверка формата месяца (YYYY-MM)
          if (!/^\d{4}-\d{2}$/.test(editingValue)) {
            alert('Месяц должен быть в формате YYYY-MM');
            return;
          }
          updateData.month = editingValue;
        } else {
          updateData[editingField] = editingValue;
        }

        const { data, error } = await supabase
          .from('planned_expenses')
          .update(updateData)
          .eq('id', editingId)
          .select()
          .single();

        if (error) throw error;

        setPlannedExpenses((prev) =>
          prev.map((p) => (p.id === editingId ? data : p))
        );
      }

      cancelEdit();
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      alert('Ошибка при сохранении изменений');
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingType(null);
    setEditingField(null);
    setEditingValue('');
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }

  // --- Компонент EditableCell для уменьшения дублирования ---
  function EditableCell({ value, isEditing, onChange, onSave, onCancel, onKeyDown, dataType = 'text' }) {
    if (isEditing) {
      return (
        <input
          autoFocus
          type={dataType}
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={onSave}
          onKeyDown={onKeyDown}
          style={{
            width: '100%',
            padding: '4px 8px',
            border: '2px solid #007bff',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
      );
    }

    return (
      <span style={{ cursor: 'pointer', userSelect: 'none' }}>
        {value}
      </span>
    );
  }

  async function handleAddOperation(e) {
    e.preventDefault();

    if (!amount || !category) return;

    const newOperation = {
      user_id: session.user.id,
      type,
      amount: Number(amount),
      category,
      description,
      operation_date: selectedMonth === currentMonth ? formatLocalDate(today) : `${selectedMonth}-01`,
    };

    const { data, error } = await supabase
      .from('operations')
      .insert(newOperation)
      .select()
      .single();

    if (error) {
      console.error('Ошибка добавления операции:', error);
      return;
    }

    setOperations((prev) => [data, ...prev]);
    setAmount('');
    setCategory('');
    setDescription('');
  }

  async function deleteOperation(id) {
    const { error } = await supabase
      .from('operations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Ошибка удаления операции:', error);
      return;
    }

    setOperations((prev) => prev.filter((o) => o.id !== id));
  }

  async function handleAddPlannedExpense(e) {
    e.preventDefault();

    if (!planAmount || !planCategory) return;

    const newPlan = {
      user_id: session.user.id,
      month: selectedMonth,
      amount: Number(planAmount),
      category: planCategory,
      description: planDescription,
      is_done: false,
    };

    const { data, error } = await supabase
      .from('planned_expenses')
      .insert(newPlan)
      .select()
      .single();

    if (error) {
      console.error('Ошибка добавления плана:', error);
      return;
    }

    setPlannedExpenses((prev) => [data, ...prev]);
    setPlanAmount('');
    setPlanCategory('');
    setPlanDescription('');
  }

  async function deletePlannedExpense(id) {
    const { error } = await supabase
      .from('planned_expenses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Ошибка удаления плана:', error);
      return;
    }

    setPlannedExpenses((prev) => prev.filter((p) => p.id !== id));
  }

  async function togglePlanDone(plan) {
    const { data, error } = await supabase
      .from('planned_expenses')
      .update({ is_done: !plan.is_done })
      .eq('id', plan.id)
      .select()
      .single();

    if (error) {
      console.error('Ошибка обновления плана:', error);
      return;
    }

    setPlannedExpenses((prev) =>
      prev.map((p) => (p.id === plan.id ? data : p))
    );
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <main className="dashboard">
      <div className="topbar">
        <h1>Семейный бюджет</h1>

        <button className="secondary-button" onClick={handleLogout}>
          Выйти
        </button>
      </div>

      <div className="month-panel card">
        <label htmlFor="month-select">Месяц</label>

        <select
          id="month-select"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {monthOptions.map((month) => (
            <option key={month} value={month}>
              {getMonthName(month)}
            </option>
          ))}
        </select>
      </div>

      <div className="summary">
        <div className="summary-card card">
          <span className="summary-label">Доходы</span>
          <span className="summary-value amount-income">
            {totals.income.toLocaleString('ru-RU')} ₸
          </span>
        </div>

        <div className="summary-card card">
          <span className="summary-label">Расходы</span>
          <span className="summary-value amount-expense">
            {totals.expense.toLocaleString('ru-RU')} ₸
          </span>
        </div>

        <div className="summary-card card">
          <span className="summary-label">Баланс</span>
          <span className="summary-value">
            {totals.balance.toLocaleString('ru-RU')} ₸
          </span>
        </div>
      </div>

      <div className="summary">
        <div className="summary-card card">
          <span className="summary-label">Запланировано</span>
          <span className="summary-value">
            {plannedTotals.planned.toLocaleString('ru-RU')} ₸
          </span>
        </div>

        <div className="summary-card card">
          <span className="summary-label">
            Баланс с учётом планируемых расходов
          </span>
          <span
            className={
              plannedTotals.balanceWithPlanned >= 0
                ? 'summary-value amount-income'
                : 'summary-value amount-expense'
            }
          >
            {plannedTotals.balanceWithPlanned.toLocaleString('ru-RU')} ₸
          </span>
        </div>
      </div>

      <section className="operation-form card">
        <h2>Запланировать расход</h2>

        <form onSubmit={handleAddPlannedExpense}>
          <div className="form-row">
            <input
              type="number"
              placeholder="Сумма"
              value={planAmount}
              onChange={(e) => setPlanAmount(e.target.value)}
              required
            />

            <input
              type="text"
              placeholder="Категория"
              value={planCategory}
              onChange={(e) => setPlanCategory(e.target.value)}
              required
            />
          </div>

          <input
            type="text"
            placeholder="Описание (необязательно)"
            value={planDescription}
            onChange={(e) => setPlanDescription(e.target.value)}
          />

          <button type="submit" className="primary-button">
            Добавить план
          </button>
        </form>
      </section>

      <section className="operation-form card">
        <h2>Добавить операцию</h2>

        <form onSubmit={handleAddOperation}>
          <div className="form-row">
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="income">Доход</option>
              <option value="expense">Расход</option>
            </select>

            <input
              type="number"
              placeholder="Сумма"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <input
              type="text"
              placeholder="Категория"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />

            <input
              type="text"
              placeholder="Описание (необязательно)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <button type="submit" className="primary-button">
            Добавить
          </button>
        </form>
      </section>

      <section className="operations card">
        <div className="section-header">
          <h2>Планируемые расходы</h2>

          <span className="badge">
            {monthPlannedExpenses.length} планов
          </span>
        </div>

        {monthPlannedExpenses.length === 0 ? (
          <p className="empty-state">
            Планов на этот месяц пока нет.
          </p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Месяц</th>
                  <th>Категория</th>
                  <th>Описание</th>
                  <th>Тип</th>
                  <th>Сумма</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {monthPlannedExpenses.map((plan) => (
                  <tr key={plan.id}>
                    <td onDoubleClick={() => startEditingPlan(plan, 'month')}>
                      {editingId === plan.id && editingType === 'plan' && editingField === 'month' ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleEditKeyDown}
                          placeholder="YYYY-MM"
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            border: '2px solid #007bff',
                            borderRadius: '4px',
                            fontSize: '14px',
                          }}
                        />
                      ) : (
                        <span style={{ cursor: 'pointer', userSelect: 'none' }}>
                          {plan.month}
                        </span>
                      )}
                    </td>

                    <td onDoubleClick={() => startEditingPlan(plan, 'category')}>
                      {editingId === plan.id && editingType === 'plan' && editingField === 'category' ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleEditKeyDown}
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            border: '2px solid #007bff',
                            borderRadius: '4px',
                            fontSize: '14px',
                          }}
                        />
                      ) : (
                        <strong style={{ cursor: 'pointer', userSelect: 'none' }}>
                          {plan.category}
                        </strong>
                      )}
                    </td>

                    <td onDoubleClick={() => startEditingPlan(plan, 'description')}>
                      {editingId === plan.id && editingType === 'plan' && editingField === 'description' ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleEditKeyDown}
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            border: '2px solid #007bff',
                            borderRadius: '4px',
                            fontSize: '14px',
                          }}
                        />
                      ) : (
                        <span style={{ cursor: 'pointer', userSelect: 'none' }}>
                          {plan.description || 'Без описания'}
                        </span>
                      )}
                    </td>

                    <td>
                      <span
                        className={
                          plan.is_done
                            ? 'pill pill-income'
                            : 'pill pill-expense'
                        }
                        style={{ cursor: 'pointer' }}
                        onClick={() => togglePlanDone(plan)}
                      >
                        {plan.is_done ? 'Выполнено' : 'В плане'}
                      </span>
                    </td>

                    <td onDoubleClick={() => startEditingPlan(plan, 'amount')}>
                      {editingId === plan.id && editingType === 'plan' && editingField === 'amount' ? (
                        <input
                          autoFocus
                          type="number"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleEditKeyDown}
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            border: '2px solid #007bff',
                            borderRadius: '4px',
                            fontSize: '14px',
                          }}
                        />
                      ) : (
                        <span className="amount-expense" style={{ cursor: 'pointer', userSelect: 'none' }}>
                          {Number(plan.amount).toLocaleString('ru-RU')} ₸
                        </span>
                      )}
                    </td>

                    <td>
                      <button
                        className="delete-button"
                        onClick={() => deletePlannedExpense(plan.id)}
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

      <section className="operations card">
        <div className="section-header">
          <h2>Операции</h2>

          <span className="badge">
            {monthOperations.length} операций
          </span>
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
                    <td onDoubleClick={() => startEditingOperation(operation, 'operation_date')}>
                      {editingId === operation.id && editingType === 'operation' && editingField === 'operation_date' ? (
                        <input
                          autoFocus
                          type="date"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleEditKeyDown}
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            border: '2px solid #007bff',
                            borderRadius: '4px',
                            fontSize: '14px',
                          }}
                        />
                      ) : (
                        <span style={{ cursor: 'pointer', userSelect: 'none' }}>
                          {operation.operation_date}
                        </span>
                      )}
                    </td>

                    <td onDoubleClick={() => startEditingOperation(operation, 'category')}>
                      {editingId === operation.id && editingType === 'operation' && editingField === 'category' ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleEditKeyDown}
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            border: '2px solid #007bff',
                            borderRadius: '4px',
                            fontSize: '14px',
                          }}
                        />
                      ) : (
                        <strong style={{ cursor: 'pointer', userSelect: 'none' }}>
                          {operation.category}
                        </strong>
                      )}
                    </td>

                    <td onDoubleClick={() => startEditingOperation(operation, 'description')}>
                      {editingId === operation.id && editingType === 'operation' && editingField === 'description' ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleEditKeyDown}
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            border: '2px solid #007bff',
                            borderRadius: '4px',
                            fontSize: '14px',
                          }}
                        />
                      ) : (
                        <span style={{ cursor: 'pointer', userSelect: 'none' }}>
                          {operation.description || 'Без описания'}
                        </span>
                      )}
                    </td>

                    <td>
                      <span
                        className={
                          operation.type === 'income'
                            ? 'pill pill-income'
                            : 'pill pill-expense'
                        }
                      >
                        {operation.type === 'income' ? 'Доход' : 'Расход'}
                      </span>
                    </td>

                    <td onDoubleClick={() => startEditingOperation(operation, 'amount')}>
                      {editingId === operation.id && editingType === 'operation' && editingField === 'amount' ? (
                        <input
                          autoFocus
                          type="number"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleEditKeyDown}
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            border: '2px solid #007bff',
                            borderRadius: '4px',
                            fontSize: '14px',
                          }}
                        />
                      ) : (
                        <span
                          className={
                            operation.type === 'income'
                              ? 'amount-income'
                              : 'amount-expense'
                          }
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          {operation.type === 'income' ? '+' : '-'}
                          {Number(operation.amount).toLocaleString('ru-RU')} ₸
                        </span>
                      )}
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