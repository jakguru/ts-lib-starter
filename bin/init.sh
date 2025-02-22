#!/bin/bash
curl -sL https://raw.githubusercontent.com/jakguru/ts-lib-starter/refs/heads/main/bin/init.cjs -o /tmp/ts-lib-starter-initializer.cjs 
node /tmp/ts-lib-starter-initializer.cjs 
rm /tmp/ts-lib-starter-initializer.cjs
