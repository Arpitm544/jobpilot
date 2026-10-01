import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.user import GUID, utc_now


class JobPreference(Base):
    __tablename__ = "job_preferences"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Search preferences
    target_roles = Column(JSON, default=list, nullable=False)        # ["Frontend Developer", "Full Stack Engineer"]
    experience_level = Column(String(50), default="Junior", nullable=False) # "Intern", "Fresher", "Junior", "Mid", "Senior"
    locations = Column(JSON, default=list, nullable=False)           # ["Remote", "Bengaluru", "New York"]
    workplace_type = Column(String(50), default="Any", nullable=False) # "Remote", "Hybrid", "Onsite", "Any"
    job_type = Column(String(50), default="Full-time", nullable=False) # "Full-time", "Internship", "Contract"
    min_salary = Column(Integer, default=0, nullable=False)          # In annual currency units or monthly stipend
    
    # Discovery filters & blacklists
    company_blacklist = Column(JSON, default=list, nullable=False)   # ["Company A", "Company B"]
    include_keywords = Column(JSON, default=list, nullable=False)    # ["React", "Python", "FastAPI"]
    exclude_keywords = Column(JSON, default=list, nullable=False)    # ["Senior Staff", "10+ years"]
    
    # Automation controls
    apply_mode = Column(String(50), default="review_then_apply", nullable=False) # "review_then_apply", "auto_with_cap", "full_auto"
    daily_cap = Column(Integer, default=20, nullable=False)
    match_threshold = Column(Integer, default=70, nullable=False)     # 0-100 score threshold
    kill_switch = Column(Boolean, default=False, nullable=False)     # Emergency stop for all automated jobs
    
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    # Relationship
    user = relationship("User", back_populates="job_preferences")
