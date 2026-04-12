FROM python:3.12-slim AS builder

WORKDIR /build
COPY apps/api/pyproject.toml .

RUN python -m pip install --upgrade pip \
    && python -c "import subprocess, sys, tomllib; deps = tomllib.load(open('pyproject.toml', 'rb'))['project']['dependencies']; subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--prefix=/install', *deps])"

FROM python:3.12-slim AS runtime

WORKDIR /app
ENV PYTHONPATH=/app

COPY --from=builder /install /usr/local
COPY apps/api/ .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

