# JARVIS Web

JARVIS'in Render üzerinde çalışmak için hazırlanmış tarayıcı sürümü. Mikrofon ve sesli yanıt tarayıcıda çalışır; Gemini anahtarı yalnızca sunucuda tutulur.

## Render ile yayınlama

1. Bu değişiklikleri GitHub'a gönderin.
2. Render'da **New +** → **Blueprint** seçin ve depoyu bağlayın. Depodaki `render.yaml` otomatik algılanır.
3. Oluşan formda `GEMINI_API_KEY` için Gemini API anahtarınızı girin ve yayına alın.

Elle Web Service oluşturacaksanız:

- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn web_app:app --host 0.0.0.0 --port $PORT`
- **Environment Variable:** `GEMINI_API_KEY` = Gemini API anahtarınız

`config/api_keys.json` dosyasını GitHub'a koymayın. Render'da anahtarlar Environment bölümüne eklenmelidir. YouTube kanal raporu kullanacaksanız isteğe bağlı olarak `YOUTUBE_API_KEY` ve `YOUTUBE_CHANNEL_HANDLE` değişkenlerini de ekleyin.

## Yerelde çalıştırma

```bash
python -m pip install -r requirements.txt
GEMINI_API_KEY=anahtariniz uvicorn web_app:app --reload
```

Ardından `http://127.0.0.1:8000` adresini açın.

Mevcut macOS masaüstü uygulamasını yerelde çalıştırmaya devam etmek için `requirements-desktop.txt` kullanın.

## Web sürümünün sınırları

Web sunucusu Mac'inize erişmez: uygulama açma, Apple Takvim/Anımsatıcılar, ekran analizi ve WhatsApp Desktop işlemleri bu sürümde yoktur. Hava durumu, YouTube raporları ve JARVIS belleği desteklenir. Bellek yalnızca açık tarayıcı oturumunda tutulur; ziyaretçiler birbirlerinin bilgilerini göremez.
