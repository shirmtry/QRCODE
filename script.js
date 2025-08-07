const SHEET_API = 'https://sheetdb.io/api/v1/j9sqry5cgir1c'; // Thay YOUR_SHEETDB_ID bằng ID thật

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
