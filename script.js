const SHEET_API = "https://sheetdb.io/api/v1/j9sqry5cgir1c";
const BANK_CODE = "ACB";
const ACCOUNT_NUMBER = "43146717";
const ACCOUNT_NAME = "DINH TAN HUY";

function getIP() {
  return fetch("https://api.ipify.org?format=json")
    .then(res => res.json())
    .then(data => data.ip)
    .catch(() => "unknown");
}

function registerUser() {
  const username = document.getElementById("register-username").value;
  const password = document.getElementById("register-password").value;

  fetch(`${SHEET_API}/search?username=${username}`)
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
      fetch(SHEET_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData)
      }).then(() => {
        alert("Đăng ký thành công!");
      });
    });
}

function loginUser() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  fetch(`${SHEET_API}/search?username=${username}&password=${password}`)
    .then(res => res.json())
    .then(users => {
      if (users.length === 0) return alert("Sai thông tin đăng nhập!");
      localStorage.setItem("username", username);
      alert("Đăng nhập thành công!");
      window.location.href = "deposit.html";
    });
}

function generateRandomNote(length = 7) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateQR() {
  const amount = document.getElementById("amount").value;
  const username = localStorage.getItem("username");
  if (!username) return alert("Bạn chưa đăng nhập!");

  if (!amount || amount <= 0) {
    alert("Vui lòng nhập số tiền hợp lệ.");
    return;
  }

  const note = generateRandomNote();
  const encodedName = encodeURIComponent(ACCOUNT_NAME);
  const imageUrl = `https://img.vietqr.io/image/${BANK_CODE}-${ACCOUNT_NUMBER}-compact.png?amount=${amount}&addInfo=${note}&accountName=${encodedName}`;

  document.getElementById("qr-result").innerHTML = `
    <p><strong>Mã QR VietQR:</strong></p>
    <img src="${imageUrl}" alt="VietQR Code" />
    <p><strong>Nội dung CK:</strong> ${note}</p>
    <p><strong>Người nhận:</strong> ${ACCOUNT_NAME}</p>
    <p style="color: green; font-weight: bold;">✅ Đã tạo mã chuyển khoản thành công!</p>
  `;

  // Ghi log nạp vào sheet (cộng dồn)
  fetch(`${SHEET_API}/search?username=${username}`)
    .then(res => res.json())
    .then(users => {
      if (users.length === 0) return;
      const id = users[0].id;
      const currentTotal = parseFloat(users[0].total_nap || 0);
      const updateData = {
        data: { total_nap: currentTotal + parseFloat(amount) }
      };
      fetch(`${SHEET_API}/id/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData)
      });
    });
}
