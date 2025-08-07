// ==================== GOOGLE SHEET ENDPOINT ====================
const SHEET_API = "https://sheetdb.io/api/v1/j9sqry5cgir1c"; // ← Thay bằng URL Script Web App của bạn


// USER LOGIN/REGISTER
function register() {
  const username = document.getElementById('register_username').value;
  const password = document.getElementById('register_password').value;

  if (!username || !password) return alert('Vui lòng nhập đủ');

  const data = { username, password };
  localStorage.setItem('user', JSON.stringify(data));
  alert('Đăng ký thành công!');
}

function login() {
  const username = document.getElementById('login_username').value;
  const password = document.getElementById('login_password').value;

  const user = JSON.parse(localStorage.getItem('user'));
  if (user && user.username === username && user.password === password) {
    alert('Đăng nhập thành công!');
    window.location.href = 'deposit.html';
  } else {
    alert('Sai thông tin!');
  }
}

// DEPOSIT FUNCTION
function createDeposit() {
  const amount = document.getElementById('deposit_amount').value;
  const user = JSON.parse(localStorage.getItem('user'));

  if (!user) return alert('Bạn chưa đăng nhập');
  if (!amount || amount <= 0) return alert('Nhập số tiền hợp lệ');

  // Tạo nội dung QR chuyển khoản cho ngân hàng ACB
  const bank = 'ACB';
  const stk = '123456789'; // Thay bằng số tài khoản admin
  const name = 'NGUYEN VAN A'; // Tên người nhận
  const description = `${user.username}-${amount}`;

  const qr_content = `ACB;${stk};${name};${amount};${description}`;
  QRCode.toDataURL(qr_content, function (err, url) {
    if (err) {
      document.getElementById('message').innerText = 'Lỗi tạo QR';
      return;
    }
    document.getElementById('qr_code').innerHTML = `<img src="${url}" alt="QR Code" width="200"/>`;
  });

  // Gửi thông tin nạp lên SheetDB
  const depositData = {
    data: [{
      username: user.username,
      amount,
      time: new Date().toLocaleString()
    }]
  };

  fetch(SHEET_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(depositData)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('message').innerText = 'Gửi yêu cầu nạp thành công!';
    })
    .catch(() => {
      document.getElementById('message').innerText = 'Lỗi khi gửi dữ liệu';
    });
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
