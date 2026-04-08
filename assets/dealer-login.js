const feedbackNode = document.querySelector('[data-dealer-login-feedback]');

function setFeedback(text, isError = false) {
  if (!feedbackNode) return;
  feedbackNode.textContent = text;
  feedbackNode.style.color = isError ? '#b42318' : '';
}

window.addEventListener('DOMContentLoaded', async () => {
  const auth = window.KOMPUTERRA_DEALER_AUTH;
  const restored = await auth.refreshSession();
  if (restored?.session_token) {
    location.href = 'dealer-portal.html';
    return;
  }

  document.forms.dealerLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = e.currentTarget.login.value.trim();
    const password = e.currentTarget.password.value;
    setFeedback('Перевіряємо доступ...');
    try {
      await auth.login(login, password);
      location.href = 'dealer-portal.html';
    } catch (error) {
      setFeedback(error.message || 'Невірний логін або пароль.', true);
    }
  });
});
