const SHEET_URL = "https://sheetdb.io/api/v1/j9sqry5cgir1c";
const BANK_CODE = "ACB";
const ACCOUNT_NUMBER = "43146717";
const ACCOUNT_NAME = "DINH TAN HUY";

// Hàm xử lý tự động tạo QR khi có tham số amount
function handleAutoGenerateQR() {
  const urlParams = new URLSearchParams(window.location.search);
  const amount = urlParams.get('amount');
  const note = urlParams.get('note');
  
  if (amount) {
    const amountInput = document.getElementById('amount');
    if (amountInput) {
      amountInput.value = amount;
      if (note) {
        localStorage.setItem("paymentNote", decodeURIComponent(note));
      }
      generateQR();
    }
  }
}

// Hàm tạo mã ngẫu nhiên
function generateRandomNote(length = 7) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Hàm tạo mã QR
function generateQR() {
  const amount = document.getElementById("amount").value;
  const username = localStorage.getItem("username");
  if (!username) return alert("Bạn chưa đăng nhập!");

  if (!amount || amount <= 0) {
    alert("Vui lòng nhập số tiền hợp lệ.");
    return;
  }

  const defaultNote = localStorage.getItem("paymentNote") || generateRandomNote();
  const encodedName = encodeURIComponent(ACCOUNT_NAME);
  const imageUrl = `https://img.vietqr.io/image/${BANK_CODE}-${ACCOUNT_NUMBER}-compact.png?amount=${amount}&addInfo=${defaultNote}&accountName=${encodedName}`;

  document.getElementById("qr-result").innerHTML = `
    <p><strong>Mã QR VietQR:</strong></p>
    <img src="${imageUrl}" alt="VietQR Code">
    <p><strong>Nội dung CK:</strong> ${defaultNote}</p>
    <p><strong>Người nhận:</strong> ${ACCOUNT_NAME}</p>
    <p style="color: green; font-weight: bold;">✅ Đã tạo mã chuyển khoản thành công!</p>
  `;

  // Ghi log nạp tiền
  fetch(`${SHEET_URL}/search?username=${username}`)
    .then(res => res.json())
    .then(users => {
      if (users.length === 0) return;
      const id = users[0].id;
      const currentTotal = parseFloat(users[0].total_nap || 0);
      const updateData = {
        data: { total_nap: currentTotal + parseFloat(amount) }
      };
      fetch(`${SHEET_URL}/id/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData)
      });
    });
}

// Hàm lấy IP
function getIP() {
  return fetch("https://api.ipify.org?format=json")
    .then(res => res.json())
    .then(data => data.ip)
    .catch(() => "unknown");
}

// Hàm đăng ký
function registerUser() {
  const username = document.getElementById("register-username").value;
  const password = document.getElementById("register-password").value;

  fetch(`${SHEET_URL}/search?username=${username}`)
    .then(res => res.json())
    .then(async users => {
      if (users.length > 0) return alert("Tên đăng nhập đã tồn tại!");
      const ip = await getIP();
      const userData = {
        data: {
          username,
          password,
          ip,
          total_nap: 0
        }
      };
      fetch(SHEET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData)
      }).then(() => {
        alert("Đăng ký thành công!");
      });
    });
}

// Hàm đăng nhập
function loginUser() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  fetch(`${SHEET_URL}/search?username=${username}&password=${password}`)
    .then(res => res.json())
    .then(users => {
      if (users.length === 0) return alert("Sai thông tin đăng nhập!");
      localStorage.setItem("username", username);
      alert("Đăng nhập thành công!");
      window.location.href = "deposit.html";
    });
}

// Tự động chạy khi trang được tải
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('deposit.html')) {
    handleAutoGenerateQR();
  }
});
