# Stage 1: Build the React app
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_BACKEND_PORT=3001
ENV VITE_BACKEND_PORT=${VITE_BACKEND_PORT}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
