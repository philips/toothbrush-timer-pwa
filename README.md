# Toothbrush Timer PWA

A simple, static toothbrushing timer designed for mobile phones or tablets.

> Built from handwritten design notes — see [`docs/notes/`](docs/notes/) for
> the original sketches this app was based on.

## Tech stack
- Static HTML + PWA (installable, works offline via a service worker)
- Hosted on GitHub Pages
- No build step, no dependencies

## Basic usage
1. Choose a brushing session length (defaults to **2:00**) using the `-` / `+` buttons.
2. Press **Start** to begin the timer.
3. The app guides you through six segments, splitting the total time evenly:
   - Upper Front
   - Upper Back
   - Upper Top
   - Lower Front
   - Lower Back
   - Lower Top

   Each segment shows the segment name, an illustration of the teeth
   highlighting the current segment, and the time remaining for that section.
4. When all six segments are complete, a finish screen is shown and you can
   start again.

## Running locally
Just serve the folder with any static file server, e.g.:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploying to GitHub Pages
Push this repository to GitHub and enable Pages for the `main` branch
(root folder) in the repository settings. No build step is required.
