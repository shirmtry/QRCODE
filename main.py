from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from vietqr.api import VietQR
import qrcode
import io

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/generate-qr")
async def generate_qr(
    amount: int = Form(...),
):
    # Thông tin cố định (hoặc có thể nhận thêm từ Form)
    bank_id = 'VCB'
    account_no = '0123456789'
    account_name = 'DINH TAN HUY'
    add_info = 'Nap tien'

    # Tạo chuỗi VietQR
    qr = VietQR()
    result = qr.generate(
        bank_id=bank_id,
        account_no=account_no,
        account_name=account_name,
        amount=amount,
        add_info=add_info
    )

    qr_img = qrcode.make(result['data'])
    buf = io.BytesIO()
    qr_img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")
