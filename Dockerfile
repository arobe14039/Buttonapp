# Stage 1: Build the React app
FROM node:16-alpine as build

WORKDIR /app

# Copy dependency files
COPY package.json .
COPY package-lock.json .
RUN npm install

# Copy the rest of the code
COPY . .

# Build the React app (this will use homepage="." from package.json)
RUN npm run build

# Stage 2: Serve the app with Nginx
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
