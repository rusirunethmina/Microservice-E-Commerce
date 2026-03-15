import os
import smtplib
import time
import uuid
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
import json

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr

app = FastAPI(title="notification-service", version="1.0.0")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname.lower(),
            "service": "notification-service",
            "environment": os.getenv("ENV", "development"),
            "message": record.getMessage(),
        }

        for field in ("request_id", "method", "path", "status_code", "duration_ms", "order_id", "user_id", "recipient"):
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload)


logger = logging.getLogger("notification-service")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
logger.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
logger.propagate = False


class OrderCompletedEmailRequest(BaseModel):
    to_email: EmailStr
    customer_name: str
    order_id: int
    total_price: float
    completed_at: datetime | None = None


def build_email_body(payload: OrderCompletedEmailRequest) -> str:
    completed_at = (
        payload.completed_at.strftime("%B %d, %Y at %I:%M %p")
        if payload.completed_at
        else datetime.utcnow().strftime("%B %d, %Y at %I:%M %p")
    )
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:36px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;letter-spacing:0.5px;">Order Confirmed</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;font-size:16px;color:#333333;line-height:1.6;">
                Hi <strong>{payload.customer_name}</strong>,
              </p>
              <p style="margin:0 0 28px;font-size:16px;color:#555555;line-height:1.6;">
                Great news! Your order has been completed successfully. Here are the details:
              </p>
              <!-- Order Details Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fc;border-radius:8px;border:1px solid #e8eaef;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e8eaef;">
                          <span style="font-size:13px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;">Order Number</span><br>
                          <span style="font-size:18px;color:#333333;font-weight:600;">#{payload.order_id}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e8eaef;">
                          <span style="font-size:13px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;">Total Amount</span><br>
                          <span style="font-size:22px;color:#667eea;font-weight:700;">${payload.total_price:.2f}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;">
                          <span style="font-size:13px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;">Completed On</span><br>
                          <span style="font-size:15px;color:#333333;font-weight:500;">{completed_at}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:15px;color:#555555;line-height:1.6;">
                If you have any questions about your order, feel free to reach out to our support team.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f9fc;padding:24px 40px;border-top:1px solid #e8eaef;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;color:#999999;">
                Thank you for shopping with us!
              </p>
              <p style="margin:0;font-size:12px;color:#bbbbbb;">
                &copy; {datetime.utcnow().year} E-Commerce Store. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def send_email_via_gmail(payload: OrderCompletedEmailRequest) -> None:
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user)

    if not smtp_user or not smtp_password:
        raise ValueError("SMTP_USER and SMTP_PASSWORD are required")

    logger.info(
        "notification.sending_email",
        extra={"order_id": payload.order_id, "recipient": payload.to_email},
    )

    message = MIMEMultipart()
    message["From"] = from_email
    message["To"] = payload.to_email
    message["Subject"] = f"Order #{payload.order_id} completed"
    message.attach(MIMEText(build_email_body(payload), "html"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(from_email, payload.to_email, message.as_string())


@app.get("/health")
def health() -> dict:
    return {
        "success": True,
        "service": "notification-service",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    start_time = time.perf_counter()

    logger.info(
        "request.started",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
        },
    )

    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "request.failed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
            },
        )
        raise

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
    response.headers["x-request-id"] = request_id
    logger.info(
        "request.completed",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    request_id = request.headers.get("x-request-id")
    logger.warning(
        "request.http_error",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": exc.status_code,
        },
    )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.post("/notify/order-completed")
def notify_order_completed(payload: OrderCompletedEmailRequest) -> dict:
    try:
        send_email_via_gmail(payload)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except smtplib.SMTPException as exc:
        raise HTTPException(status_code=502, detail=f"SMTP error: {str(exc)}") from exc

    logger.info(
        "notification.sent",
        extra={"order_id": payload.order_id, "recipient": payload.to_email},
    )

    return {
        "success": True,
        "message": "Order completion email sent",
        "to": payload.to_email,
        "order_id": payload.order_id,
    }
