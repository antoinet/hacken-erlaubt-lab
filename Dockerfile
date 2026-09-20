# The training environment (no npm dependencies).
#
# One image, three entrypoints: `node server/server.js` runs the web
# application, `node decoys/server.js` the banner services for the
# port-scanning stage, and `node scoreboard/server.js` the flag check and
# presenter dashboard. docker-compose.yml starts all three.
FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY lib ./lib
COPY server ./server
COPY site ./site
COPY decoys ./decoys
COPY scoreboard ./scoreboard

# The scoreboard's data directory, owned by the unprivileged user: a fresh
# named volume inherits these permissions, so the container can write to it.
RUN mkdir -p /data && chown node:node /data
VOLUME /data

ENV PORT=8080
EXPOSE 8080 2222 3306 6379 9999

# Runs unprivileged; the app holds no real data and writes nothing to disk.
USER node
CMD ["node", "server/server.js"]
