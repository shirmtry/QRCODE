// ==================== GOOGLE SHEET ENDPOINT ====================
const SHEET_URL = "https://sheetdb.io/api/v1/j9sqry5cgir1c"; // ← Thay bằng URL Script Web App của bạn

// ==================== ĐĂNG KÝ ====================
document.getElementById('registerForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value.trim();

  fetch(SHEET_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'register',
      username,
      password
    }),
  })
  .then(res => res.json())
  .then(data => alert(data.message))
  .catch(err => alert('Lỗi khi đăng ký'));
});

// ==================== ĐĂNG NHẬP ====================
document.getElementById('loginForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  fetch(SHEET_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'login',
      username,
      password
    }),
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert('Đăng nhập thành công!');
      localStorage.setItem('username', username);
      window.location.href = 'deposit.html';
    } else {
      alert('Sai tài khoản hoặc mật khẩu');
    }
  })
  .catch(err => alert('Lỗi khi đăng nhập'));
});

// ==================== NẠP TIỀN ====================
document.getElementById('depositForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const amount = document.getElementById('amount').value.trim();
  const username = localStorage.getItem('username');

  if (!username) {
    alert('Bạn chưa đăng nhập!');
    return;
  }

  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    alert('Vui lòng nhập số tiền hợp lệ!');
    return;
  }

  // Thông tin ngân hàng ACB
  const bank = 'ACB';
  const accountNumber = '123456789';
  const accountName = 'Nguyen Van A';
  const note = `Nap_${username}_${Date.now()}`;
  const amountFormatted = parseInt(amount);

  const qrAPI = `https://img.vietqr.io/image/${bank}-${accountNumber}-compact2.png?amount=${amountFormatted}&addInfo=${note}&accountName=${encodeURIComponent(accountName)}`;

  document.getElementById('qrImage').src = qrAPI;
  document.getElementById('qrCodeArea').style.display = 'block';

  // Gửi log nạp tiền vào Google Sheet
  fetch(SHEET_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'deposit',
      username,
      amount: amountFormatted,
      note
    })
  });

  // Đếm ngược
  let timeLeft = 300; // 5 phút
  const countdown = document.getElementById('countdown');
  countdown.innerText = `Mã QR hết hạn sau: ${timeLeft} giây`;

  const timer = setInterval(() => {
    timeLeft--;
    countdown.innerText = `Mã QR hết hạn sau: ${timeLeft} giây`;
    if (timeLeft <= 0) {
      clearInterval(timer);
      document.getElementById('qrCodeArea').style.display = 'none';
    }
  }, 1000);
});
