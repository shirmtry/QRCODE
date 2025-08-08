// ===================== CONFIG =====================
const SHEET_URL = "https://sheetdb.io/api/v1/j9sqry5cgir1c";
const BANK_CODE = "ACB";
const ACCOUNT_NUMBER = "43146717";
const ACCOUNT_NAME = "DINH TAN HUY";
const CHECK_INTERVAL = 30000; // 30 giây kiểm tra một lần
let checkIntervalId = null;

// ===================== FORM SWITCH =====================
function showLogin() {
  document.getElementById("login-form").style.display = "block";
  document.getElementById("register-form").style.display = "none";
}

function showRegister() {
  document.getElementById("login-form").style.display = "none";
  document.getElementById("register-form").style.display = "block";
}

// ===================== QR AUTO GENERATE =====================
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

// ===================== RANDOM NOTE =====================
function generateRandomNote(length = 7) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ===================== CHECK PAYMENT =====================
async function checkPaymentStatus(note, amount) {
  const username = localStorage.getItem("username");
  if (!username) return false;

  try {
    const response = await fetch(`${SHEET_URL}/search?username=${username}&note=${note}`);
    const transactions = await response.json();

    const matchingTransaction = transactions.find(
      txn => txn.note === note && parseFloat(txn.amount) === parseFloat(amount)
    );

    return !!matchingTransaction;
  } catch (error) {
    console.error("Lỗi khi kiểm tra giao dịch:", error);
    return false;
  }
}

// ===================== UPDATE BALANCE =====================
async function updateUserBalance(username, amount) {
  try {
    const userResponse = await fetch(`${SHEET_URL}/search?username=${username}`);
    const users = await userResponse.json();

    if (users.length === 0) return false;

    const user = users[0];
    const currentBalance = parseFloat(user.balance || 0);
    const newBalance = currentBalance + parseFloat(amount);

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

// ===================== GENERATE QR =====================
function generateQR() {
  const amount = document.getElementById("amount").value;
  const username = localStorage.getItem("username");
  if (!username) return alert("Bạn chưa đăng nhập!");

  if (!amount || amount <= 0) {
    alert("Vui lòng nhập số tiền hợp lệ.");
    return;
  }

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

  checkIntervalId = setInterval(async () => {
    const isPaid = await checkPaymentStatus(defaultNote, amount);
    if (isPaid) {
      const updated = await updateUserBalance(username, amount);
      if (updated) {
        document.getElementById("payment-status").innerHTML =
          '✅ Thanh toán thành công! Tiền đã được cộng vào tài khoản.';
        clearInterval(checkIntervalId);

        await recordTransaction(username, amount, defaultNote);
        await updateBalanceDisplay();
      }
    }
  }, CHECK_INTERVAL);

  document.getElementById("stop-checking").addEventListener("click", () => {
    clearInterval(checkIntervalId);
    document.getElementById("payment-status").innerHTML =
      '❌ Đã dừng kiểm tra. Nếu đã chuyển tiền, vui lòng liên hệ admin.';
  });
}

// ===================== RECORD TRANSACTION =====================
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

// ===================== UPDATE BALANCE DISPLAY =====================
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

// ===================== FORMAT MONEY =====================
function formatMoney(amount) {
  return parseFloat(amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// ===================== GET IP =====================
function getIP() {
  return fetch("https://api.ipify.org?format=json")
    .then(res => res.json())
    .then(data => data.ip)
    .catch(() => "unknown");
}

// ===================== REGISTER =====================
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
        showLogin();
      });
    });
}

// ===================== LOGIN =====================
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

// ===================== ON PAGE LOAD =====================
document.addEventListener('DOMContentLoaded', function () {
  if (window.location.pathname.includes('deposit.html')) {
    handleAutoGenerateQR();
    updateBalanceDisplay();
  }
});
