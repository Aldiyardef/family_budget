import { useState } from 'react';
import { login, register, logout } from '../lib/auth';

export default function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    const { error } = isRegister
      ? await register(email, password)
      : await login(email, password);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      isRegister
        ? 'Регистрация выполнена. Проверьте email.'
        : 'Вход выполнен успешно.'
    );
  }
async function handleLogout() {
  const { error } = await logout();

  if (error) {
    setMessage(error.message);
    return;
  }

  setMessage('Вы вышли из аккаунта.');
}
  return (
    <form onSubmit={handleSubmit}>
      <h2>{isRegister ? 'Регистрация' : 'Вход'}</h2>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />

      <input
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />

      <button type="submit">
        {isRegister ? 'Зарегистрироваться' : 'Войти'}
      </button>

      <button
        type="button"
        onClick={() => setIsRegister(!isRegister)}
      >
        {isRegister ? 'Уже есть аккаунт' : 'Создать аккаунт'}
      </button>
	
	<button type="button" onClick={handleLogout}>
  	Выйти
	</button>
      {message && <p>{message}</p>}
    </form>
  );
}
