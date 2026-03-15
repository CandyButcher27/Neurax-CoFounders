from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pathlib import Path
import shutil
import uuid
from pypdf import PdfReader

from services.prd_parser import parse_prd

router = APIRouter()

TMP_DIR = Path(r"C:\Users\aryan\Documents\Code Stuff\neurax\tmp")
TMP_DIR.mkdir(parents=True, exist_ok=True)


def save_prd_to_tmp_dir(text: str | None = None, file: UploadFile | None = None) -> Path:
    """
    Normalizes input into a .txt file stored in TMP_DIR.
    """

    file_name = f"prd_{uuid.uuid4().hex}.txt"
    save_path = TMP_DIR / file_name

    # Case 1: chat text
    if text:
        with open(save_path, "w", encoding="utf-8") as f:
            f.write(text)
        return save_path

    # Case 2: uploaded file
    if file:
        suffix = Path(file.filename).suffix.lower()

        # TXT upload
        if suffix == ".txt":
            with open(save_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            return save_path

        # PDF upload
        if suffix == ".pdf":
            reader = PdfReader(file.file)
            extracted_text = ""

            for page in reader.pages:
                extracted_text += page.extract_text() or ""

            with open(save_path, "w", encoding="utf-8") as f:
                f.write(extracted_text)

            return save_path

        raise HTTPException(
            status_code=400,
            detail="Only .txt or .pdf files are supported."
        )

    raise HTTPException(
        status_code=400,
        detail="No PRD content provided."
    )


@router.post("/parse-prd")
async def parse_prd_route(
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
):
    if not text and not file:
        raise HTTPException(
            status_code=400,
            detail="Provide either PRD text or a file upload."
        )

    try:
        prd_path = save_prd_to_tmp_dir(text=text, file=file)
        return parse_prd(file_path=str(prd_path))

    except HTTPException:
        raise

    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Uploaded file could not be processed."
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"PRD parsing failed: {str(e)}"
        )