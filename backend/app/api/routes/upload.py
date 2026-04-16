import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User, UserRole
from app.models.operations import UploadBatch, ApprovalWorkflow
from app.models.renewal import RenewalPolicy
from app.schemas import UploadBatchOut
from app.services.ingestion_service import ingest_excel
from app.services.audit_service import log_action
from typing import List

router = APIRouter(prefix="/upload", tags=["Upload"])

ALLOWED_EXTENSIONS = {".xlsx", ".xls"}
MAX_FILE_SIZE_MB = 20


@router.post("", response_model=UploadBatchOut, status_code=201)
async def upload_excel(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{ext}'. Only .xlsx and .xls are accepted."
        )

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, f"batch_{file.filename}")

    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Max allowed: {MAX_FILE_SIZE_MB} MB."
        )

    with open(file_path, "wb") as f:
        f.write(contents)

    batch = UploadBatch(
        filename=file.filename,
        uploaded_by=current_user.id,
        status="PROCESSING",
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    log_action(
        db,
        "FILE_UPLOADED",
        user_id=current_user.id,
        description=f"Uploaded {file.filename}",
        ip_address=request.client.host
    )

    try:
        results = ingest_excel(file_path, db, batch.id, current_user.id)
        batch.total_records = results["total"]
        batch.processed_records = results["processed"]
        batch.failed_records = results["failed"]
        batch.status = "SUCCESS" if not results["errors"] else "PARTIAL"
        batch.error_details = {
            "errors": results["errors"],
            "warnings": results["warnings"],
        }
    except Exception as e:
        batch.status = "FAILED"
        batch.error_details = {"errors": [str(e)]}

    db.commit()
    db.refresh(batch)

    log_action(
        db,
        "INGESTION_COMPLETE",
        user_id=current_user.id,
        event_metadata={
            "batch_id": batch.id,
            "processed": batch.processed_records,
            "failed": batch.failed_records,
        }
    )

    return batch


@router.get("", response_model=List[UploadBatchOut])
async def list_batches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(UploadBatch).order_by(UploadBatch.created_at.desc()).limit(50).all()


@router.get("/{batch_id}", response_model=UploadBatchOut)
async def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    batch = db.query(UploadBatch).filter(UploadBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.delete("/{batch_id}")
async def delete_batch(
    batch_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    batch = db.query(UploadBatch).filter(UploadBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    policy_ids = [
        row[0]
        for row in db.query(RenewalPolicy.id)
        .filter(RenewalPolicy.batch_id == batch_id)
        .all()
    ]

    if policy_ids:
        db.query(ApprovalWorkflow).filter(
            ApprovalWorkflow.policy_id.in_(policy_ids)
        ).delete(synchronize_session=False)

    db.query(RenewalPolicy).filter(
        RenewalPolicy.batch_id == batch_id
    ).delete(synchronize_session=False)

    file_path = os.path.join(settings.UPLOAD_DIR, f"batch_{batch.filename}")
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    db.delete(batch)
    db.commit()

    log_action(
        db,
        "UPLOAD_BATCH_DELETED",
        user_id=current_user.id,
        description=f"Deleted upload batch {batch.filename} (ID: {batch_id})",
        ip_address=request.client.host,
        event_metadata={"batch_id": batch_id},
    )

    return {"message": "Upload deleted successfully"}
