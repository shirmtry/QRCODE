const SHEET_URL = "https://sheetdb.io/api/v1/j9sqry5cgir1c";
const BANK_CODE = "ACB";
const ACCOUNT_NUMBER = "43146717";
const ACCOUNT_NAME = "DINH TAN HUY";
const CHECK_INTERVAL = 30000; // 30 giây kiểm tra một lần
let checkIntervalId = null;

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

// Hàm kiểm tra giao dịch
async function checkPaymentStatus(note, amount) {
  const username = localStorage.getItem("username");
  if (!username) return false;

  try {
    // Kiểm tra trong cơ sở dữ liệu
    const response = await fetch(`${SHEET_URL}/search?username=${username}&note=${note}`);
    const transactions = await response.json();
    
    // Nếu tìm thấy giao dịch với note và số tiền khớp
    const matchingTransaction = transactions.find(
      txn => txn.note === note && parseFloat(txn.amount) === parseFloat(amount)
    );
    
    return !!matchingTransaction;
  } catch (error) {
    console.error("Lỗi khi kiểm tra giao dịch:", error);
    return false;
  }
}

// Hàm cập nhật số dư cho user
async function updateUserBalance(username, amount) {
  try {
    // Lấy thông tin user hiện tại
    const userResponse = await fetch(`${SHEET_URL}/search?username=${username}`);
    const users = await userResponse.json();
    
    if (users.length === 0) return false;
    
    const user = users[0];
    const currentBalance = parseFloat(user.balance || 0);
    const newBalance = currentBalance + parseFloat(amount);
    
    // Cập nhật số dư
    const updateResponse = await fetch(`${SHEET_URL}/id/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: { 
          balance: newBalance,
          last_payment: new Date().toISOString()
        }
      })
    });
    
    return updateResponse.ok;
  } catch (error) {
    console.error("Lỗi khi cập nhật số dư:", error);
    return false;
  }
}

// Hàm tạo mã QR và bắt đầu kiểm tra giao dịch
function generateQR() {
  const amount = document.getElementById("amount").value;
  const username = localStorage.getItem("username");
  if (!username) return alert("Bạn chưa đăng nhập!");

  if (!amount || amount <= 0) {
    alert("Vui lòng nhập số tiền hợp lệ.");
    return;
  }

  // Dừng bất kỳ interval kiểm tra nào đang chạy
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }

  const defaultNote = localStorage.getItem("paymentNote") || generateRandomNote();
  const encodedName = encodeURIComponent(ACCOUNT_NAME);
  const imageUrl = `https://img.vietqr.io/image/${BANK_CODE}-${ACCOUNT_NUMBER}-compact.png?amount=${amount}&addInfo=${defaultNote}&accountName=${encodedName}`;

  document.getElementById("qr-result").innerHTML = `
    <p><strong>Mã QR VietQR:</strong></p>
    <img src="${imageUrl}" alt="VietQR Code">
    <p><strong>Nội dung CK:</strong> ${defaultNote}</p>
    <p><strong>Người nhận:</strong> ${ACCOUNT_NAME}</p>
    <p><strong>Số tiền:</strong> ${formatMoney(amount)} VND</p>
    <p id="payment-status" style="color: orange; font-weight: bold;">⏳ Đang chờ thanh toán...</p>
    <button id="stop-checking" style="background-color: #e74c3c; margin-top: 10px;">Dừng kiểm tra</button>
  `;

  // Bắt đầu kiểm tra giao dịch
  checkIntervalId = setInterval(async () => {
    const isPaid = await checkPaymentStatus(defaultNote, amount);
    if (isPaid) {
      const updated = await updateUserBalance(username, amount);
      if (updated) {
        document.getElementById("payment-status").innerHTML = 
          '✅ Thanh toán thành công! Tiền đã được cộng vào tài khoản.';
        clearInterval(checkIntervalId);
        
        // Cập nhật giao dịch
        await recordTransaction(username, amount, defaultNote);
        
        // Hiển thị số dư mới
        await updateBalanceDisplay();
      }
    }
  }, CHECK_INTERVAL);

  // Thêm sự kiện cho nút dừng kiểm tra
  document.getElementById("stop-checking").addEventListener("click", () => {
    clearInterval(checkIntervalId);
    document.getElementById("payment-status").innerHTML = 
      '❌ Đã dừng kiểm tra. Nếu đã chuyển tiền, vui lòng liên hệ admin.';
  });
}

// Hàm ghi lại giao dịch
async function recordTransaction(username, amount, note) {
  try {
    const transactionData = {
      data: {
        username,
        amount,
        note,
        status: "completed",
        date: new Date().toISOString()
      }
    };
    
    await fetch(SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transactionData)
    });
  } catch (error) {
    console.error("Lỗi khi ghi giao dịch:", error);
  }
}

// Hàm cập nhật hiển thị số dư
async function updateBalanceDisplay() {
  const username = localStorage.getItem("username");
  if (!username) return;
  
  try {
    const response = await fetch(`${SHEET_URL}/search?username=${username}`);
    const users = await response.json();
    
    if (users.length > 0) {
      const balanceElement = document.getElementById("user-balance");
      if (balanceElement) {
        balanceElement.textContent = formatMoney(users[0].balance || 0) + " VND";
      }
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật số dư:", error);
  }
}

// Hàm định dạng tiền tệ
function formatMoney(amount) {
  return parseFloat(amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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
          balance: 0,
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
    updateBalanceDisplay();
  }
});
