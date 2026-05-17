import asyncio
import base64
import io
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Union

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from imgutils.metrics import ccip_difference, ccip_extract_feature
from imgutils.tagging import get_pixai_tags
from pydantic import BaseModel
from PIL import Image

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model warm-up state
MODELS_WARMED_UP = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager to handle startup and shutdown events.
    We use this to warm up the models.
    """
    global MODELS_WARMED_UP
    logger.info("Starting up AI Service...")

    try:
        # Warm up PixAI tagging model
        logger.info("Warming up PixAI tagging model...")
        # Create a small dummy image for warm-up
        dummy_image = Image.new('RGB', (448, 448), color='white')
        get_pixai_tags(dummy_image)

        # Warm up CCIP model
        logger.info("Warming up CCIP model...")
        ccip_extract_feature(dummy_image)

        MODELS_WARMED_UP = True
        logger.info("All models warmed up successfully!")
    except Exception as e:
        logger.error(f"Error during model warm-up: {e}")
        # We don't raise here to allow the service to start even if warm-up fails,
        # but requests might be slower or fail later.

    yield

    logger.info("Shutting down AI Service...")


app = FastAPI(lifespan=lifespan)


# ─── Response Models ───────────────────────────────────────────────────────────

class TaggingResponse(BaseModel):
    general: Dict[str, float]
    character: Dict[str, float]
    ips: List[str]
    ips_mapping: Dict[str, List[str]]


class CCIPFeatureResponse(BaseModel):
    feature: Union[str, List[float]]


class CCIPBatchFeatureItem(BaseModel):
    """Per-file result for batch CCIP feature extraction."""
    feature: Optional[Union[str, List[float]]] = None
    error: Optional[str] = None


class CCIPBatchFeatureResponse(BaseModel):
    features: List[CCIPBatchFeatureItem]


class CCIPDifferenceRequest(BaseModel):
    feature1: List[float]
    feature2: List[float]


class CCIPDifferenceResponse(BaseModel):
    difference: float


class SimilarityRequest(BaseModel):
    query_feature: List[float]
    candidates: List[List[float]]
    top_k: Optional[int] = None


class SimilarityResponse(BaseModel):
    results: List[Dict[str, Any]]


class TaggingBatchItem(BaseModel):
    """Per-file result for batch tagging."""
    result: Optional[TaggingResponse] = None
    error: Optional[str] = None


class PathRequest(BaseModel):
    path: str


# ─── Helpers ───────────────────────────────────────────────────────────────────

async def load_image(file: Optional[UploadFile], path: Optional[str]) -> Image.Image:
    if file:
        contents = await file.read()
        return await asyncio.to_thread(
            lambda: Image.open(io.BytesIO(contents)).convert("RGB")
        )
    elif path:
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail=f"File not found: {path}")
        return await asyncio.to_thread(lambda: Image.open(path).convert("RGB"))
    else:
        raise HTTPException(status_code=400, detail="Either file or path must be provided")


def encode_feature(feature: np.ndarray, encoding: str) -> Any:
    """Encode a feature vector to the requested format."""
    if encoding == "base64":
        return base64.b64encode(feature.astype(np.float32).tobytes()).decode("ascii")
    return feature.tolist()


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "models_warmed_up": MODELS_WARMED_UP}


@app.post("/tag", response_model=TaggingResponse)
async def tag_image(
    file: Optional[UploadFile] = File(None),
    path: Optional[str] = Form(None),
):
    try:
        image = await load_image(file, path)

        # Run tagging offloaded to thread pool (CPU-bound)
        general, character, ips, ips_mapping = await asyncio.to_thread(
            get_pixai_tags,
            image,
            fmt=('general', 'character', 'ips', 'ips_mapping'),
        )

        return {
            "general": general,
            "character": character,
            "ips": ips,
            "ips_mapping": ips_mapping,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing tagging request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tag/batch", response_model=List[TaggingBatchItem])
async def tag_image_batch(
    files: List[UploadFile] = File(...),
):
    """Batch tagging: process multiple images and return tags for each."""
    async def process_one(f: UploadFile) -> TaggingBatchItem:
        try:
            image = await load_image(f, None)
            # Offload CPU-bound tagging to thread pool
            general, character, ips, ips_mapping = await asyncio.to_thread(
                get_pixai_tags,
                image,
                fmt=('general', 'character', 'ips', 'ips_mapping'),
            )
            return TaggingBatchItem(
                result=TaggingResponse(
                    general=general,
                    character=character,
                    ips=ips,
                    ips_mapping=ips_mapping,
                )
            )
        except Exception as e:
            logger.error(f"Error processing file {f.filename}: {e}")
            return TaggingBatchItem(error=str(e))

    # Load and process all images concurrently
    results = await asyncio.gather(*[process_one(f) for f in files])
    return list(results)


@app.post("/ccip/feature", response_model=CCIPFeatureResponse)
async def extract_ccip_feature(
    file: Optional[UploadFile] = File(None),
    path: Optional[str] = Form(None),
    encoding: str = Query("json", description="Response encoding: 'json' (list) or 'base64'"),
):
    try:
        image = await load_image(file, path)
        # Offload CPU-bound feature extraction to thread pool
        feature = await asyncio.to_thread(ccip_extract_feature, image)
        return {"feature": encode_feature(feature, encoding)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing CCIP feature request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ccip/feature/batch", response_model=CCIPBatchFeatureResponse)
async def extract_ccip_feature_batch(
    files: List[UploadFile] = File(...),
    encoding: str = Query("json", description="Response encoding: 'json' (list) or 'base64'"),
):
    """Batch CCIP feature extraction: return a list of feature vectors."""
    async def process_one(f: UploadFile) -> CCIPBatchFeatureItem:
        try:
            image = await load_image(f, None)
            # Offload CPU-bound feature extraction to thread pool
            feature = await asyncio.to_thread(ccip_extract_feature, image)
            return CCIPBatchFeatureItem(feature=encode_feature(feature, encoding))
        except Exception as e:
            logger.error(f"Error processing file {f.filename}: {e}")
            return CCIPBatchFeatureItem(error=str(e))

    # Load and process all images concurrently
    items = await asyncio.gather(*[process_one(f) for f in files])
    return {"features": list(items)}


@app.post("/ccip/similarity", response_model=SimilarityResponse)
async def calculate_similarity(request: SimilarityRequest):
    """Compute top-k closest candidates to a query feature vector."""
    try:
        query = np.array(request.query_feature, dtype=np.float32)
        candidates = [
            np.array(c, dtype=np.float32) for c in request.candidates
        ]

        # Compute differences and sort
        scored: List[Dict[str, Any]] = []
        for idx, cand in enumerate(candidates):
            diff = float(ccip_difference(query, cand))
            scored.append({"index": idx, "difference": diff})

        scored.sort(key=lambda x: x["difference"])

        if request.top_k is not None and request.top_k > 0:
            scored = scored[: request.top_k]

        return {"results": scored}
    except Exception as e:
        logger.error(f"Error processing similarity request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ccip/difference", response_model=CCIPDifferenceResponse)
async def calculate_ccip_difference(request: CCIPDifferenceRequest):
    try:
        diff = ccip_difference(request.feature1, request.feature2)
        return {"difference": float(diff)}
    except Exception as e:
        logger.error(f"Error processing CCIP difference request: {e}")
        raise HTTPException(status_code=500, detail=str(e))
