# Grump Factor — GitHub Pages

A zero-build, single-file React app you can host on GitHub Pages. Features:
- Shareable URL with `?level=NN&cups=X&name=Someone`
- Dark/Light mode toggle (persisted)
- Keyboard controls (←/→, 1–5, R)
- Copy/Share link + message templates
- Accessible live region updates

## Quick deploy (no build tools)

1) Create a new GitHub repo (e.g., `grump-factor`) and **upload these files** to the repo root:
   - `index.html`
   - `.nojekyll`

2) Go to **Settings → Pages**  
   - **Build and deployment**: *Deploy from a branch*  
   - **Branch**: `main` • **Folder**: `/ (root)`  
   - Click **Save**.

3) Wait ~1–3 minutes. Your site will be live at:  
   `https://<your-username>.github.io/<repo-name>`

### Notes
- This version uses Tailwind CDN + React UMD + Babel Standalone (so you don’t need Node).  
- If you want the Framer Motion version (with richer animations), ask your assistant for the **Vite + GitHub Actions** project; it keeps the exact React code and builds it automatically on push.
