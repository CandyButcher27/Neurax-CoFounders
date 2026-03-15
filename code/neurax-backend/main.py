from fastapi import FastAPI
from routes import health, parse_prd

app = FastAPI(
    title="cofounder.ai API",
    description="Backend services powering cofounder.ai",
    version="0.1.0",
)


@app.get("/")
async def root():
    return {
        "service": "cofounder.ai",
        "status": "running",
        "message": "Welcome to the cofounder.ai backend"
    }


# Register routers
def register_routes():
    app.include_router(
        health.router,
        prefix="/health",
        tags=["health"]
    )
    app.include_router(parse_prd.router, tags=["PRD"])


register_routes()