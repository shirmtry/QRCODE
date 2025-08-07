const SHEET_URL = 'https://sheetdb.io/api/v1/j9sqry5cgir1c'; // Thay YOUR_SHEETDB_ID

function register() {
  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value.trim();

  if (!username || !password) {
    return alert("Please enter both username and password to register.");
  }

  fetch(`${SHEET_URL}/search?username=${username}`)
    .then(res => res.json())
    .then(data => {
      if (data.length > 0) {
        document.getElementById('status').innerText = 'Username already exists!';
      } else {
        fetch(SHEET_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: [{ username, password, amount: 0 }] })
        })
        .then(() => {
          document.getElementById('status').innerText = 'Registration successful!';
        });
      }
    });
}

function login() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  fetch(`${SHEET_URL}/search?username=${username}&password=${password}`)
    .then(res => res.json())
    .then(data => {
      if (data.length > 0) {
        localStorage.setItem('user', username);
        window.location.href = 'deposit.html';
      } else {
        document.getElementById('status').innerText = 'Invalid credentials!';
      }
    });
}

function generateQR() {
  const amount = document.getElementById('amount').value;
  const username = localStorage.getItem('user');
  if (!amount || amount <= 0) {
    return alert("Enter a valid amount.");
  }

  // Ghi lại thông tin nạp (sheet chỉ lưu username + amount)
  fetch(SHEET_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{ username, amount }]
    })
  });

  // Tạo mã QR
  const qr = new QRious({
    element: document.createElement('canvas'),
    value: `BANK_TRANSFER|USERNAME:${username}|AMOUNT:${amount}`,
    size: 200,
  });

  const container = document.getElementById('qrCodeContainer');
  container.innerHTML = '';
  container.appendChild(qr.element);
  document.getElementById('depositStatus').innerText = 'Scan QR to complete payment.';
}

window.onload = function () {
  if (document.getElementById('currentUser')) {
    const user = localStorage.getItem('user');
    if (!user) {
      window.location.href = 'index.html';
    } else {
      document.getElementById('currentUser').innerText = user;
    }
  }
};
