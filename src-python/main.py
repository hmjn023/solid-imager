from contextlib import asynccontextmanager
from typing import Dict, List, Tuple, Any, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Body
from pydantic import BaseModel
from imgutils.tagging import get_pixai_tags
from imgutils.metrics import ccip_extract_feature, ccip_difference
import numpy as np
from PIL import Image
import io
import logging
import os

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

class TaggingResponse(BaseModel):
    general: Dict[str, float]
    character: Dict[str, float]
    ips: List[str]
    ips_mapping: Dict[str, List[str]]

class CCIPFeatureResponse(BaseModel):
    feature: List[float]

class CCIPDifferenceRequest(BaseModel):
    feature1: List[float]
    feature2: List[float]

class CCIPDifferenceResponse(BaseModel):
    difference: float

class CCIPBatchDifferenceRequest(BaseModel):
    queries: List[List[float]]
    targets: List[List[float]]

class CCIPBatchDifferenceResponse(BaseModel):
    differences: List[List[float]]

class PathRequest(BaseModel):
    path: str

@app.get("/health")
def health_check():
    return {"status": "ok", "models_warmed_up": MODELS_WARMED_UP}

def load_image(file: Optional[UploadFile], path: Optional[str]) -> Image.Image:
    if file:
        contents = file.file.read()
        return Image.open(io.BytesIO(contents)).convert("RGB")
    elif path:
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail=f"File not found: {path}")
        return Image.open(path).convert("RGB")
    else:
        raise HTTPException(status_code=400, detail="Either file or path must be provided")

@app.post("/tag", response_model=TaggingResponse)
async def tag_image(
    file: Optional[UploadFile] = File(None),
    path: Optional[str] = Form(None)
):
    try:
        image = load_image(file, path)
        
        # Run tagging
        # fmt=('general', 'character', 'ips', 'ips_mapping')
        general, character, ips, ips_mapping = get_pixai_tags(
            image, 
            fmt=('general', 'character', 'ips', 'ips_mapping')
        )
        
        return {
            "general": general,
            "character": character,
            "ips": ips,
            "ips_mapping": ips_mapping
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing tagging request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ccip/feature", response_model=CCIPFeatureResponse)
async def extract_ccip_feature(
    file: Optional[UploadFile] = File(None),
    path: Optional[str] = Form(None)
):
    try:
        image = load_image(file, path)
        
        feature = ccip_extract_feature(image)
        # feature is a numpy array, convert to list
        return {"feature": feature.tolist()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing CCIP feature request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ccip/difference", response_model=CCIPDifferenceResponse)
async def calculate_ccip_difference(request: CCIPDifferenceRequest):
    try:
        diff = ccip_difference(request.feature1, request.feature2)
        return {"difference": float(diff)}
    except Exception as e:
        logger.error(f"Error processing CCIP difference request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ccip/batch_difference", response_model=CCIPBatchDifferenceResponse)
async def calculate_ccip_batch_difference(request: CCIPBatchDifferenceRequest):
    try:
        if not request.queries or not request.targets:
            return {"differences": []}

        queries = np.array(request.queries)
        targets = np.array(request.targets)

        # Optimized matrix calculation for Euclidean distance:
        # dist(a, b) = sqrt(|a|^2 + |b|^2 - 2 * a . b)

        q_sq = np.sum(queries**2, axis=1, keepdims=True)
        t_sq = np.sum(targets**2, axis=1, keepdims=False)

        # Matrix multiplication for the 2*a.b part
        dot_product = np.dot(queries, targets.T)

        dists_sq = q_sq + t_sq - 2 * dot_product

        # Avoid negative values from precision errors
        dists = np.sqrt(np.maximum(dists_sq, 0.0))

        return {"differences": dists.tolist()}
    except Exception as e:
        logger.error(f"Error processing CCIP batch difference request: {e}")
        raise HTTPException(status_code=500, detail=str(e))
