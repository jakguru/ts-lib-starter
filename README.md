# Jak Guru's Typescript Library Starter

A starter template which can be used as a quick and easy starter for getting a project up and running.

## Usage

From your command line, run:

```bash
curl -sL https://raw.githubusercontent.com/jakguru/ts-lib-starter/refs/heads/main/bin/init.cjs -o /tmp/ts-lib-starter-initializer.cjs && \
node /tmp/ts-lib-starter-initializer.cjs && \
rm /tmp/ts-lib-starter-initializer.cjs
```

Provide the script with the answers and let it create the folder and initialise the dependancies for you

## Customization

You can search and replace all instances of `@example/lib` within the project, but the main files which should be customized are:

* `./package.json`
* `./vite.config.mts`
