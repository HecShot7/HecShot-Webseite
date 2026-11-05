# HecShot Visuals – Website

One-page portfolio site with a 3D scroll animation (Three.js particle morph, GSAP ScrollTrigger, Lenis smooth scroll).
It works on phones and desktops. No build step is needed: these are static files only.

## Run locally
```bash
python3 -m http.server 8080
# then open http://localhost:8080
```
(Opening the file directly with `file://` does not work, because ES modules need a server.)

## Customize
- **Text:** everything is in `index.html`.
- **Email / socials:** in `index.html`, search for `TODO` (`hallo@hecshot.de` is a placeholder).
- **Impressum / Datenschutz:** the footer links still point to `#`. Required for a German website.
- **3D shapes:** `js/scene.js` (one function per service; colors in `PALETTE`).
- **Position of the 3D object per section:** the `data-x`, `data-y` and `data-scale` attributes on the `<section>`s.

## 3D quality
The glow (bloom) switches off automatically on slow devices. To force it on for testing, use `?hq` in the URL.

## Hosting
Any static hosting works: GitHub Pages, Netlify, Vercel, Cloudflare Pages, or classic webspace (FTP upload).
