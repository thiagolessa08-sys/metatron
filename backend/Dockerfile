FROM python:3.11-slim

WORKDIR /app

# ffmpeg: necessário para transcodificar áudios de telefonia (mu-law/a-law/GSM)
# antes de enviar ao Whisper
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x start.sh

CMD ["sh", "start.sh"]
