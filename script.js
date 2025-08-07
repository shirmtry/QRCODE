function generateQR() {
  const bank = document.getElementById("bankCode").value.toLowerCase();
  const account = document.getElementById("accountNumber").value;
  const name = document.getElementById("accountName").value.toUpperCase();
  const amount = document.getElementById("amount").value;
  const note = encodeURIComponent(document.getElementById("note").value || "");

  if (!bank || !account || !name) {
    alert("Vui lòng nhập đủ thông tin tài khoản.");
    return;
  }

  const imageUrl = `https://img.vietqr.io/image/${bank}-${account}-compact.png?amount=${amount}&addInfo=${note}&accountName=${name}`;

  document.getElementById("qr-result").innerHTML = `
    <p>Mã QR VietQR:</p>
    <img src="${imageUrl}" alt="VietQR Code" />
  `;
}
