# Self-hosted variant of the training app (no npm dependencies).
#
# Used when the scenario must run offline inside a lab VM, or behind a
# non-standard port so that a port-scanning exercise has something to find.
FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY lib ./lib
COPY server ./server
COPY site ./site

ENV PORT=8080
EXPOSE 8080

# Runs unprivileged; the app holds no real data and writes nothing to disk.
USER node
CMD ["node", "server/server.js"]
