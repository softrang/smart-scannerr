# A3 Smart Scanner

Mobile-camera document scanner web app. Supports A3/A4 PDF, JPG export, multi-page PDF, printing, and OpenCV.js quadrilateral auto-crop (best effort).

## Run locally
- Open the folder in VS Code.
- Start a local server (camera access generally requires HTTPS or localhost), e.g. `python -m http.server 8000`.
- Visit `http://localhost:8000`.
- Allow camera permission. On a phone, use a secure HTTPS deployment.

## Deploy with GitHub + Netlify
1. Create a GitHub repository, e.g. `a3-smart-scanner`.
2. Upload `index.html`, `style.css`, `app.js`, and this README to the repository root.
3. In Netlify choose **Add new site → Import an existing project** and connect GitHub.
4. Choose the repository. Build command: leave blank. Publish directory: `.` (repository root).
5. Deploy. Open the Netlify HTTPS URL on your phone and allow camera access.

## Notes
- Processing happens in the browser. Camera image is not uploaded to a backend.
- OpenCV.js and jsPDF are loaded from CDNs, so internet is needed when opening the app.
- Auto crop is heuristic contour detection. If the page edges are unclear, it falls back to the original captured image.
- A3 page is 297 × 420 mm; results depend on camera resolution, lighting, focus, and distance.
- The app uses browser print dialog. Exact print scale and paper size depend on the printer and print settings.
