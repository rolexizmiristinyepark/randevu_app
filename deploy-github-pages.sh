#!/bin/bash

# GitHub Pages deployment script

echo "🚀 Building for production..."
npm run build

echo "📦 Deploying to GitHub Pages..."
cd dist

# Git init in dist folder
git init
git add -A
git commit -m "Deploy to GitHub Pages"

# Force push to gh-pages branch
git branch -M gh-pages
git remote add origin https://github.com/KULLANICI_ADINIZ/REPO_ADINIZ.git
git push -f origin gh-pages

echo "✅ Deployment complete!"
echo "📌 Your site will be available at: https://KULLANICI_ADINIZ.github.io/REPO_ADINIZ/"

cd ..
