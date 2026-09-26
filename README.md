# Pepcision

Static research-compound storefront with a homepage, contact page, Learn page, FAQ, and seven product landing pages. Assets and licensed fonts are served locally.

## Validate

Run `node scripts/validate.mjs` with Node 22. GitHub Actions runs the same check for pull requests and pushes to main.

## Publish on Render

- Service type: Static Site
- Repository: mikedunlap1/Pepcisioin
- Branch: main
- Build command: `node scripts/validate.mjs`
- Publish directory: `.`
- No environment variables or package installation required.

Render can automatically redeploy after a pull request is merged into main. GitHub Pages is also configured to serve the repository root.

## Site behavior

- BUY NOW and availability buttons open the contact page.
- The contact form opens the customer's email application; no checkout or form backend is connected.
- Product information lives in `product-data.js`.
- The shared bottle photo and logo artwork live in `assets/`.
- Former About, Shop, and Product URLs redirect to the relevant replacement pages.

Font licenses are included under `assets/fonts/`. The previous browser-side Airtable catalog integration has been removed.
