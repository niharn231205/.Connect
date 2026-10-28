# Frontend

The application is native HTML, CSS and JavaScript, served by `backend/server.js`.
There is no frontend build step in Render. The compiled homepage CSS is committed.

`css/studio.css` defines the approved Career Studio theme and responsive workspace.
`css/style.css` retains legacy component compatibility. Route-specific styles load
before `studio.css`; script-controlled visibility is preserved.

The homepage was designed and approved on Superdesign, then exported into native
markup. It has no dependency on the Superdesign canvas or a runtime Tailwind compiler.
To rebuild its utility stylesheet after editing `index.html` or `css/home.source.css`:

```sh
npx --yes tailwindcss@3.4.17 -i frontend/css/home.source.css -o frontend/css/home.css --content frontend/index.html --minify
```

Run that command from the repository root. See `DESIGN.md` for the visual tokens,
reference observations and interaction principles. Backend resume classification
and scoring APIs remain unchanged by the redesign.
