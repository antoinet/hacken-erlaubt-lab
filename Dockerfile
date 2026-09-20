# The training environment (no npm dependencies).
#
# One image, two entrypoints: `node server/server.js` runs the web
# application, `node decoys/server.js` the banner services for the
# port-scanning stage. docker-compose.yml starts both.
FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY lib ./lib
COPY server ./server
COPY site ./site
COPY decoys ./decoys

ENV PORT=8080
EXPOSE 8080 2222 3306 6379 9999

# Runs unprivileged; the app holds no real data and writes nothing to disk.
USER node
CMD ["node", "server/server.js"]
