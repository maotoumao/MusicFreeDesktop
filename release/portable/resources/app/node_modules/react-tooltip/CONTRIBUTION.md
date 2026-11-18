# Contribution

## Running project locally

### ReactTooltip (root)

1. Run `npm install` || `yarn` to install dependencies
2. You can test by: `yarn dev` to run dev mode, or you can run **docs** directly using root folder instead of NPM, for this, please check **docs section**.

### Docs

You still need step 1 from `ReactTooltip (root)` section.
Docs are commited using npm packages, but with this steps, you can use local ReactTooltip package build.

1. In **docs** folder, run `npm install` || `yarn` to install dependencies
2. In **root** folder (parent of docs folder), run `yarn build` to generate a production build (you can use `yarn build --watch` to always generate a new build when a file changes)
3. Change `package.json`:

From this:
```
"react": "18.2.0",
"react-dom": "18.2.0",
"react-tooltip": "5.0.0"
```

To this:
```
"react": "link:../node_modules/react",
"react-dom": "link:../node_modules/react-dom",
"react-tooltip": "link:.."

```

4. Run `yarn start` and open `localhost:3000` to see docs running locally.

OBS: do not commit this change or the docs will broken the deployment and will not be updated.


