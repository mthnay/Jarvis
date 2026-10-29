"""Render-compatible web edition of JARVIS.

The browser owns microphone access and speech playback.  This process only
handles the UI, Gemini requests, and cloud-safe tools; it never exposes the
Gemini key to the client.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import logging
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types

from actions.weather import get_weather_summary
from actions.youtube_stats import get_youtube_channel_report

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
MAX_HISTORY = 16

app = FastAPI(title="JARVIS Web", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
logger = logging.getLogger("jarvis.web")


TOOLS = [
    types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="get_weather",
                description="Bir şehir için güncel hava durumu özetini getirir.",
                parameters_json_schema={
                    "type": "object",
                    "properties": {"location": {"type": "string", "description": "Şehir veya konum"}},
                },
            ),
            types.FunctionDeclaration(
                name="get_youtube_channel_report",
                description="YouTube kanalının herkese açık istatistiklerini ve son videolarını raporlar.",
                parameters_json_schema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "handle": {"type": "string"},
                        "video_limit": {"type": "integer", "minimum": 1, "maximum": 10},
                    },
                    "required": ["query"],
                },
            ),
            types.FunctionDeclaration(
                name="save_memory",
                description="Kullanıcının açıkça hatırlamanı istediği kalıcı bilgiyi kaydeder.",
                parameters_json_schema={
                    "type": "object",
                    "properties": {
                        "category": {"type": "string", "enum": ["identity", "preferences", "projects", "notes"]},
                        "key": {"type": "string"},
                        "value": {"type": "string"},
                    },
                    "required": ["category", "key", "value"],
                },
            ),
            types.FunctionDeclaration(
                name="delete_memory",
                description="Kullanıcının açıkça silmeni istediği bellek kaydını siler.",
                parameters_json_schema={
                    "type": "object",
                    "properties": {
                        "category": {"type": "string"},
                        "key": {"type": "string"},
                        "match_text": {"type": "string"},
                    },
                },
            ),
        ]
    )
]


def api_key() -> str:
    """Prefer Render environment variables; local config remains a fallback."""
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if key:
        return key
    try:
        from app_config import get_app_config_value
        return str(get_app_config_value("gemini_api_key", "") or "").strip()
    except Exception:
        return ""


def format_session_memory(memory: dict[str, dict[str, str]]) -> str:
    if not memory:
        return ""
    rows = ["[BU TARAYICI OTURUMUNDA HATIRLANANLAR]"]
    for category, values in memory.items():
        for key, value in values.items():
            rows.append(f"{category}/{key}: {value}")
    return "\n".join(rows)


def system_instruction(session_memory: dict[str, dict[str, str]]) -> str:
    now = dt.datetime.now().astimezone().strftime("%d %B %Y, %H:%M")
    return "\n\n".join(part for part in [
        f"Sen JARVIS'sin. Tarih ve saat: {now}.",
        "Türkçe, samimi, kısa ve yardımcı yanıt ver. Web tabanlı bir asistansın.",
        "Yalnızca tanımlı araçları kullan. Bilgisayarda uygulama açamaz, Apple Takvim/Anımsatıcılarına erişemez, WhatsApp mesajı gönderemez veya ekran göremezsin; bu isteklerde bunu netçe açıkla.",
        format_session_memory(session_memory),
    ] if part)


async def run_tool(name: str, args: dict[str, Any], session_memory: dict[str, dict[str, str]]) -> str:
    if name == "get_weather":
        return await asyncio.to_thread(get_weather_summary, str(args.get("location") or ""))
    if name == "get_youtube_channel_report":
        return await asyncio.to_thread(
            get_youtube_channel_report,
            str(args.get("query") or "overview"),
            str(args.get("handle") or ""),
            int(args.get("video_limit") or 6),
        )
    if name == "save_memory":
        category, key, value = (str(args.get(field) or "").strip() for field in ("category", "key", "value"))
        if not (category and key and value):
            return "Kayıt için kategori, anahtar ve değer gerekli."
        session_memory.setdefault(category, {})[key] = value
        return "Bilgi bu tarayıcı oturumunda hatırlandı."
    if name == "delete_memory":
        category, key = str(args.get("category") or "").strip(), str(args.get("key") or "").strip()
        if category and key and key in session_memory.get(category, {}):
            del session_memory[category][key]
            if not session_memory[category]:
                del session_memory[category]
            return "Bilgi bu oturumun hafızasından silindi."
        return "Bu oturumda silinecek eşleşen bir bilgi bulamadım."
    return "Bu araç web sürümünde kullanılamıyor."


def response_text(response: Any) -> str:
    try:
        return str(response.text or "").strip()
    except (AttributeError, ValueError):
        return ""


async def answer(message: str, history: list[types.Content], session_memory: dict[str, dict[str, str]]) -> tuple[str, list[types.Content]]:
    key = api_key()
    if not key:
        raise RuntimeError("GEMINI_API_KEY ortam değişkeni ayarlanmamış.")
    client = genai.Client(api_key=key)
    contents = [*history[-MAX_HISTORY:], types.Content(role="user", parts=[types.Part(text=message)])]
    config = types.GenerateContentConfig(
        system_instruction=system_instruction(session_memory),
        tools=TOOLS,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )

    # A bounded tool loop prevents a malformed model response from holding a web request forever.
    for _ in range(4):
        response = await asyncio.to_thread(client.models.generate_content, model=MODEL, contents=contents, config=config)
        candidate = response.candidates[0].content
        contents.append(candidate)
        calls = getattr(response, "function_calls", None) or []
        if not calls:
            return response_text(response) or "Şu an yanıt oluşturamadım.", contents[-MAX_HISTORY:]

        responses = []
        for call in calls:
            result = await run_tool(call.name, dict(call.args or {}), session_memory)
            responses.append(types.Part.from_function_response(name=call.name, response={"result": result}))
        contents.append(types.Content(role="tool", parts=responses))

    return "İşlemi tamamlamak için çok fazla araç çağrısı oluştu. Lütfen isteğini yeniden ifade et.", contents[-MAX_HISTORY:]


@app.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "model": MODEL}


@app.websocket("/ws")
async def chat(websocket: WebSocket) -> None:
    await websocket.accept()
    history: list[types.Content] = []
    session_memory: dict[str, dict[str, str]] = {}
    try:
        while True:
            payload = await websocket.receive_json()
            message = str(payload.get("message") or "").strip()
            if not message:
                continue
            if len(message) > 8_000:
                await websocket.send_json({"type": "error", "message": "Mesaj en fazla 8.000 karakter olabilir."})
                continue
            await websocket.send_json({"type": "status", "message": "Düşünüyorum..."})
            try:
                reply, history = await answer(message, history, session_memory)
                await websocket.send_json({"type": "reply", "message": reply})
            except Exception as exc:
                logger.exception("JARVIS request failed")
                message = "JARVIS şu an yanıt veremiyor. API anahtarını ve servis günlüklerini kontrol edip yeniden deneyin."
                if "GEMINI_API_KEY" in str(exc):
                    message = "JARVIS yapılandırılmamış: Render Environment bölümünde GEMINI_API_KEY ekleyin."
                await websocket.send_json({"type": "error", "message": message})
    except WebSocketDisconnect:
        return
