FROM node:24.14.0-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig*.json ./
COPY src ./src
COPY public ./public
COPY tools ./tools
RUN npm run build

FROM python:3.13.5-slim
WORKDIR /app
COPY server/requirements*.txt ./server/
RUN pip install --no-cache-dir -r server/requirements.txt
COPY server ./server
COPY knowledge ./knowledge
COPY public ./public
COPY --from=frontend /app/dist ./dist
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
