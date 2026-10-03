import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    def send_application_notification(self, user_email: str, job_title: str, company_name: str, application_id: str):
        subject = f"JobPilot: Application Submitted for {job_title} at {company_name}"
        body = f"""
Hello,

Your autonomous agent JobPilot has successfully applied for the following position:

Job Title: {job_title}
Company: {company_name}
Application ID: {application_id}

You can review your application pipeline in the JobPilot dashboard.

Best regards,
JobPilot Autonomous Agent
"""

        if not settings.SMTP_HOST:
            logger.info(f"[MOCK EMAIL] To: {user_email}, Subject: {subject}\nBody: {body}")
            return

        try:
            msg = MIMEMultipart()
            msg['From'] = settings.SMTP_FROM_EMAIL
            msg['To'] = user_email
            msg['Subject'] = subject

            msg.attach(MIMEText(body, 'plain'))

            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.starttls()
            
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                
            server.send_message(msg)
            server.quit()
            logger.info(f"Successfully sent application notification email to {user_email}")
        except Exception as e:
            logger.error(f"Failed to send email notification to {user_email}: {e}")


email_service = EmailService()
