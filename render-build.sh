#!/usr/bin/env bash
# Render Build Script — runs on every deploy
set -o errexit

npm install
npx prisma generate
npx prisma migrate deploy
npm run build
