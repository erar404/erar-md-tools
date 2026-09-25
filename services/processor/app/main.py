from fastapi import FastAPI

from .routers import analyze, click_track, download, mixdown, split, trim

app = FastAPI(title="MD Tools Processor")

app.include_router(download.router)
app.include_router(analyze.router)
app.include_router(trim.router)
app.include_router(click_track.router)
app.include_router(split.router)
app.include_router(mixdown.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
