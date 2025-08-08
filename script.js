// ===================== CONFIG =====================
const SHEET_URL = "https://sheetdb.io/api/v1/j9sqry5cgir1c";
const BANK_CODE = "ACB";
const ACCOUNT_NUMBER = "43146717";
const ACCOUNT_NAME = "DINH TAN HUY";
const CHECK_INTERVAL = 30000; // 30 giây
let checkIntervalId = null;
let countdownIntervalId = null;

// ===================== FORM SWITCH =====================
function showLogin() {
  document.getElementById("login-form").style.display = "block";
  document.getElementById("register-form").style.display = "none";
}

function showRegister() {
  document.getElementById("login-form").style.display = "none";
  document.getElementById("register-form").style.display = "block";
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

// ===================== LẤY HOẶC TẠO MÃ CÓ HẠN 5 PHÚT =====================
function getOrCreatePaymentNote() {
  const stored = JSON.parse(localStorage.getItem("paymentNoteData"));
  const now = Date.now();

  if (stored && now < stored.expireAt) {
    return stored.note; // Dùng lại nếu chưa hết hạn
  }

  const newNote = generateRandomNote();
  const expireAt = now + 5 * 60 * 1000; // 5 phút
  localStorage.setItem("paymentNoteData", JSON.stringify({
    note: newNote,
    expireAt
  }));
  return newNote;
}

// ===================== LẤY THỜI GIAN CÒN LẠI =====================
function getRemainingTime() {
  const stored = JSON.parse(localStorage.getItem("paymentNoteData"));
  if (!stored) return 0;
  const now = Date.now();
  return Math.max(0, Math.floor((stored.expireAt - now) / 1000));
}

// ===================== QR AUTO GENERATE =====================
function handleAutoGenerateQR() {
  const urlParams = new URLSearchParams(window.location.search);
  const amount = urlParams.get('amount');

  if (amount) {
    const amountInput = document.getElementById('amount');
    if (amountInput) {
      amountInput.value = amount;
      generateQR();
    }
  }
}

// ===================== CHECK PAYMENT =====================
async function checkPaymentStatus(note, amount) {
  const username = localStorage.getItem("username");
  if (!username) return false;

  try {
    const response = await fetch(`${SHEET_URL}/search?username=${username}&note=${note}&status=pending`);
    const transactions = await response.json();

    const matchingTransaction = transactions.find(
      txn => txn.note === note && parseFloat(txn.amount) === parseFloat(amount)
    );

    return matchingTransaction ? matchingTransaction.id : false; // trả về ID nếu tìm thấy
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

  // Dừng interval cũ
  if (checkIntervalId) clearInterval(checkIntervalId);
  if (countdownIntervalId) clearInterval(countdownIntervalId);

  const paymentNote = getOrCreatePaymentNote();
  const remainingSeconds = getRemainingTime();

  // Ghi giao dịch pending vào Sheet
  recordPendingTransaction(username, amount, paymentNote);

  const encodedName = encodeURIComponent(ACCOUNT_NAME);
  const imageUrl = `https://img.vietqr.io/image/${BANK_CODE}-${ACCOUNT_NUMBER}-compact.png?amount=${amount}&addInfo=${paymentNote}&accountName=${encodedName}`;

  document.getElementById("qr-result").innerHTML = `
    <p><strong>Mã QR VietQR:</strong></p>
    <img src="${imageUrl}" alt="VietQR Code">
    <p><strong>Nội dung CK:</strong> ${paymentNote}</p>
    <p><strong>Người nhận:</strong> ${ACCOUNT_NAME}</p>
    <p><strong>Số tiền:</strong> ${formatMoney(amount)} VND</p>
    <p id="countdown-timer" style="font-weight: bold; color: blue;">⏳ Thời gian còn lại: ${formatTime(remainingSeconds)}</p>
    <p id="payment-status" style="color: orange; font-weight: bold;">⏳ Đang chờ thanh toán...</p>
    <button id="stop-checking" style="background-color: #e74c3c; margin-top: 10px;">Dừng kiểm tra</button>
  `;

  // Đếm ngược
  let timeLeft = remainingSeconds;
  countdownIntervalId = setInterval(() => {
    timeLeft--;
    document.getElementById("countdown-timer").textContent =
      `⏳ Thời gian còn lại: ${formatTime(timeLeft)}`;
    if (timeLeft <= 0) {
      clearInterval(countdownIntervalId);
      clearInterval(checkIntervalId);
      localStorage.removeItem("paymentNoteData");
      document.getElementById("payment-status").innerHTML = "❌ Mã đã hết hạn! Tạo mã mới để tiếp tục.";
    }
  }, 1000);

  // Kiểm tra thanh toán
  checkIntervalId = setInterval(async () => {
    const transactionId = await checkPaymentStatus(paymentNote, amount);
    if (transactionId) {
      const updated = await updateUserBalance(username, amount);
      if (updated) {
        await updateTransactionStatus(transactionId, "completed");
        document.getElementById("payment-status").innerHTML =
          '✅ Thanh toán thành công! Tiền đã được cộng vào tài khoản.';
        clearInterval(checkIntervalId);
        clearInterval(countdownIntervalId);
        localStorage.removeItem("paymentNoteData");
        await updateBalanceDisplay();
      }
    }
  }, CHECK_INTERVAL);

  // Nút dừng
  document.getElementById("stop-checking").addEventListener("click", () => {
    clearInterval(checkIntervalId);
    clearInterval(countdownIntervalId);
    document.getElementById("payment-status").innerHTML =
      '❌ Đã dừng kiểm tra. Nếu đã chuyển tiền, vui lòng liên hệ admin.';
  });
}

// ===================== FORMAT TIME =====================
function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// ===================== RECORD TRANSACTION PENDING =====================
async function recordPendingTransaction(username, amount, note) {
  try {
    const pendingData = {
      data: {
        username: username,
        amount: parseFloat(amount),
        note: note,
        status: "pending",
        date: new Date().toISOString()
      }
    };
    await fetch(SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingData)
    });
  } catch (error) {
    console.error("Lỗi khi ghi pending:", error);
  }
}

// ===================== UPDATE TRANSACTION STATUS =====================
async function updateTransactionStatus(rowId, newStatus) {
  try {
    await fetch(`${SHEET_URL}/id/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: { status: newStatus }
      })
    });
  } catch (error) {
    console.error("Lỗi khi update status:", error);
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
