from fastapi import Header, HTTPException, status

from .config import PROCESSOR_SERVICE_TOKEN


async def verify_service_token(authorization: str = Header(default="")) -> None:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or token != PROCESSOR_SERVICE_TOKEN:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Invalid or missing service token"
        )
