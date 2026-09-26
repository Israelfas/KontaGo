# Imagen de la web (Railway la arma sola al publicar; ver railway.json).
# Las NEXT_PUBLIC_* y BACKEND_URL_INTERNA quedan fijas al compilar: Railway
# pasa las variables del servicio como ARG.
FROM node:22-slim AS compilar
WORKDIR /app
# El mismo npm que generó el package-lock (el 10 de Node 22 lo rechaza).
RUN npm install -g npm@12
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG BACKEND_URL_INTERNA
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SOPORTE_CORREO
ARG NEXT_PUBLIC_APP_ANDROID_URL
ARG NEXT_PUBLIC_APP_IOS_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=compilar /app/package.json /app/next.config.ts ./
COPY --from=compilar /app/node_modules ./node_modules
COPY --from=compilar /app/public ./public
COPY --from=compilar /app/.next ./.next
USER node
CMD ["node", "node_modules/next/dist/bin/next", "start"]
