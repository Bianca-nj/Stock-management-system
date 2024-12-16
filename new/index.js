document.getElementById('signup-form').addEventListener('submit', async function (event) {
  event.preventDefault();

  const username = document.getElementById('username').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
  }

  try {
      const response = await fetch('/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
      });

      if (response.ok) {
          alert('User registered successfully');
          window.location.href = 'login.html'; // Redirect to login page
      } else {
          const data = await response.json();
          alert(data.message); // Display server response message
      }
  } catch (error) {
      console.error('Error:', error);
      alert('An error occurred');
  }
});
