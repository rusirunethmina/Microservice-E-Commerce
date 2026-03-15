import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr

app = FastAPI(title="notification-service", version="1.0.0")


class OrderCompletedEmailRequest(BaseModel):
    to_email: EmailStr
    customer_name: str
    order_id: int
    total_price: float
    completed_at: datetime | None = None


def build_email_body(payload: OrderCompletedEmailRequest) -> str:
    completed_at = payload.completed_at.isoformat() if payload.completed_at else datetime.utcnow().isoformat()
    return (
        f"Hello {payload.customer_name},\n\n"
        f"Your order #{payload.order_id} has been completed successfully.\n"
        f"Total amount: ${payload.total_price:.2f}\n"
        f"Completed at: {completed_at}\n\n"
        "Thank you for shopping with us.\n"
    )


def send_email_via_gmail(payload: OrderCompletedEmailRequest) -> None:
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user)

    if not smtp_user or not smtp_password:
        raise ValueError("SMTP_USER and SMTP_PASSWORD are required")

    print(f"[NotificationService] Sending completion email for order_id={payload.order_id} to={payload.to_email}")

    message = MIMEMultipart()
    message["From"] = from_email
    message["To"] = payload.to_email
    message["Subject"] = f"Order #{payload.order_id} completed"
    message.attach(MIMEText(build_email_body(payload), "plain"))

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


@app.post("/notify/order-completed")
def notify_order_completed(payload: OrderCompletedEmailRequest) -> dict:
    try:
        send_email_via_gmail(payload)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except smtplib.SMTPException as exc:
        raise HTTPException(status_code=502, detail=f"SMTP error: {str(exc)}") from exc

    return {
        "success": True,
        "message": "Order completion email sent",
        "to": payload.to_email,
        "order_id": payload.order_id,
    }
