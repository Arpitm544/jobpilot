import base64
import bcrypt
from cryptography.fernet import Fernet
from app.config import settings


def hash_password(password: str) -> str:
    """Hash password using bcrypt directly (safe against passlib 72-byte test bug)"""
    # Truncate to 72 bytes as per bcrypt specification
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash"""
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


# AES-256 Symmetric Encryption via Fernet
def get_fernet_cipher() -> Fernet:
    key = settings.ENCRYPTION_KEY
    if not key or len(key) < 32:
        key = base64.urlsafe_b64encode(settings.SECRET_KEY.ljust(32)[:32].encode())
    else:
        if isinstance(key, str):
            key = key.encode()
    return Fernet(key)


def encrypt_secret(plain_text: str) -> str:
    """Encrypt sensitive credentials/tokens/cookies"""
    if not plain_text:
        return ""
    cipher = get_fernet_cipher()
    return cipher.encrypt(plain_text.encode()).decode()


def decrypt_secret(cipher_text: str) -> str:
    """Decrypt sensitive credentials/tokens/cookies"""
    if not cipher_text:
        return ""
    cipher = get_fernet_cipher()
    return cipher.decrypt(cipher_text.encode()).decode()
