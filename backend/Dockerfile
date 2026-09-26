# Imagen del backend (Railway la arma sola al publicar; ver railway.json).
# Dos etapas: la primera compila con todas las dependencias; la final lleva
# solo las de producción y el código compilado.
FROM node:22-slim AS compilar
WORKDIR /app
# El mismo npm que generó el package-lock (el 10 de Node 22 lo rechaza).
RUN npm install -g npm@12
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# Los días de las ventas y del cierre de caja son los de Ecuador.
ENV TZ=America/Guayaquil
COPY --from=compilar /app/package.json ./
COPY --from=compilar /app/node_modules ./node_modules
COPY --from=compilar /app/dist ./dist
USER node
CMD ["node", "dist/main"]
